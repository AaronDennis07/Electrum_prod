package handlers

import (
	"encoding/json"
	"fmt"
	"mime/multipart"
	"strconv"
	"strings"

	"github.com/AaronDennis07/electrum/internals/database"
	"github.com/AaronDennis07/electrum/internals/models"
	"github.com/gofiber/fiber/v2"
	"github.com/xuri/excelize/v2"
)

// StudentResponse represents a student with department name for API responses
type StudentResponse struct {
	Usn              string `json:"usn"`
	Name             string `json:"name"`
	Email            string `json:"email"`
	Department       string `json:"department"`
	PreviousCourse   string `json:"previous_course"`
	PreviousCourseID string `json:"previous_course_id"`
	HasPassword      bool   `json:"has_password"`
}

// GetAllStudents returns all students with optional search and pagination
func GetAllStudents(c *fiber.Ctx) error {
	db := database.DB.Db

	// Query params
	search := c.Query("search", "")
	department := c.Query("department", "")
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 50)
	offset := (page - 1) * limit

	var students []models.Student
	var total int64

	query := db.Model(&models.Student{}).Preload("Department")

	// Apply search filter
	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("usn ILIKE ? OR name ILIKE ? OR email ILIKE ?", searchPattern, searchPattern, searchPattern)
	}

	// Apply department filter
	if department != "" {
		var dept models.Department
		if err := db.Where("name = ?", department).First(&dept).Error; err == nil {
			query = query.Where("department_id = ?", dept.ID)
		}
	}

	// Get total count
	query.Count(&total)

	// Get paginated results
	if err := query.Offset(offset).Limit(limit).Order("usn ASC").Find(&students).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch students",
		})
	}

	// Convert to response format
	var response []StudentResponse
	for _, s := range students {
		deptName := ""
		if s.Department.Name != nil {
			deptName = *s.Department.Name
		}
		prevCourse := ""
		if s.PreviousCourse != nil {
			prevCourse = *s.PreviousCourse
		}
		prevCourseID := ""
		if s.PreviousCourseID != nil {
			prevCourseID = *s.PreviousCourseID
		}
		name := ""
		if s.Name != nil {
			name = *s.Name
		}
		email := ""
		if s.Email != nil {
			email = *s.Email
		}

		response = append(response, StudentResponse{
			Usn:              s.Usn,
			Name:             name,
			Email:            email,
			Department:       deptName,
			PreviousCourse:   prevCourse,
			PreviousCourseID: prevCourseID,
			HasPassword:      s.Password != nil && *s.Password != "",
		})
	}

	return c.JSON(fiber.Map{
		"students": response,
		"total":    total,
		"page":     page,
		"limit":    limit,
		"pages":    (total + int64(limit) - 1) / int64(limit),
	})
}

// DeleteStudent deletes a student by USN
func DeleteStudent(c *fiber.Ctx) error {
	db := database.DB.Db
	usn := c.Params("usn")

	var student models.Student
	if err := db.Where("usn = ?", usn).First(&student).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Student not found",
		})
	}

	// Delete enrollments first
	db.Where("student_id = ?", usn).Delete(&models.Enrollment{})

	// Delete student
	if err := db.Delete(&student).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete student",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Student deleted successfully",
	})
}

// GetAllDepartments returns all departments
func GetAllDepartments(c *fiber.Ctx) error {
	db := database.DB.Db

	var departments []models.Department
	if err := db.Find(&departments).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch departments",
		})
	}

	var response []fiber.Map
	for _, d := range departments {
		name := ""
		if d.Name != nil {
			name = *d.Name
		}
		fname := ""
		if d.FName != nil {
			fname = *d.FName
		}
		response = append(response, fiber.Map{
			"id":    d.ID,
			"name":  name,
			"fname": fname,
		})
	}

	return c.JSON(fiber.Map{
		"departments": response,
	})
}

// CreateDepartment creates a new department
func CreateDepartment(c *fiber.Ctx) error {
	db := database.DB.Db

	type DepartmentRequest struct {
		Name  string `json:"name"`
		FName string `json:"fname"`
	}

	req := new(DepartmentRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Department name is required",
		})
	}

	// Check if department already exists
	var existing models.Department
	if err := db.Where("name = ?", req.Name).First(&existing).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Department already exists",
		})
	}

	department := models.Department{
		Name:  &req.Name,
		FName: &req.FName,
	}

	if err := db.Create(&department).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create department",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Department created successfully",
		"department": fiber.Map{
			"id":    department.ID,
			"name":  req.Name,
			"fname": req.FName,
		},
	})
}

// ExportStudentsExcel exports all students to Excel
func ExportStudentsExcel(c *fiber.Ctx) error {
	db := database.DB.Db

	var students []models.Student
	if err := db.Preload("Department").Order("usn ASC").Find(&students).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch students",
		})
	}

	f := excelize.NewFile()
	sheetName := "Students"
	f.SetSheetName("Sheet1", sheetName)

	// Set headers
	headers := []string{"USN", "Name", "Email", "Department", "Previous Course", "Previous Course ID"}
	for i, h := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, h)
	}

	// Set data
	for i, s := range students {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), s.Usn)
		if s.Name != nil {
			f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), *s.Name)
		}
		if s.Email != nil {
			f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), *s.Email)
		}
		if s.Department.Name != nil {
			f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), *s.Department.Name)
		}
		if s.PreviousCourse != nil {
			f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), *s.PreviousCourse)
		}
		if s.PreviousCourseID != nil {
			f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), *s.PreviousCourseID)
		}
	}

	buffer, err := f.WriteToBuffer()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate Excel file",
		})
	}

	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", "attachment; filename=\"students.xlsx\"")

	return c.Send(buffer.Bytes())
}

