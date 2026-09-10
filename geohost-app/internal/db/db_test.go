package db

import (
	"testing"
)

func setupTestDB(t *testing.T) *DB {
	t.Helper()
	database, err := Open(":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory test db: %v", err)
	}
	t.Cleanup(func() {
		_ = database.Close()
	})
	return database
}

func TestSubdomainValidation(t *testing.T) {
	tests := []struct {
		subdomain string
		valid     bool
	}{
		{"my-app", true},
		{"app123", true},
		{"abc", true},
		{"ab", false},
		{"-bad", false},
		{"bad-", false},
		{"BadName", false},
		{"has..dot", false},
		{"toolongdomainnameexceedingthelimitsofsixtythreecharactersinlength12345", false},
	}

	for _, tt := range tests {
		t.Run(tt.subdomain, func(t *testing.T) {
			got := ValidSubdomain(tt.subdomain)
			if got != tt.valid {
				t.Errorf("ValidSubdomain(%q) = %v, want %v", tt.subdomain, got, tt.valid)
			}
		})
	}
}

func TestProjectLifecycle(t *testing.T) {
	db := setupTestDB(t)

	// Create user
	userID, err := db.FindOrCreateGoogleUser("user@example.com", "google-123", "Test User")
	if err != nil {
		t.Fatalf("FindOrCreateGoogleUser failed: %v", err)
	}

	// 1. Create Pending Project
	pid, err := db.CreatePendingProject("cool-site", &userID, 95, `{"score":95}`)
	if err != nil {
		t.Fatalf("CreatePendingProject failed: %v", err)
	}

	// 2. Fetch project
	p, err := db.GetProjectByID(pid)
	if err != nil || p == nil {
		t.Fatalf("GetProjectByID failed: %v", err)
	}
	if p.Status != "pending" || p.ScanScore != 95 || !p.IsPublic {
		t.Errorf("unexpected project details: %+v", p)
	}

	// 3. Auto-approve
	if err := db.AutoApproveProject(pid); err != nil {
		t.Fatalf("AutoApproveProject failed: %v", err)
	}

	// 4. Suspend project
	if err := db.SuspendProject(pid); err != nil {
		t.Fatalf("SuspendProject failed: %v", err)
	}
	p, _ = db.GetProjectByID(pid)
	if p.Status != "suspended" {
		t.Errorf("expected suspended, got %s", p.Status)
	}

	// 5. Unsuspend project
	if err := db.UnsuspendProject(pid); err != nil {
		t.Fatalf("UnsuspendProject failed: %v", err)
	}
	p, _ = db.GetProjectByID(pid)
	if p.Status != "approved" {
		t.Errorf("expected approved, got %s", p.Status)
	}

	// 6. Reject approved project
	if err := db.RejectApprovedProject(pid, "policy violation"); err != nil {
		t.Fatalf("RejectApprovedProject failed: %v", err)
	}
	p, _ = db.GetProjectByID(pid)
	if p.Status != "rejected" {
		t.Errorf("expected rejected, got %s", p.Status)
	}

	// 7. Delete rejected project
	if err := db.DeleteProject(pid); err != nil {
		t.Fatalf("DeleteProject failed: %v", err)
	}
	p, _ = db.GetProjectByID(pid)
	if p != nil {
		t.Errorf("expected deleted project to return nil, got %+v", p)
	}
}

func TestVisibilityAndGallery(t *testing.T) {
	db := setupTestDB(t)

	uid, err := db.FindOrCreateGoogleUser("creator@example.com", "gid-1", "Creator")
	if err != nil {
		t.Fatalf("create user: %v", err)
	}

	pid, err := db.CreatePendingProject("public-site", &uid, 100, "")
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	_ = db.ApproveProject(pid)

	// Should be listed in public projects
	publicProjects, err := db.ListPublicProjects()
	if err != nil {
		t.Fatalf("ListPublicProjects failed: %v", err)
	}
	if len(publicProjects) != 1 {
		t.Fatalf("expected 1 public project, got %d", len(publicProjects))
	}

	// Hide from public gallery
	if err := db.SetProjectVisibility(pid, uid, false); err != nil {
		t.Fatalf("SetProjectVisibility failed: %v", err)
	}

	// Should not be in public gallery anymore
	publicProjects, err = db.ListPublicProjects()
	if err != nil || len(publicProjects) != 0 {
		t.Errorf("expected 0 public projects after hiding, got %d", len(publicProjects))
	}

	// But should still be in owner's projects
	ownerProjects, err := db.GetProjectsByOwner(uid)
	if err != nil || len(ownerProjects) != 1 {
		t.Errorf("expected 1 owner project, got %d", len(ownerProjects))
	}
}

func TestAnalyticsAggregation(t *testing.T) {
	db := setupTestDB(t)

	pid, _ := db.CreatePendingProject("analytics-site", nil, 100, "")

	events := []PageviewEvent{
		{ProjectID: pid, VisitorHash: "hash1", Path: "/", Referrer: "google.com", Country: "IN", Device: "mobile"},
		{ProjectID: pid, VisitorHash: "hash1", Path: "/about", Referrer: "google.com", Country: "IN", Device: "mobile"},
		{ProjectID: pid, VisitorHash: "hash2", Path: "/", Referrer: "twitter.com", Country: "US", Device: "desktop"},
	}

	if err := db.BatchRecordPageviews(events); err != nil {
		t.Fatalf("BatchRecordPageviews failed: %v", err)
	}

	summary, err := db.GetAnalyticsSummary(pid, 7)
	if err != nil {
		t.Fatalf("GetAnalyticsSummary failed: %v", err)
	}

	if summary.TotalPageviews != 3 {
		t.Errorf("expected 3 total pageviews, got %d", summary.TotalPageviews)
	}
	if summary.UniqueVisitors != 2 {
		t.Errorf("expected 2 unique visitors, got %d", summary.UniqueVisitors)
	}
	if len(summary.ByCountry) != 2 {
		t.Errorf("expected 2 countries, got %d", len(summary.ByCountry))
	}
}
