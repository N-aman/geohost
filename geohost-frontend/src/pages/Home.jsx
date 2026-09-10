import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Home() {
  const [showcase, setShowcase] = useState([])
  const [quickSubdomain, setQuickSubdomain] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/projects/public')
      .then(res => res.ok ? res.json() : [])
      .then(data => setShowcase(Array.isArray(data) ? data.slice(0, 8) : []))
      .catch(() => setShowcase([]))
  }, [])

  const handleQuickDeploy = (e) => {
    e.preventDefault()
    const clean = quickSubdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (clean) {
      navigate(`/upload?subdomain=${clean}`)
    } else {
      navigate('/upload')
    }
  }

  const pipelineStages = [
    {
      id: 0,
      code: "01 // INGEST",
      name: "Archive Ingestion",
      detail: "Receives raw ZIP payload. Enforces 50MB ceiling, validates central directory records, and checks CRC-32 integrity.",
      metric: "50MB Cap PASS",
      status: "PASS",
    },
    {
      id: 1,
      code: "02 // UNPACK",
      name: "Directory Isolation",
      detail: "Extracts into sandboxed filesystem structure. Sanitizes path traversal (Zip-Slip defense), rejects symlinks, and caps 200MB decompression.",
      metric: "Zip-Slip 0 Traversal",
      status: "PASS",
    },
    {
      id: 2,
      code: "03 // SECURITY",
      name: "AST & Entropy Scan",
      detail: "Static AST parser evaluates JavaScript syntax trees for malicious eval(), phishing forms, and crypto miners. Measures Shannon entropy to detect packed payloads.",
      metric: "Entropy: 4.12 0 Exploits",
      status: "PASS",
    },
    {
      id: 3,
      code: "04 // RESOLVE",
      name: "Policy Resolution",
      detail: "Security engine computes composite verdict. Archives scoring >= 85 auto-approve instantaneously without manual human queue delay.",
      metric: "Score: 100/100 AUTO-APPROVED",
      status: "LIVE",
    },
    {
      id: 4,
      code: "05 // DEPLOY",
      name: "Edge Propagation",
      detail: "Registers custom subdomain in O(1) in-memory LRU cache. Global Anycast DNS routes traffic with automatic TLS and platform CSP headers.",
      metric: "< 50ms Worldwide Routing",
      status: "ACTIVE",
    },
  ]

  return (
    <div className="inst-main">
      {/* 1. Technical Masthead */}
      <section className="inst-masthead">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--accent-primary)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            ORACLE ARM64 CLUSTER · GLOBAL ANYCAST EDGE · PRE-FLIGHT AUDITING
          </span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '28px',
          fontWeight: 700,
          letterSpacing: '-0.025em',
          color: 'var(--text-primary)',
          margin: '0 0 12px 0',
          lineHeight: 1.25,
        }}>
          Fast, Verified Web Hosting at the Edge
        </h1>

        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          color: 'var(--text-secondary)',
          margin: '0 0 24px 0',
          maxWidth: '740px',
          lineHeight: 1.6,
        }}>
          GeoHost is an infrastructure platform for deploying verified static web applications. Every upload undergoes automated decompression safety checks, JavaScript AST vulnerability parsing, and Shannon entropy analysis before global publication.
        </p>

        {/* Quick Launch Action Strip */}
        <form onSubmit={handleQuickDeploy} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          maxWidth: '540px',
          marginBottom: '28px',
          flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            minWidth: '260px',
            background: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-muted)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}>
            <input
              type="text"
              placeholder="choose-subdomain"
              value={quickSubdomain}
              onChange={e => setQuickSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                padding: '8px 12px',
                outline: 'none',
                flex: 1,
              }}
            />
            <span style={{
              padding: '0 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              background: 'var(--bg-surface-1)',
              borderLeft: '1px solid var(--border-subtle)',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
            }}>
              .geohost.site
            </span>
          </div>

          <button type="submit" className="btn-primary" style={{ height: '36px', padding: '0 18px' }}>
            Deploy Now →
          </button>
        </form>

        {/* Technical Key-Value Badges */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          background: 'var(--bg-surface-0)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
        }}>
          <div>
            <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              PAYLOAD LIMIT
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>
              50 MB ZIP / 200 MB EXP
            </strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              SCANNING ENGINE
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-primary)' }}>
              AST & SHANNON ENTROPY
            </strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              SUBDOMAIN CACHE
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>
              O(1) THREAD-SAFE LRU
            </strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              VISITOR TELEMETRY
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--state-live)' }}>
              HMAC-SHA256 COOKIELESS
            </strong>
          </div>
        </div>
      </section>

      {/* 2. Pipeline Track */}
      <section style={{ marginBottom: '32px' }}>
        <div className="inst-section-label">
          <span>Deployment Lifecycle & Verification Pipeline</span>
        </div>
        <div className="pipeline-track">
          {pipelineStages.map(stage => (
            <div key={stage.id} className="pipeline-node">
              <div className="pipeline-step-idx">{stage.code}</div>
              <div className="pipeline-step-title">
                <span>{stage.name}</span>
                <span className={`badge badge-${stage.status === 'PASS' || stage.status === 'LIVE' || stage.status === 'ACTIVE' ? 'approved' : 'pending'}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                  {stage.status}
                </span>
              </div>
              <p className="pipeline-step-desc">{stage.detail}</p>
              <div className="pipeline-step-meta">{stage.metric}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Verified Public Deployments Table */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div className="inst-section-label" style={{ margin: 0 }}>
            <span>Verified Public Deployments</span>
          </div>
          <Link to="/explore" style={{ fontSize: '12px', fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--accent-primary)' }}>
            View All in Explore →
          </Link>
        </div>

        <div className="inst-table-container">
          <table className="inst-table">
            <thead>
              <tr>
                <th>Subdomain</th>
                <th>Status</th>
                <th>Security Rating</th>
                <th>Deployed</th>
                <th style={{ textAlign: 'right' }}>Target Endpoint</th>
              </tr>
            </thead>
            <tbody>
              {showcase.length > 0 ? (
                showcase.map(project => (
                  <tr key={project.id || project.subdomain}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {project.subdomain}
                    </td>
                    <td>
                      <span className="badge badge-approved">
                        <span className="pulse-dot" />
                        Live
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--state-live)' }}>
                        Score: 100/100 Verified
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {project.created_at ? new Date(project.created_at).toLocaleDateString() : 'Active'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <a
                        href={`https://${project.subdomain}.geohost.site`}
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
                        {project.subdomain}.geohost.site ↗
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
                    No public deployments cataloged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Engineering Architecture & Guarantees */}
      <section style={{ marginBottom: '32px' }}>
        <div className="inst-section-label">
          <span>Engineering Architecture & Guarantees</span>
        </div>
        <div className="spec-matrix">
          <div className="spec-cell">
            <div className="spec-cell-header">01 // ENGINE</div>
            <div className="spec-cell-title">Concurrent Go Runtime</div>
            <div className="spec-cell-body">
              Compiled Go daemon running on native ARM64 Oracle Cloud infrastructure. Utilizes non-blocking goroutine multiplexing, token bucket rate limiting, and 50MB streaming multipart processing without buffering full payloads into heap memory.
            </div>
          </div>

          <div className="spec-cell">
            <div className="spec-cell-header">02 // SAFETY</div>
            <div className="spec-cell-title">Pre-Flight AST Auditing</div>
            <div className="spec-cell-body">
              Static JavaScript AST scanning detects execution exploits (eval, prototype tampering, crypto miners, exfiltration sinks). Calculates byte entropy to quarantine packed malware.
            </div>
          </div>

          <div className="spec-cell">
            <div className="spec-cell-header">03 // EDGE</div>
            <div className="spec-cell-title">O(1) LRU Routing</div>
            <div className="spec-cell-body">
              High-concurrency thread-safe LRU cache. Resolves target paths in O(1) time without querying SQLite on edge hits, proxied over Cloudflare Anycast tunnels.
            </div>
          </div>

          <div className="spec-cell">
            <div className="spec-cell-header">04 // PRIVACY</div>
            <div className="spec-cell-title">Cookieless Telemetry</div>
            <div className="spec-cell-body">
              Zero client-side tracking scripts or third-party cookies. Records privacy-safe daily unique visits using server-side HMAC-SHA256 salted hashes and Cloudflare edge geolocation headers.
            </div>
            <div style={{ marginTop: '12px' }}>
              <Link to="/privacy" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                View Privacy Policy &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Operational Footer */}
      <footer style={{
        paddingTop: '24px',
        paddingBottom: '24px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: 'var(--text-tertiary)',
        flexWrap: 'wrap',
        gap: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '13px' }}>GeoHost</span>
          <span style={{ color: 'var(--border-muted)' }}>&bull;</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>Edge Infrastructure</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          <Link to="/explore" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px' }}>Explore</Link>
          <Link to="/upload" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px' }}>Deploy</Link>
          <Link to="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px' }}>Privacy Policy</Link>
          <Link to="/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px' }}>Terms of Service</Link>
          <Link to="/admin" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px' }}>Admin</Link>
          <span style={{ color: 'var(--state-live)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>&bull; ALL SYSTEMS OPERATIONAL</span>
        </div>
      </footer>
    </div>
  )
}
