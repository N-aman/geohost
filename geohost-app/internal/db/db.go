// Package db provides the data access layer for geohost. Every query
// in this package uses parameterized statements — string concatenation
// into SQL is never acceptable here, even for values that look "safe"
// (like an integer ID), because that discipline is what prevents SQL
// injection bugs from ever being introduced later during refactors.
package db

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	_ "github.com/mattn/go-sqlite3"
)

// subdomainPattern defines the only characters ever allowed in a
// subdomain: lowercase letters, digits, and hyphens, 3-63 characters.
// This mirrors DNS label rules and is enforced BEFORE any subdomain
// value is used in a query or, later, a filesystem path. Reject
// anything that doesn't match — never attempt to sanitize/escape it.
var subdomainPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$`)

var ErrProjectNotPending = fmt.Errorf("project is not in pending status")
var ErrInvalidCredentials = fmt.Errorf("invalid email or password")
var ErrInvalidSession = fmt.Errorf("invalid or expired session")
var ErrUnauthorized = fmt.Errorf("unauthorized action")
var ErrNotFound = fmt.Errorf("resource not found")

type DB struct {
	conn *sql.DB
}

// Conn returns the underlying database connection for external modules (e.g. analytics).
func (d *DB) Conn() *sql.DB {
	return d.conn
}

// Open opens the SQLite database at path, enables foreign keys and WAL mode,
// and automatically migrates schema and tables to the latest version.
func Open(path string) (*DB, error) {
	conn, err := sql.Open("sqlite3", path+"?_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("connecting to database: %w", err)
	}

	// Performance and reliability pragmas (WAL mode, busy timeout)
	if !strings.Contains(path, ":memory:") {
		if _, err := conn.Exec("PRAGMA journal_mode = WAL;"); err != nil {
			return nil, fmt.Errorf("enabling WAL: %w", err)
		}
	}
	if _, err := conn.Exec("PRAGMA busy_timeout = 5000;"); err != nil {
		return nil, fmt.Errorf("setting busy_timeout: %w", err)
	}

	d := &DB{conn: conn}
	if err := d.migrate(); err != nil {
		return nil, fmt.Errorf("running migrations: %w", err)
	}
	return d, nil
}

func (d *DB) Close() error {
	return d.conn.Close()
}

// migrate ensures all tables, columns, and indexes exist.
func (d *DB) migrate() error {
	baseTables := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL DEFAULT '',
		google_id TEXT,
		display_name TEXT NOT NULL DEFAULT '',
		is_admin BOOLEAN NOT NULL DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS projects (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		owner_id INTEGER REFERENCES users(id),
		subdomain TEXT UNIQUE NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		storage_path TEXT NOT NULL DEFAULT '',
		file_size_bytes INTEGER DEFAULT 0,
		rejection_reason TEXT DEFAULT '',
		reviewed_by INTEGER REFERENCES users(id),
		reviewed_at TIMESTAMP,
		is_public BOOLEAN NOT NULL DEFAULT 1,
		scan_score INTEGER DEFAULT 100,
		scan_report TEXT DEFAULT '',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS audit_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		project_id INTEGER REFERENCES projects(id),
		action TEXT NOT NULL,
		actor_id INTEGER REFERENCES users(id),
		metadata TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS sessions (
		token_hash TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		expires_at TIMESTAMP NOT NULL
	);

	CREATE TABLE IF NOT EXISTS pageviews (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
		visitor_hash TEXT NOT NULL,
		path TEXT NOT NULL DEFAULT '/',
		referrer TEXT NOT NULL DEFAULT '',
		country TEXT NOT NULL DEFAULT 'XX',
		device TEXT NOT NULL DEFAULT 'desktop',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS daily_stats (
		project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
		date TEXT NOT NULL,
		pageviews INTEGER NOT NULL DEFAULT 0,
		unique_visitors INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (project_id, date)
	);
	`
	if _, err := d.conn.Exec(baseTables); err != nil {
		return fmt.Errorf("executing base schema: %w", err)
	}

	// Incremental column migrations for existing databases
	if err := d.ensureColumn("users", "google_id", "TEXT"); err != nil {
		return err
	}
	if err := d.ensureColumn("users", "display_name", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := d.ensureColumn("projects", "is_public", "BOOLEAN NOT NULL DEFAULT 1"); err != nil {
		return err
	}
	if err := d.ensureColumn("projects", "scan_score", "INTEGER DEFAULT 100"); err != nil {
		return err
	}
	if err := d.ensureColumn("projects", "scan_report", "TEXT DEFAULT ''"); err != nil {
		return err
	}

	indexes := `
	CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL AND google_id != '';
	CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
	CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
	CREATE INDEX IF NOT EXISTS idx_projects_is_public ON projects(is_public);
	CREATE INDEX IF NOT EXISTS idx_pv_proj_time ON pageviews(project_id, created_at);
	`
	if _, err := d.conn.Exec(indexes); err != nil {
		return fmt.Errorf("executing indexes: %w", err)
	}

	return nil
}

