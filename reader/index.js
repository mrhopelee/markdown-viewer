'use strict'

const MARKDOWN_RE = /\.(?:markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text)$/i

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', '.idea', '.vscode',
  '__pycache__', '.obsidian', '.trash', 'vendor', 'dist', 'build',
])

// theme name -> color scheme, identical to content/index.js
const THEME_COLORS = {
  'github': 'light',
  'github-dark': 'dark',
  'almond': 'light',
  'awsm': 'light',
  'axist': 'light',
  'bamboo': 'auto',
  'bullframe': 'light',
  'holiday': 'auto',
  'kacit': 'light',
  'latex': 'light',
  'marx': 'light',
  'mini': 'light',
  'modest': 'light',
  'new': 'auto',
  'no-class': 'auto',
  'pico': 'auto',
  'retro': 'dark',
  'sakura': 'light',
  'sakura-vader': 'dark',
  'semantic': 'light',
  'simple': 'auto',
  'style-sans': 'light',
  'style-serif': 'light',
  'stylize': 'light',
  'superstylin': 'auto',
  'tacit': 'light',
  'vanilla': 'auto',
  'water': 'light',
  'water-dark': 'dark',
  'writ': 'light',
  'custom': 'auto',
}

const $ = (sel) => document.querySelector(sel)

let rootHandle = null
let rootName = ''
let fileMap = new Map()       // relative path -> FileSystemFileHandle
let currentDir = ''           // directory of the currently open file ('' for root)
let currentPath = ''          // relative path of the currently open file
let currentRaw = ''           // raw markdown source of the currently open file
let objectUrls = []           // blob URLs created for local media, revoked on switch
let headingEls = []           // heading elements of the current doc, in document order
let activeRow = null
let raw = false
let settings = null           // cached chrome.storage.sync snapshot
let themeState = null         // { syntax, wrapperClass } from applyTheme()

// ---------------------------------------------------------------------------
// settings + theme (replicates content/index.js + background theme pipeline)
// ---------------------------------------------------------------------------

function loadSettings () {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (res) => {
      settings = res || {}
      resolve(settings)
    })
  })
}

function ensureLink (id, href) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('link')
    el.id = id
    el.rel = 'stylesheet'
    el.type = 'text/css'
    document.head.appendChild(el)
  }
  el.href = href
}

