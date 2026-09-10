package scanner

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Decision string

const (
	DecisionAutoApprove  Decision = "AUTO_APPROVE"
	DecisionManualReview Decision = "MANUAL_REVIEW"
	DecisionAutoReject   Decision = "AUTO_REJECT"
)

type Finding struct {
	Severity string `json:"severity"` // "critical", "warning", "info"
	Message  string `json:"message"`
	File     string `json:"file,omitempty"`
}

type ScanReport struct {
	Score          int       `json:"score"`
	Decision       Decision  `json:"decision"`
	HardBlocked    bool      `json:"hard_blocked"`
	BlockReason    string    `json:"block_reason,omitempty"`
	Findings       []Finding `json:"findings"`
	ExtractedFiles int       `json:"extracted_files"`
}

// ToJSON converts the ScanReport to a JSON string for DB storage.
func (r *ScanReport) ToJSON() string {
	b, err := json.Marshal(r)
	if err != nil {
		return "{}"
	}
	return string(b)
}

type SafetyScanner struct {
	clamav *ClamAVClient
}

func NewSafetyScanner() *SafetyScanner {
	return &SafetyScanner{
		clamav: NewClamAVClient(),
	}
}

// ScanDirectory walks the extracted quarantine directory and evaluates security risks.
func (s *SafetyScanner) ScanDirectory(dirPath string) (*ScanReport, error) {
	report := &ScanReport{
		Score:    100,
		Findings: []Finding{},
	}

	// 1. ClamAV Virus/Malware Scan
	if s.clamav != nil {
		clean, detail, err := s.clamav.ScanPath(dirPath)
		if err != nil {
			report.Findings = append(report.Findings, Finding{
				Severity: "info",
				Message:  fmt.Sprintf("ClamAV scanner note: %v", err),
			})
		} else if !clean {
			report.HardBlocked = true
			report.BlockReason = fmt.Sprintf("Malware identified by ClamAV: %s", detail)
			report.Score = 0
			report.Decision = DecisionAutoReject
			report.Findings = append(report.Findings, Finding{
				Severity: "critical",
				Message:  report.BlockReason,
			})
			return report, nil
		}
	}

	hasExternalCalls := false

	// 2. Walk directory and inspect static assets
	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		report.ExtractedFiles++

		ext := strings.ToLower(filepath.Ext(path))
		rel, _ := filepath.Rel(dirPath, path)

		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		content := string(data)

		switch ext {
		case ".html", ".htm":
			s.inspectHTML(rel, content, report, &hasExternalCalls)
		case ".js":
			s.inspectJS(rel, content, report, &hasExternalCalls)
		case ".css":
			s.inspectCSS(rel, content, report, &hasExternalCalls)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("walking quarantine directory: %w", err)
	}

	// Bonus for 100% self-contained sites
	if !hasExternalCalls && report.Score == 100 {
		report.Findings = append(report.Findings, Finding{
			Severity: "info",
			Message:  "Clean site: 100% self-contained with no external network dependencies.",
		})
	}

	// 3. Final Decision based on score and flags
	if report.HardBlocked || report.Score < 50 {
		report.Decision = DecisionAutoReject
		if report.BlockReason == "" {
			report.BlockReason = fmt.Sprintf("Security score too low (%d/100)", report.Score)
		}
	} else if report.Score >= 85 {
		report.Decision = DecisionAutoApprove
	} else {
		report.Decision = DecisionManualReview
	}

	return report, nil
}

func (s *SafetyScanner) inspectJS(relPath, content string, report *ScanReport, hasExternal *bool) {
	jsRes := ScanJavaScript(relPath, content)

	// Hard Block: Cryptominer signatures
	if jsRes.HasCryptoMiner {
		report.HardBlocked = true
		report.BlockReason = "Cryptominer pattern identified in script"
		report.Score = 0
		report.Findings = append(report.Findings, Finding{
			Severity: "critical",
			Message:  "In-browser cryptominer signature detected.",
			File:     relPath,
		})
		return
	}

	// High Entropy Obfuscation
	if jsRes.Entropy > 5.8 && len(content) > 500 && jsRes.HasPackedJS {
		report.Score -= 50
		report.Findings = append(report.Findings, Finding{
			Severity: "critical",
			Message:  fmt.Sprintf("High-entropy packed obfuscation detected (entropy: %.2f)", jsRes.Entropy),
			File:     relPath,
		})
	}

	if jsRes.HasEval {
		report.Score -= 35
		report.Findings = append(report.Findings, Finding{
			Severity: "warning",
			Message:  "Dynamic execution via eval() or Function() constructor.",
			File:     relPath,
		})
	}

	if jsRes.HasCookieAccess {
		report.Score -= 15
		report.Findings = append(report.Findings, Finding{
			Severity: "warning",
			Message:  "Direct access to document.cookie.",
			File:     relPath,
		})
	}

	for _, u := range jsRes.ExternalURLs {
		*hasExternal = true
		if !IsAllowedExternalResource(u) {
			report.Score -= 25
			report.Findings = append(report.Findings, Finding{
				Severity: "warning",
				Message:  fmt.Sprintf("External network connection to unlisted origin: %s", u),
				File:     relPath,
			})
		}
	}
}

