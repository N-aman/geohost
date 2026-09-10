package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"geohost/internal/db"
	"geohost/internal/scanner"
	"geohost/internal/upload"
)

// UploadDeps bundles what the upload handler needs.
type UploadDeps struct {
	DB                *db.DB
	DataDir           string
	MaxUploadBytes    int64
	MaxExtractedBytes int64
	Scanner           *scanner.SafetyScanner
}

type uploadResponse struct {
	Status    string `json:"status"` // "approved" or "pending"
	ProjectID int64  `json:"project_id"`
	Subdomain string `json:"subdomain"`
	Score     int    `json:"score"`
	Message   string `json:"message"`
}

// UploadHandler processes zip uploads, enforces user authentication, runs
// automated safety scanning, and auto-approves safe projects or queues suspicious ones.
func UploadHandler(deps UploadDeps) http.HandlerFunc {
	if deps.Scanner == nil {
		deps.Scanner = scanner.NewSafetyScanner()
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// 1. Enforce authentication: only logged-in users can upload
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil {
			http.Error(w, "authentication required: please sign in to upload", http.StatusUnauthorized)
			return
		}
		userID, err := deps.DB.ValidateSession(cookie.Value)
		if err != nil {
			http.Error(w, "authentication required: invalid or expired session", http.StatusUnauthorized)
			return
		}

		// 2. Request body cap (e.g. 50MB)
		r.Body = http.MaxBytesReader(w, r.Body, deps.MaxUploadBytes)

		subdomain := r.FormValue("subdomain")
		if !db.ValidSubdomain(subdomain) {
			http.Error(w, "invalid subdomain format: 3-63 lowercase alphanumeric characters or hyphens", http.StatusBadRequest)
			return
		}

		// 3. Subdomain collision check
		existing, err := deps.DB.GetProjectBySubdomain(subdomain)
		if err != nil {
			log.Printf("upload: subdomain lookup failed: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if existing != nil {
			http.Error(w, "subdomain already taken", http.StatusConflict)
			return
		}

		// 4. Extract site archive
		file, _, err := r.FormFile("site")
		if err != nil {
			http.Error(w, "missing 'site' file field", http.StatusBadRequest)
			return
		}
		defer file.Close()

		tempQuarantineID, err := randomHexName(8)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		tempQuarantineDir := filepath.Join(deps.DataDir, "quarantine", "tmp_"+tempQuarantineID)
		if err := os.MkdirAll(tempQuarantineDir, 0o755); err != nil {
			log.Printf("upload: creating temp quarantine dir failed: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer os.RemoveAll(tempQuarantineDir)

		zipPath, err := saveUploadToTemp(tempQuarantineDir, file)
		if err != nil {
			log.Printf("upload: saving raw upload failed: %v", err)
			http.Error(w, "upload failed to save", http.StatusBadRequest)
			return
		}

		result, err := upload.SafeExtract(zipPath, tempQuarantineDir, deps.MaxExtractedBytes)
		if err != nil {
			log.Printf("upload: extraction rejected for %s: %v", subdomain, err)
			http.Error(w, "archive failed validation: "+err.Error(), http.StatusBadRequest)
			return
		}

		// 5. Must have index.html at root
		if _, err := os.Stat(filepath.Join(tempQuarantineDir, "index.html")); err != nil {
			http.Error(w, "archive must contain index.html at its root", http.StatusBadRequest)
			return
		}

		// 6. Automated Safety Scan
		report, err := deps.Scanner.ScanDirectory(tempQuarantineDir)
		if err != nil {
			log.Printf("upload: safety scan error for %s: %v", subdomain, err)
			http.Error(w, "security scanning error", http.StatusInternalServerError)
			return
		}

		// If critical threats found (malware, cryptominer, phishing): reject immediately
		if report.Decision == scanner.DecisionAutoReject {
			log.Printf("upload: project %s auto-rejected by scanner: %s (score %d)", subdomain, report.BlockReason, report.Score)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{
				"error":        "Security policy violation",
				"block_reason": report.BlockReason,
				"score":        report.Score,
				"findings":     report.Findings,
			})
			return
		}

		// 7. Persist project in database
		projectID, err := deps.DB.CreatePendingProject(subdomain, &userID, report.Score, report.ToJSON())
		if err != nil {
			log.Printf("upload: database error for %s: %v", subdomain, err)
			http.Error(w, "failed to record project", http.StatusInternalServerError)
			return
		}

		// Move from temp quarantine to official project quarantine directory
		projQuarantineDir := filepath.Join(deps.DataDir, "quarantine", strconv.FormatInt(projectID, 10))
		_ = os.RemoveAll(projQuarantineDir)
		if err := os.Rename(tempQuarantineDir, projQuarantineDir); err != nil {
			log.Printf("upload: rename to quarantine failed: %v", err)
			http.Error(w, "internal filesystem error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		// 8. Auto-Approve or Queue for Manual Review
		if report.Decision == scanner.DecisionAutoApprove {
			// Auto-approve: move files directly to approved/ and update status
			approvedDir := filepath.Join(deps.DataDir, "approved", strconv.FormatInt(projectID, 10))
			_ = os.RemoveAll(approvedDir)
			if err := os.Rename(projQuarantineDir, approvedDir); err != nil {
				log.Printf("upload: moving to approved failed for %d: %v", projectID, err)
			} else {
				_ = deps.DB.AutoApproveProject(projectID)
				log.Printf("upload: project %d (%s) AUTO-APPROVED (score: %d, files: %d, bytes: %d)",
					projectID, subdomain, report.Score, result.FilesExtracted, result.TotalBytes)

				w.WriteHeader(http.StatusCreated)
				json.NewEncoder(w).Encode(uploadResponse{
					Status:    "approved",
					ProjectID: projectID,
					Subdomain: subdomain,
					Score:     report.Score,
					Message:   fmt.Sprintf("Site auto-approved! Live at https://%s.geohost.site", subdomain),
				})
				return
			}
		}

		// Manual Review Required
		log.Printf("upload: project %d (%s) QUEUED FOR REVIEW (score: %d, files: %d, bytes: %d)",
			projectID, subdomain, report.Score, result.FilesExtracted, result.TotalBytes)

		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(uploadResponse{
			Status:    "pending",
			ProjectID: projectID,
			Subdomain: subdomain,
			Score:     report.Score,
			Message:   fmt.Sprintf("Uploaded, pending admin review (project id %d)", projectID),
		})
	}
}

func saveUploadToTemp(dir string, src io.Reader) (string, error) {
	name, err := randomHexName(16)
	if err != nil {
		return "", err
	}
	path := filepath.Join(dir, name+".zip")

	out, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return "", err
	}
	defer out.Close()

	if _, err := io.Copy(out, src); err != nil {
		return "", err
	}
	return path, nil
}

func randomHexName(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
