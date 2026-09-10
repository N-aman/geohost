package cache

import (
	"sync"
	"time"
)

type node struct {
	key       string
	value     any
	expiresAt time.Time
	prev      *node
	next      *node
}

// LRUCache implements a concurrent, fixed-capacity, Least-Recently-Used cache
// using a doubly-linked list and a hash map for O(1) reads, insertions, and evictions.
type LRUCache struct {
	capacity int
	items    map[string]*node
	head     *node
	tail     *node
	mu       sync.RWMutex
}

func NewLRUCache(capacity int) *LRUCache {
	if capacity <= 0 {
		capacity = 1000
	}
	c := &LRUCache{
		capacity: capacity,
		items:    make(map[string]*node, capacity),
		head:     &node{},
		tail:     &node{},
	}
	c.head.next = c.tail
	c.tail.prev = c.head
	return c
}

// Get returns the value for key if present and not expired, moving it to the front of the LRU.
func (c *LRUCache) Get(key string) (any, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	n, ok := c.items[key]
	if !ok {
		return nil, false
	}

	if !n.expiresAt.IsZero() && time.Now().After(n.expiresAt) {
		c.removeNode(n)
		delete(c.items, key)
		return nil, false
	}

	c.moveToHead(n)
	return n.value, true
}

// Set adds or updates a key with a TTL.
func (c *LRUCache) Set(key string, value any, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	var exp time.Time
	if ttl > 0 {
		exp = time.Now().Add(ttl)
	}

	if n, ok := c.items[key]; ok {
		n.value = value
		n.expiresAt = exp
		c.moveToHead(n)
		return
	}

	if len(c.items) >= c.capacity {
		// Evict least recently used (node before tail)
		lru := c.tail.prev
		c.removeNode(lru)
		delete(c.items, lru.key)
	}

	newNode := &node{
		key:       key,
		value:     value,
		expiresAt: exp,
	}
	c.items[key] = newNode
	c.addNode(newNode)
}

// Remove invalidates a key from the cache.
func (c *LRUCache) Remove(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if n, ok := c.items[key]; ok {
		c.removeNode(n)
		delete(c.items, key)
	}
}

func (c *LRUCache) addNode(n *node) {
	n.prev = c.head
	n.next = c.head.next
	c.head.next.prev = n
	c.head.next = n
}

func (c *LRUCache) removeNode(n *node) {
	n.prev.next = n.next
	n.next.prev = n.prev
}

func (c *LRUCache) moveToHead(n *node) {
	c.removeNode(n)
	c.addNode(n)
}

