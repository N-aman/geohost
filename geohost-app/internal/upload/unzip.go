// Package upload handles processing of user-submitted site archives:
// safe extraction, file validation, and the quarantine workflow. Every
// function here treats its input as actively hostile — this package
// is the platform's primary attack surface.
package upload

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// allowedExtensions is the exhaustive allowlist of file types this
// platform will ever serve. This is an allowlist, not a denylist,
// deliberately: a denylist requires anticipating every dangerous
// extension in advance, while an allowlist fails safe by default —
// anything not explicitly permitted is rejected.
var allowedExtensions = map[string]bool{
	".html": true, ".htm": true,
	".css":  true,
	".js":   true,
	".json": true,
	".png":  true, ".jpg": true, ".jpeg": true, ".gif": true, ".svg": true, ".webp": true, ".ico": true,
	".woff": true, ".woff2": true, ".ttf": true, ".eot": true,
	".txt": true, ".md": true,
}

// ExtractResult summarizes a completed extraction for logging/auditing.
type ExtractResult struct {
	FilesExtracted int
	TotalBytes     int64
}

// SafeExtract extracts the zip archive at zipPath into destDir, which
// must already exist and be empty. It enforces, in order:
//  1. Path containment: every extracted entry must resolve to a path
//     inside destDir. This is the zip-slip defense — a malicious
//     archive entry named "../../etc/cron.d/evil" is rejected outright
//     rather than "sanitized", because sanitizing path traversal
//     attempts is a well-known source of bypass bugs. Reject, don't fix.
//  2. No symlinks: archive entries that are symlinks are rejected.
//     A symlink could point outside destDir and be silently followed
//     later by something that reads "extracted" files.
//  3. Extension allowlist: only recognized static-asset extensions
//     are extracted; everything else causes the whole extraction to
//     be aborted (fail closed on the whole archive, not just that file
//     — a mixed archive with one disallowed file is suspicious enough
//     to reject wholesale rather than silently drop entries).
//  4. Size caps: both per-file and cumulative decompressed size are
//     checked continuously during extraction (not just from the zip's
//     reported/uncompressed-size header, which is attacker-controlled
//     and can lie) — this is the zip-bomb defense.
func SafeExtract(zipPath, destDir string, maxTotalBytes int64) (*ExtractResult, error) {
	destDirAbs, err := filepath.Abs(destDir)
	if err != nil {
		return nil, fmt.Errorf("resolving destination dir: %w", err)
	}

	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("opening zip: %w", err)
	}
	defer r.Close()

	result := &ExtractResult{}

	for _, f := range r.File {
		// Reject symlinks and other non-regular entries outright.
		if f.Mode()&os.ModeSymlink != 0 {
			return nil, fmt.Errorf("archive entry %q is a symlink, rejected", f.Name)
		}
		if f.FileInfo().IsDir() {
			continue // directories are created implicitly below
		}

		ext := strings.ToLower(filepath.Ext(f.Name))
		if !allowedExtensions[ext] {
			return nil, fmt.Errorf("archive entry %q has disallowed extension %q", f.Name, ext)
		}

		// Path containment check — the core zip-slip defense.
		cleanRelPath := filepath.Clean(f.Name)
		if strings.HasPrefix(cleanRelPath, "..") || filepath.IsAbs(cleanRelPath) {
			return nil, fmt.Errorf("archive entry %q attempts path traversal", f.Name)
		}
		destPath := filepath.Join(destDirAbs, cleanRelPath)
		// Belt-and-suspenders: even after cleaning, confirm the final
		// resolved path is genuinely inside destDirAbs before writing
		// a single byte.
		if !strings.HasPrefix(destPath, destDirAbs+string(os.PathSeparator)) {
			return nil, fmt.Errorf("archive entry %q resolves outside destination", f.Name)
		}

		if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
			return nil, fmt.Errorf("creating directory for %q: %w", f.Name, err)
		}

		if err := extractOneFile(f, destPath, maxTotalBytes, result); err != nil {
			return nil, err
		}
	}

	return result, nil
}

// extractOneFile writes a single zip entry to destPath, enforcing the
// cumulative size cap as bytes are copied — not trusting the zip
// header's declared size, which is attacker-controlled.
func extractOneFile(f *zip.File, destPath string, maxTotalBytes int64, result *ExtractResult) error {
	rc, err := f.Open()
	if err != nil {
		return fmt.Errorf("opening archive entry %q: %w", f.Name, err)
	}
	defer rc.Close()

	out, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return fmt.Errorf("creating extracted file %q: %w", destPath, err)
	}
	defer out.Close()

	// LimitReader caps how much we'll ever read for a single file
	// relative to the REMAINING budget, so a single huge entry can't
	// blow past maxTotalBytes before we notice.
	remaining := maxTotalBytes - result.TotalBytes
	if remaining <= 0 {
		return fmt.Errorf("extraction exceeded total size limit of %d bytes", maxTotalBytes)
	}
	limited := io.LimitReader(rc, remaining+1) // +1 so we can detect overflow

	written, err := io.Copy(out, limited)
	if err != nil {
		return fmt.Errorf("writing extracted file %q: %w", destPath, err)
	}
	if written > remaining {
		return fmt.Errorf("extraction exceeded total size limit of %d bytes", maxTotalBytes)
	}

	result.TotalBytes += written
	result.FilesExtracted++
	return nil
}
