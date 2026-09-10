import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export default function Analytics() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project_id')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('30d')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!projectId) {
      setError('Project identifier missing in telemetry query string.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    fetch(`/my/analytics?project_id=${projectId}&range=${range}`, { credentials: 'include' })
      .then(res => {
        if (res.status === 403) throw new Error('Access restricted: Telemetry is strictly accessible to the project owner and platform administrators.')
        if (res.status === 401) throw new Error('Session authentication required to access edge telemetry.')
        if (!res.ok) throw new Error('Failed to retrieve telemetry events from edge cache.')
        return res.json()
      })
      .then(resData => {
        setData(resData)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [projectId, range])

  if (error) {
    return (
      <div className="inst-main" style={{ maxWidth: '640px' }}>
        <div className="inst-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--state-danger)', marginBottom: '8px' }}>
            // ACCESS_RESTRICTED
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            Telemetry Authorization Notice
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>
            {error}
          </p>
          <Link to="/dashboard" className="btn-secondary">
            &larr; Back to My Sites
          </Link>
        </div>
      </div>
    )
  }

  const maxViews = data?.by_day?.reduce((max, d) => Math.max(max, d.pageviews), 0) || 1

  return (
    <div className="inst-main">
      {/* Masthead */}
      <section className="inst-masthead">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Link to="/dashboard" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                &larr; MY SITES
              </Link>
              <span style={{ color: 'var(--border-muted)' }}>/</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                PROJECT #{projectId}
              </span>
            </div>
            <h1 className="inst-title">Traffic & Visitor Telemetry</h1>
            <p className="inst-subtitle">
              Server-side, cookieless edge metrics compiled with HMAC-SHA256 daily unique hashes.
            </p>
          </div>

          {/* Time Range Selector */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { id: '7d', label: '7 DAYS' },
              { id: '30d', label: '30 DAYS' },
              { id: '90d', label: '90 DAYS' },
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                style={{
                  background: range === r.id ? 'var(--bg-surface-2)' : 'var(--bg-surface-0)',
                  color: range === r.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: range === r.id ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginTop: '24px',
          background: 'var(--bg-surface-0)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
        }}>
          <div>
            <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              TOTAL PAGEVIEWS
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: 'var(--text-primary)' }}>
              {data ? (data.total_pageviews ?? 0) : '0'}
            </strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              UNIQUE VISITORS
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: 'var(--state-live)' }}>
              {data ? (data.unique_visitors ?? 0) : '0'}
            </strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              TOP GEOGRAPHIC ORIGIN
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--accent-primary)' }}>
              {data?.by_country && data.by_country.length > 0 ? (data.by_country[0].name || 'Direct') : 'Direct / Anycast'}
            </strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              PRIMARY CLIENT DEVICE
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-primary)' }}>
              {data?.by_device && data.by_device.length > 0 ? (data.by_device[0].name || 'Desktop') : 'Desktop'}
            </strong>
          </div>
        </div>
      </section>

      {/* Main Time-Series Visualization */}
      <section style={{ marginBottom: '28px' }}>
        <div className="inst-panel">
          <div style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            marginBottom: '16px',
            fontWeight: 600,
          }}>
            REQUEST VOLUME OVER TIME ({range.toUpperCase()})
          </div>

          {loading ? (
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              Compiling telemetry series...
            </div>
          ) : data?.by_day && data.by_day.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '180px', paddingTop: '20px' }}>
              {data.by_day.map((d, i) => {
                const heightPct = Math.max((d.pageviews / maxViews) * 100, 4)
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                      {d.pageviews > 0 ? d.pageviews : ''}
                    </div>
                    <div
                      title={`${d.date}: ${d.pageviews} views, ${d.unique_visitors || 0} visitors`}
                      style={{
                        width: '100%',
                        height: `${heightPct}%`,
                        background: 'var(--accent-primary)',
                        borderRadius: '2px 2px 0 0',
                        opacity: 0.85,
                        transition: 'opacity 0.1s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
                    />
                    <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                      {d.date.slice(5)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              No traffic recorded during this time range.
            </div>
          )}
        </div>
      </section>

      {/* Two Column Diagnostic Tables */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Top Paths */}
        <div className="inst-panel">
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600 }}>
            TOP REQUEST PATHS / ENDPOINTS
          </div>

          <table className="inst-table">
            <thead>
              <tr>
                <th>Path</th>
                <th style={{ textAlign: 'right' }}>Requests</th>
              </tr>
            </thead>
            <tbody>
              {data?.by_path && data.by_path.length > 0 ? (
                data.by_path.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{p.name || '/'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{p.count}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '20px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                    No path telemetry collected.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cloudflare Geo-IP Ingress */}
        <div className="inst-panel">
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600 }}>
            GEOGRAPHIC EDGE INGRESS (CLOUDFLARE)
          </div>

          <table className="inst-table">
            <thead>
              <tr>
                <th>Region / Country</th>
                <th style={{ textAlign: 'right' }}>Requests</th>
              </tr>
            </thead>
            <tbody>
              {data?.by_country && data.by_country.length > 0 ? (
                data.by_country.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{c.name || 'Unknown'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{c.count}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '20px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                    No geographic telemetry recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
