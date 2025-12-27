package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/AaronDennis07/electrum/internals/cache"
	"github.com/AaronDennis07/electrum/internals/database"
	"github.com/AaronDennis07/electrum/internals/models"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

// Operation timeouts for resilience
const (
	redisTimeout = 5 * time.Second
	dbTimeout    = 10 * time.Second
)

type Session struct {
	Courses  map[string]string
	Students map[string]string
}
type SessionRequest struct {
	Session models.Session `json:"session"`
}
type CourseRequest struct {
	Name       string `json:"name"`
	Code       string `json:"code"`
	Department string `json:"department"`
}

// Helper to get session ID string for Redis keys
func getSessionKey(sessionID uint) string {
	return fmt.Sprintf("session:%d", sessionID)
}

// getRedisContext returns a context with timeout for Redis operations
func getRedisContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), redisTimeout)
}

// getDBContext returns a context with timeout for DB operations
func getDBContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), dbTimeout)
}

func CreateSession(c *fiber.Ctx) error {
	db := database.DB.Db

	uploadedFile, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "error in uploading file",
			"err":     err.Error(),
		})
	}
	students, CourseData, err := parseExcel(uploadedFile)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "error in parsing file",
			"err":     err.Error(),
		})
	}

	request := new(SessionRequest)
	re := c.FormValue("data")
	err = json.Unmarshal([]byte(re), &request)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid data received",
			"err":     err.Error(),
		})
	}

	// Adding courses
	for _, reqCourse := range CourseData {
		var department models.Department
		err := db.Where("name=?", reqCourse.Department).First(&department).Error
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
				"message": "error in finding department in db",
				"err":     err.Error(),
			})
		}
		course := models.Course{
			Name:       reqCourse.Name,
			Code:       reqCourse.Code,
			Seats:      &reqCourse.Seats,
			Department: department,
		}
		err = db.Create(&course).Error
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
				"message": "error in creating course in db",
				"err":     err.Error(),
			})
		}
		request.Session.Courses = append(request.Session.Courses, course)
	}

	// Creating session
	status := "upcoming"
	request.Session.Status = &status
	err = db.Create(&request.Session).Error
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "error in creating session in db",
			"err":     err.Error(),
		})
	}

	// Checking if students exist
	var notFound []string = []string{}
	for _, usn := range students {
		var student models.Student
		err = db.Where("usn=?", usn).First(&student).Error
		if err != nil {
			notFound = append(notFound, usn)
			continue
		}
		err = db.Create(&models.Enrollment{
			StudentID: &usn,
			SessionID: &request.Session.ID,
		}).Error
		if err != nil {
			log.Println("creating enrollment: ", err)
		}
	}
	var count int64
	db.Model(&models.Enrollment{}).Where("session_id=?", request.Session.ID).Count(&count)

	err = db.Model(&request.Session).Update("total_students", count).Error
	if err != nil {
		log.Println("updating total students:", err)
	}
	err = db.Model(&request.Session).Update("applied_students", 0).Error
	if err != nil {
		log.Println("updating applied students:", err)
	}

	var createdSession models.Session
	err = db.Preload("Courses").Find(&createdSession, request.Session.ID).Error
	if err != nil {
		log.Println("loading session:", err)
	}
	var enrolledStudents []models.Enrollment
	err = db.Preload("Student").Where("session_id=?", request.Session.ID).Find(&enrolledStudents).Error
	if err != nil {
		log.Println("loading enrollment:", err)
	}
	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"session":  createdSession,
		"enrolled": enrolledStudents,
		"notFound": notFound,
	})
}

func StartSession(c *fiber.Ctx) error {
	db := database.DB.Db

	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid session ID",
		})
	}

	var sessionDb models.Session
	err = db.Preload("Courses").First(&sessionDb, sessionID).Error
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Session does not exist",
			"err":     err.Error(),
		})
	}

	// Check if session is already open (prevent double-start)
	sessionKey := getSessionKey(uint(sessionID))
	courseKey := sessionKey + ":courses"
	studentKey := sessionKey + ":students"
	statusKey := sessionKey + ":status"

	ctx, cancel := getRedisContext()
	defer cancel()

	// Check if already running
	existingStatus, _ := cache.Client.Redis.Get(ctx, statusKey).Result()
	if existingStatus == "open" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Session is already running",
		})
	}

	// Determine if this is a fresh start or a resume
	isResume := sessionDb.Status != nil && *sessionDb.Status == "closed"
	if isResume {
		log.Printf("RESUMING session %d (was previously closed)", sessionID)
	} else {
		log.Printf("STARTING session %d for the first time", sessionID)
	}

	// STEP 1: Clear any stale Redis data for this session (clean slate)
	log.Printf("Session %d: Clearing any stale Redis data...", sessionID)
	cache.Client.Redis.Del(ctx, courseKey, studentKey, statusKey)

	// STEP 2: Get accurate enrollment counts from database
	// This ensures we have the correct seat availability
	type CourseEnrollmentCount struct {
		CourseID uint
		Count    int64
	}
	var enrollmentCounts []CourseEnrollmentCount
	db.Model(&models.Enrollment{}).
		Select("course1_id as course_id, COUNT(*) as count").
		Where("session_id = ? AND course1_id IS NOT NULL", sessionID).
		Group("course1_id").
		Scan(&enrollmentCounts)

	// Build a map for quick lookup
	enrolledPerCourse := make(map[uint]int64)
	for _, ec := range enrollmentCounts {
		enrolledPerCourse[ec.CourseID] = ec.Count
	}

	// STEP 3: Populate course seats with ACCURATE available counts
	log.Printf("Session %d: Populating course seats in Redis...", sessionID)
	for _, course := range sessionDb.Courses {
		totalSeats := *course.Seats
		filledSeats := enrolledPerCourse[course.ID]
		availableSeats := int64(totalSeats) - filledSeats

		if availableSeats < 0 {
			log.Printf("WARNING: Course %d has negative available seats (%d total, %d filled). Setting to 0.",
				course.ID, totalSeats, filledSeats)
			availableSeats = 0
		}

		err = cache.Client.Redis.HSet(ctx, courseKey, fmt.Sprintf("%d", course.ID), availableSeats).Err()
		if err != nil {
			log.Printf("Error populating course %d in Redis: %v", course.ID, err)
		}

		log.Printf("Course %d (%s): %d total seats, %d filled, %d available",
			course.ID, *course.Code, totalSeats, filledSeats, availableSeats)
	}

	// STEP 4: Load ALL eligible students for this session
	// Students with Course1ID = enrolled, NULL = eligible but not enrolled
	log.Printf("Session %d: Populating student eligibility in Redis...", sessionID)
	var enrollments []models.Enrollment
	db.Where("session_id = ?", sessionDb.ID).Find(&enrollments)

	eligibleCount := 0
	enrolledCount := 0
	for _, enrollment := range enrollments {
		if enrollment.StudentID == nil {
			continue
		}

		if enrollment.Course1ID != nil {
			// Already enrolled - store course ID
			err = cache.Client.Redis.HSet(ctx, studentKey, *enrollment.StudentID, fmt.Sprintf("%d", *enrollment.Course1ID)).Err()
			enrolledCount++
		} else {
			// Eligible but not enrolled - store empty string
			err = cache.Client.Redis.HSet(ctx, studentKey, *enrollment.StudentID, "").Err()
			eligibleCount++
		}

		if err != nil {
			log.Printf("Error adding student %s to Redis: %v", *enrollment.StudentID, err)
		}
	}

	log.Printf("Session %d: Loaded %d eligible students, %d already enrolled", sessionID, eligibleCount, enrolledCount)

	// STEP 5: Set session status to "open" in Redis (do this LAST to prevent race conditions)
	err = cache.Client.Redis.Set(ctx, statusKey, "open", 0).Err()
	if err != nil {
		log.Printf("Error setting session status in Redis: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to initialize session in cache",
		})
	}

	// STEP 6: Update DB status
	err = db.Model(&sessionDb).Update("status", "open").Error
	if err != nil {
		// Rollback Redis if DB fails
		cache.Client.Redis.Del(ctx, courseKey, studentKey, statusKey)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update session status in database",
			"err":     err.Error(),
		})
	}

	// Return the populated data for verification
	coursesData := cache.Client.Redis.HGetAll(ctx, courseKey).Val()
	studentsCount := cache.Client.Redis.HLen(ctx, studentKey).Val()

	actionType := "started"
	if isResume {
		actionType = "resumed"
	}

	log.Printf("Session %d %s successfully. Courses: %d, Students loaded: %d, Already enrolled: %d",
		sessionID, actionType, len(coursesData), studentsCount, enrolledCount)

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message":          fmt.Sprintf("Session %s successfully", actionType),
		"is_resume":        isResume,
		"session":          sessionDb,
		"courses":          coursesData,
		"total_students":   studentsCount,
		"already_enrolled": enrolledCount,
		"available_slots":  eligibleCount,
	})
}