func (d *DB) ensureColumn(table, column, colType string) error {
	rows, err := d.conn.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return fmt.Errorf("querying pragma table_info for %s: %w", table, err)
	}
	defer rows.Close()

	hasCol := false
	for rows.Next() {
		var cid int
		var name, cType string
		var notNull, pk int
		var dfltValue sql.NullString
		if err := rows.Scan(&cid, &name, &cType, &notNull, &dfltValue, &pk); err != nil {
			return err
		}
		if strings.EqualFold(name, column) {
			hasCol = true
			break
		}
	}
	if !hasCol {
		alter := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s;", table, column, colType)
		if _, err := d.conn.Exec(alter); err != nil {
			return fmt.Errorf("adding column %s to %s: %w", column, table, err)
		}
	}
	return nil
}

// ValidSubdomain reports whether s is a syntactically valid subdomain.
func ValidSubdomain(s string) bool {
	return subdomainPattern.MatchString(s)
}

type ResolvedProject struct {
	ID     int64
	Status string
}

// GetProjectBySubdomain looks up a project by its subdomain.
func (d *DB) GetProjectBySubdomain(subdomain string) (*ResolvedProject, error) {
	if !ValidSubdomain(subdomain) {
		return nil, fmt.Errorf("invalid subdomain format: %q", subdomain)
	}

	row := d.conn.QueryRow(`SELECT id, status FROM projects WHERE subdomain = ?`, subdomain)
	var p ResolvedProject
	if err := row.Scan(&p.ID, &p.Status); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("querying project by subdomain: %w", err)
	}
	return &p, nil
}

// CreatePendingProject inserts a new project row with status 'pending'.
func (d *DB) CreatePendingProject(subdomain string, ownerID *int64, scanScore int, scanReport string) (int64, error) {
	if !ValidSubdomain(subdomain) {
		return 0, fmt.Errorf("invalid subdomain format: %q", subdomain)
	}
	res, err := d.conn.Exec(
		`INSERT INTO projects (owner_id, subdomain, status, storage_path, scan_score, scan_report, is_public) 
		 VALUES (?, ?, 'pending', '', ?, ?, 1)`,
		ownerID, subdomain, scanScore, scanReport,
	)
	if err != nil {
		return 0, fmt.Errorf("inserting project: %w", err)
	}
	return res.LastInsertId()
}