function applyTheme () {
  const theme = settings.theme || 'github'
  const width = (settings.themes && settings.themes.width) || 'auto'
  const syntax = !settings.content || settings.content.syntax !== false

  let scheme = THEME_COLORS[theme] || 'auto'
  if (theme === 'custom' && settings.custom) scheme = settings.custom.color || 'auto'

  const isDark = scheme === 'dark' ||
    (scheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const color = isDark ? 'dark' : 'light'

  const body = document.body
  for (const c of [...body.classList]) {
    if (c.startsWith('_theme-') || c.startsWith('_color-')) body.classList.remove(c)
  }
  body.classList.add(`_theme-${theme}`, `_color-${color}`)

  // theme stylesheet
  ensureLink('_theme', theme !== 'custom' ? chrome.runtime.getURL(`/themes/${theme}.css`) : '')

  // custom theme stylesheet
  const customEl = document.getElementById('_custom')
  if (theme === 'custom' && settings.custom && settings.custom.theme) {
    let el = customEl
    if (!el) {
      el = document.createElement('style')
      el.id = '_custom'
      el.type = 'text/css'
      document.head.appendChild(el)
    }
    el.textContent = settings.custom.theme
  } else if (customEl) {
    customEl.remove()
  }

  // syntax highlighting stylesheet
  if (syntax) {
    ensureLink('_prism', chrome.runtime.getURL(`/vendor/${color === 'dark' ? 'prism-okaidia' : 'prism'}.min.css`))
  }

  const wrapperClass =
    (/github(-dark)?/.test(theme) ? 'markdown-body' : 'markdown-theme') +
    (width !== 'auto' ? ` _width-${width}` : '')

  themeState = { syntax, wrapperClass }
  return themeState
}

// ---------------------------------------------------------------------------
// markdown compilation — reuses the background compiler so output is identical
// ---------------------------------------------------------------------------

function frontmatter (md) {
  if (/^-{3}[\s\S]+?-{3}/.test(md)) {
    const [, yaml] = /^-{3}([\s\S]+?)-{3}/.exec(md)
    const title = /title: (?:'|")*(.*)(?:'|")*/.exec(yaml)
    title && (document.title = title[1])
  } else if (/^\+{3}[\s\S]+?\+{3}/.test(md)) {
    const [, toml] = /^\+{3}([\s\S]+?)\+{3}/.exec(toml)
    const title = /title = (?:'|"|`)*(.*)(?:'|"|`)*/.exec(toml)
    title && (document.title = title[1])
  }
  return md.replace(/^(?:-|\+){3}[\s\S]+?(?:-|\+){3}/, '')
}

function anchors (html) {
  return html.replace(
    /(<h[1-6] id="(.*?)">)/g,
    (header, _, id) =>
      header +
      `<a class="anchor" name="${id}" href="#${id}">` +
      '<span class="octicon octicon-link"></span></a>'
  )
}

async function compileMarkdown (markdown) {
  try {
    const res = await chrome.runtime.sendMessage({ message: 'markdown', markdown })
    return (res && res.html) || ''
  } catch (err) {
    return ''
  }
}

// ---------------------------------------------------------------------------
// prism autoloader — load languages from local vendor path (main world)
// ---------------------------------------------------------------------------

function setupPrism () {
  if (!window.Prism || !Prism.plugins || !Prism.plugins.autoloader) return
  Prism.plugins.autoloader.addScript = (language, done) => {
    const s = document.createElement('script')
    s.src = chrome.runtime.getURL(`/vendor/prism/prism-${language}.min.js`)
    s.onload = () => done && done()
    s.onerror = () => done && done()
    document.head.appendChild(s)
  }
}

// ---------------------------------------------------------------------------
// IndexedDB persistence for the directory handle (survives page reloads)
// ---------------------------------------------------------------------------

function openDB () {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('markdown-viewer-reader', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('handles')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut (handle) {
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite')
    tx.objectStore('handles').put(handle, 'root')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
}

async function idbGet () {
  const db = await openDB()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readonly')
      const req = tx.objectStore('handles').get('root')
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

// ---------------------------------------------------------------------------
// File System Access API
// ---------------------------------------------------------------------------

function supported () {
  return typeof window.showDirectoryPicker === 'function'
}

async function pickDirectory () {
  if (!supported()) {
    setStatus('当前浏览器不支持 File System Access API，请使用 Chrome / Edge 86+')
    return
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'read' })
    rootHandle = handle
    await idbPut(handle)
    await loadTree()
  } catch (err) {
    if (err && err.name === 'AbortError') return // user cancelled the picker
    setStatus('选择文件夹失败：' + err.message)
  }
}

async function ensurePermission (handle) {
  const opts = { mode: 'read' }
  try {
    let perm = await handle.queryPermission(opts)
    if (perm === 'granted') return true
    if (perm === 'prompt') perm = await handle.requestPermission(opts)
    return perm === 'granted'
  } catch (err) {
    return false
  }
}

// ---------------------------------------------------------------------------
// directory traversal
// ---------------------------------------------------------------------------

async function collect (dirHandle, prefix, out) {
  for await (const [name, entry] of dirHandle.entries()) {
    if (name.startsWith('.')) continue
    if (entry.kind === 'file') {
      if (MARKDOWN_RE.test(name)) out.push({ path: prefix + name, name, handle: entry })
    } else if (entry.kind === 'directory') {
      if (SKIP_DIRS.has(name)) continue
      await collect(entry, prefix + name + '/', out)
    }
  }
  return out
}

async function loadTree () {
  if (!rootHandle) return

  const ok = await ensurePermission(rootHandle)
  if (!ok) {
    setStatus('需要重新授权访问该文件夹')
    $('#grant').classList.remove('hidden')
    $('#pick').classList.add('hidden')
    return
  }

  $('#grant').classList.add('hidden')
  $('#pick').classList.remove('hidden')
  setStatus('正在扫描目录…')

  const files = await collect(rootHandle, '', [])
  fileMap = new Map(files.map((f) => [f.path, f.handle]))
  renderTree(buildTree(files), files.length)
  $('#path').textContent = rootName + ' · ' + files.length + ' 个文件'
  setStatus(files.length ? '' : '该目录下没有 Markdown 文件')
}

// ---------------------------------------------------------------------------
// tree building + rendering
// ---------------------------------------------------------------------------

function naturalCompare (a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function buildTree (files) {
  const root = { name: '', dirs: new Map(), files: [] }
  for (const f of files) {
    const parts = f.path.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i]
      if (!node.dirs.has(dir)) node.dirs.set(dir, { name: dir, dirs: new Map(), files: [] })
      node = node.dirs.get(dir)
    }
    node.files.push(f)
  }
  return root
}

function renderTree (root, total) {
  const el = $('#tree')
  el.textContent = ''

  const dirs = [...root.dirs.values()].sort((a, b) => naturalCompare(a.name, b.name))
  for (const dir of dirs) el.appendChild(renderDir(dir, 0))

  root.files.sort((a, b) => naturalCompare(a.name, b.name))
  for (const f of root.files) el.appendChild(renderFile(f, 0))

  if (!total) {
    el.innerHTML = '<div class="tree-empty">没有可显示的 Markdown 文件</div>'
  }
}

function renderDir (dir, depth) {
  const wrap = document.createElement('div')
  wrap.className = 'tree-dir'

  const row = document.createElement('div')
  row.className = 'tree-row'
  row.style.paddingLeft = (depth * 14 + 8) + 'px'

  const arrow = document.createElement('span')
  arrow.className = 'arrow'
  arrow.textContent = '\u25B8'

  const label = document.createElement('span')
  label.className = 'label'
  label.textContent = dir.name + '/'

  row.append(arrow, label)

  const children = document.createElement('div')
  children.className = 'children'

  const dirs = [...dir.dirs.values()].sort((a, b) => naturalCompare(a.name, b.name))
  for (const d of dirs) children.appendChild(renderDir(d, depth + 1))

  dir.files.sort((a, b) => naturalCompare(a.name, b.name))
  for (const f of dir.files) children.appendChild(renderFile(f, depth + 1))

  row.addEventListener('click', () => {
    const open = wrap.classList.toggle('open')
    arrow.textContent = open ? '\u25BE' : '\u25B8'
  })

  wrap.append(row, children)
  return wrap
}

function renderFile (f, depth) {
  const row = document.createElement('div')
  row.className = 'tree-row file'
  row.style.paddingLeft = (depth * 14 + 8) + 'px'
  row.textContent = f.name
  row.title = f.path
  row.addEventListener('click', () => {
    select(row)
    openFile(f)
  })
  return row
}

function select (row) {
  if (activeRow) activeRow.classList.remove('active')
  activeRow = row
  row.classList.add('active')
}

// ---------------------------------------------------------------------------
// relative-path resolution for local media (images / video / audio)
// ---------------------------------------------------------------------------

function resolvePath (dir, ref) {
  const stack = []
  for (const part of (dir + ref).split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (!stack.length) return null // escapes the picked root
      stack.pop()
    } else {
      stack.push(part)
    }
  }
  return stack.join('/')
}

function resolveMediaRef (ref) {
  if (!ref) return null
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return null // scheme, //host, anchor
  let path = ref.split('#')[0].split('?')[0]
  if (!path) return null
  if (path.startsWith('/')) path = path.slice(1) // root-relative
  return resolvePath(currentDir, path)
}

function revokeObjectUrls () {
  for (const u of objectUrls) URL.revokeObjectURL(u)
  objectUrls = []
}

async function resolveMedia () {
  revokeObjectUrls()
  const els = [
    ...document.querySelectorAll('#view img[src]'),
    ...document.querySelectorAll('#view video[src]'),
    ...document.querySelectorAll('#view audio[src]'),
    ...document.querySelectorAll('#view source[src]'),
  ]
  await Promise.all(els.map(async (el) => {
    const target = resolveMediaRef(el.getAttribute('src'))
    if (!target || !fileMap.has(target)) return
    try {
      const file = await fileMap.get(target).getFile()
      const url = URL.createObjectURL(file)
      objectUrls.push(url)
      el.setAttribute('src', url)
    } catch (err) { /* leave unresolved */ }
  }))
}

// ---------------------------------------------------------------------------
// document outline (headings) in the sidebar
// ---------------------------------------------------------------------------

function headingText (h) {
  const clone = h.cloneNode(true)
  clone.querySelectorAll('.anchor').forEach((a) => a.remove())
  return clone.textContent.trim()
}

function buildOutline () {
  const outline = $('#outline')
  outline.textContent = ''
  headingEls = [...document.querySelectorAll('#view h1, #view h2, #view h3, #view h4, #view h5, #view h6')]

  if (!headingEls.length) {
    outline.innerHTML = '<div class="tree-empty">本文档无标题</div>'
    return
  }

  const root = { level: 0, children: [] }
  const stack = [root]
  for (const h of headingEls) {
    const level = parseInt(h.tagName.slice(1), 10)
    const node = { level, el: h, children: [] }
    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop()
    stack[stack.length - 1].children.push(node)
    stack.push(node)
  }

  const render = (nodes, depth) => {
    for (const n of nodes) {
      const a = document.createElement('a')
      a.className = 'toc-item'
      a.style.paddingLeft = (depth * 12 + 10) + 'px'
      a.textContent = headingText(n.el)
      a.href = '#' + (n.el.id || '')
      a.addEventListener('click', (e) => {
        e.preventDefault()
        n.el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      outline.appendChild(a)
      if (n.children.length) render(n.children, depth + 1)
    }
  }
  render(root.children, 0)
}

function trackHeadings () {
  const content = document.querySelector('.content')
  let ticking = false

  const update = () => {
    ticking = false
    const top = content.getBoundingClientRect().top + 8
    let activeId = null
    for (const h of headingEls) {
      if (h.getBoundingClientRect().top <= top + 8) activeId = h.id
    }
    document.querySelectorAll('.toc-item').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + activeId)
    })
  }

  content.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(update)
    }
  })
  update()
}

