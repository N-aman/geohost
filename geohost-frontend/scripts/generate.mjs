import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, '_original-site')
const OUT = path.join(ROOT, 'src')

const PAGES = [
  { file: 'index.html', comp: 'Home', route: '/', base: '/' },
  { file: 'status.html', comp: 'Status', route: '/status', base: '/' },
  { file: 'upload.html', comp: 'Upload', route: '/upload', base: '/' },
  { file: 'admin.html', comp: 'Admin', route: '/admin', base: '/' },
  { file: 'admin/login.html', comp: 'AdminLogin', route: '/admin/login', base: '/admin/' },
]
const ROUTES = new Set(['/', '/status', '/upload', '/admin', '/admin/login'])

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const RAW_TEXT = new Set(['style', 'script'])

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '\u00a9',
  mdash: '\u2014', ndash: '\u2013', middot: '\u00b7', hellip: '\u2026', rsquo: '\u2019',
  lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d', times: '\u00d7', bull: '\u2022',
  deg: '\u00b0', plusmn: '\u00b1', trade: '\u2122', reg: '\u00ae', laquo: '\u00ab', raquo: '\u00bb',
}
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const num = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(num) && num > 0 && num <= 0x10ffff ? String.fromCodePoint(num) : m
    }
    const named = ENTITIES[body] || ENTITIES[body.toLowerCase()]
    return named !== undefined ? named : m
  })
}

function parse(src) {
  let i = 0
  function parseNodes(endTag) {
    const nodes = []
    while (i < src.length) {
      const nxt = src.indexOf('<', i)
      if (nxt === -1) { pushText(src.slice(i)); i = src.length; break }
      if (nxt > i) pushText(src.slice(i, nxt))
      i = nxt
      if (src.startsWith('<!--', i)) {
        const e = src.indexOf('-->', i)
        i = e === -1 ? src.length : e + 3
        continue
      }
      if (src.startsWith('<!', i)) {
        const e = src.indexOf('>', i)
        i = e === -1 ? src.length : e + 1
        continue
      }
      if (src.startsWith('</', i)) {
        const e = src.indexOf('>', i)
        const name = src.slice(i + 2, e).trim().toLowerCase()
        i = e + 1
        if (endTag === name) return nodes
        // stray close tag: skip
        continue
      }
      const m = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(src.slice(i))
      if (!m) { pushText('<'); i++; continue }
      const name = m[1].toLowerCase()
      i += m[0].length
      const attrs = []
      let selfClosed = false
      while (i < src.length) {
        while (i < src.length && /\s/.test(src[i])) i++
        if (i >= src.length) break
        if (src[i] === '>') { i++; break }
        if (src.startsWith('/>', i)) { i += 2; selfClosed = true; break }
        let nm = ''
        while (i < src.length && !/[\s=/>]/.test(src[i])) nm += src[i++]
        if (!nm) { i++; continue }
        let val = null
        if (src[i] === '=') {
          i++
          while (i < src.length && /\s/.test(src[i])) i++
          const q = src[i]
          if (q === '"' || q === "'") {
            const e = src.indexOf(q, i + 1)
            val = decodeEntities(src.slice(i + 1, e === -1 ? src.length : e))
            i = e === -1 ? src.length : e + 1
          } else {
            const st = i
            while (i < src.length && !/[\s>]/.test(src[i])) i++
            val = decodeEntities(src.slice(st, i))
          }
        }
        attrs.push({ name: nm, value: val })
      }
      const el = { type: 'el', tag: name, attrs, selfClosed, children: [] }
      nodes.push(el)
      if (!selfClosed && !VOID.has(name)) {
        if (RAW_TEXT.has(name)) {
          const closeIdx = src.toLowerCase().indexOf('</' + name, i)
          const content = src.slice(i, closeIdx === -1 ? src.length : closeIdx)
          el.children.push({ type: 'text', v: content })
          i = closeIdx === -1 ? src.length : closeIdx
          const ce = src.indexOf('>', i)
          i = ce === -1 ? src.length : ce + 1
        } else {
          el.children.push(...parseNodes(name))
        }
      }
    }
    return nodes

    function pushText(v) {
      if (nodes.length && nodes[nodes.length - 1].type === 'text') nodes[nodes.length - 1].v += v
      else nodes.push({ type: 'text', v })
    }
  }
  return parseNodes(null)
}

