package scanner

import (
	"regexp"
)

var (
	rxCSSImport   = regexp.MustCompile(`(?i)@import\s+(?:url\(['"]?|['"])(https?://[^'"\)]+)`)
	rxCSSUrl      = regexp.MustCompile(`(?i)url\(\s*['"]?(https?://[^'")]+)['"]?\s*\)`)
	rxCSSBehavior = regexp.MustCompile(`(?i)(behavior\s*:|-moz-binding\s*:)`)
	rxCSSExpr     = regexp.MustCompile(`(?i)expression\s*\(`)
	rxCSSAttrLeak = regexp.MustCompile(`(?i)input\[[^\]]*value[\^\$\*~]?=`)
)

type CSSScanResult struct {
	HasExpression bool
	HasKeylogger  bool
	ExternalURLs  []string
}

// ScanCSS scans CSS files for dangerous dynamic expressions, keylogging selectors, and external URLs.
func ScanCSS(content string) *CSSScanResult {
	res := &CSSScanResult{
		ExternalURLs: []string{},
	}

	if rxCSSBehavior.MatchString(content) || rxCSSExpr.MatchString(content) {
		res.HasExpression = true
	}
	if rxCSSAttrLeak.MatchString(content) {
		res.HasKeylogger = true
	}

	for _, m := range rxCSSImport.FindAllStringSubmatch(content, -1) {
		if len(m) > 1 {
			res.ExternalURLs = append(res.ExternalURLs, m[1])
		}
	}
	for _, m := range rxCSSUrl.FindAllStringSubmatch(content, -1) {
		if len(m) > 1 {
			res.ExternalURLs = append(res.ExternalURLs, m[1])
		}
	}

	res.ExternalURLs = deduplicateStrings(res.ExternalURLs)
	return res
}

