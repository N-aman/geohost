package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"geohost/internal/db"
)

// AdminDeps bundles dependencies for admin-only handlers.
type AdminDeps struct {
	DB      *db.DB
	DataDir string
}

type projectActionRequest struct {
	ProjectID int64  `json:"project_id"`
	Reason    string `json:"reason,omitempty"`
}

// ApproveHandler moves a project's files from quarantine to approved and flips its status.
func ApproveHandler(deps AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req projectActionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if err := deps.DB.ApproveProject(req.ProjectID); err != nil {
			if errors.Is(err, db.ErrProjectNotPending) {
				http.Error(w, "project is not pending", http.StatusConflict)
				return
			}
			log.Printf("admin: approve failed for project %d: %v", req.ProjectID, err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		idStr := strconv.FormatInt(req.ProjectID, 10)
		src := filepath.Join(deps.DataDir, "quarantine", idStr)
		dst := filepath.Join(deps.DataDir, "approved", idStr)

		if err := os.Rename(src, dst); err != nil {
			log.Printf("CRITICAL: project %d approved in DB but file move failed: %v", req.ProjectID, err)
			http.Error(w, "approved but file move failed, contact admin", http.StatusInternalServerError)
			return
		}

		log.Printf("admin: project %d approved and moved to %s", req.ProjectID, dst)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"success": true, "message": fmt.Sprintf("project %d approved", req.ProjectID)})
	}
}

// RejectHandler marks a project rejected. Can reject a pending project or an already approved/suspended project.
func RejectHandler(deps AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req projectActionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Reason == "" {
			req.Reason = "rejected by admin"
		}

		p, err := deps.DB.GetProject(req.ProjectID)
		if err != nil || p == nil {
			http.Error(w, "project not found", http.StatusNotFound)
			return
		}

		idStr := strconv.FormatInt(req.ProjectID, 10)

		if p.Status == "pending" {
			if err := deps.DB.RejectProject(req.ProjectID, req.Reason); err != nil {
				log.Printf("admin: reject failed for pending %d: %v", req.ProjectID, err)
				http.Error(w, "reject failed", http.StatusInternalServerError)
				return
			}
			_ = os.RemoveAll(filepath.Join(deps.DataDir, "quarantine", idStr))
		} else if p.Status == "approved" || p.Status == "suspended" {
			if err := deps.DB.RejectApprovedProject(req.ProjectID, req.Reason); err != nil {
				log.Printf("admin: reject failed for approved %d: %v", req.ProjectID, err)
				http.Error(w, "reject failed", http.StatusInternalServerError)
				return
			}
			// Remove from approved directory so Nginx immediately returns 404
			_ = os.RemoveAll(filepath.Join(deps.DataDir, "approved", idStr))
		} else {
			http.Error(w, "project is already rejected", http.StatusConflict)
			return
		}

		log.Printf("admin: project %d rejected: %s", req.ProjectID, req.Reason)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"success": true, "message": fmt.Sprintf("project %d rejected", req.ProjectID)})
	}
}

// SuspendHandler suspends an approved project, taking it offline immediately.
func SuspendHandler(deps AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req projectActionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if err := deps.DB.SuspendProject(req.ProjectID); err != nil {
			http.Error(w, "suspend failed: "+err.Error(), http.StatusBadRequest)
			return
		}

		log.Printf("admin: project %d suspended", req.ProjectID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"success": true, "message": fmt.Sprintf("project %d suspended", req.ProjectID)})
	}
}

// UnsuspendHandler restores a suspended project back to approved.
func UnsuspendHandler(deps AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req projectActionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if err := deps.DB.UnsuspendProject(req.ProjectID); err != nil {
			http.Error(w, "unsuspend failed: "+err.Error(), http.StatusBadRequest)
			return
		}

		log.Printf("admin: project %d unsuspended (restored to approved)", req.ProjectID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"success": true, "message": fmt.Sprintf("project %d unsuspended", req.ProjectID)})
	}
}

// DeleteHandler permanently removes a rejected or suspended project from DB and filesystem.
func DeleteHandler(deps AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req projectActionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if err := deps.DB.DeleteProject(req.ProjectID); err != nil {
			http.Error(w, "delete failed: "+err.Error(), http.StatusBadRequest)
			return
		}

		idStr := strconv.FormatInt(req.ProjectID, 10)
		_ = os.RemoveAll(filepath.Join(deps.DataDir, "quarantine", idStr))
		_ = os.RemoveAll(filepath.Join(deps.DataDir, "approved", idStr))

		log.Printf("admin: project %d permanently deleted", req.ProjectID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"success": true, "message": fmt.Sprintf("project %d permanently deleted", req.ProjectID)})
	}
}

// ListProjectsHandler returns projects filtered by ?status=.
func ListProjectsHandler(deps AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		status := r.URL.Query().Get("status")
		if status == "" {
			status = "pending"
		}

		projects, err := deps.DB.ListProjectsByStatus(status)
		if err != nil {
			log.Printf("admin: listing projects failed: %v", err)
			http.Error(w, "invalid status or internal error", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(projects); err != nil {
			log.Printf("admin: encoding project list failed: %v", err)
		}
	}
}

type fileEntry struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
}

// ListFilesHandler returns file entries for a project.
func ListFilesHandler(deps AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		idStr := r.URL.Query().Get("project_id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || id <= 0 {
			http.Error(w, "invalid project_id", http.StatusBadRequest)
			return
		}

		// Look in quarantine first, then approved
		dir := filepath.Join(deps.DataDir, "quarantine", strconv.FormatInt(id, 10))
		if _, err := os.Stat(dir); os.IsNotExist(err) {
			dir = filepath.Join(deps.DataDir, "approved", strconv.FormatInt(id, 10))
		}

		var files []fileEntry
		err = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if info.IsDir() {
				return nil
			}
			rel, _ := filepath.Rel(dir, path)
			files = append(files, fileEntry{Name: rel, Size: info.Size()})
			return nil
		})
		if err != nil {
			http.Error(w, "project files not found", http.StatusNotFound)
			return
		}
		if files == nil {
			files = []fileEntry{}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(files)
	}
}

// PreviewFileHandler safely serves a file from quarantine or approved for the sandboxed admin inspector.
func PreviewFileHandler(deps AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		idStr := r.URL.Query().Get("project_id")
		projectID, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || projectID <= 0 {
			http.Error(w, "invalid project_id", http.StatusBadRequest)
			return
		}

		filePath := r.URL.Query().Get("path")
		if filePath == "" {
			filePath = "index.html"
		}

		// Security: prevent path traversal out of project directory
		cleanPath := filepath.Clean(filePath)
		if strings.HasPrefix(cleanPath, "..") || filepath.IsAbs(cleanPath) {
			http.Error(w, "invalid path traversal", http.StatusForbidden)
			return
		}

		// Check quarantine first, then approved
		fullPath := filepath.Join(deps.DataDir, "quarantine", strconv.FormatInt(projectID, 10), cleanPath)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			fullPath = filepath.Join(deps.DataDir, "approved", strconv.FormatInt(projectID, 10), cleanPath)
			if _, err := os.Stat(fullPath); os.IsNotExist(err) {
				http.Error(w, "file not found", http.StatusNotFound)
				return
			}
		}

		// Enforce sandboxing headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'self' 'unsafe-inline' data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; object-src 'none';")

		http.ServeFile(w, r, fullPath)
	}
}