// SubscribeToSession handles WebSocket connections for real-time seat updates
// Improved with proper cleanup and error handling
func SubscribeToSession(c *websocket.Conn) {
	sessionID := c.Params("sessionId")
	sessionKey := "session:" + sessionID
	courseKey := sessionKey + ":courses"

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pubsub := cache.Client.Redis.Subscribe(ctx, sessionKey)
	defer pubsub.Close()

	ch := pubsub.Channel()

	// Send initial course data
	redisCtx, redisCancel := getRedisContext()
	courses := cache.Client.Redis.HGetAll(redisCtx, courseKey).Val()
	redisCancel()

	if len(courses) != 0 {
		jsonCourses, _ := json.Marshal(courses)
		if err := c.WriteMessage(websocket.TextMessage, jsonCourses); err != nil {
			log.Println("Error writing initial message to websocket:", err)
			return
		}
	}

	// Use WaitGroup to ensure clean shutdown
	var wg sync.WaitGroup
	done := make(chan struct{})

	// Goroutine to send messages from Redis pub/sub to the client
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case msg, ok := <-ch:
				if !ok {
					return
				}
				var payloadMap map[string]interface{}
				if err := json.Unmarshal([]byte(msg.Payload), &payloadMap); err != nil {
					log.Println("Error unmarshalling payload:", err)
					continue
				}

				jsonMessage, err := json.Marshal(payloadMap)
				if err != nil {
					log.Println("Error marshalling message:", err)
					continue
				}

				if err := c.WriteMessage(websocket.TextMessage, jsonMessage); err != nil {
					log.Println("Error writing message to websocket:", err)
					return
				}
			case <-done:
				return
			}
		}
	}()

	// Keep-alive ping every 30 seconds
	wg.Add(1)
	go func() {
		defer wg.Done()
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if err := c.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			case <-done:
				return
			}
		}
	}()

	// Read messages from client to detect disconnection
	for {
		if _, _, err := c.ReadMessage(); err != nil {
			log.Println("Client disconnected:", err)
			break
		}
	}

	// Signal goroutines to stop
	close(done)
	wg.Wait()
}

func sessionExists(key1 string, key2 string) bool {
	ctx, cancel := getRedisContext()
	defer cancel()
	return cache.Client.Redis.Exists(ctx, key1, key2).Val() > 0
}

// EnrollToCourse handles student enrollment with improved error handling and idempotency
func EnrollToCourse(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	sessionKey := "session:" + sessionID
	courseKey := sessionKey + ":courses"
	studentKey := sessionKey + ":students"
	statusKey := sessionKey + ":status"

	req := struct {
		ID     string `json:"id"`
		Course string `json:"course"`
	}{}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid data received",
		})
	}

	// Validate input
	if req.ID == "" || req.Course == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Student ID and Course are required",
		})
	}

	ctx, cancel := getRedisContext()
	defer cancel()

	// Check if session is still open (fast Redis check)
	status, err := cache.Client.Redis.Get(ctx, statusKey).Result()
	if err != nil || status != "open" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Session is not currently open for enrollment",
		})
	}

	// Enhanced Lua script with better error handling and idempotency
	// Returns: OK, COURSE_NOT_EXIST, ALREADY_ENROLLED, COURSE_FULL, STUDENT_NOT_ELIGIBLE, or ALREADY_IN_THIS_COURSE
	script := `
		-- Check if session exists (course key has data)
		local course_seats = redis.call("HGET", KEYS[1], ARGV[1])
		if course_seats == false then
			return "COURSE_NOT_EXIST"
		end
		
		-- Check if student is eligible for this session
		local student_status = redis.call("HGET", KEYS[2], ARGV[2])
		if student_status == false then
			return "STUDENT_NOT_ELIGIBLE"
		end
		
		-- Check if student already enrolled (idempotency check)
		if student_status == ARGV[1] then
			return "ALREADY_IN_THIS_COURSE"
		end
		
		-- Check if student enrolled in ANY course
		if student_status ~= "" then
			return "ALREADY_ENROLLED"
		end
		
		-- Check seat availability
		if tonumber(course_seats) <= 0 then
			return "COURSE_FULL"
		end
		
		-- Atomic enrollment: decrement seat and mark student enrolled
		redis.call("HINCRBY", KEYS[1], ARGV[1], -1)
		redis.call("HSET", KEYS[2], ARGV[2], ARGV[1])
		return "OK"
	`

	res, err := cache.Client.Redis.Eval(ctx, script, []string{courseKey, studentKey}, req.Course, req.ID).Result()
	if err != nil {
		log.Printf("Error executing Lua script for enrollment - Student: %s, Course: %s, Error: %v", req.ID, req.Course, err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Enrollment failed. Please try again.",
			"retry":   true,
		})
	}

	switch res {
	case "COURSE_NOT_EXIST":
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Course does not exist in this session",
		})
	case "ALREADY_IN_THIS_COURSE":
		// Idempotent success - student already in this course
		return c.Status(http.StatusOK).JSON(fiber.Map{
			"message": "Already enrolled in this course",
		})
	case "ALREADY_ENROLLED":
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "You have already enrolled in another course",
		})
	case "STUDENT_NOT_ELIGIBLE":
		return c.Status(http.StatusForbidden).JSON(fiber.Map{
			"message": "You are not eligible for this session",
		})
	case "COURSE_FULL":
		return c.Status(http.StatusConflict).JSON(fiber.Map{
			"message": "Course is full",
		})
	}

	// Asynchronously update the database with retry logic
	go syncEnrollmentToDB(sessionID, req.Course, req.ID)

	// Publish updated seats to all connected WebSocket clients
	go func() {
		pubCtx, pubCancel := getRedisContext()
		defer pubCancel()

		courses := cache.Client.Redis.HGetAll(pubCtx, courseKey).Val()
		jsonCourses, _ := json.Marshal(courses)
		if err := cache.Client.Redis.Publish(pubCtx, sessionKey, string(jsonCourses)).Err(); err != nil {
			log.Printf("Error publishing seat update: %v", err)
		}
	}()

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Successfully enrolled",
	})
}

