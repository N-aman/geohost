package analytics

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"geohost/internal/db"
)

type EventInput struct {
	ProjectID int64
	IP        string
	Path      string
	Referrer  string
	Country   string
	UserAgent string
}

type Collector struct {
	database  *db.DB
	events    chan db.PageviewEvent
	secretKey []byte
	wg        sync.WaitGroup
	quit      chan struct{}
}

func NewCollector(database *db.DB, bufferSize int, secret string) *Collector {
	if bufferSize <= 0 {
		bufferSize = 1000
	}
	key := []byte(secret)
	if len(key) == 0 {
		key = []byte("geohost-default-analytics-salt-2026")
	}

	c := &Collector{
		database:  database,
		events:    make(chan db.PageviewEvent, bufferSize),
		secretKey: key,
		quit:      make(chan struct{}),
	}
	c.wg.Add(1)
	go c.worker()
	return c
}

// Track processes incoming request metadata and sends it to the background batch buffer.
// Non-blocking: drops event if buffer is overwhelmed.
func (c *Collector) Track(in EventInput) {
	if in.ProjectID <= 0 {
		return
	}

	// Filter out common automated scrapers and bots
	uaLow := strings.ToLower(in.UserAgent)
	if strings.Contains(uaLow, "bot") || strings.Contains(uaLow, "crawler") || strings.Contains(uaLow, "spider") || strings.Contains(uaLow, "uptime") {
		return
	}

	now := time.Now()
	visitorHash := c.hashVisitor(in.IP, in.UserAgent, in.ProjectID, now)
	device := classifyDevice(in.UserAgent)
	cleanPath := cleanPath(in.Path)
	cleanRef := cleanReferrer(in.Referrer)
	country := in.Country
	if country == "" {
		country = "XX"
	}

	evt := db.PageviewEvent{
		ProjectID:   in.ProjectID,
		VisitorHash: visitorHash,
		Path:        cleanPath,
		Referrer:    cleanRef,
		Country:     country,
		Device:      device,
		CreatedAt:   now,
	}

	select {
	case c.events <- evt:
	default:
		log.Println("analytics: buffer full under high load, dropping event")
	}
}

func (c *Collector) worker() {
	defer c.wg.Done()
	batch := make([]db.PageviewEvent, 0, 100)
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case evt := <-c.events:
			batch = append(batch, evt)
			if len(batch) >= 100 {
				c.flush(batch)
				batch = batch[:0]
			}
		case <-ticker.C:
			if len(batch) > 0 {
				c.flush(batch)
				batch = batch[:0]
			}
		case <-c.quit:
			// Drain remaining events
			for {
				select {
				case evt := <-c.events:
					batch = append(batch, evt)
				default:
					if len(batch) > 0 {
						c.flush(batch)
					}
					return
				}
			}
		}
	}
}

func (c *Collector) flush(batch []db.PageviewEvent) {
	if len(batch) == 0 {
		return
	}
	if err := c.database.BatchRecordPageviews(batch); err != nil {
		log.Printf("analytics: error flushing batch of %d events: %v", len(batch), err)
	}
}

func (c *Collector) Close() {
	close(c.quit)
	c.wg.Wait()
}

// hashVisitor calculates a 16-character daily rotating HMAC-SHA256 hash.
func (c *Collector) hashVisitor(ip, ua string, projectID int64, t time.Time) string {
	dateStr := t.Format("2006-01-02")
	mac := hmac.New(sha256.New, c.secretKey)
	mac.Write([]byte(fmt.Sprintf("%s:%s:%s:%d", ip, ua, dateStr, projectID)))
	sum := mac.Sum(nil)
	return hex.EncodeToString(sum)[:16]
}

func classifyDevice(ua string) string {
	low := strings.ToLower(ua)
	if strings.Contains(low, "ipad") || strings.Contains(low, "tablet") {
		return "tablet"
	}
	if strings.Contains(low, "mobile") || strings.Contains(low, "android") || strings.Contains(low, "iphone") {
		return "mobile"
	}
	return "desktop"
}

func cleanPath(p string) string {
	if p == "" {
		return "/"
	}
	// Strip query parameters from path
	if idx := strings.Index(p, "?"); idx != -1 {
		p = p[:idx]
	}
	if len(p) > 100 {
		p = p[:100]
	}
	return p
}

func cleanReferrer(ref string) string {
	if ref == "" {
		return "Direct"
	}
	// Keep hostname only
	ref = strings.TrimPrefix(ref, "https://")
	ref = strings.TrimPrefix(ref, "http://")
	if idx := strings.Index(ref, "/"); idx != -1 {
		ref = ref[:idx]
	}
	if len(ref) > 60 {
		ref = ref[:60]
	}
	return ref
}

