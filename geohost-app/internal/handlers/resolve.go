package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"geohost/internal/analytics"
	"geohost/internal/cache"
	"geohost/internal/db"
	"geohost/internal/ratelimit"
)

type ResolveDeps struct {
	DB        *db.DB
	Collector *analytics.Collector
	Cache     *cache.LRUCache
	Limiter   *ratelimit.IPTokenBucketLimiter
}

// ResolveHandler implements high-concurrency subdomain resolution with
// in-memory LRU caching, algorithmic token-bucket rate limiting, and
// asynchronous privacy-safe analytics collection.
func ResolveHandler(deps ResolveDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		clientIP := r.Header.Get("CF-Connecting-IP")
		if clientIP == "" {
			clientIP = r.Header.Get("X-Forwarded-For")
			if clientIP == "" {
				clientIP = r.RemoteAddr
			}
		}

		// 1. Algorithmic Token-Bucket Rate Limiter (CS Showcase)
		if deps.Limiter != nil && !deps.Limiter.Allow(clientIP) {
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}

		subdomain := r.Header.Get("X-Original-Host")
		if subdomain == "" || !db.ValidSubdomain(subdomain) {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// 2. High-speed O(1) LRU Cache lookup
		var projectID int64
		var isApproved bool
		cacheKey := "subdomain:" + strings.ToLower(subdomain)

		if deps.Cache != nil {
			if val, ok := deps.Cache.Get(cacheKey); ok {
				if cached, ok := val.(*db.ResolvedProject); ok {
					projectID = cached.ID
					isApproved = (cached.Status == "approved")
				}
			}
		}

		// Cache miss: query SQLite database
		if projectID == 0 {
			project, err := deps.DB.GetProjectBySubdomain(subdomain)
			if err != nil {
				log.Printf("resolve: lookup error for %q: %v", subdomain, err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			if project == nil {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			projectID = project.ID
			isApproved = (project.Status == "approved")

			// Populate LRU cache (TTL: 5 minutes)
			if deps.Cache != nil {
				deps.Cache.Set(cacheKey, project, 5*time.Minute)
			}
		}

		if !isApproved {
			w.WriteHeader(http.StatusForbidden)
			return
		}

		// 3. Collect privacy-safe traffic analytics asynchronously
		if deps.Collector != nil {
			path := r.Header.Get("X-Original-URI")
			if path == "" {
				path = "/"
			}
			deps.Collector.Track(analytics.EventInput{
				ProjectID: projectID,
				IP:        clientIP,
				Path:      path,
				Referrer:  r.Header.Get("X-Referer"),
				Country:   r.Header.Get("CF-IPCountry"),
				UserAgent: r.Header.Get("X-User-Agent"),
			})
		}

		w.Header().Set("X-Project-Id", strconv.FormatInt(projectID, 10))
		w.WriteHeader(http.StatusOK)
	}
}