// syncEnrollmentToDB syncs enrollment to database with retry logic
func syncEnrollmentToDB(sessionID string, courseID string, studentID string) {
	db := database.DB.Db
	maxRetries := 3
	retryDelay := 100 * time.Millisecond

	sessID, err := strconv.ParseUint(sessionID, 10, 32)
	if err != nil {
		log.Printf("Invalid session ID for DB sync: %s", sessionID)
		return
	}

	for attempt := 1; attempt <= maxRetries; attempt++ {
		err := performDBSync(db, uint(sessID), courseID, studentID)
		if err == nil {
			return
		}

		log.Printf("DB sync attempt %d/%d failed for student %s: %v", attempt, maxRetries, studentID, err)

		if attempt < maxRetries {
			time.Sleep(retryDelay)
			retryDelay *= 2 // Exponential backoff
		}
	}

	// Log critical failure for manual recovery
	log.Printf("CRITICAL: Failed to sync enrollment to DB after %d attempts - Session: %s, Course: %s, Student: %s",
		maxRetries, sessionID, courseID, studentID)

	// TODO: Add to a dead letter queue or alert system for manual recovery
}

// performDBSync performs the actual database sync
func performDBSync(db *gorm.DB, sessionID uint, courseID string, studentID string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Update enrollment record
		result := tx.Model(&models.Enrollment{}).
			Where("session_id = ? AND student_id = ?", sessionID, studentID).
			Update("course1_id", courseID)

		if result.Error != nil {
			return result.Error
		}

		if result.RowsAffected == 0 {
			return fmt.Errorf("no enrollment found for student %s in session %d", studentID, sessionID)
		}

		// Update seats_filled counter
		if err := tx.Model(&models.Course{}).
			Where("id = ? AND session_id = ?", courseID, sessionID).
			Update("seats_filled", gorm.Expr("COALESCE(seats_filled, 0) + 1")).Error; err != nil {
			return err
		}

		// Update session applied_students counter
		if err := tx.Model(&models.Session{}).
			Where("id = ?", sessionID).
			Update("applied_students", gorm.Expr("COALESCE(applied_students, 0) + 1")).Error; err != nil {
			return err
		}

		return nil
	})
}

func StopSession(c *fiber.Ctx) error {
	db := database.DB.Db

	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid session ID",
		})
	}

	sessionKey := getSessionKey(uint(sessionID))
	courseKey := sessionKey + ":courses"
	studentKey := sessionKey + ":students"
	statusKey := sessionKey + ":status"

	ctx, cancel := getRedisContext()
	defer cancel()

	// STEP 1: Set status to closed FIRST to stop new enrollments immediately
	log.Printf("Stopping session %d: Setting status to closed...", sessionID)
	cache.Client.Redis.Set(ctx, statusKey, "closed", 0)

	// STEP 2: Notify all WebSocket clients that session is closed
	cache.Client.Redis.Publish(ctx, sessionKey, `{"session_closed":true}`)

	// STEP 3: Sync Redis enrollments back to DB (in case any async writes failed)
	// This ensures we don't lose any enrollments
	log.Printf("Session %d: Syncing Redis data back to database...", sessionID)
	syncResult := syncRedisToDatabase(db, uint(sessionID), studentKey, courseKey)

	// STEP 4: Clean up Redis keys AFTER sync
	cache.Client.Redis.Del(ctx, courseKey, studentKey, statusKey)

	// STEP 5: Update DB status
	var session models.Session
	if err := db.Preload("Courses").First(&session, sessionID).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"message": "Session not found",
		})
	}

	err = db.Model(&session).Update("status", "closed").Error
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to stop session",
			"err":     err.Error(),
		})
	}

	// STEP 6: Recalculate and update final counts in DB
	var appliedCount int64
	db.Model(&models.Enrollment{}).
		Where("session_id = ? AND course1_id IS NOT NULL", sessionID).
		Count(&appliedCount)

	db.Model(&session).Update("applied_students", appliedCount)

	// Update seats_filled for each course
	for _, course := range session.Courses {
		var courseEnrolled int64
		db.Model(&models.Enrollment{}).
			Where("session_id = ? AND course1_id = ?", sessionID, course.ID).
			Count(&courseEnrolled)
		db.Model(&models.Course{}).Where("id = ?", course.ID).Update("seats_filled", courseEnrolled)
	}

	log.Printf("Session %d stopped successfully. Sync result: %+v", sessionID, syncResult)

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message":        "Session stopped",
		"session":        session,
		"sync_result":    syncResult,
		"total_enrolled": appliedCount,
	})
}

