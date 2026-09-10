import React from 'react'
import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="inst-main" style={{ maxWidth: '780px', padding: '40px 24px' }}>
      <section className="inst-masthead" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            LEGAL // ACCEPTABLE USE DIRECTIVE
          </span>
        </div>
        <h1 className="inst-title" style={{ fontSize: '26px', marginBottom: '8px' }}>Terms of Service</h1>
        <p className="inst-subtitle" style={{ fontSize: '13px' }}>
          Effective Date: September 2026 · GeoHost Edge Infrastructure
        </p>
      </section>

      <div className="inst-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px', lineHeight: 1.6, fontSize: '13px', color: 'var(--text-secondary)' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            1. Service Overview
          </h2>
          <p>
            GeoHost provides high-performance, automated edge hosting for static web applications. By accessing or publishing content through GeoHost, you agree to comply with these Terms of Service.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            2. Acceptable Use & Security Restrictions
          </h2>
          <p>
            All deployments undergo automated pre-flight static analysis (AST parsing and Shannon entropy evaluation). You agree NOT to upload, host, or propagate:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '6px' }}>
            <li>Malicious code, exploits, or obfuscated payloads designed to compromise client browsers.</li>
            <li>In-browser cryptocurrency miners (e.g., CoinHive, coinimp, or similar scripts).</li>
            <li>Phishing interfaces, deceptive credential harvesting forms, or brand impersonation assets.</li>
            <li>Denial-of-service tools, port scanners, or automated scraping scripts targeting the edge network.</li>
            <li>Decompression bombs (archives exceeding the 50MB payload ceiling or 200MB uncompressed limit).</li>
          </ul>
        </div>

        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            3. Content Ownership & Responsibility
          </h2>
          <p>
            You retain all intellectual property rights and full ownership of the web assets and source code you deploy. You are solely responsible for ensuring that your hosted material does not infringe on third-party copyrights, trademarks, or applicable laws.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            4. Enforcement & Triage
          </h2>
          <p>
            Deployments that fail automated security thresholds or trigger heuristic anomaly flags will be quarantined for administrative moderation. GeoHost reserves the right to suspend or revoke access to any subdomain violating these security baselines.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            5. Contact & Support
          </h2>
          <p>
            Inquiries regarding terms, compliance, or security governance should be directed to: <code style={{ color: 'var(--accent-primary)' }}>namanlalwani04@gmail.com</code>.
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          <Link to="/" className="btn-secondary" style={{ display: 'inline-flex' }}>
            &larr; Back to GeoHost Overview
          </Link>
        </div>
      </div>
    </div>
  )
}