// ---------------------------------------------------------------------------
// open + render a file
// ---------------------------------------------------------------------------

function render () {
  if (raw) {
    $('#raw').textContent = currentRaw
    $('#raw').classList.remove('hidden')
    $('#view').classList.add('hidden')
    $('#raw-btn').textContent = '预览'
  } else {
    $('#raw').classList.add('hidden')
    $('#view').classList.remove('hidden')
    $('#raw-btn').textContent = '源码'
  }
}

async function openFile (f) {
  try {
    setStatus('正在读取 ' + f.name + ' …')
    const file = await f.handle.getFile()
    const text = await file.text()

    currentRaw = text
    currentPath = f.path
    currentDir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/') + 1) : ''

    const { syntax, wrapperClass } = themeState || applyTheme()
    const view = $('#view')
    view.className = wrapperClass
    view.innerHTML = anchors(await compileMarkdown(frontmatter(text)))

    if (syntax) {
      setTimeout(() => window.Prism && Prism.highlightAll(), 20)
    }

    await resolveMedia()
    buildOutline()
    trackHeadings()

    $('#empty').classList.add('hidden')
    $('#path').textContent = f.path
    render()
    setStatus('')
  } catch (err) {
    setStatus('读取失败：' + err.message)
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function setStatus (msg) {
  $('#status').textContent = msg || ''
}

function toggleSidebar () {
  document.body.classList.toggle('sidebar-hidden')
}

function setSideMode (mode) {
  $('#tab-files').classList.toggle('active', mode === 'files')
  $('#tab-outline').classList.toggle('active', mode === 'outline')
  $('#tree').classList.toggle('hidden', mode !== 'files')
  $('#outline').classList.toggle('hidden', mode !== 'outline')
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

async function boot () {
  if (!supported()) {
    $('#pick').classList.add('hidden')
    setStatus('当前浏览器不支持文件系统访问，请用 Chrome / Edge 86+')
    return
  }

  await loadSettings()
  applyTheme()
  setupPrism()

  const saved = await idbGet()
  if (!saved) {
    setStatus('请选择要浏览的文件夹')
    return
  }

  rootHandle = saved
  rootName = saved.name
  const ok = await ensurePermission(saved)
  if (ok) {
    await loadTree()
  } else {
    setStatus('需要重新授权访问上次的文件夹')
    $('#grant').classList.remove('hidden')
    $('#pick').classList.add('hidden')
  }
}

$('#pick').addEventListener('click', pickDirectory)
$('#grant').addEventListener('click', async () => {
  if (rootHandle && await ensurePermission(rootHandle)) await loadTree()
})
$('#raw-btn').addEventListener('click', () => {
  raw = !raw
  render()
})
$('#toggle-sidebar').addEventListener('click', toggleSidebar)
$('#tab-files').addEventListener('click', () => setSideMode('files'))
$('#tab-outline').addEventListener('click', () => setSideMode('outline'))

boot()