// syncRedisToDatabase syncs enrollment data from Redis back to DB
// This catches any enrollments that may not have been persisted due to async failures
func syncRedisToDatabase(db *gorm.DB, sessionID uint, studentKey string, courseKey string) map[string]interface{} {
	ctx, cancel := getRedisContext()
	defer cancel()

	result := map[string]interface{}{
		"checked":    0,
		"synced":     0,
		"already_ok": 0,
		"errors":     0,
		"error_list": []string{},
	}

	// Get all student enrollments from Redis
	students := cache.Client.Redis.HGetAll(ctx, studentKey).Val()
	result["checked"] = len(students)

	for studentID, courseIDStr := range students {
		// Skip students who haven't enrolled
		if courseIDStr == "" {
			result["already_ok"] = result["already_ok"].(int) + 1
			continue
		}

		courseID, err := strconv.ParseUint(courseIDStr, 10, 32)
		if err != nil {
			result["errors"] = result["errors"].(int) + 1
			result["error_list"] = append(result["error_list"].([]string),
				fmt.Sprintf("Invalid course ID for student %s: %s", studentID, courseIDStr))
			continue
		}

		// Check if enrollment exists in DB
		var enrollment models.Enrollment
		err = db.Where("session_id = ? AND student_id = ?", sessionID, studentID).First(&enrollment).Error
		if err != nil {
			result["errors"] = result["errors"].(int) + 1
			result["error_list"] = append(result["error_list"].([]string),
				fmt.Sprintf("Enrollment not found for student %s: %v", studentID, err))
			continue
		}

		// Check if the course ID matches
		if enrollment.Course1ID != nil && *enrollment.Course1ID == uint(courseID) {
			// Already correct in DB
			result["already_ok"] = result["already_ok"].(int) + 1
			continue
		}

		// Update DB with Redis data (Redis is source of truth during session)
		courseIDUint := uint(courseID)
		err = db.Model(&enrollment).Update("course1_id", courseIDUint).Error
		if err != nil {
			result["errors"] = result["errors"].(int) + 1
			result["error_list"] = append(result["error_list"].([]string),
				fmt.Sprintf("Failed to sync student %s to course %d: %v", studentID, courseID, err))
			continue
		}

		log.Printf("Synced enrollment: Student %s -> Course %d (was missing in DB)", studentID, courseID)
		result["synced"] = result["synced"].(int) + 1
	}

	return result
}

type CourseData struct {
	Id         uint
	Name       string
	Code       string
	Seats      uint
	Department string
}

func GetSession(c *fiber.Ctx) error {
	db := database.DB.Db

	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid session ID",
		})
	}

	var session models.Session
	if err := db.First(&session, sessionID).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"message": "Session not found",
		})
	}

	var courses []models.Course
	db.Preload("Department").Where("session_id=?", sessionID).Find(&courses)

	courseData := []CourseData{}
	for _, course := range courses {
		courseData = append(courseData, CourseData{
			Id:         course.ID,
			Name:       *course.Name,
			Code:       *course.Code,
			Seats:      *course.Seats,
			Department: *course.Department.Name,
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"session": session,
		"courses": courseData,
	})
}

func GetAllSessions(c *fiber.Ctx) error {
	db := database.DB.Db
	var sessions []models.Session
	result := db.Preload("Courses").Find(&sessions)
	if result.Error != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch sessions",
		})
	}
	return c.Status(http.StatusOK).JSON(sessions)
}

func GetSessionDetails(c *fiber.Ctx) error {
	db := database.DB.Db

	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid session ID",
		})
	}

	var session models.Session

	err = db.Preload("Courses", func(db *gorm.DB) *gorm.DB {
		return db.Select("courses.*, COUNT(enrollments.course1_id) as seats_filled").
			Joins("LEFT JOIN enrollments ON enrollments.course1_id = courses.id").
			Group("courses.id")
	}).First(&session, sessionID).Error

	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Session not found",
		})
	}

	return c.JSON(fiber.Map{
		"session": session,
	})
}

