package routers

import (
	"github.com/AaronDennis07/electrum/internals/handlers"
	"github.com/gofiber/fiber/v2"
)

func SetupStudentRoutes(app *fiber.App) {
	api := app.Group("api/v1/student")

	api.Post("/upload", handlers.UploadStudent)
	api.Get("/all", handlers.GetAllStudents)
	api.Get("/export", handlers.ExportStudentsExcel)
	api.Delete("/:usn", handlers.DeleteStudent)

	// Department routes
	api.Get("/departments", handlers.GetAllDepartments)
	api.Post("/department", handlers.CreateDepartment)

	app.Post("/auth/student/reset-password", handlers.ResetStudentPassword)
}
