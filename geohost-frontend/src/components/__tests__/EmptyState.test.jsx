import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EmptyState from '../EmptyState'

describe('EmptyState', () => {
  it('renders title and description properly', () => {
    render(<EmptyState title="No Sites" description="Create your first site today." />)
    expect(screen.getByText('No Sites')).toBeInTheDocument()
    expect(screen.getByText('Create your first site today.')).toBeInTheDocument()
  })

  it('triggers action callback when button is clicked', () => {
    const handleAction = vi.fn()
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        actionText="Click Me"
        onAction={handleAction}
      />
    )
    const btn = screen.getByText('Click Me')
    fireEvent.click(btn)
    expect(handleAction).toHaveBeenCalledTimes(1)
  })
})