func SendEnrollmentsExcel(c *fiber.Ctx) error {
	db := database.DB.Db

	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid session ID",
		})
	}

	// Load session with courses
	var session models.Session
	if err := db.Preload("Courses").First(&session, sessionID).Error; err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Session does not exist",
		})
	}

	// Load all enrollments with related data
	// Note: GORM struggles with Student.Department because Student PK is Usn (string), not ID
	// So we need to manually load the relationships
	var enrollments []models.Enrollment
	db.Preload("Course1").
		Where("session_id = ?", session.ID).
		Order("student_id").
		Find(&enrollments)

	// Load students separately and build a map (since StudentID is string -> Usn)
	var studentIDs []string
	for _, e := range enrollments {
		if e.StudentID != nil {
			studentIDs = append(studentIDs, *e.StudentID)
		}
	}

	var students []models.Student
	if len(studentIDs) > 0 {
		db.Preload("Department").Where("usn IN ?", studentIDs).Find(&students)
	}

	// Build student map for quick lookup
	studentMap := make(map[string]models.Student)
	for _, s := range students {
		studentMap[s.Usn] = s
	}

	// Attach students to enrollments
	for i := range enrollments {
		if enrollments[i].StudentID != nil {
			if student, ok := studentMap[*enrollments[i].StudentID]; ok {
				enrollments[i].Student = student
			}
		}
	}

	log.Printf("Excel Export: Session %d - Found %d enrollments, %d students loaded", sessionID, len(enrollments), len(students))

	// Get all departments dynamically
	var departments []models.Department
	db.Find(&departments)

	// Create Excel file
	f := excelize.NewFile()

	// Style for headers
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"4472C4"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
		},
	})

	// Style for data cells
	dataStyle, _ := f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
		},
		Alignment: &excelize.Alignment{Vertical: "center"},
	})

	// Style for summary headers
	summaryHeaderStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"70AD47"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})

	// Load timezone
	indianLocation, _ := time.LoadLocation("Asia/Kolkata")

	// ========== SHEET 1: Summary ==========
	summarySheet := "Summary"
	f.SetSheetName("Sheet1", summarySheet)

	// Session info
	f.SetCellValue(summarySheet, "A1", "Session Name")
	f.SetCellValue(summarySheet, "B1", safeDerefString(session.Name))
	f.SetCellValue(summarySheet, "A2", "Session Type")
	f.SetCellValue(summarySheet, "B2", safeDerefString(session.SessionType))
	f.SetCellValue(summarySheet, "A3", "Status")
	f.SetCellValue(summarySheet, "B3", safeDerefString(session.Status))
	f.SetCellValue(summarySheet, "A4", "Export Time")
	f.SetCellValue(summarySheet, "B4", time.Now().In(indianLocation).Format("2006-01-02 15:04:05"))

	// Overall stats
	totalEligible := len(enrollments)
	totalEnrolled := 0
	for _, e := range enrollments {
		if e.Course1ID != nil {
			totalEnrolled++
		}
	}

	f.SetCellValue(summarySheet, "A6", "Total Eligible Students")
	f.SetCellValue(summarySheet, "B6", totalEligible)
	f.SetCellValue(summarySheet, "A7", "Total Enrolled")
	f.SetCellValue(summarySheet, "B7", totalEnrolled)
	f.SetCellValue(summarySheet, "A8", "Not Enrolled")
	f.SetCellValue(summarySheet, "B8", totalEligible-totalEnrolled)
	f.SetCellValue(summarySheet, "A9", "Enrollment Rate")
	if totalEligible > 0 {
		f.SetCellValue(summarySheet, "B9", fmt.Sprintf("%.1f%%", float64(totalEnrolled)/float64(totalEligible)*100))
	} else {
		f.SetCellValue(summarySheet, "B9", "0%")
	}

	// Course-wise breakdown
	f.SetCellValue(summarySheet, "A11", "Course Breakdown")
	f.MergeCell(summarySheet, "A11", "E11")
	f.SetCellStyle(summarySheet, "A11", "E11", summaryHeaderStyle)

	f.SetCellValue(summarySheet, "A12", "Course Code")
	f.SetCellValue(summarySheet, "B12", "Course Name")
	f.SetCellValue(summarySheet, "C12", "Total Seats")
	f.SetCellValue(summarySheet, "D12", "Enrolled")
	f.SetCellValue(summarySheet, "E12", "Available")
	f.SetCellStyle(summarySheet, "A12", "E12", headerStyle)

	row := 13
	for _, course := range session.Courses {
		var enrolled int64
		db.Model(&models.Enrollment{}).
			Where("session_id = ? AND course1_id = ?", sessionID, course.ID).
			Count(&enrolled)

		totalSeats := uint(0)
		if course.Seats != nil {
			totalSeats = *course.Seats
		}

		f.SetCellValue(summarySheet, fmt.Sprintf("A%d", row), safeDerefString(course.Code))
		f.SetCellValue(summarySheet, fmt.Sprintf("B%d", row), safeDerefString(course.Name))
		f.SetCellValue(summarySheet, fmt.Sprintf("C%d", row), totalSeats)
		f.SetCellValue(summarySheet, fmt.Sprintf("D%d", row), enrolled)
		f.SetCellValue(summarySheet, fmt.Sprintf("E%d", row), int64(totalSeats)-enrolled)
		f.SetCellStyle(summarySheet, fmt.Sprintf("A%d", row), fmt.Sprintf("E%d", row), dataStyle)
		row++
	}

	// Department-wise breakdown
	row += 2
	f.SetCellValue(summarySheet, fmt.Sprintf("A%d", row), "Department Breakdown")
	f.MergeCell(summarySheet, fmt.Sprintf("A%d", row), fmt.Sprintf("D%d", row))
	f.SetCellStyle(summarySheet, fmt.Sprintf("A%d", row), fmt.Sprintf("D%d", row), summaryHeaderStyle)
	row++

	f.SetCellValue(summarySheet, fmt.Sprintf("A%d", row), "Department")
	f.SetCellValue(summarySheet, fmt.Sprintf("B%d", row), "Eligible")
	f.SetCellValue(summarySheet, fmt.Sprintf("C%d", row), "Enrolled")
	f.SetCellValue(summarySheet, fmt.Sprintf("D%d", row), "Rate")
	f.SetCellStyle(summarySheet, fmt.Sprintf("A%d", row), fmt.Sprintf("D%d", row), headerStyle)
	row++

	// Calculate department stats
	deptStats := make(map[string]struct {
		Eligible int
		Enrolled int
	})
	for _, e := range enrollments {
		deptName := "Unknown"
		if e.Student.Department.Name != nil {
			deptName = *e.Student.Department.Name
		}
		stats := deptStats[deptName]
		stats.Eligible++
		if e.Course1ID != nil {
			stats.Enrolled++
		}
		deptStats[deptName] = stats
	}

	for _, dept := range departments {
		deptName := safeDerefString(dept.Name)
		stats := deptStats[deptName]
		if stats.Eligible == 0 {
			continue
		}

		f.SetCellValue(summarySheet, fmt.Sprintf("A%d", row), deptName)
		f.SetCellValue(summarySheet, fmt.Sprintf("B%d", row), stats.Eligible)
		f.SetCellValue(summarySheet, fmt.Sprintf("C%d", row), stats.Enrolled)
		if stats.Eligible > 0 {
			f.SetCellValue(summarySheet, fmt.Sprintf("D%d", row), fmt.Sprintf("%.1f%%", float64(stats.Enrolled)/float64(stats.Eligible)*100))
		}
		f.SetCellStyle(summarySheet, fmt.Sprintf("A%d", row), fmt.Sprintf("D%d", row), dataStyle)
		row++
	}

	// Set column widths for summary
	f.SetColWidth(summarySheet, "A", "A", 25)
	f.SetColWidth(summarySheet, "B", "B", 40)
	f.SetColWidth(summarySheet, "C", "E", 15)

	// ========== SHEET 2: All Enrollments ==========
	allSheet := "All Enrollments"
	f.NewSheet(allSheet)

	headers := []string{"S.No", "USN", "Student Name", "Department", "Course Code", "Course Name", "Enrollment Date", "Enrollment Time"}
	for i, h := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(allSheet, cell, h)
	}
	f.SetCellStyle(allSheet, "A1", "H1", headerStyle)

	row = 2
	sno := 1
	for _, enrollment := range enrollments {
		if enrollment.Course1ID == nil {
			continue // Skip non-enrolled students in this sheet
		}

		enrollmentTime := ""
		enrollmentDate := ""
		if !enrollment.UpdatedAt.IsZero() {
			indianTime := enrollment.UpdatedAt.In(indianLocation)
			enrollmentTime = indianTime.Format("15:04:05")
			enrollmentDate = indianTime.Format("2006-01-02")
		}

		f.SetCellValue(allSheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(allSheet, fmt.Sprintf("B%d", row), safeDerefString(enrollment.StudentID))
		f.SetCellValue(allSheet, fmt.Sprintf("C%d", row), safeDerefString(enrollment.Student.Name))
		f.SetCellValue(allSheet, fmt.Sprintf("D%d", row), safeDerefString(enrollment.Student.Department.Name))
		f.SetCellValue(allSheet, fmt.Sprintf("E%d", row), safeDerefString(enrollment.Course1.Code))
		f.SetCellValue(allSheet, fmt.Sprintf("F%d", row), safeDerefString(enrollment.Course1.Name))
		f.SetCellValue(allSheet, fmt.Sprintf("G%d", row), enrollmentDate)
		f.SetCellValue(allSheet, fmt.Sprintf("H%d", row), enrollmentTime)
		f.SetCellStyle(allSheet, fmt.Sprintf("A%d", row), fmt.Sprintf("H%d", row), dataStyle)

		row++
		sno++
	}

	// Set column widths
	f.SetColWidth(allSheet, "A", "A", 8)
	f.SetColWidth(allSheet, "B", "B", 15)
	f.SetColWidth(allSheet, "C", "C", 25)
	f.SetColWidth(allSheet, "D", "D", 15)
	f.SetColWidth(allSheet, "E", "E", 15)
	f.SetColWidth(allSheet, "F", "F", 40)
	f.SetColWidth(allSheet, "G", "H", 15)

	// ========== SHEET 3: Not Enrolled ==========
	notEnrolledSheet := "Not Enrolled"
	f.NewSheet(notEnrolledSheet)

	notEnrolledHeaders := []string{"S.No", "USN", "Student Name", "Department", "Email"}
	for i, h := range notEnrolledHeaders {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(notEnrolledSheet, cell, h)
	}
	f.SetCellStyle(notEnrolledSheet, "A1", "E1", headerStyle)

	row = 2
	sno = 1
	for _, enrollment := range enrollments {
		if enrollment.Course1ID != nil {
			continue // Skip enrolled students
		}

		f.SetCellValue(notEnrolledSheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(notEnrolledSheet, fmt.Sprintf("B%d", row), safeDerefString(enrollment.StudentID))
		f.SetCellValue(notEnrolledSheet, fmt.Sprintf("C%d", row), safeDerefString(enrollment.Student.Name))
		f.SetCellValue(notEnrolledSheet, fmt.Sprintf("D%d", row), safeDerefString(enrollment.Student.Department.Name))
		f.SetCellValue(notEnrolledSheet, fmt.Sprintf("E%d", row), safeDerefString(enrollment.Student.Email))
		f.SetCellStyle(notEnrolledSheet, fmt.Sprintf("A%d", row), fmt.Sprintf("E%d", row), dataStyle)

		row++
		sno++
	}

	f.SetColWidth(notEnrolledSheet, "A", "A", 8)
	f.SetColWidth(notEnrolledSheet, "B", "B", 15)
	f.SetColWidth(notEnrolledSheet, "C", "C", 25)
	f.SetColWidth(notEnrolledSheet, "D", "D", 15)
	f.SetColWidth(notEnrolledSheet, "E", "E", 30)

	// ========== DYNAMIC DEPARTMENT SHEETS ==========
	// Create a sheet for each department that has enrollments
	// First, collect all department names that have enrolled students
	deptNamesToProcess := make([]string, 0)
	for deptName, stats := range deptStats {
		if stats.Enrolled > 0 && deptName != "" {
			deptNamesToProcess = append(deptNamesToProcess, deptName)
		}
	}
	log.Printf("Excel Export: Creating sheets for %d departments: %v", len(deptNamesToProcess), deptNamesToProcess)

	for _, deptName := range deptNamesToProcess {
		// Create sheet with department name
		sheetName := deptName
		if len(sheetName) > 31 { // Excel sheet name limit
			sheetName = sheetName[:31]
		}

		// Sanitize sheet name (Excel has restrictions on certain characters)
		sheetName = strings.ReplaceAll(sheetName, "/", "-")
		sheetName = strings.ReplaceAll(sheetName, "\\", "-")
		sheetName = strings.ReplaceAll(sheetName, "*", "-")
		sheetName = strings.ReplaceAll(sheetName, "?", "-")
		sheetName = strings.ReplaceAll(sheetName, "[", "(")
		sheetName = strings.ReplaceAll(sheetName, "]", ")")
		sheetName = strings.ReplaceAll(sheetName, ":", "-")

		f.NewSheet(sheetName)

		// Headers
		deptHeaders := []string{"S.No", "USN", "Student Name", "Course Code", "Course Name", "Enrollment Date", "Enrollment Time"}
		for i, h := range deptHeaders {
			cell := fmt.Sprintf("%c1", 'A'+i)
			f.SetCellValue(sheetName, cell, h)
		}
		f.SetCellStyle(sheetName, "A1", "G1", headerStyle)

		// Data
		row = 2
		sno = 1
		for _, enrollment := range enrollments {
			if enrollment.Course1ID == nil {
				continue
			}
			studentDept := safeDerefString(enrollment.Student.Department.Name)
			if studentDept != deptName {
				continue
			}

			enrollmentTime := ""
			enrollmentDate := ""
			if !enrollment.UpdatedAt.IsZero() {
				indianTime := enrollment.UpdatedAt.In(indianLocation)
				enrollmentTime = indianTime.Format("15:04:05")
				enrollmentDate = indianTime.Format("2006-01-02")
			}

			f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), sno)
			f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), safeDerefString(enrollment.StudentID))
			f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), safeDerefString(enrollment.Student.Name))
			f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), safeDerefString(enrollment.Course1.Code))
			f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), safeDerefString(enrollment.Course1.Name))
			f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), enrollmentDate)
			f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), enrollmentTime)
			f.SetCellStyle(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("G%d", row), dataStyle)

			row++
			sno++
		}

		// Set column widths
		f.SetColWidth(sheetName, "A", "A", 8)
		f.SetColWidth(sheetName, "B", "B", 15)
		f.SetColWidth(sheetName, "C", "C", 25)
		f.SetColWidth(sheetName, "D", "D", 15)
		f.SetColWidth(sheetName, "E", "E", 40)
		f.SetColWidth(sheetName, "F", "G", 15)
	}

	// ========== DYNAMIC COURSE SHEETS ==========
	// Create a sheet for each course (use ID to handle duplicate codes like Morning/Evening)
	for _, course := range session.Courses {
		courseCode := safeDerefString(course.Code)
		courseName := safeDerefString(course.Name)
		if courseCode == "" {
			continue
		}

		// Extract a short identifier from course name (e.g., "Morning", "Evening", "Afternoon")
		timeSlot := ""
		if strings.Contains(courseName, "(Morning)") {
			timeSlot = "_M"
		} else if strings.Contains(courseName, "(Afternoon)") {
			timeSlot = "_A"
		} else if strings.Contains(courseName, "(Evening)") {
			timeSlot = "_E"
		}

		// Create sheet with course code + time slot (to handle duplicates)
		sheetName := courseCode + timeSlot
		if len(sheetName) > 31 { // Excel sheet name limit
			sheetName = sheetName[:31]
		}
		f.NewSheet(sheetName)

		// Course info header
		f.SetCellValue(sheetName, "A1", "Course Code:")
		f.SetCellValue(sheetName, "B1", safeDerefString(course.Code))
		f.SetCellValue(sheetName, "A2", "Course Name:")
		f.SetCellValue(sheetName, "B2", safeDerefString(course.Name))

		var enrolledCount int64
		db.Model(&models.Enrollment{}).
			Where("session_id = ? AND course1_id = ?", sessionID, course.ID).
			Count(&enrolledCount)

		totalSeats := uint(0)
		if course.Seats != nil {
			totalSeats = *course.Seats
		}

		f.SetCellValue(sheetName, "A3", "Total Seats:")
		f.SetCellValue(sheetName, "B3", totalSeats)
		f.SetCellValue(sheetName, "A4", "Enrolled:")
		f.SetCellValue(sheetName, "B4", enrolledCount)

		// Headers for enrolled students
		courseHeaders := []string{"S.No", "USN", "Student Name", "Department", "Enrollment Date", "Enrollment Time"}
		for i, h := range courseHeaders {
			cell := fmt.Sprintf("%c6", 'A'+i)
			f.SetCellValue(sheetName, cell, h)
		}
		f.SetCellStyle(sheetName, "A6", "F6", headerStyle)

		// Data
		row = 7
		sno = 1
		for _, enrollment := range enrollments {
			if enrollment.Course1ID == nil || *enrollment.Course1ID != course.ID {
				continue
			}

			enrollmentTime := ""
			enrollmentDate := ""
			if !enrollment.UpdatedAt.IsZero() {
				indianTime := enrollment.UpdatedAt.In(indianLocation)
				enrollmentTime = indianTime.Format("15:04:05")
				enrollmentDate = indianTime.Format("2006-01-02")
			}

			f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), sno)
			f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), safeDerefString(enrollment.StudentID))
			f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), safeDerefString(enrollment.Student.Name))
			f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), safeDerefString(enrollment.Student.Department.Name))
			f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), enrollmentDate)
			f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), enrollmentTime)
			f.SetCellStyle(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("F%d", row), dataStyle)

			row++
			sno++
		}

		// Set column widths
		f.SetColWidth(sheetName, "A", "A", 8)
		f.SetColWidth(sheetName, "B", "B", 15)
		f.SetColWidth(sheetName, "C", "C", 25)
		f.SetColWidth(sheetName, "D", "D", 15)
		f.SetColWidth(sheetName, "E", "F", 15)
	}

	// Set Summary as the first sheet
	if idx, err := f.GetSheetIndex(summarySheet); err == nil {
		f.SetActiveSheet(idx)
	}

	// Generate file
	buffer, err := f.WriteToBuffer()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to generate Excel file",
			"error":   err.Error(),
		})
	}

	sessionName := safeDerefString(session.Name)
	if sessionName == "" {
		sessionName = fmt.Sprintf("session_%d", sessionID)
	}
	// Clean filename
	sessionName = strings.ReplaceAll(sessionName, " ", "_")
	sessionName = strings.ReplaceAll(sessionName, "/", "-")

	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s_enrollments.xlsx\"", sessionName))

	return c.Send(buffer.Bytes())
}

