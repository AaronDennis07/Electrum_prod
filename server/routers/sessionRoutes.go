package routers

import (
	"github.com/AaronDennis07/electrum/internals/handlers"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

func SetupSessionhRoutes(app *fiber.App) {
	api := app.Group("/session")
	api.Get("/ws/:sessionId", websocket.New(handlers.SubscribeToSession))
	api.Post("", handlers.CreateSession)
	api.Post("/:sessionId/start", handlers.StartSession)
	api.Post("/:sessionId/enroll", handlers.EnrollToCourse)
	api.Post("/:sessionId/stop", handlers.StopSession)
	api.Get("", handlers.GetAllSessions)
	api.Get("/:sessionId", handlers.GetSession)
	api.Get("/details/:sessionId", handlers.GetSessionDetails)
	api.Get("/:sessionId/excel", handlers.SendEnrollmentsExcel)
	api.Post("/:sessionId/upload", handlers.UploadData)
	api.Get("/:sessionId/checkenrollment/:student", handlers.CheckEnrollment)

	// Session health/monitoring routes
	api.Get("/:sessionId/health", handlers.GetSessionHealth)
	api.Post("/:sessionId/resync", handlers.ForceResyncSession)

	// Course rules routes
	api.Get("/:sessionId/rules", handlers.GetCourseRules)
	api.Post("/:sessionId/rules", handlers.CreateCourseRule)
	api.Post("/:sessionId/rules/bulk", handlers.BulkCreateCourseRules)
	api.Delete("/rules/:ruleId", handlers.DeleteCourseRule)
}
