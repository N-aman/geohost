import fs from 'fs'
import path from 'path'
import esbuild from 'esbuild'
import { pathToFileURL } from 'url'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, '_original-site')
const TMP = path.join(ROOT, 'scripts')

fs.writeFileSync(path.join(TMP, 'ssr-entry.jsx'), `
import React from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import Home from '${ROOT.replace(/\\/g, '/')}/src/pages/Home.jsx'
import Status from '${ROOT.replace(/\\/g, '/')}/src/pages/Status.jsx'
import Upload from '${ROOT.replace(/\\/g, '/')}/src/pages/Upload.jsx'
import Admin from '${ROOT.replace(/\\/g, '/')}/src/pages/Admin.jsx'
import AdminLogin from '${ROOT.replace(/\\/g, '/')}/src/pages/AdminLogin.jsx'

const routes = { '/': Home, '/status': Status, '/upload': Upload, '/admin': Admin, '/admin/login': AdminLogin }
export function renderAll() {
  const out = {}
  for (const [p, C] of Object.entries(routes)) {
    out[p] = renderToString(React.createElement(StaticRouter, { location: p }, React.createElement(C)))
  }
  return out
}
`)

await esbuild.build({
  entryPoints: [path.join(TMP, 'ssr-entry.jsx')],
  bundle: true,
  format: 'esm',
  outfile: path.join(ROOT, 'scripts', '.verify-bundle.mjs'),
  jsx: 'automatic',
  loader: { '.css': 'empty' },
})

const { renderAll } = await import(pathToFileURL(path.join(ROOT, 'scripts', '.verify-bundle.mjs')).href)
const rendered = renderAll()

function visibleTextsFromHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(script|svg)[\s\S]*?<\/(script|svg)>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n').map(s => s.trim()).filter(Boolean)
}
function decode(s) {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
}

const PAGE_MAP = [
  ['/', 'index.html'],
  ['/status', 'status.html'],
  ['/upload', 'upload.html'],
  ['/admin', 'admin.html'],
  ['/admin/login', 'admin/login.html'],
]

let failures = 0
for (const [route, file] of PAGE_MAP) {
  const orig = fs.readFileSync(path.join(SRC, file), 'utf8')
  const bodyStart = orig.indexOf('<div id="main"')
  const end = orig.indexOf('<!-- Start of bodyEnd -->', bodyStart)
  const mainEnd = orig.lastIndexOf('</div>', orig.indexOf('id="svg-templates"'))
  let scope = orig.slice(bodyStart, end > -1 ? end : undefined)
  const origTexts = decode(scope)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(script|svg)[\s\S]*?<\/(script|svg)>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean)

  const ren = rendered[route]
  const newTexts = decode(ren)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean)

  const missing = origTexts.filter(t => !newTexts.includes(t))
  const extra = newTexts.filter(t => !origTexts.includes(t))

  // svg template integrity
  const usedIds = [...ren.matchAll(/<use href="#([^"]+)"/g)].map(m => m[1])
  const defIds = [...ren.matchAll(/<svg id="([^"]+)"/g)].map(m => m[1])
  const dangling = [...new Set(usedIds.filter(id => !defIds.includes(id)))]

  console.log(`--- ${route} (${file})`)
  console.log(`texts original=${origTexts.length} rendered=${newTexts.length}`)
  if (missing.length) { failures++; console.log('MISSING:', JSON.stringify(missing)) }
  if (extra.length) { failures++; console.log('EXTRA:', JSON.stringify(extra)) }
  if (dangling.length) { failures++; console.log('DANGLING use refs:', JSON.stringify(dangling)) }
  if (!missing.length && !extra.length && !dangling.length) console.log('OK')
}

console.log(failures === 0 ? 'ALL ROUTES MATCH' : `${failures} route(s) with differences`)