func safeDerefString(s *string) string {
	if s != nil {
		return *s
	}
	return ""
}

func CheckEnrollment(c *fiber.Ctx) error {
	db := database.DB.Db

	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid session ID",
		})
	}

	var session models.Session
	if err := db.First(&session, sessionID).Error; err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"message": "Session does not exist",
		})
	}

	var enrollment models.Enrollment
	var student models.Student
	db.Where("usn=?", c.Params("student")).First(&student)
	db.Preload("Course1").Preload("Student").Where("session_id=? and student_id=?", session.ID, student.Usn).First(&enrollment)

	if enrollment.Course1ID == nil {
		return c.Status(http.StatusOK).JSON(fiber.Map{
			"message":  "Student is not enrolled in any course",
			"enrolled": false,
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message":  "Student is enrolled",
		"course":   enrollment.Course1,
		"enrolled": true,
	})
}

// GetCourseRules returns all course rules for a session
func GetCourseRules(c *fiber.Ctx) error {
	db := database.DB.Db

	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid session ID",
		})
	}

	var rules []models.CourseRule
	db.Where("session_id = ?", sessionID).Find(&rules)

	return c.JSON(fiber.Map{
		"rules": rules,
	})
}

// CreateCourseRule creates a new course rule for a session
func CreateCourseRule(c *fiber.Ctx) error {
	db := database.DB.Db

	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid session ID",
		})
	}

	var session models.Session
	if err := db.First(&session, sessionID).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": "Session not found",
		})
	}

	type RuleRequest struct {
		CourseCode       string `json:"course_code"`
		RuleType         string `json:"rule_type"`
		TargetCourseCode string `json:"target_course_code"`
		ExclusionGroup   string `json:"exclusion_group"`
	}

	req := new(RuleRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	validTypes := map[string]bool{
		"hide_if_taken":         true,
		"requires_prerequisite": true,
		"mutually_exclusive":    true,
	}
	if !validTypes[req.RuleType] {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid rule type. Must be: hide_if_taken, requires_prerequisite, or mutually_exclusive",
		})
	}

	sessID := uint(sessionID)
	rule := models.CourseRule{
		SessionID:        &sessID,
		CourseCode:       &req.CourseCode,
		RuleType:         &req.RuleType,
		TargetCourseCode: &req.TargetCourseCode,
		ExclusionGroup:   &req.ExclusionGroup,
	}

	if err := db.Create(&rule).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create rule",
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"message": "Rule created successfully",
		"rule":    rule,
	})
}

