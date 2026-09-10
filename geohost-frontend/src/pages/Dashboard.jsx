import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import Toast from '../components/Toast'

export default function Dashboard() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/my/projects', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized or failed to fetch projects')
        return res.json()
      })
      .then(data => {
        setProjects(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  const toggleVisibility = async (project) => {
    const newVisibility = !project.is_public
    try {
      const res = await fetch(`/my/projects/visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ project_id: project.id, is_public: newVisibility }),
      })

      if (!res.ok) throw new Error('Failed to update visibility')

      setProjects(prev => prev.map(p => 
        p.id === project.id ? { ...p, is_public: newVisibility } : p
      ))

      setToast({
        type: 'success',
        message: newVisibility 
          ? `${project.subdomain} marked public in Explore network.`
          : `${project.subdomain} set to private (direct link only).`,
      })
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    }
  }

  const filteredProjects = projects.filter(p => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    const matchesSearch = !search || p.subdomain.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Telemetry Aggregates
  const totalCount = projects.length
  const liveCount = projects.filter(p => p.status === 'approved').length
  const pendingCount = projects.filter(p => p.status === 'pending').length
  const publicCount = projects.filter(p => p.is_public).length

  return (
    <div className="inst-main">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Control Surface Masthead */}
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
                CONTROL SURFACE // USER WORKSPACE
              </span>
            </div>
            <h1 className="inst-title">My Deployed Sites</h1>
            <p className="inst-subtitle">
              Manage subdomain mappings, security audit status, and visitor telemetry across the Anycast edge.
            </p>
          </div>

          <Link to="/upload" className="btn-primary">
            + Deploy New Site
          </Link>
        </div>

        {/* Telemetry Metric Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          marginTop: '24px',
          background: 'var(--bg-surface-0)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
        }}>
          <div>
            <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              TOTAL DEPLOYMENTS
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--text-primary)' }}>
              {totalCount}
            </strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              LIVE & ACTIVE
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--state-live)' }}>
              {liveCount}
            </strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              PENDING AUDIT
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--state-warning)' }}>
              {pendingCount}
            </strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              PUBLIC IN EXPLORE
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--accent-primary)' }}>
              {publicCount}
            </strong>
          </div>
        </div>
      </section>

      {/* Control Filter Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
      }}>
        {/* Status Filter Pills */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {['all', 'approved', 'pending', 'suspended', 'rejected'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? 'var(--bg-surface-2)' : 'var(--bg-surface-0)',
                color: statusFilter === st ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: statusFilter === st ? 'var(--accent-primary)' : 'var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Subdomain Filter Search */}
        <div style={{ minWidth: '220px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search subdomains..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: '12px', padding: '6px 10px' }}
          />
        </div>
      </div>

      {/* Data Table / Empty State */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          Reading deployment records from edge cache...
        </div>
      ) : projects.length === 0 ? (
        <div className="inst-panel" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
            // WORKSPACE_EMPTY
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            No Active Deployments Found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
            Compress your HTML, CSS, and JS files into a .zip archive and upload to reserve a custom subdomain.
          </p>
          <Link to="/upload" className="btn-primary">
            Deploy First Project →
          </Link>
        </div>
      ) : (
        <div className="inst-table-container">
          <table className="inst-table">
            <thead>
              <tr>
                <th>Subdomain</th>
                <th>Status</th>
                <th>Pre-Flight Audit</th>
                <th>Network Visibility</th>
                <th>Target Domain</th>
                <th style={{ textAlign: 'right' }}>Telemetry</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length > 0 ? (
                filteredProjects.map(p => {
                  const isApproved = p.status === 'approved'
                  const url = `https://${p.subdomain}.geohost.site`

                  return (
                    <tr key={p.id}>
                      {/* Subdomain Identifier */}
                      <td>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                          {p.subdomain}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          ID #{p.id} · {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <StatusBadge status={p.status} />
                      </td>

                      {/* Pre-Flight Audit */}
                      <td>
                        {p.status === 'rejected' ? (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--state-danger)' }}>
                            FAILED · Security Violation
                          </span>
                        ) : p.scan_score !== undefined ? (
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            color: p.scan_score >= 85 ? 'var(--state-live)' : 'var(--state-warning)',
                            fontWeight: 600,
                          }}>
                            {p.scan_score >= 85 ? `PASS (${p.scan_score}/100)` : `QUEUED (${p.scan_score}/100)`}
                          </span>
                        ) : (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                            100/100 Verified
                          </span>
                        )}
                      </td>

                      {/* Visibility Switch */}
                      <td>
                        <button
                          onClick={() => toggleVisibility(p)}
                          style={{
                            background: p.is_public ? 'var(--accent-subtle)' : 'var(--bg-surface-subtle)',
                            border: '1px solid',
                            borderColor: p.is_public ? 'var(--accent-primary)' : 'var(--border-muted)',
                            color: p.is_public ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '3px 8px',
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                          title={p.is_public ? "Public: visible on Explore network" : "Private: hidden from Explore"}
                        >
                          <span style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            background: p.is_public ? 'var(--accent-primary)' : 'var(--text-disabled)',
                          }} />
                          {p.is_public ? 'PUBLIC' : 'PRIVATE'}
                        </button>
                      </td>

                      {/* Target Domain Link */}
                      <td>
                        {isApproved ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              color: 'var(--accent-primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {p.subdomain}.geohost.site ↗
                          </a>
                        ) : (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                            {p.subdomain}.geohost.site
                          </span>
                        )}
                      </td>

                      {/* Telemetry Action */}
                      <td style={{ textAlign: 'right' }}>
                        {isApproved ? (
                          <Link
                            to={`/analytics?project_id=${p.id}`}
                            className="btn-secondary"
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            Telemetry →
                          </Link>
                        ) : (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-disabled)' }}>
                            N/A
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '24px' }}>
                    No projects matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
