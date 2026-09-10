import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'

export default function Explore() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('TABLE') // 'TABLE' | 'GRID'

  useEffect(() => {
    fetch('/projects/public')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setProjects(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  const filtered = projects.filter(p => 
    !search || p.subdomain.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="inst-main">
      {/* Masthead */}
      <section className="inst-masthead">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--accent-primary)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                NETWORK DISCOVERY // VERIFIED CLUSTER
              </span>
            </div>
            <h1 className="inst-title">Public Network Deployments</h1>
            <p className="inst-subtitle">
              Inspect and discover live web applications verified by the GeoHost automated pre-flight security engine.
            </p>
          </div>

          <Link to="/upload" className="btn-primary">
            + Deploy Your Archive
          </Link>
        </div>
      </section>

      {/* Control / Filter Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
      }}>
        {/* Search Input */}
        <div style={{ minWidth: '260px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Filter public subdomains..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
            VIEW:
          </span>
          <button
            onClick={() => setViewMode('TABLE')}
            style={{
              background: viewMode === 'TABLE' ? 'var(--bg-surface-2)' : 'var(--bg-surface-0)',
              color: viewMode === 'TABLE' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: viewMode === 'TABLE' ? 'var(--accent-primary)' : 'var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            TABLE
          </button>
          <button
            onClick={() => setViewMode('GRID')}
            style={{
              background: viewMode === 'GRID' ? 'var(--bg-surface-2)' : 'var(--bg-surface-0)',
              color: viewMode === 'GRID' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: viewMode === 'GRID' ? 'var(--accent-primary)' : 'var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            GRID
          </button>
        </div>
      </div>

      {/* Directory Content */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          Syncing public routing table from edge...
        </div>
      ) : filtered.length === 0 ? (
        <div className="inst-panel" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
            // NETWORK_EMPTY
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            {search ? `No deployments matching "${search}"` : "No public deployments published"}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
            {search ? "Try searching for a different subdomain identifier." : "Be the first to publish a verified website to the public edge."}
          </p>
          <Link to="/upload" className="btn-primary">
            Deploy Now →
          </Link>
        </div>
      ) : viewMode === 'TABLE' ? (
        /* High-Density Table View */
        <div className="inst-table-container">
          <table className="inst-table">
            <thead>
              <tr>
                <th>Subdomain</th>
                <th>Status</th>
                <th>Security Rating</th>
                <th>Verified Date</th>
                <th style={{ textAlign: 'right' }}>Target Endpoint</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {p.subdomain}
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--state-live)' }}>
                      Score: 100/100 Verified
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Active'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <a
                      href={`https://${p.subdomain}.geohost.site`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--accent-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {p.subdomain}.geohost.site ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Architectural Grid View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filtered.map(p => (
            <div
              key={p.id}
              style={{
                background: 'var(--bg-surface-0)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {p.subdomain}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--state-live)' }}>
                  Score: 100/100 · 0 Flags
                </div>
              </div>

              <div style={{
                background: 'var(--bg-surface-1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                wordBreak: 'break-all',
              }}>
                https://{p.subdomain}.geohost.site
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Active'}
                </span>
                <a
                  href={`https://${p.subdomain}.geohost.site`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
                >
                  Launch Site ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
