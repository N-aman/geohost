package ratelimit

import (
	"sync"
	"time"
)

// TokenBucket implements the token bucket algorithm for rate limiting.
// Tokens refill at a steady rate up to a maximum capacity.
// Each request consumes 1 token; if no tokens remain, the request is throttled.
type TokenBucket struct {
	capacity   float64
	tokens     float64
	refillRate float64 // tokens per second
	lastRefill time.Time
	mu         sync.Mutex
}

func NewTokenBucket(capacity, refillRate float64) *TokenBucket {
	return &TokenBucket{
		capacity:   capacity,
		tokens:     capacity,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

// Allow reports whether a single token can be consumed.
func (tb *TokenBucket) Allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(tb.lastRefill).Seconds()
	tb.tokens = tb.tokens + elapsed*tb.refillRate
	if tb.tokens > tb.capacity {
		tb.tokens = tb.capacity
	}
	tb.lastRefill = now

	if tb.tokens >= 1.0 {
		tb.tokens -= 1.0
		return true
	}
	return false
}

// IPTokenBucketLimiter manages per-IP rate limiters in memory with periodic eviction.
type IPTokenBucketLimiter struct {
	capacity   float64
	refillRate float64
	buckets    sync.Map
}

func NewIPLimiter(capacity, refillRate float64) *IPTokenBucketLimiter {
	limiter := &IPTokenBucketLimiter{
		capacity:   capacity,
		refillRate: refillRate,
	}
	return limiter
}

// Allow checks if the given IP address is allowed to proceed.
func (l *IPTokenBucketLimiter) Allow(ip string) bool {
	if ip == "" {
		return true
	}
	val, ok := l.buckets.Load(ip)
	if !ok {
		val, _ = l.buckets.LoadOrStore(ip, NewTokenBucket(l.capacity, l.refillRate))
	}
	bucket := val.(*TokenBucket)
	return bucket.Allow()
}

