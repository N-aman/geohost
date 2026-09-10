package ratelimit

import (
	"testing"
	"time"
)

func TestTokenBucket_RefillAndLimit(t *testing.T) {
	// 2 tokens capacity, refills 1 token per second
	tb := NewTokenBucket(2, 1)

	if !tb.Allow() {
		t.Errorf("1st token should be allowed")
	}
	if !tb.Allow() {
		t.Errorf("2nd token should be allowed")
	}
	if tb.Allow() {
		t.Errorf("3rd token should be blocked")
	}

	// Wait 1.1s to allow refill of 1 token
	time.Sleep(1100 * time.Millisecond)

	if !tb.Allow() {
		t.Errorf("token should be allowed after refill")
	}
	if tb.Allow() {
		t.Errorf("should be exhausted again")
	}
}

func TestIPLimiter(t *testing.T) {
	limiter := NewIPLimiter(1, 1)

	if !limiter.Allow("1.1.1.1") {
		t.Errorf("1.1.1.1 should be allowed")
	}
	if limiter.Allow("1.1.1.1") {
		t.Errorf("1.1.1.1 should be limited")
	}
	if !limiter.Allow("2.2.2.2") {
		t.Errorf("2.2.2.2 should have independent bucket")
	}
}

