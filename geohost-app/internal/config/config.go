// Package config loads application configuration from environment
// variables. No values are hardcoded in application logic — this is
// the single place defaults live, so deployment-specific values never
// leak into business logic or version control.
package config

import (
	"fmt"
	"os"
)

type Config struct {
	// DBPath is the absolute path to the SQLite database file.
	DBPath string
	// DataDir is the absolute path to the root data directory,
	// containing quarantine/, approved/, and rejected/ subdirectories.
	// All served content is resolved relative to DataDir/approved —
	// never trust a path built any other way.
	DataDir string
	// ListenAddr is the address the resolve/API server listens on.
	// Bound to localhost only — Nginx is the only intended caller,
	// this should never be exposed directly to the internet.
	ListenAddr string
	// MaxUploadBytes caps the size of an accepted zip upload, checked
	// before and during processing.
	MaxUploadBytes int64
	// MaxExtractedBytes caps total decompressed size, independent of
	// the zip's on-disk size. Primary defense against zip bombs.
	MaxExtractedBytes int64
	// GoogleClientID is the OAuth Web Client ID from Google Cloud Console.
	GoogleClientID string
	// AnalyticsSecret is used to salt daily anonymous visitor hashes.
	AnalyticsSecret string
}

// Load reads configuration from environment variables and validates
// that required paths exist.
func Load() (*Config, error) {
	dataDir := getEnv("GEOHOST_DATA_DIR", "")
	if dataDir == "" {
		return nil, fmt.Errorf("GEOHOST_DATA_DIR must be set")
	}
	if info, err := os.Stat(dataDir); err != nil || !info.IsDir() {
		return nil, fmt.Errorf("GEOHOST_DATA_DIR %q is not a valid directory: %w", dataDir, err)
	}

	dbPath := getEnv("GEOHOST_DB_PATH", "")
	if dbPath == "" {
		return nil, fmt.Errorf("GEOHOST_DB_PATH must be set")
	}

	listenAddr := getEnv("GEOHOST_LISTEN_ADDR", "127.0.0.1:8080")
	const (
		defaultMaxUploadBytes    = 50 * 1024 * 1024  // 50MB zip on disk
		defaultMaxExtractedBytes = 200 * 1024 * 1024 // 200MB decompressed
	)
	googleClientID := getEnv("GOOGLE_CLIENT_ID", "")
	analyticsSecret := getEnv("GEOHOST_ANALYTICS_SECRET", "geohost-analytics-secret-salt-2026")

	return &Config{
		DBPath:            dbPath,
		DataDir:           dataDir,
		ListenAddr:        listenAddr,
		MaxUploadBytes:    defaultMaxUploadBytes,
		MaxExtractedBytes: defaultMaxExtractedBytes,
		GoogleClientID:    googleClientID,
		AnalyticsSecret:   analyticsSecret,
	}, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
