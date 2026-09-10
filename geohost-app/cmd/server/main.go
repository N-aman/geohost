package main

import (
	"encoding/json"
	"log"
	"net/http"

	"geohost/internal/analytics"
	"geohost/internal/cache"
	"geohost/internal/config"
	"geohost/internal/db"
	"geohost/internal/handlers"
	"geohost/internal/ratelimit"
	"geohost/internal/scanner"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	database, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("database error: %v", err)
	}
	defer database.Close()

	// High-performance concurrency primitives
	cacheInstance := cache.NewLRUCache(2000)
	limiter := ratelimit.NewIPLimiter(100, 50) // 100 capacity, 50 refill/s
	collector := analytics.NewCollector(database, 2000, cfg.AnalyticsSecret)
	defer collector.Close()
	scannerInstance := scanner.NewSafetyScanner()

	mux := http.NewServeMux()

	// 1. Internal Subdomain Resolution for Nginx auth_request
	mux.HandleFunc("/resolve", handlers.ResolveHandler(handlers.ResolveDeps{
		DB:        database,
		Collector: collector,
		Cache:     cacheInstance,
		Limiter:   limiter,
	}))

	// 2. Upload Endpoint (auth-gated, safe extraction, scanning & auto-approval)
	mux.HandleFunc("/upload", handlers.UploadHandler(handlers.UploadDeps{
		DB:                database,
		DataDir:           cfg.DataDir,
		MaxUploadBytes:    cfg.MaxUploadBytes,
		MaxExtractedBytes: cfg.MaxExtractedBytes,
		Scanner:           scannerInstance,
	}))

	// 3. Authentication Endpoints
	mux.HandleFunc("/login", handlers.LoginHandler(database))
	mux.HandleFunc("/admin/login", handlers.LoginHandler(database))
	mux.HandleFunc("/auth/google", handlers.GoogleLoginHandler(database, cfg.GoogleClientID))
	mux.HandleFunc("/auth/google/client-id", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"client_id": cfg.GoogleClientID})
	})
	mux.HandleFunc("/logout", handlers.LogoutHandler(database))
	mux.HandleFunc("/me", handlers.MeHandler(database))

	// 4. User Dashboard, Public Gallery & Traffic Analytics
	mux.HandleFunc("/my/projects", handlers.RequireAuth(database, handlers.MyProjectsHandler(database)))
	mux.HandleFunc("/my/projects/visibility", handlers.RequireAuth(database, handlers.SetProjectVisibilityHandler(database)))
	mux.HandleFunc("/projects/public", handlers.PublicProjectsHandler(database))
	mux.HandleFunc("/my/analytics", handlers.RequireAuth(database, handlers.AnalyticsHandler(database)))

	// 5. Public Status Lookup
	mux.HandleFunc("/status/", handlers.StatusHandler(database))

	// 6. Admin Control Console (Guarded by RequireAdmin)
	adminDeps := handlers.AdminDeps{DB: database, DataDir: cfg.DataDir}
	mux.HandleFunc("/admin/projects", handlers.RequireAdmin(database, handlers.ListProjectsHandler(adminDeps)))
	mux.HandleFunc("/admin/files", handlers.RequireAdmin(database, handlers.ListFilesHandler(adminDeps)))
	mux.HandleFunc("/admin/preview", handlers.RequireAdmin(database, handlers.PreviewFileHandler(adminDeps)))
	mux.HandleFunc("/admin/approve", handlers.RequireAdmin(database, handlers.ApproveHandler(adminDeps)))
	mux.HandleFunc("/admin/reject", handlers.RequireAdmin(database, handlers.RejectHandler(adminDeps)))
	mux.HandleFunc("/admin/suspend", handlers.RequireAdmin(database, handlers.SuspendHandler(adminDeps)))
	mux.HandleFunc("/admin/unsuspend", handlers.RequireAdmin(database, handlers.UnsuspendHandler(adminDeps)))
	mux.HandleFunc("/admin/delete", handlers.RequireAdmin(database, handlers.DeleteHandler(adminDeps)))

	log.Printf("geohost server listening on %s (limits: upload %dMB, extracted %dMB)",
		cfg.ListenAddr, cfg.MaxUploadBytes/(1024*1024), cfg.MaxExtractedBytes/(1024*1024))

	if err := http.ListenAndServe(cfg.ListenAddr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
