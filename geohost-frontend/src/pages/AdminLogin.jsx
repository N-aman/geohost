import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const expired = searchParams.get('expired')

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
      if (!res.ok) throw new Error(data.error || 'Authentication rejected')

      if (!data.is_admin) {
        throw new Error('Access denied: Account does not have administrative privileges.')
      }

      navigate('/admin')
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
        maxWidth: '400px',
        padding: '32px 28px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
            color: 'var(--accent-primary)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            Admin Console Access
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
            RESTRICTED INFRASTRUCTURE ROOT
          </div>
        </div>

        {expired && (
          <div style={{
            background: 'var(--state-warning-bg)',
            border: '1px solid var(--state-warning-border)',
            color: 'var(--state-warning)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            marginBottom: '16px',
          }}>
            Session expired or privileges revoked. Please re-authenticate.
          </div>
        )}

        {error && (
          <div style={{
            background: 'var(--state-danger-bg)',
            border: '1px solid var(--state-danger-border)',
            color: 'var(--state-danger)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              ADMINISTRATOR IDENTIFIER
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="admin@geohost.site"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              CONSOLE SECRET KEY
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
            disabled={submitting}
            className="btn-primary"
            style={{ width: '100%', padding: '9px 16px', marginTop: '6px' }}
          >
            {submitting ? 'Verifying...' : 'Authenticate Console →'}
          </button>
        </form>
      </div>
    </div>
  )
}
