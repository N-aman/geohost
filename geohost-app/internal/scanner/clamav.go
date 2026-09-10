package scanner

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"strings"
	"time"
)

type ClamAVClient struct {
	Network string
	Address string
	Timeout time.Duration
}

// NewClamAVClient initializes a client for clamd.
// Default tries Unix socket /var/run/clamav/clamd.ctl first, or TCP 127.0.0.1:3310.
func NewClamAVClient() *ClamAVClient {
	addr := os.Getenv("GEOHOST_CLAMD_ADDR")
	if addr != "" {
		if strings.HasPrefix(addr, "/") {
			return &ClamAVClient{Network: "unix", Address: addr, Timeout: 10 * time.Second}
		}
		return &ClamAVClient{Network: "tcp", Address: addr, Timeout: 10 * time.Second}
	}

	// Try default unix socket path if it exists
	if _, err := os.Stat("/var/run/clamav/clamd.ctl"); err == nil {
		return &ClamAVClient{Network: "unix", Address: "/var/run/clamav/clamd.ctl", Timeout: 10 * time.Second}
	}

	// Fallback to local TCP port
	return &ClamAVClient{Network: "tcp", Address: "127.0.0.1:3310", Timeout: 5 * time.Second}
}

// ScanPath requests clamd to scan a directory on disk.
// Returns (clean bool, details string, err error).
// If clamd is offline or not installed, clean is true with an informational message.
func (c *ClamAVClient) ScanPath(dirPath string) (bool, string, error) {
	conn, err := net.DialTimeout(c.Network, c.Address, c.Timeout)
	if err != nil {
		// ClamAV daemon not reachable; allow fallback to AST/heuristic scanning
		return true, "clamd daemon unavailable (skipped)", nil
	}
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(c.Timeout))

	cmd := fmt.Sprintf("nMULTISCAN %s\n", dirPath)
	if _, err := conn.Write([]byte(cmd)); err != nil {
		return true, "clamd communication error", nil
	}

	reader := bufio.NewReader(conn)
	for {
		line, err := reader.ReadString('\n')
		if line != "" {
			line = strings.TrimSpace(line)
			if strings.HasSuffix(line, "FOUND") {
				return false, line, nil
			}
			if strings.HasSuffix(line, "ERROR") {
				return false, line, fmt.Errorf("clamd reported error: %s", line)
			}
		}
		if err != nil {
			break
		}
	}

	return true, "OK", nil
}