func (s *SafetyScanner) inspectHTML(relPath, content string, report *ScanReport, hasExternal *bool) {
	htmlRes, err := ScanHTML(strings.NewReader(content))
	if err != nil {
		return
	}

	if len(htmlRes.MetaRedirects) > 0 {
		report.Score -= 40
		report.Findings = append(report.Findings, Finding{
			Severity: "warning",
			Message:  "Meta refresh redirect detected (potential redirect phishing/ad cloaking).",
			File:     relPath,
		})
	}

	// Hard Block: Phishing form
	if htmlRes.HasPasswordForm && len(htmlRes.ExternalForms) > 0 {
		report.HardBlocked = true
		report.BlockReason = fmt.Sprintf("Phishing form: password input submitting to external domain %s", htmlRes.ExternalForms[0])
		report.Score = 0
		report.Findings = append(report.Findings, Finding{
			Severity: "critical",
			Message:  report.BlockReason,
			File:     relPath,
		})
		return
	}

	for _, formAction := range htmlRes.ExternalForms {
		*hasExternal = true
		report.Score -= 30
		report.Findings = append(report.Findings, Finding{
			Severity: "warning",
			Message:  fmt.Sprintf("Form action submits to external target: %s", formAction),
			File:     relPath,
		})
	}

	for _, script := range htmlRes.ExternalScripts {
		*hasExternal = true
		if !IsAllowedExternalResource(script) {
			report.Score -= 25
			report.Findings = append(report.Findings, Finding{
				Severity: "warning",
				Message:  fmt.Sprintf("External script from unapproved origin: %s", script),
				File:     relPath,
			})
		}
	}

	for _, iframe := range htmlRes.ExternalIframes {
		*hasExternal = true
		report.Score -= 30
		report.Findings = append(report.Findings, Finding{
			Severity: "warning",
			Message:  fmt.Sprintf("External iframe embedding: %s", iframe),
			File:     relPath,
		})
	}

	if len(htmlRes.InlineEvents) > 5 {
		report.Score -= 10
		report.Findings = append(report.Findings, Finding{
			Severity: "info",
			Message:  fmt.Sprintf("%d inline event attributes detected.", len(htmlRes.InlineEvents)),
			File:     relPath,
		})
	}

	if htmlRes.HasBaseTag {
		report.Score -= 10
		report.Findings = append(report.Findings, Finding{
			Severity: "info",
			Message:  "<base> tag overrides relative URL root.",
			File:     relPath,
		})
	}
}

func (s *SafetyScanner) inspectCSS(relPath, content string, report *ScanReport, hasExternal *bool) {
	cssRes := ScanCSS(content)

	if cssRes.HasExpression {
		report.HardBlocked = true
		report.BlockReason = "Dynamic CSS expression/behavior detected"
		report.Score = 0
		report.Findings = append(report.Findings, Finding{
			Severity: "critical",
			Message:  "Dynamic CSS expression detected.",
			File:     relPath,
		})
		return
	}

	if cssRes.HasKeylogger {
		report.Score -= 40
		report.Findings = append(report.Findings, Finding{
			Severity: "warning",
			Message:  "Potential CSS attribute value keylogger selector detected.",
			File:     relPath,
		})
	}

	for _, u := range cssRes.ExternalURLs {
		*hasExternal = true
		if !IsAllowedExternalResource(u) {
			report.Score -= 10
			report.Findings = append(report.Findings, Finding{
				Severity: "info",
				Message:  fmt.Sprintf("External CSS import or asset: %s", u),
				File:     relPath,
			})
		}
	}
}

