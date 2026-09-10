import React from 'react'

export default function EmptyState({ icon, title, description, actionText, onAction }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '48px 24px',
      border: '1px dashed var(--border-subtle)',
      borderRadius: '12px',
      background: 'color-mix(in oklch, var(--bg-surface) 60%, transparent)',
      color: 'var(--text-secondary)',
      minHeight: '260px',
    }}>
      <div style={{
        fontSize: '28px',
        width: '52px',
        height: '52px',
        borderRadius: '12px',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-subtle)',
        display: 'grid',
        placeItems: 'center',
        marginBottom: '16px',
      }}>
        {icon || '📁'}
      </div>
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
        {title}
      </h3>
      <p style={{ fontSize: '13px', maxWidth: '360px', lineHeight: 1.5, margin: '0 0 20px 0', color: 'var(--text-secondary)' }}>
        {description}
      </p>
      {actionText && (
        <button type="button" onClick={onAction} className="btn-primary">
          {actionText}
        </button>
      )}
    </div>
  )
}

