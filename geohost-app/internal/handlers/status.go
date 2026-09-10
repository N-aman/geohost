package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"geohost/internal/db"
)

// StatusHandler serves GET /status/{id} — a public, unauthenticated
// endpoint so an uploader can check their own project's review state
// using only the ID they received at upload time. No session or
// ownership check exists yet (project IDs aren't tied to accounts in
// the current schema), so treat the ID itself as the "credential" —
// an acceptable tradeoff for a low-stakes status lookup, not
// something to extend to any sensitive data later without real auth.
func StatusHandler(database *db.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		idStr := strings.TrimPrefix(r.URL.Path, "/status/")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || id <= 0 {
			http.Error(w, "invalid project id", http.StatusBadRequest)
			return
		}

		project, err := database.GetProjectByID(id)
		if err != nil {
			log.Printf("status: lookup failed for %d: %v", id, err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if project == nil {
			http.Error(w, "project not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(project)
	}
}
