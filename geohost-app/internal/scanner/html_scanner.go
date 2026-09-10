package scanner

import (
	"io"
	"strings"

	"golang.org/x/net/html"
)

type HTMLScanResult struct {
	ExternalScripts []string
	ExternalIframes []string
	ExternalForms   []string
	HasPasswordForm bool
	MetaRedirects   []string
	InlineEvents    []string
	HasBaseTag      bool
}

// ScanHTML parses an HTML document using the standard tokenizer from golang.org/x/net/html.
func ScanHTML(r io.Reader) (*HTMLScanResult, error) {
	doc, err := html.Parse(r)
	if err != nil {
		return nil, err
	}

	result := &HTMLScanResult{
		ExternalScripts: []string{},
		ExternalIframes: []string{},
		ExternalForms:   []string{},
		MetaRedirects:   []string{},
		InlineEvents:    []string{},
	}

	var walk func(*html.Node, bool)
	walk = func(n *html.Node, inFormWithPassword bool) {
		if n.Type == html.ElementNode {
			tag := strings.ToLower(n.Data)

			currentFormHasPassword := inFormWithPassword
			if tag == "input" {
				for _, attr := range n.Attr {
					if strings.ToLower(attr.Key) == "type" && strings.ToLower(attr.Val) == "password" {
						result.HasPasswordForm = true
					}
				}
			}

			for _, attr := range n.Attr {
				key := strings.ToLower(attr.Key)
				val := strings.TrimSpace(attr.Val)

				// Detect inline javascript handlers (onload, onerror, onclick, onmouseover)
				if strings.HasPrefix(key, "on") && len(key) > 2 {
					result.InlineEvents = append(result.InlineEvents, key+"="+val)
				}

				// External script sources
				if tag == "script" && key == "src" && isExternalURL(val) {
					result.ExternalScripts = append(result.ExternalScripts, val)
				}

				// External iframes
				if tag == "iframe" && key == "src" && isExternalURL(val) {
					result.ExternalIframes = append(result.ExternalIframes, val)
				}

				// External form actions (credential harvesting / phishing)
				if tag == "form" && key == "action" && isExternalURL(val) {
					result.ExternalForms = append(result.ExternalForms, val)
				}

				// Meta refresh redirects
				if tag == "meta" && key == "http-equiv" && strings.EqualFold(val, "refresh") {
					for _, a2 := range n.Attr {
						if strings.ToLower(a2.Key) == "content" {
							result.MetaRedirects = append(result.MetaRedirects, a2.Val)
						}
					}
				}

				// Base tag hijack
				if tag == "base" && key == "href" {
					result.HasBaseTag = true
				}
			}

			for c := n.FirstChild; c != nil; c = c.NextSibling {
				walk(c, currentFormHasPassword)
			}
			return
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c, inFormWithPassword)
		}
	}

	walk(doc, false)
	result.ExternalScripts = deduplicateStrings(result.ExternalScripts)
	result.ExternalIframes = deduplicateStrings(result.ExternalIframes)
	result.ExternalForms = deduplicateStrings(result.ExternalForms)
	return result, nil
}