const ATTR_MAP = { class: 'className', for: 'htmlFor' }
function attrName(raw) {
  const n = raw.toLowerCase()
  if (ATTR_MAP[n]) return ATTR_MAP[n]
  if (n.startsWith('data-') || n.startsWith('aria-')) return n
  if (raw !== n) return raw
  if (/^[a-z][a-zA-Z0-9]*$/.test(n)) return n
  return n.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}
function styleToObject(s) {
  const entries = []
  for (const part of s.split(';')) {
    const t = part.trim()
    if (!t) continue
    const ci = t.indexOf(':')
    if (ci === -1) continue
    const rawKey = t.slice(0, ci).trim()
    const val = JSON.stringify(t.slice(ci + 1).trim())
    if (rawKey.startsWith('--')) entries.push(`${JSON.stringify(rawKey)}: ${val}`)
    else {
      const camel = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      entries.push(`${/^[a-zA-Z][a-zA-Z0-9]*$/.test(camel) ? camel : JSON.stringify(rawKey)}: ${val}`)
    }
  }
  return `{{ ${entries.join(', ')} }}`
}
const BOOL_ATTRS = new Set(['disabled', 'required', 'checked', 'readonly', 'selected', 'multiple', 'autofocus', 'autoplay', 'controls', 'loop', 'muted', 'open', 'hidden'])

let usesLink = false
function resolveInternal(href, base) {
  try {
    const u = new URL(href, 'http://localhost' + base)
    if (u.origin !== 'http://localhost') return null
    let p = u.pathname.replace(/\/+$/, '') || '/'
    return ROUTES.has(p) ? p : null
  } catch { return null }
}
function emitAttrs(attrs, tag, base) {
  const parts = []
  for (const a of attrs) {
    const n = a.name.toLowerCase()
    if (n === 'href' && tag === 'a') continue
    if (n === 'value' && ['input', 'textarea', 'select'].includes(tag)) {
      parts.push(`defaultValue=${JSON.stringify(a.value ?? '')}`)
      continue
    }
    if (n === 'style' && a.value != null) { parts.push(`style=${styleToObject(a.value)}`); continue }
    const name = attrName(a.name)
    if (a.value == null) parts.push(BOOL_ATTRS.has(n) || n.startsWith('data-') || n.startsWith('aria-') ? `${name}={true}` : name)
    else parts.push(`${name}=${JSON.stringify(a.value)}`)
  }
  return parts
}
function fmtTag(tag, attrsParts, selfClose) {
  const joined = attrsParts.length ? ' ' + attrsParts.join(' ') : ''
  return `<${tag}${joined}${selfClose ? ' />' : '>'}`
}
function emit(nodes, base, indent) {
  const lines = []
  const pad = '  '.repeat(indent)
  for (const node of nodes) {
    if (node.type === 'comment') continue
    if (node.type === 'text') {
      if (!node.v.trim()) continue
      lines.push(`${pad}{${JSON.stringify(node.v)}}`)
      continue
    }
    if (node.type !== 'el') continue
    let { tag, attrs } = node
    if (tag === 'script' || tag === 'link') continue
    let openTag = tag
    const attrParts = emitAttrs(attrs, tag, base)
    if (tag === 'a') {
      const href = attrs.find(a => a.name.toLowerCase() === 'href')
      if (href && href.value != null) {
        const to = resolveInternal(href.value, base)
        if (to) { openTag = 'Link'; usesLink = true; attrParts.unshift(`to=${JSON.stringify(to)}`) }
      }
    }
    const kids = node.children.filter(c => !(c.type === 'text' && !c.v.trim()) )
    if (node.selfClosed || VOID.has(tag) || kids.length === 0) {
      lines.push(`${pad}${fmtTag(openTag, attrParts, true)}`)
      continue
    }
    if (kids.length === 1 && kids[0].type === 'text') {
      const tv = kids[0].v
      if (tv.length < 80 && !tv.includes('\n')) {
        lines.push(`${pad}${fmtTag(openTag, attrParts, false)}{${JSON.stringify(tv)}}</${openTag}>`)
        continue
      }
    }
    lines.push(`${pad}${fmtTag(openTag, attrParts, false)}`)
    lines.push(...emit(kids, base, indent + 1))
    lines.push(`${pad}</${openTag}>`)
  }
  return lines
}

