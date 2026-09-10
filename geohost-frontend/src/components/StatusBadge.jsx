import React from 'react'

export default function StatusBadge({ status }) {
  const norm = (status || 'pending').toLowerCase()

  let className = 'badge badge-pending'
  let label = 'Pending'

  switch (norm) {
    case 'approved':
      className = 'badge badge-approved'
      label = 'Live'
      break
    case 'rejected':
      className = 'badge badge-rejected'
      label = 'Rejected'
      break
    case 'suspended':
      className = 'badge badge-suspended'
      label = 'Suspended'
      break
    default:
      className = 'badge badge-pending'
      label = 'In Review'
      break
  }

  return (
    <span className={className}>
      <span className={`pulse-dot ${norm === 'approved' || norm === 'pending' ? 'pulse-active' : ''}`} />
      {label}
    </span>
  )
}

