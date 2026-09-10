package scanner

import (
	"math"
)

// CalculateShannonEntropy calculates information entropy of a string (in bits per symbol).
// Normal human-readable English text and formatted source code typically scores 3.5 - 4.8.
// Heavily packed, encrypted, or obfuscated payloads typically score above 5.8.
func CalculateShannonEntropy(data string) float64 {
	if len(data) == 0 {
		return 0
	}
	counts := make(map[rune]float64)
	for _, r := range data {
		counts[r]++
	}
	var entropy float64
	length := float64(len(data))
	for _, count := range counts {
		p := count / length
		entropy -= p * math.Log2(p)
	}
	return entropy
}

