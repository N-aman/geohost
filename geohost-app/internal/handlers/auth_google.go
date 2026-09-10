package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"geohost/internal/db"
	"google.golang.org/api/idtoken"
)

type googleAuthRequest struct {
	Credential string `json:"credential"`
}

// GoogleLoginHandler handles Google Identity Services (GIS) ID tokens.
// It verifies the cryptographic signature with Google's JWKS, validates audience,
// auto-registers the user or links their account, and issues a standard session cookie.
func GoogleLoginHandler(database *db.DB, clientID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req googleAuthRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Credential) == "" {
			http.Error(w, "credential token required", http.StatusBadRequest)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		// Validate token with Google's public keys.
		// If clientID is configured, it strictly enforces audience == clientID.
		payload, err := idtoken.Validate(ctx, req.Credential, clientID)
		if err != nil {
			log.Printf("auth_google: token validation failed: %v", err)
			http.Error(w, "invalid or expired google token", http.StatusUnauthorized)
			return
		}

		emailVal, ok := payload.Claims["email"].(string)
		if !ok || emailVal == "" {
			http.Error(w, "email claim missing from token", http.StatusUnauthorized)
			return
		}
		email := strings.ToLower(strings.TrimSpace(emailVal))

		verified, _ := payload.Claims["email_verified"].(bool)
		if !verified {
			http.Error(w, "google email is not verified", http.StatusUnauthorized)
			return
		}

		name, _ := payload.Claims["name"].(string)
		googleSub := payload.Subject // unique immutable Google account ID

		userID, err := database.FindOrCreateGoogleUser(email, googleSub, name)
		if err != nil {
			log.Printf("auth_google: failed creating user for %s: %v", email, err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		token, err := database.CreateSession(userID, sessionTTL)
		if err != nil {
			log.Printf("auth_google: failed creating session: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteStrictMode,
			MaxAge:   int(sessionTTL.Seconds()),
		})

		user, _ := database.GetUserByID(userID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(user)
	}
}

