# GeoHost — Product Design Specification & Visual Identity Blueprint
**Concept:** A Technical Hosting Instrument  
**Core Principles:** Precision · Trust · Speed · Technical Depth · Control · Clarity · Engineering Quality  
**Anti-Goals:** Not a marketing SaaS, not an AI startup template, not a Vercel clone, not a Dribbble concept, no fake terminals, no bento grids.

---

## 1. Product Philosophy & Visual Identity

### 1.1 The Core Concept: A Technical Hosting Instrument
GeoHost is infrastructure software for developers who need fast, verified web application hosting. It is not a lifestyle brand or a flashy marketing SaaS. It sits in the same category of tools as Wireshark, Grafana, Datadog, or an AWS/Cloudflare edge console—software engineered for practitioners who prize information density, immediate legibility, and deterministic control over cosmetic embellishments.

### 1.2 Personality Attributes
* **Precision**: Sub-pixel alignment, consistent baseline grids, tabular figures for metrics, deterministic layout bounds.
* **Trust**: Security and verification results are presented as audit reports, not gamified badges.
* **Speed**: Zero unnecessary layout shifts, instant response times, compact navigation paths, sub-millisecond visual hierarchy.
* **Technical Depth**: Meaningful metadata (HTTP status codes, cryptographic hashes, Shannon entropy values, byte sizes, anycast POPs) is accessible without cluttering the primary workflow.
* **Control**: Clear lifecycle states (Deploy, Suspend, Purge, Toggle Visibility) with predictable consequences.
* **Clarity**: No ambiguity between what is platform chrome and what is user content.
* **Engineering Quality**: Restrained motion, high contrast ratios, semantic structure, zero visual noise.

---

## 2. The Anti-Pattern Purge (AI-Slop Elimination)

The following design artifacts are strictly prohibited across all GeoHost surfaces:
* ? **No decorative pseudo-terminals**: Faux macOS window buttons (red/yellow/green dots) wrapping hardcoded CLI logs are banned. Operational flows must be represented as actual system state pipelines.
* ? **No bento grids**: Do not group arbitrary features into asymmetrical rounded cards just because bento grids are trendy. Group by system function.
* ? **No purple/blue gradient fills or gradient text**: Every color token must have semantic meaning (e.g., active state, error, warning, success, neutral chrome).
* ? **No glassmorphism or blur filters**: No `backdrop-filter: blur(20px)`. Surfaces must have solid, predictable contrast and structural hierarchy.
* ? **No glowing borders or neon shadows**: No `box-shadow: 0 0 25px rgba(0, 102, 255, 0.4)`. Elevation is achieved through subtle border value shifts and luminance contrast.
* ? **No card-for-everything syndrome**: Information should live in structured tables, definition lists, tabular rows, and semantic sections separated by 1px rules—not floating rounded boxes.
* ? **No giant, hollow marketing heroes**: Headings must be proportional and direct. No 64px vague slogans like "Supercharge your deployment workflow with next-gen AI".
* ? **No decorative icons**: Icons only appear when they function as recognizable visual anchors or affordances (e.g., external link, clipboard copy, sorting arrows).

---

## 3. Design System & Token Architecture

### 3.1 Color Palette (Functional, Restrained, High-Contrast)
Every color serves an operational purpose:

```css
:root {
  /* Neutral Canvas & Surfaces */
  --bg-canvas: #090a0c;        /* Deep technical slate black */
  --bg-surface-0: #0f1115;     /* Structural chrome, top bar, sidebar */
  --bg-surface-1: #15181e;     /* Inset panels, table headers, table rows */
  --bg-surface-2: #1c2028;     /* Active rows, hover states, input fields */
  --bg-surface-elevated: #242933; /* Modals, dropdown flyouts */

  /* Structural Rules & Borders */
  --border-subtle: #1f242d;    /* Grid lines, cell dividers */
  --border-muted: #2d3442;     /* Card bounds, input borders */
  --border-active: #485369;    /* Focused inputs, active selections */
  --border-strong: #707e99;    /* High-contrast accents */

  /* Text & Data Contrast */
  --text-primary: #f0f3f8;     /* Primary values, headings, active labels */
  --text-secondary: #9aa5b8;   /* Table headers, descriptors, metadata */
  --text-tertiary: #606b7d;    /* Inactive items, timestamp labels, hints */
  --text-disabled: #404756;    /* Disabled buttons, unavailable actions */

  /* Semantic Instrument Accents */
  --accent-instrument: #2e78d6;       /* Primary operational actions (Deploy, Confirm) */
  --accent-instrument-hover: #3d8bf2;
  --accent-instrument-subtle: rgba(46, 120, 214, 0.12);

  /* System States */
  --state-live: #10b981;              /* Green: Online, approved, healthy */
  --state-live-bg: rgba(16, 185, 129, 0.10);
  --state-live-border: rgba(16, 185, 129, 0.25);

  --state-pending: #f59e0b;           /* Amber: Review required, queued */
  --state-pending-bg: rgba(245, 158, 11, 0.10);
  --state-pending-border: rgba(245, 158, 11, 0.25);

  --state-blocked: #ef4444;           /* Red: Rejected, malicious, failed */
  --state-blocked-bg: rgba(239, 68, 68, 0.10);
  --state-blocked-border: rgba(239, 68, 68, 0.25);

  --state-suspended: #64748b;         /* Slate: Frozen, offline */
  --state-suspended-bg: rgba(100, 116, 139, 0.10);
  --state-suspended-border: rgba(100, 116, 139, 0.25);
}
```

