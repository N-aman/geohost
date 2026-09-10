import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusBadge from '../StatusBadge'

describe('StatusBadge', () => {
  it('renders Live badge for approved status', () => {
    render(<StatusBadge status="approved" />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('renders In Review badge for pending status', () => {
    render(<StatusBadge status="pending" />)
    expect(screen.getByText('In Review')).toBeInTheDocument()
  })

  it('renders Rejected badge for rejected status', () => {
    render(<StatusBadge status="rejected" />)
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('renders Suspended badge for suspended status', () => {
    render(<StatusBadge status="suspended" />)
    expect(screen.getByText('Suspended')).toBeInTheDocument()
  })
})

