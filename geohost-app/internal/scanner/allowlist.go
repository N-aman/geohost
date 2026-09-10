package scanner

import (
	"strings"
)

// AllowedCDNPrefixes lists trusted public content delivery networks
// commonly used for standard web libraries (React, Vue, Bootstrap, Fonts).
var AllowedCDNPrefixes = []string{
	"https://cdnjs.cloudflare.com/",
	"https://cdn.jsdelivr.net/",
	"https://unpkg.com/",
	"https://fonts.googleapis.com/",
	"https://fonts.gstatic.com/",
	"https://use.typekit.net/",
	"https://ka-f.fontawesome.com/",
	"https://kit.fontawesome.com/",
	"https://ajax.googleapis.com/",
	"https://cdn.tailwindcss.com",
}

// IsAllowedExternalResource returns true if urlStr points to a trusted CDN prefix.
func IsAllowedExternalResource(urlStr string) bool {
	clean := strings.TrimSpace(urlStr)
	for _, prefix := range AllowedCDNPrefixes {
		if strings.HasPrefix(clean, prefix) {
			return true
		}
	}
	return false
}