// DeleteCourseRule deletes a course rule
func DeleteCourseRule(c *fiber.Ctx) error {
	db := database.DB.Db
	ruleID := c.Params("ruleId")

	var rule models.CourseRule
	if err := db.First(&rule, ruleID).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": "Rule not found",
		})
	}

	if err := db.Delete(&rule).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete rule",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Rule deleted successfully",
	})
}

// BulkCreateCourseRules creates multiple rules at once
func BulkCreateCourseRules(c *fiber.Ctx) error {
	db := database.DB.Db

	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid session ID",
		})
	}

	var session models.Session
	if err := db.First(&session, sessionID).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": "Session not found",
		})
	}

	type RuleRequest struct {
		CourseCode       string `json:"course_code"`
		RuleType         string `json:"rule_type"`
		TargetCourseCode string `json:"target_course_code"`
		ExclusionGroup   string `json:"exclusion_group"`
	}

	type BulkRequest struct {
		Rules []RuleRequest `json:"rules"`
	}

	req := new(BulkRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Delete existing rules for this session first
	db.Where("session_id = ?", sessionID).Delete(&models.CourseRule{})

	// Create new rules
	sessID := uint(sessionID)
	created := 0
	for _, r := range req.Rules {
		rule := models.CourseRule{
			SessionID:        &sessID,
			CourseCode:       &r.CourseCode,
			RuleType:         &r.RuleType,
			TargetCourseCode: &r.TargetCourseCode,
			ExclusionGroup:   &r.ExclusionGroup,
		}
		if err := db.Create(&rule).Error; err == nil {
			created++
		}
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"message": "Rules created successfully",
		"created": created,
	})
}