function findEl(nodes, tag, id) {
  for (const n of nodes) {
    if (n.type === 'el' && n.tag === tag) {
      const idAttr = n.attrs.find(a => a.name.toLowerCase() === 'id')
      if (!id || (idAttr && idAttr.value === id)) return n
    }
    if (n.type === 'el' && n.children) {
      const f = findEl(n.children, tag, id)
      if (f) return f
    }
  }
  return null
}

function pageBody(file, base) {
  const html = fs.readFileSync(path.join(SRC, file), 'utf8')
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || ''
  const bodyStart = html.indexOf('<body>')
  const bodyEnd = html.lastIndexOf('</body>')
  const tree = parse(html.slice(bodyStart + 6, bodyEnd))
  const main = findEl(tree, 'div', 'main')
  const svgs = findEl(tree, 'div', 'svg-templates')
  if (!main) throw new Error('#main not found in ' + file)
  const children = [...main.children]
  if (svgs) children.push(svgs)
  return { title, lines: emit(children, base, 2) }
}

// ---- CSS extraction ----
function extractCss(file, re) {
  const html = fs.readFileSync(path.join(SRC, file), 'utf8')
  const out = []
  let m
  while ((m = re.exec(html))) {
    const openEnd = m.index + m[0].length
    const close = html.indexOf('</style>', openEnd)
    out.push(html.slice(openEnd, close))
  }
  return out.join('\n')
}

fs.mkdirSync(path.join(OUT, 'pages'), { recursive: true })
fs.mkdirSync(path.join(OUT, 'styles'), { recursive: true })

// fonts.css from index.html
const fontsHtml = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8')
const fm = fontsHtml.match(/<style data-framer-font-css>([\s\S]*?)<\/style>/)
fs.writeFileSync(path.join(OUT, 'styles/fonts.css'), fm[1].replace(/url\("images\//g, 'url("/images/').replace(/url\(images\//g, 'url(/images/'))

// framer.css: concat all pages' ssr-minified blocks (dedupe identical blocks)
const seen = new Set()
const cssBlocks = []
for (const p of PAGES) {
  const css = extractCss(p.file, /<style data-framer-css-ssr-minified[^>]*>/g)
  if (!seen.has(css)) { seen.add(css); cssBlocks.push(`/* ${p.file} */\n${css}`) }
}
fs.writeFileSync(path.join(OUT, 'styles/framer.css'), cssBlocks.join('\n\n'))

// pages
for (const p of PAGES) {
  usesLink = false
  const { title, lines } = pageBody(p.file, p.base)
  const linkUsed = usesLink
  const header = [
    "import { useEffect } from 'react'",
    ...(linkUsed ? ["import { Link } from 'react-router-dom'"] : []),
  ]
  const comp = `${header.join('\n')}\n\nexport default function ${p.comp}() {\n  useEffect(() => {\n    document.title = ${JSON.stringify(title)}\n  }, [])\n\n  return (\n    <>\n${lines.join('\n')}\n    </>\n  )\n}\n`
  fs.writeFileSync(path.join(OUT, 'pages', p.comp + '.jsx'), comp)
  console.log('generated', p.comp + '.jsx', '(' + lines.length + ' lines)')
}
console.log('done')
