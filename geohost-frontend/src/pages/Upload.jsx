import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

export default function Upload() {
  const [searchParams] = useSearchParams()
  const initialSubdomain = searchParams.get('subdomain') || ''

  const [subdomain, setSubdomain] = useState(initialSubdomain)
  const [file, setFile] = useState(null)
  const [isPublic, setIsPublic] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  
  // Lifecycle Phase: 'idle' | 'uploading' | 'scanning' | 'success' | 'review'
  const [phase, setPhase] = useState('idle')
  const [resultData, setResultData] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const navigate = useNavigate()

  useEffect(() => {
    if (initialSubdomain) {
      setSubdomain(initialSubdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''))
    }
  }, [initialSubdomain])

  const handleFileDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const validateAndSetFile = (f) => {
    if (!f.name.toLowerCase().endsWith('.zip')) {
      setErrorMsg('Payload error: Only standard .zip archives are supported.')
      return
    }
    if (f.size > 50 * 1024 * 1024) {
      setErrorMsg('Limit exceeded: Archive size exceeds 50MB ceiling.')
      return
    }
    setErrorMsg('')
    setFile(f)
  }

  const isSubdomainValid = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(subdomain)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    const cleanSub = subdomain.trim().toLowerCase()
    if (!isSubdomainValid) {
      setErrorMsg('Invalid subdomain: Use 3-63 lowercase alphanumeric characters and hyphens.')
      return
    }

    if (!file) {
      setErrorMsg('Payload missing: Select a valid .zip archive to deploy.')
      return
    }

    const formData = new FormData()
    formData.append('subdomain', cleanSub)
    formData.append('file', file)
    formData.append('is_public', isPublic ? '1' : '0')

    try {
      setPhase('uploading')

      const response = await fetch('/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (response.status === 401) {
        navigate('/login?redirect=/upload')
        return
      }

      setPhase('scanning')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Deployment failed at edge validation layer.')
      }

      setResultData(data)

      if (data.status === 'approved') {
        setPhase('success')
      } else {
        setPhase('review')
      }
    } catch (err) {
      setErrorMsg(err.message)
      setPhase('idle')
    }
  }

  return (
    <div className="inst-main" style={{ maxWidth: '800px' }}>
      {/* Header */}
      <section className="inst-masthead">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--accent-primary)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            WORKSPACE // DEPLOYMENT INSTRUMENT
          </span>
        </div>
        <h1 className="inst-title">Deploy Web Archive</h1>
        <p className="inst-subtitle">
          Submit a .zip bundle for automated AST validation, entropy calculation, and instant Anycast edge publication.
        </p>
      </section>

      {/* State A: Instant Success Verdict */}
      {phase === 'success' ? (
        <div className="inst-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--state-live)',
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--state-live)' }}>
              PRE-FLIGHT AUDIT PASSED · EDGE DEPLOYED
            </span>
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
            {subdomain}.geohost.site is live
          </h2>

          <div className="inst-panel-inset" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Edge Target:</span><br />
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {subdomain}.geohost.site
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Security Verdict:</span><br />
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--state-live)', fontWeight: 600 }}>
                  AUTO-APPROVED (100/100)
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Payload Size:</span><br />
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {(file?.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>POP Node:</span><br />
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  fra-edge01 (Active)
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href={`https://${subdomain}.geohost.site`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              Open Live Site ↗
            </a>
            <Link to="/dashboard" className="btn-secondary">
              View in My Sites
            </Link>
            <button
              onClick={() => { setPhase('idle'); setFile(null); setSubdomain(''); }}
              className="btn-secondary"
            >
              Deploy Another
            </button>
          </div>
        </div>
      ) : phase === 'review' ? (
        <div className="inst-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--state-warning)',
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--state-warning)' }}>
              PRE-FLIGHT AUDIT: MANUAL REVIEW REQUIRED
            </span>
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
            Archive queued for administrator review
          </h2>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
            The automated AST scanner detected patterns that require secondary inspection before edge propagation (Score: {resultData?.scan_score || 70}/100). The submission has been quarantined in the review queue.
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/dashboard" className="btn-primary">
              View Status in My Sites
            </Link>
            <button
              onClick={() => { setPhase('idle'); setFile(null); }}
              className="btn-secondary"
            >
              Back to Deploy Form
            </button>
          </div>
        </div>
      ) : (
        /* The Standard Deployment Form */
        <form onSubmit={handleSubmit}>
          <div className="inst-panel" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            
            {/* Step 1: Subdomain Target */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                01 // SUBDOMAIN IDENTIFIER
              </label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="project-slug"
                  value={subdomain}
                  onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  disabled={phase !== 'idle'}
                  required
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                  }}
                />
                <span style={{
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-muted)',
                  borderLeft: 'none',
                  color: 'var(--text-tertiary)',
                  padding: '8px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  borderTopRightRadius: 'var(--radius-sm)',
                  borderBottomRightRadius: 'var(--radius-sm)',
                  whiteSpace: 'nowrap',
                }}>
                  .geohost.site
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                Must be 3-63 lowercase alphanumeric characters or hyphens.
              </div>
            </div>

            {/* Step 2: Payload Dropzone */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                02 // ARCHIVE PAYLOAD (.ZIP)
              </label>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                style={{
                  border: '1px dashed',
                  borderColor: dragOver ? 'var(--accent-primary)' : file ? 'var(--state-live)' : 'var(--border-muted)',
                  background: dragOver ? 'var(--accent-subtle)' : file ? 'var(--state-live-bg)' : 'var(--bg-surface-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '28px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => document.getElementById('archive-file-input').click()}
              >
                <input
                  id="archive-file-input"
                  type="file"
                  accept=".zip"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                  disabled={phase !== 'idle'}
                />

                {file ? (
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {file.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--state-live)' }}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB · Ready for pre-flight audit
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Click or drag & drop to select .zip archive
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      Max payload: 50MB (expands up to 200MB)
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Public / Private Visibility Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Public Network Visibility
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  Showcase in Explore feed upon security approval
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                disabled={phase !== 'idle'}
                style={{
                  background: isPublic ? 'var(--accent-subtle)' : 'var(--bg-surface-1)',
                  border: '1px solid',
                  borderColor: isPublic ? 'var(--accent-primary)' : 'var(--border-muted)',
                  color: isPublic ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {isPublic ? 'PUBLIC' : 'PRIVATE'}
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div style={{
                background: 'var(--state-danger-bg)',
                border: '1px solid var(--state-danger-border)',
                color: 'var(--state-danger)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
              }}>
                {errorMsg}
              </div>
            )}

            {/* Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                {phase === 'uploading' ? (
                  <span>[01/02] Streaming payload to edge...</span>
                ) : phase === 'scanning' ? (
                  <span>[02/02] Running AST & entropy analysis...</span>
                ) : (
                  <span>Pre-flight audit: ACTIVE</span>
                )}
              </div>

              <button
                type="submit"
                disabled={!file || !isSubdomainValid || phase !== 'idle'}
                className="btn-primary"
                style={{ padding: '9px 22px' }}
              >
                {phase === 'uploading' ? 'Uploading...' : phase === 'scanning' ? 'Auditing...' : 'Deploy to Edge →'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