// GetSessionHealth returns the health/status of a running session
// Compares Redis data with DB for integrity verification
func GetSessionHealth(c *fiber.Ctx) error {
	db := database.DB.Db

	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid session ID",
		})
	}

	sessionKey := getSessionKey(uint(sessionID))
	courseKey := sessionKey + ":courses"
	studentKey := sessionKey + ":students"
	statusKey := sessionKey + ":status"

	ctx, cancel := getRedisContext()
	defer cancel()

	// Get session from DB
	var session models.Session
	if err := db.Preload("Courses").First(&session, sessionID).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": "Session not found",
		})
	}

	health := fiber.Map{
		"session_id":   sessionID,
		"session_name": session.Name,
		"db_status":    session.Status,
		"healthy":      true,
		"issues":       []string{},
	}

	issues := []string{}

	// Check Redis status
	redisStatus, err := cache.Client.Redis.Get(ctx, statusKey).Result()
	if err != nil {
		health["redis_status"] = "not_found"
		health["redis_active"] = false
		if *session.Status == "open" {
			issues = append(issues, "Session is 'open' in DB but not found in Redis")
			health["healthy"] = false
		}
	} else {
		health["redis_status"] = redisStatus
		health["redis_active"] = true
	}

	// Get Redis course data
	redisCourses := cache.Client.Redis.HGetAll(ctx, courseKey).Val()
	health["redis_courses_count"] = len(redisCourses)

	// Get Redis student data
	redisStudentsCount := cache.Client.Redis.HLen(ctx, studentKey).Val()
	health["redis_students_count"] = redisStudentsCount

	// Compare course seat counts
	courseComparison := []fiber.Map{}
	for _, course := range session.Courses {
		courseIDStr := fmt.Sprintf("%d", course.ID)
		redisSeats := redisCourses[courseIDStr]

		// Get actual enrollments from DB
		var dbEnrolled int64
		db.Model(&models.Enrollment{}).
			Where("session_id = ? AND course1_id = ?", sessionID, course.ID).
			Count(&dbEnrolled)

		totalSeats := *course.Seats
		expectedAvailable := int64(totalSeats) - dbEnrolled

		comp := fiber.Map{
			"course_id":          course.ID,
			"course_code":        course.Code,
			"total_seats":        totalSeats,
			"db_enrolled":        dbEnrolled,
			"expected_available": expectedAvailable,
			"redis_available":    redisSeats,
			"match":              true,
		}

		// Parse Redis seats and compare
		if redisSeats != "" {
			redisAvailable, _ := strconv.ParseInt(redisSeats, 10, 64)
			if redisAvailable != expectedAvailable {
				comp["match"] = false
				comp["discrepancy"] = redisAvailable - expectedAvailable
				issues = append(issues, fmt.Sprintf("Course %s: Redis shows %d available, expected %d",
					*course.Code, redisAvailable, expectedAvailable))
			}
		}

		courseComparison = append(courseComparison, comp)
	}
	health["course_comparison"] = courseComparison

	// Count enrolled students in Redis
	redisEnrolled := 0
	redisNotEnrolled := 0
	redisStudents := cache.Client.Redis.HGetAll(ctx, studentKey).Val()
	for _, courseID := range redisStudents {
		if courseID == "" {
			redisNotEnrolled++
		} else {
			redisEnrolled++
		}
	}
	health["redis_enrolled"] = redisEnrolled
	health["redis_not_enrolled"] = redisNotEnrolled

	// Count enrolled students in DB
	var dbEnrolled int64
	db.Model(&models.Enrollment{}).
		Where("session_id = ? AND course1_id IS NOT NULL", sessionID).
		Count(&dbEnrolled)
	health["db_enrolled"] = dbEnrolled

	var dbTotal int64
	db.Model(&models.Enrollment{}).
		Where("session_id = ?", sessionID).
		Count(&dbTotal)
	health["db_total_eligible"] = dbTotal

	// Check if enrolled counts match
	if int64(redisEnrolled) != dbEnrolled {
		issues = append(issues, fmt.Sprintf("Enrollment count mismatch: Redis=%d, DB=%d", redisEnrolled, dbEnrolled))
	}

	health["issues"] = issues
	if len(issues) > 0 {
		health["healthy"] = false
	}

	return c.JSON(health)
}

// ForceResyncSession forces a resync of Redis from DB (emergency use)
func ForceResyncSession(c *fiber.Ctx) error {
	db := database.DB.Db

	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid session ID",
		})
	}

	var session models.Session
	if err := db.Preload("Courses").First(&session, sessionID).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": "Session not found",
		})
	}

	if session.Status == nil || *session.Status != "open" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Session is not open",
		})
	}

	sessionKey := getSessionKey(uint(sessionID))
	courseKey := sessionKey + ":courses"
	studentKey := sessionKey + ":students"
	statusKey := sessionKey + ":status"

	ctx, cancel := getRedisContext()
	defer cancel()

	// Temporarily set status to "resyncing" to pause new enrollments
	cache.Client.Redis.Set(ctx, statusKey, "resyncing", 0)

	log.Printf("Force resync started for session %d", sessionID)

	// Clear and repopulate courses
	cache.Client.Redis.Del(ctx, courseKey)

	type CourseEnrollmentCount struct {
		CourseID uint
		Count    int64
	}
	var enrollmentCounts []CourseEnrollmentCount
	db.Model(&models.Enrollment{}).
		Select("course1_id as course_id, COUNT(*) as count").
		Where("session_id = ? AND course1_id IS NOT NULL", sessionID).
		Group("course1_id").
		Scan(&enrollmentCounts)

	enrolledPerCourse := make(map[uint]int64)
	for _, ec := range enrollmentCounts {
		enrolledPerCourse[ec.CourseID] = ec.Count
	}

	for _, course := range session.Courses {
		totalSeats := *course.Seats
		filledSeats := enrolledPerCourse[course.ID]
		availableSeats := int64(totalSeats) - filledSeats
		if availableSeats < 0 {
			availableSeats = 0
		}

		cache.Client.Redis.HSet(ctx, courseKey, fmt.Sprintf("%d", course.ID), availableSeats)
	}

	// Clear and repopulate students
	cache.Client.Redis.Del(ctx, studentKey)

	var enrollments []models.Enrollment
	db.Where("session_id = ?", sessionID).Find(&enrollments)

	for _, enrollment := range enrollments {
		if enrollment.StudentID == nil {
			continue
		}

		if enrollment.Course1ID != nil {
			cache.Client.Redis.HSet(ctx, studentKey, *enrollment.StudentID, fmt.Sprintf("%d", *enrollment.Course1ID))
		} else {
			cache.Client.Redis.HSet(ctx, studentKey, *enrollment.StudentID, "")
		}
	}

	// Restore status to open
	cache.Client.Redis.Set(ctx, statusKey, "open", 0)

	log.Printf("Force resync completed for session %d", sessionID)

	// Publish update to all clients
	courses := cache.Client.Redis.HGetAll(ctx, courseKey).Val()
	jsonCourses, _ := json.Marshal(courses)
	cache.Client.Redis.Publish(ctx, sessionKey, string(jsonCourses))

	return c.JSON(fiber.Map{
		"message":        "Session resynced successfully",
		"courses":        courses,
		"students_count": cache.Client.Redis.HLen(ctx, studentKey).Val(),
	})
}
