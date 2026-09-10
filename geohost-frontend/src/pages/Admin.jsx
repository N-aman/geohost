import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import ConfirmModal from '../components/ConfirmModal'
import Toast from '../components/Toast'

export default function Admin() {
  const [tab, setTab] = useState('pending')
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [fileList, setFileList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)

  const navigate = useNavigate()

  useEffect(() => {
    loadProjects(tab)
  }, [tab])

  const loadProjects = (status) => {
    setLoading(true)
    setError('')
    fetch(`/admin/projects?status=${status}`, { credentials: 'include' })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          navigate('/admin/login?expired=1')
          throw new Error('Authentication required')
        }
        if (!res.ok) throw new Error('Failed to fetch projects')
        return res.json()
      })
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setProjects(list)
        setLoading(false)
        if (list.length > 0) {
          selectProject(list[0])
        } else {
          setSelectedProject(null)
          setFileList([])
        }
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }

  const selectProject = (p) => {
    setSelectedProject(p)
    loadFiles(p.id)
  }

  const loadFiles = (id) => {
    fetch(`/admin/files?project_id=${id}`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(files => setFileList(Array.isArray(files) ? files : []))
      .catch(() => setFileList([]))
  }

  const executeAction = async (action, projectId) => {
    try {
      const res = await fetch(`/admin/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ project_id: projectId }),
      })
      const text = await res.text()
      let errMsg = 'Action failed'
      let successMsg = `Action '${action}' executed successfully.`
      try {
        const data = JSON.parse(text)
        if (data.error) errMsg = data.error
        if (data.message) successMsg = data.message
      } catch {
        if (text && text.trim()) {
          errMsg = text.trim()
          successMsg = text.trim()
        }
      }
      if (!res.ok) throw new Error(errMsg)

      setToast({ type: 'success', message: successMsg })
      setModal(null)
      loadProjects(tab)
    } catch (err) {
      setToast({ type: 'error', message: err.message })
      setModal(null)
    }
  }

  const promptApprove = (p) => {
    setModal({
      title: `Approve ${p.subdomain}.geohost.site?`,
      message: 'This will propagate the site to the Anycast edge cache and make it accessible globally.',
      confirmLabel: 'Approve & Propagate',
      isDanger: false,
      onConfirm: () => executeAction('approve', p.id),
    })
  }

  const promptReject = (p) => {
    setModal({
      title: `Reject ${p.subdomain}.geohost.site?`,
      message: 'This will quarantine the project and remove its edge routing entry.',
      confirmLabel: 'Reject Submission',
      isDanger: true,
      onConfirm: () => executeAction('reject', p.id),
    })
  }

  const promptSuspend = (p) => {
    setModal({
      title: `Suspend ${p.subdomain}.geohost.site?`,
      message: 'Temporarily freeze routing to this site while keeping files intact.',
      confirmLabel: 'Suspend Site',
      isDanger: true,
      onConfirm: () => executeAction('suspend', p.id),
    })
  }

  const promptUnsuspend = (p) => {
    setModal({
      title: `Unsuspend ${p.subdomain}.geohost.site?`,
      message: 'Restore active edge routing for this project.',
      confirmLabel: 'Restore Routing',
      isDanger: false,
      onConfirm: () => executeAction('unsuspend', p.id),
    })
  }

  const promptDelete = (p) => {
    setModal({
      title: `Permanently Delete ${p.subdomain}?`,
      message: 'Irreversible action: purges all files from disk and removes the record from SQLite.',
      confirmLabel: 'Purge Permanently',
      isDanger: true,
      onConfirm: () => executeAction('delete', p.id),
    })
  }

  // Parse Pre-flight scan report
  let scanReportObj = null
  if (selectedProject?.scan_report) {
    try {
      scanReportObj = typeof selectedProject.scan_report === 'string'
        ? JSON.parse(selectedProject.scan_report)
        : selectedProject.scan_report
    } catch (e) {
      console.warn('Could not parse scan_report', e)
    }
  }

  const tabs = [
    { key: 'pending', label: 'PENDING' },
    { key: 'approved', label: 'APPROVED' },
    { key: 'suspended', label: 'SUSPENDED' },
    { key: 'rejected', label: 'REJECTED' },
  ]

  return (
    <div className="inst-main-fluid" style={{ maxWidth: '1600px', margin: '0 auto' }}>
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {modal && (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          isDanger={modal.isDanger}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Admin Masthead */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--accent-primary)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}>
              ROOT CONSOLE // MODERATION & LIFECYCLE TRIAGE
            </span>
          </div>
          <h1 className="inst-title" style={{ margin: 0, fontSize: '20px' }}>
            Admin Review & Control Console
          </h1>
        </div>

        {/* Triage Queue Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface-0)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: tab === t.key ? 'var(--bg-surface-2)' : 'transparent',
                color: tab === t.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: tab === t.key ? 'var(--accent-primary)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 12px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dual Pane Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: '16px',
        minHeight: 'calc(100vh - 180px)',
      }}>
        {/* Left Pane: Triage Queue */}
        <div style={{
          background: 'var(--bg-surface-0)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            QUEUE // {tab.toUpperCase()} ({projects.length})
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                Polling queue...
              </div>
            ) : projects.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                No {tab} projects in queue.
              </div>
            ) : (
              projects.map(p => {
                const isSelected = selectedProject?.id === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => selectProject(p)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--bg-surface-2)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                      }}>
                        {p.subdomain}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        color: 'var(--text-tertiary)',
                      }}>
                        #{p.id}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                      <span style={{
                        color: p.scan_score >= 85 ? 'var(--state-live)' : 'var(--state-warning)',
                        fontWeight: 600,
                      }}>
                        Score: {p.scan_score !== undefined ? `${p.scan_score}/100` : '100/100'}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Pane: Diagnostic Inspection Console */}
        <div style={{
          background: 'var(--bg-surface-0)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto',
        }}>
          {selectedProject ? (
            <>
              {/* Inspection Header */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: '12px',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                      {selectedProject.subdomain}.geohost.site
                    </h2>
                    <StatusBadge status={selectedProject.status} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Project ID: #{selectedProject.id} · Submitted: {selectedProject.created_at ? new Date(selectedProject.created_at).toLocaleString() : 'N/A'}
                  </div>
                  {selectedProject.status === 'rejected' && selectedProject.rejection_reason && (
                    <div style={{
                      marginTop: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--state-danger)',
                      background: 'rgba(239, 68, 68, 0.08)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'inline-block',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}>
                      REJECTION REASON: {selectedProject.rejection_reason}
                    </div>
                  )}
                </div>

                {/* Direct Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedProject.status === 'pending' && (
                    <>
                      <button onClick={() => promptApprove(selectedProject)} className="btn-success">
                        Approve
                      </button>
                      <button onClick={() => promptReject(selectedProject)} className="btn-danger">
                        Reject
                      </button>
                    </>
                  )}

                  {selectedProject.status === 'approved' && (
                    <>
                      <a
                        href={`https://${selectedProject.subdomain}.geohost.site`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '12px' }}
                      >
                        Open Live ↗
                      </a>
                      <button onClick={() => promptSuspend(selectedProject)} className="btn-secondary" style={{ color: 'var(--state-warning)' }}>
                        Suspend
                      </button>
                      <button onClick={() => promptReject(selectedProject)} className="btn-danger">
                        ✕ Revoke / Reject
                      </button>
                    </>
                  )}

                  {selectedProject.status === 'suspended' && (
                    <>
                      <button onClick={() => promptUnsuspend(selectedProject)} className="btn-success">
                        Unsuspend
                      </button>
                      <button onClick={() => promptReject(selectedProject)} className="btn-danger">
                        Reject
                      </button>
                    </>
                  )}

                  {selectedProject.status === 'rejected' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--text-tertiary)',
                        background: 'var(--bg-surface-2)',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        letterSpacing: '0.04em',
                      }}>
                        FILES PURGED · REQUIRES RE-DEPLOYMENT
                      </span>
                      <button onClick={() => promptDelete(selectedProject)} className="btn-danger">
                        Purge Record
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sentry-Style Security Diagnostic Panel */}
              <div style={{
                background: 'var(--bg-surface-1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    SECURITY AUDIT FINDINGS & HEURISTICS
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: selectedProject.scan_score >= 85 ? 'var(--state-live)' : 'var(--state-warning)',
                  }}>
                    SCORE: {selectedProject.scan_score !== undefined ? `${selectedProject.scan_score}/100` : '100/100'}
                  </span>
                </div>

                {scanReportObj?.findings && scanReportObj.findings.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {scanReportObj.findings.map((f, i) => (
                      <div key={i} style={{
                        background: 'var(--bg-surface-0)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <span style={{
                          color: f.severity === 'critical' ? 'var(--state-danger)' : 'var(--state-warning)',
                          fontWeight: 600,
                        }}>
                          [{f.severity?.toUpperCase() || 'INFO'}] {f.rule_name || f.message}
                        </span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                          {f.file_path || 'payload'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--state-live)' }}>
                    0 security vulnerabilities or suspicious heuristics flagged.
                  </div>
                )}
              </div>

              {/* Manifest & Sandboxed Preview Split */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '260px 1fr',
                gap: '16px',
                flex: 1,
              }}>
                {/* File Tree Manifest */}
                <div style={{
                  background: 'var(--bg-surface-1)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                  }}>
                    Archive Manifest ({fileList.length} files)
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {fileList.length > 0 ? (
                      fileList.map((file, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          borderBottom: '1px solid var(--border-subtle)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                        }}>
                          <span style={{ wordBreak: 'break-all' }}>{file.path}</span>
                          <span style={{ color: 'var(--text-tertiary)', marginLeft: '8px', flexShrink: 0 }}>
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', padding: '8px 0' }}>
                        No files in archive.
                      </div>
                    )}
                  </div>
                </div>

                {/* Sandboxed Live Preview */}
                <div style={{
                  background: 'var(--bg-surface-1)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '8px 12px',
                    background: 'var(--bg-surface-2)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                  }}>
                    <span>[ SANDBOXED PREVIEW // ISOLATED CONTEXT ]</span>
                    <span style={{ color: 'var(--accent-primary)' }}>sandbox="allow-scripts"</span>
                  </div>
                  <div style={{ flex: 1, minHeight: '340px', background: '#000' }}>
                    {selectedProject.status === 'rejected' ? (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        minHeight: '340px',
                        color: 'var(--text-tertiary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        gap: '8px',
                        padding: '20px',
                        textAlign: 'center',
                      }}>
                        <span style={{ color: 'var(--state-danger)', fontWeight: 600, letterSpacing: '0.04em' }}>
                          [ ASSETS PERMANENTLY PURGED ]
                        </span>
                        <span style={{ color: 'var(--text-secondary)', maxWidth: '360px' }}>
                          Deployment files were wiped from storage upon rejection. A new zip package must be submitted to undergo pre-flight security inspection.
                        </span>
                      </div>
                    ) : (
                      <iframe
                        title="Sandboxed Deployment Preview"
                        src={`/admin/preview?project_id=${selectedProject.id}&path=index.html`}
                        sandbox="allow-scripts"
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: '340px',
                          border: 'none',
                          display: 'block',
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
            }}>
              Select a project from the left queue to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
