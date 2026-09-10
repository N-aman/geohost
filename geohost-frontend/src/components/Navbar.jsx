import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'

export default function Navbar() {
  const [user, setUser] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    fetch('/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data))
      .catch(() => setUser(null))
  }, [location.pathname])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/logout', { method: 'POST', credentials: 'include' })
      setUser(null)
      setDropdownOpen(false)
      navigate('/')
    } catch (e) {
      console.error(e)
    }
  }

  const navItems = [
    { label: 'Overview', path: '/' },
    { label: 'Explore', path: '/explore' },
    { label: 'Deploy', path: '/upload' },
    ...(user ? [{ label: 'My Sites', path: '/dashboard' }] : []),
    ...(user?.is_admin ? [{ label: 'Admin', path: '/admin', isAdmin: true }] : []),
  ]

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'var(--bg-surface-0)',
      borderBottom: '1px solid var(--border-subtle)',
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      justifyContent: 'space-between',
    }}>
      {/* Brand & Regional Telemetry Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <Link to="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: 'var(--text-primary)',
          textDecoration: 'none',
        }}>
          {/* Wireframe Globe Icon with Amber Core */}
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 12 2 C 7.5 7.6 7.5 16.4 12 22 C 16.5 16.4 16.5 7.6 12 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <span style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: '16px',
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}>
            GeoHost
          </span>

          
        </Link>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', height: '52px' }}>
          {navItems.map(item => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  height: '52px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 14px',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                  textDecoration: 'none',
                }}
              >
                {item.isAdmin && (
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    marginRight: '6px',
                  }} />
                )}
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Right Utility: Edge Health & Account Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        

        {/* Authentication State */}
        {user ? (
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-surface-1)',
                border: '1px solid var(--border-muted)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 10px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
              }}
            >
              <span>{user.email || 'developer'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '180px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '6px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                zIndex: 150,
              }}>
                <div style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-tertiary)',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '4px',
                }}>
                  {user.is_admin ? 'ROLE: ADMINISTRATOR' : 'ROLE: DEVELOPER'}
                </div>

                <Link
                  to="/dashboard"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'block',
                    padding: '8px 10px',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  My Sites
                </Link>

                <Link
                  to="/upload"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'block',
                    padding: '8px 10px',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Deploy New Site
                </Link>

                {user.is_admin && (
                  <Link
                    to="/admin"
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: 'block',
                      padding: '8px 10px',
                      fontSize: '13px',
                      color: 'var(--accent-primary)',
                      textDecoration: 'none',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    Admin Console
                  </Link>
                )}

                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    fontSize: '13px',
                    color: 'var(--state-danger)',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--state-danger-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link
              to="/login"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                padding: '6px 12px',
              }}
            >
              Sign In
            </Link>
            <Link
              to="/upload"
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              Deploy Site
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
