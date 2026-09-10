import React from 'react'
import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="inst-main" style={{ maxWidth: '780px', padding: '40px 24px' }}>
      <section className="inst-masthead" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            LEGAL // PRIVACY DIRECTIVE
          </span>
        </div>
        <h1 className="inst-title" style={{ fontSize: '26px', marginBottom: '8px' }}>Privacy Policy</h1>
        <p className="inst-subtitle" style={{ fontSize: '13px' }}>
          Effective Date: September 2026 · GeoHost Edge Infrastructure
        </p>
      </section>

      <div className="inst-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px', lineHeight: 1.6, fontSize: '13px', color: 'var(--text-secondary)' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            1. Information We Collect
          </h2>
          <p>
            GeoHost is designed with privacy-first infrastructure. When you use GeoHost, we collect:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '6px' }}>
            <li><strong>Account Credentials:</strong> When signing in with Google OAuth or email, we store your email address, display name, and unique account identifier to authenticate sessions and associate your hosted projects.</li>
            <li><strong>Hosted Archives:</strong> Compressed static website bundles (.zip) submitted for edge deployment, which are scanned for security threats and stored for serving.</li>
            <li><strong>Cookieless Telemetry:</strong> Anonymized server-side request counts, geographic edge ingress points (via Cloudflare headers), and daily unique visitor hashes computed using non-reversible salted HMAC-SHA256. We do not set tracking cookies.</li>
          </ul>
        </div>

        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            2. How We Use Information
          </h2>
          <p>
            Your information is strictly used to:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '6px' }}>
            <li>Authenticate access to your deployment management workspace.</li>
            <li>Perform pre-flight static AST vulnerability scanning to ensure platform safety.</li>
            <li>Serve your web applications over the global Anycast edge network.</li>
            <li>Compile anonymous request analytics accessible solely to the project owner and platform administrators.</li>
          </ul>
        </div>

        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            3. Third-Party Services
          </h2>
          <p>
            We integrate with Google Identity Services solely to provide secure, one-click authentication. We never sell, lease, or share personal data with external advertising brokers or data aggregators.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            4. Data Retention & Deletion
          </h2>
          <p>
            You have full ownership of your hosted deployments. Deleting a project from your dashboard immediately purges the files and invalidates in-memory edge cache entries.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            5. Contact
          </h2>
          <p>
            For privacy or security inquiries, contact the platform administration at: <code style={{ color: 'var(--accent-primary)' }}>namanlalwani04@gmail.com</code>.
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
