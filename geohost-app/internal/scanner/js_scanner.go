package scanner

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/dop251/goja/ast"
	"github.com/dop251/goja/parser"
)

var (
	rxCryptoMiners  = regexp.MustCompile(`(?i)(coinhive|coinimp|cryptonight|deepminer|webminerpool|authedmine|monerominer)`)
	rxPackedJS      = regexp.MustCompile(`(?i)eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*[dr]\s*\)`)
	rxFromCharCode  = regexp.MustCompile(`String\.fromCharCode\s*\(\s*([0-9\s,]{15,})\)`)
	rxHexPayload    = regexp.MustCompile(`(\\x[0-9a-fA-F]{2}){8,}`)
	rxCookieAccess  = regexp.MustCompile(`\bdocument\.cookie\b`)
	rxStorageAccess = regexp.MustCompile(`\b(localStorage|sessionStorage)\.(getItem|setItem|removeItem|clear)\b`)
	rxEval          = regexp.MustCompile(`\b(eval|Function)\s*\(`)
	rxFetch         = regexp.MustCompile(`fetch\s*\(\s*["']https?://([^"'\s]+)`)
	rxXHR           = regexp.MustCompile(`\.open\s*\(\s*["'][A-Z]+["']\s*,\s*["']https?://([^"'\s]+)`)
	rxWebSocket     = regexp.MustCompile(`new\s+WebSocket\s*\(\s*["']wss?://([^"'\s]+)`)
	rxBeacon        = regexp.MustCompile(`navigator\.sendBeacon\s*\(\s*["']https?://([^"'\s]+)`)
)

type JSScanResult struct {
	HasCryptoMiner  bool
	HasPackedJS     bool
	HasEval         bool
	HasCookieAccess bool
	HasStorage      bool
	ExternalURLs    []string
	DangerousSinks  []string
	Entropy         float64
}

// ScanJavaScript analyzes a JS file using regex pre-filters and AST parsing.
func ScanJavaScript(filename, content string) *JSScanResult {
	res := &JSScanResult{
		ExternalURLs:   []string{},
		DangerousSinks: []string{},
		Entropy:        CalculateShannonEntropy(content),
	}

	// 1. Fast regex checks
	if rxCryptoMiners.MatchString(content) {
		res.HasCryptoMiner = true
		res.DangerousSinks = append(res.DangerousSinks, "cryptominer_signature")
	}
	if rxPackedJS.MatchString(content) || rxFromCharCode.MatchString(content) || rxHexPayload.MatchString(content) {
		res.HasPackedJS = true
		res.DangerousSinks = append(res.DangerousSinks, "packed_obfuscation")
	}
	if rxCookieAccess.MatchString(content) {
		res.HasCookieAccess = true
		res.DangerousSinks = append(res.DangerousSinks, "document.cookie")
	}
	if rxStorageAccess.MatchString(content) {
		res.HasStorage = true
	}
	if rxEval.MatchString(content) {
		res.HasEval = true
		res.DangerousSinks = append(res.DangerousSinks, "eval")
	}

	// Extract external URLs matched by regex
	for _, m := range rxFetch.FindAllStringSubmatch(content, -1) {
		if len(m) > 1 {
			res.ExternalURLs = append(res.ExternalURLs, "https://"+m[1])
		}
	}
	for _, m := range rxXHR.FindAllStringSubmatch(content, -1) {
		if len(m) > 1 {
			res.ExternalURLs = append(res.ExternalURLs, "https://"+m[1])
		}
	}
	for _, m := range rxWebSocket.FindAllStringSubmatch(content, -1) {
		if len(m) > 1 {
			res.ExternalURLs = append(res.ExternalURLs, "wss://"+m[1])
		}
	}
	for _, m := range rxBeacon.FindAllStringSubmatch(content, -1) {
		if len(m) > 1 {
			res.ExternalURLs = append(res.ExternalURLs, "https://"+m[1])
		}
	}

	// 2. Structural AST parsing with Goja
	program, err := parser.ParseFile(nil, filename, content, 0)
	if err == nil && program != nil {
		walkProgram(program, res)
	}

	res.ExternalURLs = deduplicateStrings(res.ExternalURLs)
	res.DangerousSinks = deduplicateStrings(res.DangerousSinks)
	return res
}

func walkProgram(program *ast.Program, res *JSScanResult) {
	for _, stmt := range program.Body {
		walkStatement(stmt, res)
	}
}