### 3.2 Typography: Legibility & Instrument Precision
* **Primary UI Font**: System sans-serif stack optimized for native rendering speed and neutrality:
  `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
* **Technical Monospace Font**: Dedicated for code, hashes, endpoints, status codes, and metrics:
  `"JetBrains Mono", "SF Mono", Menlo, Consolas, "Fira Code", monospace`
* **Type Hierarchy**:
  * Page Instrument Title: `20px` / `1.2` / `font-weight: 600` / tracking `-0.01em`
  * Section Header: `13px` / `font-weight: 600` / `text-transform: uppercase` / tracking `0.06em` / `--text-secondary`
  * Body Text: `14px` / `1.5` / `font-weight: 400` / `--text-primary`
  * Secondary Metadata / Table Data: `13px` / `1.4` / tabular figures enabled (`font-variant-numeric: tabular-nums`)
  * Micro Data / Badges: `11px` / `font-weight: 600` / monospace

---

## 4. Screen-by-Screen Architecture

### 4.1 Global Navigation (`Navbar.jsx`)
* **Role**: Operational HUD rather than a consumer site header.
* **Layout**: Fixed 48px height, 100% width, border-bottom: 1px solid `--border-subtle`.
* **Elements**:
  * Left: GeoHost wireframe logo + single lowercase brand label `geohost` + subtle edge region indicator `[edge-fra01]` or system status.
  * Center/Left: Primary console views: `Projects`, `Explore`, `Deploy`, `Admin` (if admin).
  * Right: Operational metrics / quick status indicator (`Edge: 100% OK`) + User account pill (email + role badge) + Sign Out / Sign In.
* **Interaction**: Clean active state underline/border indicator. No pill highlights or floating buttons.

### 4.2 Home: The Operational Overview
* **No fake marketing fluff**. Reframe the home page as the platform instrument overview:
  1. **Primary Instrument Masthead**:
     * Direct statement of capability: "High-Performance Edge Web Hosting with Pre-Flight Security Auditing."
     * Operational summary bar: Global Anycast Routing · Automated AST Scanning · Cookieless Analytics · ARM64 Go Engine.
     * Primary action: `[ Deploy Archive ]` with secondary technical link `[ Explore Public Network ]`.
  2. **The Operational Pipeline Instrument (Replacing Fake Terminal)**:
     * A structured, linear 5-step operational pipeline component:
       `ARCHIVE UPLOAD` ? `UNPACK & VERIFY` ? `AST & ENTROPY SCAN` ? `EDGE ROUTING` ? `PRODUCTION DEPLOY`
     * Each step displays real telemetry: execution time (< 80ms), checks performed (Zip-Slip, regex AST, Shannon Entropy), and determinism status.
  3. **Architecture & Technical Guarantees**:
     * A high-density technical specifications matrix comparing GeoHost's security model, edge resolution speed, and isolation against standard static hosting.
  4. **Live Network Telemetry & Verified Deployments**:
     * High-density table of recent public deployments with live status, verified scan timestamp, and direct domain link.

### 4.3 My Sites Dashboard (`Dashboard.jsx`)
* **Replaced oversized cards with a high-density Control Surface Table**:
  * Columns:
    1. **PROJECT**: Subdomain identifier + creation timestamp.
    2. **STATUS**: Operational badge (`? LIVE`, `? PENDING REVIEW`, `? SUSPENDED`, `? REJECTED`).
    3. **TARGET DOMAIN**: Direct link with external indicator (`*.geohost.site ?`).
    4. **VISIBILITY**: Fast inline toggle (`PUBLIC` vs `PRIVATE`).
    5. **SECURITY RATING**: Scan score + verified check count (e.g., `100/100 · 0 flags`).
    6. **ANALYTICS**: Link to visitor telemetry (`[ View Metrics ? ]`).
    7. **ACTIONS**: Fast action menu (`Manage`, `Redeploy`, `Delete`).
  * Instant filter bar: Search by subdomain, filter by status (All, Live, Pending, Suspended).
  * Empty state: Functional terminal-inspired prompt explaining how to push the first zip bundle via UI or CLI.

### 4.4 Deployment Flow (`Upload.jsx`)
* **An Engineering Workflow, Not a Drag-and-Drop Toy**:
  1. **Source Configuration**: Subdomain input with real-time availability check against regex `^[a-z0-9-]+$`.
  2. **Archive Inspector**: Displays selected zip file name, compressed size, file count estimate, and 50MB ceiling bar.
  3. **Deployment Options**: Gallery visibility toggle switch (Public showcase vs Private test).
  4. **Execution Console**:
     * Phase 1: Uploading payload (progress percentage, transfer rate).
     * Phase 2: Server-side verification (unpacking, AST analysis, entropy evaluation).
     * Phase 3: Edge publishing (DNS registration, Cloudflare cache purge, live URL generation).
  5. **Post-Deployment Telemetry Report**:
     * Displays exact verification score, files audited, and live HTTPS URL with one-click copy and open button.

### 4.5 Public Explore Gallery (`Explore.jsx`)
* **Websites Are the Visual Stars; Chrome Stays Subservient**:
  * Filter and search bar at the top (Subdomain search, sort by recent).
  * Responsive 3-column / 2-column grid of clean, technical project viewports:
    * Clean aspect ratio viewport showing live preview link or preview frame.
    * Subdomain label, verification badge, and timestamp.
    * Direct link opening in new tab.
  * Information-dense list view toggle for developers who prefer scanning table rows.

### 4.6 Analytics Surface (`Analytics.jsx`)
* **Real Data, Zero Hallucinated Metrics**:
  * Period selector (Last 24 Hours, Last 7 Days, Last 30 Days).
  * 4 Primary Telemetry Stat Cells:
    * Total Pageviews (exact count).
    * Daily Unique Visitors (HMAC-SHA256 anonymized).
    * Top Referrer Domain.
    * Top Geographic Origin (Cloudflare CF-IPCountry).
  * Real time-series bar chart with date timestamps, grid lines, and hover tooltips.
  * Breakdown tables:
    * Referrer distribution with percentages.
    * Country distribution with ISO country codes.

### 4.7 Admin Review & Moderation Console (`Admin.jsx`)
* **Optimized for Sub-Second Triage & Security Auditing**:
  * Dual-pane operational split view:
    * **Left Pane (Queue)**: Segmented status tabs (`Pending (N)`, `Approved (N)`, `Suspended (N)`, `Rejected (N)`), list of project submissions with score pills and timestamps.
    * **Right Pane (Audit & Action)**:
      * Submission Header: Subdomain, Owner email, Submitted timestamp, Status control buttons (`Approve`, `Reject`, `Suspend`, `Unsuspend`, `Purge Archive`).
      * Security Audit Report: Pass/Fail breakdown for Path Traversal, Executable Binaries, eval() / Obfuscation AST, Shannon Entropy score (`4.2 / 8.0 - Normal`).
      * Archive Manifest Tree: Inspectable list of all files inside the zip with individual byte sizes.
      * Live Sandboxed Edge Preview: Sandboxed iframe with strict security headers.

### 4.8 Authentication (`Login.jsx`, `AdminLogin.jsx`)
* **Minimalist, High-Focus Authentication Surface**:
  * No marketing sidebars or distracting imagery.
  * Centered technical instrument box:
    * Wireframe GeoHost mark.
    * Heading: `Authenticate to GeoHost Edge`.
    * Branded "Continue with Google" action.
    * Subtle divider: `or continue with credentials`.
    * Email and Password fields with clear focus states.
    * Inline OAuth setup modal for development environments without Google Client ID.

---

## 5. Visual QA Loop & The AI-Slop Test

Every page must pass the following product designer criteria:
1. **The Identity Test**: If the GeoHost logo is masked, does it look like a serious infrastructure console, or a generic AI SaaS?
2. **The Card Test**: Does this information need a rounded card with a 1px border, or is a semantic table/row with a divider cleaner and more information-dense?
3. **The Color Test**: Does every colored pixel represent state, action, or security, or is it decorative fluff?
4. **The Scan Test**: Can an on-call engineer read the status, domain, and security verdict in under 200 milliseconds?
