// cmd/hashpw is a one-off utility to generate a bcrypt hash for
// creating the initial admin user. Not part of the running server.
package main

import (
	"bufio"
	"fmt"
	"os"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
)

func main() {
	fmt.Print("Enter password: ")
	pw, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println()
	if err != nil {
		// Fallback for non-terminal input, still avoids echoing in
		// most cases people would pipe this.
		reader := bufio.NewReader(os.Stdin)
		line, _ := reader.ReadString('\n')
		pw = []byte(line)
	}

	hash, err := bcrypt.GenerateFromPassword(pw, bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
	fmt.Println(string(hash))
}