// AutoApproveProject sets a project's status to 'approved' if it was pending.
func (d *DB) AutoApproveProject(projectID int64) error {
	res, err := d.conn.Exec(
		`UPDATE projects SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`,
		projectID,
	)
	if err != nil {
		return fmt.Errorf("auto-approving project: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}
	if n == 0 {
		return ErrProjectNotPending
	}
	return nil
}

// MarkProjectRejected sets a project's status to 'rejected' with reason.
func (d *DB) MarkProjectRejected(projectID int64, reason string) error {
	_, err := d.conn.Exec(
		`UPDATE projects SET status = 'rejected', rejection_reason = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
		reason, projectID,
	)
	if err != nil {
		return fmt.Errorf("marking project rejected: %w", err)
	}
	return nil
}

// ApproveProject transitions status from 'pending' to 'approved'.
func (d *DB) ApproveProject(projectID int64) error {
	res, err := d.conn.Exec(
		`UPDATE projects SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`,
		projectID,
	)
	if err != nil {
		return fmt.Errorf("approving project: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking approve result: %w", err)
	}
	if n == 0 {
		return ErrProjectNotPending
	}
	return nil
}

// RejectProject sets a pending project's status to 'rejected'.
func (d *DB) RejectProject(projectID int64, reason string) error {
	res, err := d.conn.Exec(
		`UPDATE projects SET status = 'rejected', rejection_reason = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`,
		reason, projectID,
	)
	if err != nil {
		return fmt.Errorf("rejecting project: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking reject result: %w", err)
	}
	if n == 0 {
		return ErrProjectNotPending
	}
	return nil
}

// SuspendProject transitions an approved project to 'suspended'.
func (d *DB) SuspendProject(projectID int64) error {
	res, err := d.conn.Exec(
		`UPDATE projects SET status = 'suspended', reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved'`,
		projectID,
	)
	if err != nil {
		return fmt.Errorf("suspending project: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil || n == 0 {
		return fmt.Errorf("project is not in approved status")
	}
	return nil
}

// UnsuspendProject transitions a suspended project back to 'approved'.
func (d *DB) UnsuspendProject(projectID int64) error {
	res, err := d.conn.Exec(
		`UPDATE projects SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'suspended'`,
		projectID,
	)
	if err != nil {
		return fmt.Errorf("unsuspending project: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil || n == 0 {
		return fmt.Errorf("project is not in suspended status")
	}
	return nil
}

// RejectApprovedProject allows an admin to reject a project that was previously approved or suspended.
func (d *DB) RejectApprovedProject(projectID int64, reason string) error {
	res, err := d.conn.Exec(
		`UPDATE projects SET status = 'rejected', rejection_reason = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('approved', 'suspended')`,
		reason, projectID,
	)
	if err != nil {
		return fmt.Errorf("rejecting approved project: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil || n == 0 {
		return fmt.Errorf("project is not approved or suspended")
	}
	return nil
}

// DeleteProject permanently removes a rejected or suspended project from the database.
func (d *DB) DeleteProject(projectID int64) error {
	res, err := d.conn.Exec(
		`DELETE FROM projects WHERE id = ? AND status IN ('rejected', 'suspended')`,
		projectID,
	)
	if err != nil {
		return fmt.Errorf("deleting project: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil || n == 0 {
		return fmt.Errorf("only rejected or suspended projects can be deleted")
	}
	return nil
}

// GetProject fetches a project by ID regardless of status.
func (d *DB) GetProject(projectID int64) (*ResolvedProject, error) {
	row := d.conn.QueryRow(`SELECT id, status FROM projects WHERE id = ?`, projectID)
	var p ResolvedProject
	if err := row.Scan(&p.ID, &p.Status); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("querying project by id: %w", err)
	}
	return &p, nil
}

// ProjectSummary represents a project record for views and dashboards.
type ProjectSummary struct {
	ID              int64      `json:"id"`
	OwnerID         *int64     `json:"owner_id,omitempty"`
	Subdomain       string     `json:"subdomain"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
	RejectionReason string     `json:"rejection_reason,omitempty"`
	IsPublic        bool       `json:"is_public"`
	ScanScore       int        `json:"scan_score"`
	ScanReport      string     `json:"scan_report,omitempty"`
}

// GetProjectByID fetches a single project's summary by ID.
func (d *DB) GetProjectByID(projectID int64) (*ProjectSummary, error) {
	row := d.conn.QueryRow(
		`SELECT id, owner_id, subdomain, status, created_at, COALESCE(rejection_reason, ''), is_public, scan_score, COALESCE(scan_report, '') 
		 FROM projects WHERE id = ?`,
		projectID,
	)
	var p ProjectSummary
	if err := row.Scan(&p.ID, &p.OwnerID, &p.Subdomain, &p.Status, &p.CreatedAt, &p.RejectionReason, &p.IsPublic, &p.ScanScore, &p.ScanReport); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("querying project by id: %w", err)
	}
	return &p, nil
}

// ListProjectsByStatus returns projects with the given status.
func (d *DB) ListProjectsByStatus(status string) ([]ProjectSummary, error) {
	switch status {
	case "pending", "approved", "rejected", "suspended":
		// allowed
	default:
		return nil, fmt.Errorf("invalid status filter: %q", status)
	}

	rows, err := d.conn.Query(
		`SELECT id, owner_id, subdomain, status, created_at, COALESCE(rejection_reason, ''), is_public, scan_score, COALESCE(scan_report, '') 
		 FROM projects WHERE status = ? ORDER BY created_at ASC`,
		status,
	)
	if err != nil {
		return nil, fmt.Errorf("listing projects: %w", err)
	}
	defer rows.Close()

	var out []ProjectSummary
	for rows.Next() {
		var p ProjectSummary
		if err := rows.Scan(&p.ID, &p.OwnerID, &p.Subdomain, &p.Status, &p.CreatedAt, &p.RejectionReason, &p.IsPublic, &p.ScanScore, &p.ScanReport); err != nil {
			return nil, fmt.Errorf("scanning project row: %w", err)
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating project rows: %w", err)
	}
	if out == nil {
		out = []ProjectSummary{}
	}
	return out, nil
}

// GetProjectsByOwner returns all projects owned by a specific user.
func (d *DB) GetProjectsByOwner(ownerID int64) ([]ProjectSummary, error) {
	rows, err := d.conn.Query(
		`SELECT id, owner_id, subdomain, status, created_at, COALESCE(rejection_reason, ''), is_public, scan_score, COALESCE(scan_report, '') 
		 FROM projects WHERE owner_id = ? ORDER BY created_at DESC`,
		ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("querying user projects: %w", err)
	}
	defer rows.Close()

	var out []ProjectSummary
	for rows.Next() {
		var p ProjectSummary
		if err := rows.Scan(&p.ID, &p.OwnerID, &p.Subdomain, &p.Status, &p.CreatedAt, &p.RejectionReason, &p.IsPublic, &p.ScanScore, &p.ScanReport); err != nil {
			return nil, fmt.Errorf("scanning user project: %w", err)
		}
		out = append(out, p)
	}
	if out == nil {
		out = []ProjectSummary{}
	}
	return out, nil
}

// ListPublicProjects returns all approved projects that have is_public = 1.
func (d *DB) ListPublicProjects() ([]ProjectSummary, error) {
	rows, err := d.conn.Query(
		`SELECT id, owner_id, subdomain, status, created_at, COALESCE(rejection_reason, ''), is_public, scan_score, COALESCE(scan_report, '') 
		 FROM projects WHERE status = 'approved' AND is_public = 1 ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("querying public projects: %w", err)
	}
	defer rows.Close()

	var out []ProjectSummary
	for rows.Next() {
		var p ProjectSummary
		if err := rows.Scan(&p.ID, &p.OwnerID, &p.Subdomain, &p.Status, &p.CreatedAt, &p.RejectionReason, &p.IsPublic, &p.ScanScore, &p.ScanReport); err != nil {
			return nil, fmt.Errorf("scanning public project: %w", err)
		}
		out = append(out, p)
	}
	if out == nil {
		out = []ProjectSummary{}
	}
	return out, nil
}

// SetProjectVisibility toggles the is_public flag for a project owned by ownerID.
func (d *DB) SetProjectVisibility(projectID int64, ownerID int64, isPublic bool) error {
	pubVal := 0
	if isPublic {
		pubVal = 1
	}
	res, err := d.conn.Exec(
		`UPDATE projects SET is_public = ? WHERE id = ? AND owner_id = ?`,
		pubVal, projectID, ownerID,
	)
	if err != nil {
		return fmt.Errorf("updating visibility: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil || n == 0 {
		return fmt.Errorf("project not found or not owned by user")
	}
	return nil
}

// IsProjectOwnerOrAdmin checks if a user is the owner of a project or an administrator.
func (d *DB) IsProjectOwnerOrAdmin(projectID int64, userID int64) (bool, error) {
	// First check if user is admin
	var isAdmin bool
	err := d.conn.QueryRow(`SELECT is_admin FROM users WHERE id = ?`, userID).Scan(&isAdmin)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, ErrUnauthorized
		}
		return false, err
	}
	if isAdmin {
		return true, nil
	}

	// Check if user is owner
	var ownerID sql.NullInt64
	err = d.conn.QueryRow(`SELECT owner_id FROM projects WHERE id = ?`, projectID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, ErrNotFound
		}
		return false, err
	}
	if ownerID.Valid && ownerID.Int64 == userID {
		return true, nil
	}

	return false, nil
}

// User represents an authenticated platform user.
type User struct {
	ID          int64     `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	GoogleID    string    `json:"google_id,omitempty"`
	IsAdmin     bool      `json:"is_admin"`
	CreatedAt   time.Time `json:"created_at"`
}

// GetUserByID fetches user details by ID.
func (d *DB) GetUserByID(id int64) (*User, error) {
	row := d.conn.QueryRow(
		`SELECT id, email, display_name, COALESCE(google_id, ''), is_admin, created_at FROM users WHERE id = ?`,
		id,
	)
	var u User
	if err := row.Scan(&u.ID, &u.Email, &u.DisplayName, &u.GoogleID, &u.IsAdmin, &u.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("querying user by id: %w", err)
	}
	return &u, nil
}

// FindOrCreateGoogleUser finds a user by google_id or email, or creates a new one.
func (d *DB) FindOrCreateGoogleUser(email, googleID, displayName string) (int64, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))

	// 1. Check if user with this google_id exists
	var id int64
	err := d.conn.QueryRow(`SELECT id FROM users WHERE google_id = ?`, googleID).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, fmt.Errorf("querying user by google_id: %w", err)
	}

	// 2. Check if user with this email exists (e.g. existing admin or email-registered user)
	err = d.conn.QueryRow(`SELECT id FROM users WHERE LOWER(email) = ?`, cleanEmail).Scan(&id)
	if err == nil {
		// Link google_id and update display_name if empty
		_, _ = d.conn.Exec(`UPDATE users SET google_id = ?, display_name = CASE WHEN display_name = '' THEN ? ELSE display_name END WHERE id = ?`, googleID, displayName, id)
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, fmt.Errorf("querying user by email: %w", err)
	}

	// 3. Auto-register new user
	res, err := d.conn.Exec(
		`INSERT INTO users (email, password_hash, google_id, display_name, is_admin) VALUES (?, '', ?, ?, 0)`,
		cleanEmail, googleID, displayName,
	)
	if err != nil {
		return 0, fmt.Errorf("inserting new google user: %w", err)
	}
	return res.LastInsertId()
}

// AuthUser verifies email+password against the stored bcrypt hash.
// For admin login, admin accounts have is_admin = 1.
func (d *DB) AuthUser(email, password string) (int64, error) {
	row := d.conn.QueryRow(`SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER(?) AND is_admin = 1`, email)
	var id int64
	var hash string
	if err := row.Scan(&id, &hash); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, ErrInvalidCredentials
		}
		return 0, fmt.Errorf("querying user: %w", err)
	}
	if hash == "" {
		// Google-only account without password
		return 0, ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return 0, ErrInvalidCredentials
	}
	return id, nil
}

// CreateSession generates a new random session token.
func (d *DB) CreateSession(userID int64, ttl time.Duration) (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", fmt.Errorf("generating session token: %w", err)
	}
	token := hex.EncodeToString(tokenBytes)
	tokenHash := hashToken(token)

	_, err := d.conn.Exec(
		`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
		tokenHash, userID, time.Now().Add(ttl),
	)
	if err != nil {
		return "", fmt.Errorf("storing session: %w", err)
	}
	return token, nil
}

// ValidateSession checks a raw token from a client cookie against stored sessions.
func (d *DB) ValidateSession(token string) (int64, error) {
	tokenHash := hashToken(token)
	row := d.conn.QueryRow(
		`SELECT user_id, expires_at FROM sessions WHERE token_hash = ?`,
		tokenHash,
	)
	var userID int64
	var expiresAt time.Time
	if err := row.Scan(&userID, &expiresAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, ErrInvalidSession
		}
		return 0, fmt.Errorf("querying session: %w", err)
	}
	if time.Now().After(expiresAt) {
		return 0, ErrInvalidSession
	}
	return userID, nil
}

// DeleteSession removes a session (logout).
func (d *DB) DeleteSession(token string) error {
	_, err := d.conn.Exec(`DELETE FROM sessions WHERE token_hash = ?`, hashToken(token))
	return err
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