func UploadCourse(c *fiber.Ctx) error {
	courseFile, err := c.FormFile("courses")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "error in uploading file",
			"err":     err,
		})
	}

	file, err := courseFile.Open()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "error in opening file",
			"err":     err,
		})
	}
	defer file.Close()

	f, err := excelize.OpenReader(file)
	if err != nil {
		fmt.Println(err)
	}

	cols, err := f.GetCols("Sheet1")

	if err != nil {
		fmt.Println(err)

	}

	data := map[string]interface{}{
		"course": cols[0],
	}
	out, _ := json.Marshal(data)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "file uploaded successfully",
		"data":    string(out),
	})
}

func UploadStudent(c *fiber.Ctx) error {
	db := database.DB.Db
	courseFile, err := c.FormFile("student")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "error in uploading file",
			"err":     err,
		})
	}

	file, err := courseFile.Open()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "error in opening file",
			"err":     err,
		})
	}
	defer file.Close()

	f, err := excelize.OpenReader(file)
	if err != nil {
		fmt.Println(err)
	}

	rows, err := f.GetRows("Sheet1")

	if err != nil {
		fmt.Println(err)

	}

	nCreated := []string{}
	skippedDept := []string{}

	for idx, row := range rows {
		// Skip empty rows or rows with less than 4 columns
		if len(row) < 4 {
			continue
		}

		// Skip header row - check if first column looks like a header
		if idx == 0 {
			firstCell := strings.ToLower(strings.TrimSpace(row[0]))
			if firstCell == "usn" || firstCell == "roll" || firstCell == "id" || firstCell == "student" {
				continue
			}
		}

		// Skip rows with empty USN
		usn := strings.TrimSpace(row[0])
		if usn == "" {
			continue
		}

		var department models.Department
		deptName := strings.TrimSpace(row[3])
		err := db.Where("name=?", deptName).First(&department).Error
		if err != nil {
			// Department not found - skip this student but continue with others
			skippedDept = append(skippedDept, usn+" (dept: "+deptName+")")
			continue
		}

		name := ""
		if len(row) > 1 {
			name = row[1]
		}
		email := ""
		if len(row) > 2 {
			email = row[2]
		}
		prevCourse := ""
		if len(row) > 4 {
			prevCourse = row[4]
		}
		prevCourseID := ""
		if len(row) > 5 {
			prevCourseID = row[5]
		}

		student := models.Student{
			Usn:              usn,
			Name:             &name,
			Email:            &email,
			Department:       department,
			PreviousCourse:   &prevCourse,
			PreviousCourseID: &prevCourseID,
			Password: func() *string {
				if len(row) > 6 && row[6] != "" {
					return &row[6]
				}
				emptyStr := ""
				return &emptyStr
			}(),
		}
		err = db.Create(&student).Error
		if err != nil {
			nCreated = append(nCreated, usn)
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":     "file uploaded successfully",
		"notCreated":  nCreated,
		"skippedDept": skippedDept,
	})
}

func UploadData(c *fiber.Ctx) error {
	uploadedFile, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "error in uploading file",
			"err":     err,
		})
	}
	students, courses, err := parseExcel(uploadedFile)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "error in parsing file",
			"err":     err,
		})
	}

	// //save the file from c.formfile
	// file, err := uploadedFile.Open()
	// if err != nil {
	// 	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
	// 		"message": "error in opening file",
	// 		"err":     err,
	// 	})
	// }
	// defer file.Close()

	// f, err := excelize.OpenReader(file)
	// if err != nil {
	// 	fmt.Println(err)
	// }

	// students, err := f.GetCols("Sheet1")

	// if err != nil {
	// 	fmt.Println(err)

	// }
	// coursesRow, err := f.GetRows("Sheet2")
	// if err != nil {
	// 	fmt.Println(err)

	// }

	// var courses []map[string]interface{}
	// for _, row := range coursesRow {
	// 	mapRow := map[string]interface{}{
	// 		"code":       row[0],
	// 		"name":       row[1],
	// 		"seats":      row[2],
	// 		"department": row[3],
	// 	}
	// 	courses = append(courses, mapRow)
	// }

	// data := map[string]interface{}{
	// 	"students": students[0],
	// 	"courses":  courses,
	// }
	data := map[string]interface{}{
		"students": students[0],
		"courses":  courses,
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "file uploaded successfully",
		"data":    data,
	})
}
func parseExcel(uploadedFile *multipart.FileHeader) ([]string, []models.CourseData, error) {
	file, err := uploadedFile.Open()
	if err != nil {
		return nil, nil, err
	}
	defer file.Close()

	f, err := excelize.OpenReader(file)
	if err != nil {
		fmt.Println(err)
	}

	students, err := f.GetCols("Sheet1")

	if err != nil {
		fmt.Println(err)

	}
	coursesRow, err := f.GetRows("Sheet2")
	if err != nil {
		fmt.Println(err)

	}

	var courses []models.CourseData
	for _, row := range coursesRow {
		seats, _ := strconv.ParseUint(row[2], 10, 32)
		mapRow := models.CourseData{
			Code:       &row[0],
			Name:       &row[1],
			Seats:      uint(seats),
			Department: &row[3],
		}
		courses = append(courses, mapRow)
	}

	// data := map[string]interface{}{
	// 	"students": students[0],
	// 	"courses":  courses,
	// }

	return students[0], courses, nil
}
