import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'

export default function Status() {
  const [searchParams] = useSearchParams()
  const [idInput, setIdInput] = useState(searchParams.get('id') || '')
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = "GeoHost — Deployment Lookup"
  }, [])

  useEffect(() => {
    const initialId = searchParams.get('id')
    if (initialId) lookup(initialId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function lookup(id) {
    const trimmed = (id || idInput).trim()
    if (!trimmed) {
      setError('Provide a numeric project ID.')
      return
    }
    setLoading(true)
    setError('')
    setProject(null)
    try {
      const res = await fetch(`/status/${trimmed}`)
      if (res.status === 404) {
        setError('No deployment found matching that ID.')
        return
      }
      if (!res.ok) {
        setError('Edge resolution error while querying status.')
        return
      }
      const data = await res.json()
      setProject(data)
    } catch {
      setError('Could not reach cluster daemon.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inst-main" style={{ maxWidth: '640px', margin: '40px auto' }}>
      <section className="inst-masthead">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-primary)', marginBottom: '6px', fontWeight: 600 }}>
          RESOLUTION // DEPLOYMENT LOOKUP
        </div>
        <h1 className="inst-title">Deployment Status Lookup</h1>
        <p className="inst-subtitle">
          Query edge deployment state, pre-flight audit scores, and live DNS targets by numeric ID.
        </p>
      </section>

      {/* Query Bar */}
      <div className="inst-panel" style={{ marginBottom: '20px' }}>
        <form onSubmit={(e) => { e.preventDefault(); lookup(); }} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Enter Project ID (e.g. 5)"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
          />
          <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '8px 18px' }}>
            {loading ? 'Searching...' : 'Lookup →'}
          </button>
        </form>

        {error && (
          <div style={{
            marginTop: '12px',
            background: 'var(--state-danger-bg)',
            border: '1px solid var(--state-danger-border)',
            color: 'var(--state-danger)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Result Panel */}
      {project && (
        <div className="inst-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {project.subdomain}.geohost.site
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                Project ID: #{project.id}
              </div>
            </div>
            <StatusBadge status={project.status} />
          </div>

          <div className="inst-panel-inset" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>SUBDOMAIN:</span><br />
                <strong style={{ color: 'var(--text-primary)' }}>{project.subdomain}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>TARGET DOMAIN:</span><br />
                <strong style={{ color: 'var(--accent-primary)' }}>{project.subdomain}.geohost.site</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>SUBMITTED:</span><br />
                <span style={{ color: 'var(--text-secondary)' }}>
                  {project.created_at ? new Date(project.created_at).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>SECURITY VERDICT:</span><br />
                <span style={{ color: project.status === 'approved' ? 'var(--state-live)' : 'var(--state-warning)' }}>
                  {project.status === 'approved' ? 'AUTO-APPROVED' : project.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {project.status === 'approved' && (
            <a
              href={`https://${project.subdomain}.geohost.site`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              Open Live Deployment ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}
