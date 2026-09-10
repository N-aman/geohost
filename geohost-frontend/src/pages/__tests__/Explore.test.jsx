import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Explore from '../Explore'

describe('Explore Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders public projects from API', async () => {
    const mockProjects = [
      { id: 1, subdomain: 'portfolio-demo', status: 'approved', created_at: new Date().toISOString() },
      { id: 2, subdomain: 'my-docs', status: 'approved', created_at: new Date().toISOString() },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProjects,
    })

    render(
      <MemoryRouter>
        <Explore />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('portfolio-demo')).toBeInTheDocument()
      expect(screen.getByText('my-docs')).toBeInTheDocument()
    })
  })
})

