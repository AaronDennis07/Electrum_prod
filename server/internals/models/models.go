package models

import (
	"time"

	"gorm.io/gorm"
)

type Department struct {
	gorm.Model
	Name     *string `gorm:"unique" json:"name"`
	FName    *string `json:"fname"`
	Admin    *string `json:"admin"`
	Password *string `json:"password"`
}

type Session struct {
	gorm.Model
	Name            *string `json:"name"`
	SessionType     *string `json:"session_type"`
	Status          *string `json:"status"`
	TotalStudents   *int64  `json:"total_students"`
	AppliedStudents *int64  `json:"applied_students"`
	Courses         []Course
}
type Course struct {
	gorm.Model
	Name         *string    `json:"name"`
	Code         *string    `json:"code"`
	Seats        *uint      `json:"seats"`
	SeatsFilled  *int64     `json:"seats_filled"`
	DepartmentID *uint      `json:"department_id"`
	Department   Department `json:"-"`
	SessionID    *uint      `json:"session_id"`
	Session      Session    `json:"-"`
}

type Student struct {
	Usn              string         `gorm:"primaryKey" json:"usn"`
	Name             *string        `json:"name"`
	Email            *string        `json:"email"`
	Password         *string        `json:"password"`
	DepartmentID     *uint          `json:"department_id"`
	Department       Department     `json:"-"`
	PreviousCourse   *string        `json:"previous_course"`
	PreviousCourseID *string        `json:"previous_course_id"`
	CreatedAt        time.Time      `json:"-"`
	UpdatedAt        time.Time      `json:"-"`
	DeletedAt        gorm.DeletedAt `json:"-"`
}
type Admin struct {
	Name      string         `gorm:"primaryKey" json:"name"`
	Email     *string        `gorm:"unique" json:"email"`
	Password  *string        `json:"-"`
	CreatedAt time.Time      `json:"-"`
	UpdatedAt time.Time      `json:"-"`
	DeletedAt gorm.DeletedAt `json:"-"`
}
type Enrollment struct {
	gorm.Model
	Course1ID *uint   `json:"course1_id"`
	Course1   Course  `json:"-"`
	Course2ID *uint   `json:"course2_id"`
	Course2   Course  `json:"-"`
	StudentID *string `json:"student_id"`
	Student   Student `json:"-"`
	SessionID *uint   `json:"session_id"`
	Session   Session `json:"-"`
}

type CourseData struct {
	Name       *string
	Code       *string
	Seats      uint
	Department *string
}

// CourseRule defines filtering rules for course visibility during enrollment
// RuleType can be:
//   - "hide_if_taken": Hide this course if student previously took the course specified in TargetCourseCode
//   - "requires_prerequisite": Show this course ONLY if student took the prerequisite in TargetCourseCode
//   - "mutually_exclusive": Hide this course if student took any course in the ExclusionGroup
type CourseRule struct {
	gorm.Model
	SessionID        *uint   `json:"session_id"`
	Session          Session `json:"-"`
	CourseCode       *string `json:"course_code"`       // The course this rule applies to
	RuleType         *string `json:"rule_type"`         // hide_if_taken, requires_prerequisite, mutually_exclusive
	TargetCourseCode *string `json:"target_course_code"` // For prerequisites/hide_if_taken
	ExclusionGroup   *string `json:"exclusion_group"`   // Group name for mutually exclusive courses
}