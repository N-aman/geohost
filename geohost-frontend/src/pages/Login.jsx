import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [clientId, setClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '')
  const [showGoogleNotice, setShowGoogleNotice] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  useEffect(() => {
    fetch('/auth/google/client-id')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.client_id) {
          setClientId(data.client_id)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!clientId) return
    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
        })
        const btnContainer = document.getElementById('google-btn-container')
        if (btnContainer) {
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'filled_black',
            size: 'large',
            width: '100%',
            text: 'continue_with',
          })
        }
      }
    }
    if (window.google?.accounts?.id) {
      initGoogle()
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer)
          initGoogle()
        }
      }, 100)
      return () => clearInterval(timer)
    }
  }, [clientId])

  const handleGoogleCredentialResponse = async (response) => {
    setError('')
    try {
      const res = await fetch('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: response.credential }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Google authentication failed')
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    fetch('/me', { credentials: 'include' })
      .then(res => {
        if (res.ok) {
          navigate(from, { replace: true })
        } else {
          setReady(true)
        }
      })
      .catch(() => setReady(true))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid credentials')
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 120px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div className="inst-panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '32px 28px',
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--accent-primary)' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 12 2 C 7.5 7.6 7.5 16.4 12 22 C 16.5 16.4 16.5 7.6 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              GeoHost
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            AUTHENTICATION // EDGE CONTROL
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{
            background: 'var(--state-danger-bg)',
            border: '1px solid var(--state-danger-border)',
            color: 'var(--state-danger)',
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* Google Authentication */}
        <div>
          {clientId ? (
            <div id="google-btn-container" style={{ minHeight: '44px', display: 'flex', justifyContent: 'center' }} />
          ) : (
            <button
              type="button"
              onClick={() => setShowGoogleNotice(!showGoogleNotice)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '9px 16px',
                background: 'var(--bg-surface-1)',
                border: '1px solid var(--border-muted)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.12s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          )}

          {showGoogleNotice && (
            <div style={{
              marginTop: '10px',
              padding: '10px 12px',
              background: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              <strong style={{ color: 'var(--accent-primary)' }}>OAUTH CONFIGURATION NOTE:</strong><br />
              Google verification backend is ready. To connect credentials:<br />
              1. Add <code style={{ color: 'var(--text-primary)' }}>https://geohost.site</code> to Authorized Origins in GCP Console.<br />
              2. Provide <code style={{ color: 'var(--text-primary)' }}>VITE_GOOGLE_CLIENT_ID</code> in .env.
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '20px 0',
        }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            OR SIGN IN WITH EMAIL
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              EMAIL IDENTIFIER
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="developer@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              PASSWORD
            </label>
            <input
              type="password"
              className="form-input"
              placeholder=""
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={!ready || submitting}
            className="btn-primary"
            style={{ width: '100%', padding: '9px 16px', marginTop: '6px' }}
          >
            {submitting ? 'Verifying...' : 'Sign In →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <Link
            to="/admin/login"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              textDecoration: 'none',
            }}
          >
            [ Administrative Console Access ]
          </Link>
        </div>
      </div>
    </div>
  )
}
