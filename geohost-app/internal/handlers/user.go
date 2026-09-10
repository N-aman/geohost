package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"geohost/internal/db"
)

// MyProjectsHandler returns all projects submitted by the authenticated session user.
func MyProjectsHandler(database *db.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userID := GetUserIDFromContext(r)
		if userID <= 0 {
			http.Error(w, "authentication required", http.StatusUnauthorized)
			return
		}

		projects, err := database.GetProjectsByOwner(userID)
		if err != nil {
			log.Printf("user: failed fetching user projects for %d: %v", userID, err)
			http.Error(w, "internal database error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(projects)
	}
}

// PublicProjectsHandler returns all approved projects visible in the global gallery (no auth required).
func PublicProjectsHandler(database *db.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		projects, err := database.ListPublicProjects()
		if err != nil {
			log.Printf("gallery: failed fetching public projects: %v", err)
			http.Error(w, "internal database error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(projects)
	}
}

type visibilityRequest struct {
	ProjectID int64 `json:"project_id"`
	IsPublic  bool  `json:"is_public"`
}

// SetProjectVisibilityHandler allows a user to toggle whether their site appears in the global public gallery.
func SetProjectVisibilityHandler(database *db.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userID := GetUserIDFromContext(r)
		if userID <= 0 {
			http.Error(w, "authentication required", http.StatusUnauthorized)
			return
		}

		var req visibilityRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ProjectID <= 0 {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if err := database.SetProjectVisibility(req.ProjectID, userID, req.IsPublic); err != nil {
			http.Error(w, "cannot update visibility: "+err.Error(), http.StatusForbidden)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "is_public": req.IsPublic})
	}
}

// AnalyticsHandler returns traffic and visitor metrics.
// Access is strictly restricted: only the site owner or an admin can access analytics!
func AnalyticsHandler(database *db.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userID := GetUserIDFromContext(r)
		if userID <= 0 {
			http.Error(w, "authentication required", http.StatusUnauthorized)
			return
		}

		idStr := r.URL.Query().Get("project_id")
		projectID, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || projectID <= 0 {
			http.Error(w, "valid project_id required", http.StatusBadRequest)
			return
		}

		// Security check: verify caller is project owner or admin
		allowed, err := database.IsProjectOwnerOrAdmin(projectID, userID)
		if err != nil || !allowed {
			http.Error(w, "forbidden: you do not have permission to view analytics for this site", http.StatusForbidden)
			return
		}

		rangeParam := r.URL.Query().Get("range")
		days := 30
		switch rangeParam {
		case "7d":
			days = 7
		case "30d":
			days = 30
		case "90d":
			days = 90
		}

		summary, err := database.GetAnalyticsSummary(projectID, days)
		if err != nil {
			log.Printf("analytics: failed querying summary for %d: %v", projectID, err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(summary)
	}
}

