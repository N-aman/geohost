package cache

import (
	"testing"
	"time"
)

func TestLRUCache_BasicAndEviction(t *testing.T) {
	c := NewLRUCache(2)

	c.Set("k1", "v1", time.Hour)
	c.Set("k2", "v2", time.Hour)

	if val, ok := c.Get("k1"); !ok || val != "v1" {
		t.Errorf("expected v1, got %v", val)
	}

	// Adding 3rd should evict k2 (since k1 was just accessed)
	c.Set("k3", "v3", time.Hour)

	if _, ok := c.Get("k2"); ok {
		t.Errorf("expected k2 to be evicted")
	}
	if val, ok := c.Get("k3"); !ok || val != "v3" {
		t.Errorf("expected v3, got %v", val)
	}
	if val, ok := c.Get("k1"); !ok || val != "v1" {
		t.Errorf("expected k1 to still be present, got %v", val)
	}
}

func TestLRUCache_Expiration(t *testing.T) {
	c := NewLRUCache(5)
	c.Set("fast", "bye", 20*time.Millisecond)

	time.Sleep(30 * time.Millisecond)

	if _, ok := c.Get("fast"); ok {
		t.Errorf("expected item to expire")
	}
}