func walkStatement(stmt ast.Statement, res *JSScanResult) {
	if stmt == nil {
		return
	}
	switch s := stmt.(type) {
	case *ast.BlockStatement:
		for _, child := range s.List {
			walkStatement(child, res)
		}
	case *ast.ExpressionStatement:
		walkExpression(s.Expression, res)
	case *ast.IfStatement:
		walkExpression(s.Test, res)
		walkStatement(s.Consequent, res)
		walkStatement(s.Alternate, res)
	case *ast.ForStatement:
		walkStatement(s.Body, res)
	case *ast.ForInStatement:
		walkStatement(s.Body, res)
	case *ast.ForOfStatement:
		walkStatement(s.Body, res)
	case *ast.WhileStatement:
		walkExpression(s.Test, res)
		walkStatement(s.Body, res)
	case *ast.DoWhileStatement:
		walkExpression(s.Test, res)
		walkStatement(s.Body, res)
	case *ast.SwitchStatement:
		walkExpression(s.Discriminant, res)
		for _, c := range s.Body {
			for _, cs := range c.Consequent {
				walkStatement(cs, res)
			}
		}
	case *ast.ReturnStatement:
		walkExpression(s.Argument, res)
	case *ast.FunctionDeclaration:
		walkStatement(s.Function.Body, res)
	case *ast.VariableStatement:
		for _, d := range s.List {
			walkExpression(d.Initializer, res)
		}
	case *ast.TryStatement:
		walkStatement(s.Body, res)
		if s.Catch != nil {
			walkStatement(s.Catch.Body, res)
		}
		walkStatement(s.Finally, res)
	}
}

func walkExpression(expr ast.Expression, res *JSScanResult) {
	if expr == nil {
		return
	}
	switch e := expr.(type) {
	case *ast.CallExpression:
		// Check callee: eval("..."), Function("...")
		if id, ok := e.Callee.(*ast.Identifier); ok {
			if id.Name == "eval" || id.Name == "Function" {
				res.HasEval = true
				res.DangerousSinks = append(res.DangerousSinks, string(id.Name))
			}
			if id.Name == "fetch" && len(e.ArgumentList) > 0 {
				if lit, ok := e.ArgumentList[0].(*ast.StringLiteral); ok {
					u := string(lit.Value)
					if strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://") {
						res.ExternalURLs = append(res.ExternalURLs, u)
					}
				}
			}
		}
		// Bracket calls: window['eval'](...)
		if bracket, ok := e.Callee.(*ast.BracketExpression); ok {
			if lit, ok := bracket.Member.(*ast.StringLiteral); ok && lit.Value == "eval" {
				res.HasEval = true
				res.DangerousSinks = append(res.DangerousSinks, "window['eval']")
			}
		}
		for _, arg := range e.ArgumentList {
			walkExpression(arg, res)
		}
		walkExpression(e.Callee, res)

	case *ast.DotExpression:
		// document.cookie
		if left, ok := e.Left.(*ast.Identifier); ok && left.Name == "document" {
			if e.Identifier.Name == "cookie" {
				res.HasCookieAccess = true
				res.DangerousSinks = append(res.DangerousSinks, "document.cookie")
			}
		}
		walkExpression(e.Left, res)

	case *ast.AssignExpression:
		walkExpression(e.Left, res)
		walkExpression(e.Right, res)

	case *ast.BinaryExpression:
		walkExpression(e.Left, res)
		walkExpression(e.Right, res)

	case *ast.UnaryExpression:
		walkExpression(e.Operand, res)

	case *ast.FunctionLiteral:
		walkStatement(e.Body, res)

	case *ast.ArrowFunctionLiteral:
		if bodyStmt, ok := e.Body.(*ast.BlockStatement); ok {
			walkStatement(bodyStmt, res)
		} else if bodyExpr, ok := e.Body.(*ast.ExpressionBody); ok {
			walkExpression(bodyExpr.Expression, res)
		}
	}
}

func deduplicateStrings(input []string) []string {
	seen := make(map[string]bool)
	var out []string
	for _, s := range input {
		clean := strings.TrimSpace(s)
		if clean != "" && !seen[clean] {
			seen[clean] = true
			out = append(out, clean)
		}
	}
	return out
}

func isExternalURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	return u.IsAbs() || strings.HasPrefix(raw, "//")
}
