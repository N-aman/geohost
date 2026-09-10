import React, { useEffect, useRef } from 'react'

export default function Toast({ id, type = 'info', message, onClose, duration = 4000 }) {
  const toastRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose && onClose(id)
    }, duration)
    return () => clearTimeout(timer)
  }, [id, duration, onClose])

  let borderColor = 'var(--border-muted)'
  let indicatorColor = 'var(--text-secondary)'
  let symbol = 'i'

  if (type === 'success') {
    borderColor = 'var(--state-live-border)'
    indicatorColor = 'var(--state-live)'
    symbol = '✓'
  } else if (type === 'error') {
    borderColor = 'var(--state-danger-border)'
    indicatorColor = 'var(--state-danger)'
    symbol = '✕'
  } else if (type === 'warning') {
    borderColor = 'var(--state-warning-border)'
    indicatorColor = 'var(--state-warning)'
    symbol = '!'
  }

  return (
    <div
      ref={toastRef}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background: 'var(--bg-surface-elevated)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-sm)',
        padding: '12px 16px',
        color: 'var(--text-primary)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '13px',
        maxWidth: '420px',
      }}
    >
      <span style={{
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: 'var(--bg-surface-2)',
        color: indicatorColor,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {symbol}
      </span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
      <button
        type="button"
        onClick={() => onClose && onClose(id)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-tertiary)',
          fontSize: '16px',
          cursor: 'pointer',
          padding: '0 4px',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}
