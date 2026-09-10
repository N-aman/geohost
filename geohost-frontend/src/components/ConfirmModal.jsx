import React, { useRef, useEffect } from 'react'

export default function ConfirmModal({
  isOpen = true,
  title,
  message,
  description,
  confirmLabel,
  confirmText = 'Confirm',
  isDanger = false,
  onConfirm,
  onCancel,
  children,
}) {
  const dialogRef = useRef(null)
  const desc = message || description
  const label = confirmLabel || confirmText

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onCancel()
        }
      }}
      style={{
        border: '1px solid var(--border-muted)',
        background: 'var(--bg-surface-elevated)',
        color: 'var(--text-primary)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
        maxWidth: '460px',
        width: 'calc(100% - 32px)',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
      }}
    >
      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {desc && (
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {desc}
        </p>
      )}

      {children}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={isDanger ? 'btn-danger' : 'btn-primary'}
        >
          {label}
        </button>
      </div>
    </dialog>
  )
}
