package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"geohost/internal/db"
)

const sessionCookieName = "geohost_session"
const sessionTTL = 24 * time.Hour

type contextKey string

const userContextKey contextKey = "user_id"

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginHandler authenticates an admin via email + password and sets an HttpOnly cookie.
func LoginHandler(database *db.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
		userID, err := database.AuthUser(cleanEmail, req.Password)
		if err != nil {
			if errors.Is(err, db.ErrInvalidCredentials) {
				log.Printf("login: invalid credentials for email %q", cleanEmail)
				http.Error(w, "invalid email or password", http.StatusUnauthorized)
				return
			}
			log.Printf("login: error authenticating: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		token, err := database.CreateSession(userID, sessionTTL)
		if err != nil {
			log.Printf("login: error creating session: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
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

// LogoutHandler invalidates the current session.
func LogoutHandler(database *db.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err == nil {
			_ = database.DeleteSession(cookie.Value)
		}
		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteStrictMode,
			MaxAge:   -1,
		})
		w.WriteHeader(http.StatusOK)
	}
}

// RequireAuth wraps a handler so it only executes for requests with a valid session cookie.
// It attaches the authenticated user ID to the request context.
func RequireAuth(database *db.DB, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil {
			http.Error(w, "authentication required", http.StatusUnauthorized)
			return
		}
		userID, err := database.ValidateSession(cookie.Value)
		if err != nil {
			http.Error(w, "authentication required", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), userContextKey, userID)
		next(w, r.WithContext(ctx))
	}
}

// RequireAdmin wraps a handler and ensures the authenticated user has is_admin == true.
func RequireAdmin(database *db.DB, next http.HandlerFunc) http.HandlerFunc {
	return RequireAuth(database, func(w http.ResponseWriter, r *http.Request) {
		userID := GetUserIDFromContext(r)
		user, err := database.GetUserByID(userID)
		if err != nil || user == nil || !user.IsAdmin {
			http.Error(w, "forbidden: admin privileges required", http.StatusForbidden)
			return
		}
		next(w, r)
	})
}

// GetUserIDFromContext extracts the authenticated user ID from context.
func GetUserIDFromContext(r *http.Request) int64 {
	if val := r.Context().Value(userContextKey); val != nil {
		if id, ok := val.(int64); ok {
			return id
		}
	}
	return 0
}

// MeHandler returns the authenticated user's profile or 401.
func MeHandler(database *db.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		userID, err := database.ValidateSession(cookie.Value)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		user, err := database.GetUserByID(userID)
		if err != nil || user == nil {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(user)
	}
}
