// Embedded directory sidebar for rendered markdown pages.
// Injects a left sidebar (file tree + outline) and swaps the viewed file
// content in-place, reusing the page's active theme and the background compiler.
;(function () {
  'use strict'

  var MARKDOWN_RE = /\.(?:markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text)$/i
  var SKIP_DIRS = new Set(['node_modules', '.git', '.hg', '.svn', '.idea', '.vscode', '__pycache__', '.obsidian', '.trash', 'vendor', 'dist', 'build'])
  var THEME_COLORS = {
    'github': 'light', 'github-dark': 'dark', 'almond': 'light', 'awsm': 'light',
    'axist': 'light', 'bamboo': 'auto', 'bullframe': 'light', 'holiday': 'auto',
    'kacit': 'light', 'latex': 'light', 'marx': 'light', 'mini': 'light',
    'modest': 'light', 'new': 'auto', 'no-class': 'auto', 'pico': 'auto',
    'retro': 'dark', 'sakura': 'light', 'sakura-vader': 'dark', 'semantic': 'light',
    'simple': 'auto', 'style-sans': 'light', 'style-serif': 'light', 'stylize': 'light',
    'superstylin': 'auto', 'tacit': 'light', 'vanilla': 'auto', 'water': 'light',
    'water-dark': 'dark', 'writ': 'light', 'custom': 'auto'
  }

  if (document.getElementById('__mdv_sidebar')) return

  var $ = function (sel) { return document.querySelector(sel) }

  var workspaces = []          // [{ id, name, handle }] in open order
  var activeId = null          // id of the active workspace
  var fileMap = new Map()      // relative path -> FileSystemFileHandle
  var currentDir = ''          // directory of the swapped file
  var swapped = false          // showing swapped content vs original page content
  var sideMode = 'files'
  var sidebarOn = true
  var activeRow = null
  var settings = {}

  // ---- styles ----
  var css = [
    '#__mdv_sidebar{position:fixed;top:0;left:0;bottom:0;width:300px;z-index:2147483000;display:flex;flex-direction:column}',
    '#__mdv_sidebar.__mdv-hidden{display:none}',
    '#_toc{display:none!important}',
    'body._toc-left{padding-left:0!important}',
    'body._toc-right{padding-right:0!important}',
    'body.__mdv-sidebar-on{padding-left:300px!important}',
    'body._color-light #__mdv_sidebar{border-right:1px solid #d0d7de}',
    'body._color-dark #__mdv_sidebar{border-right:1px solid #30363d}',
    '#__mdv_head,#__mdv_ws_list,#__mdv_tabs,#__mdv_tree{background:#f6f8fa;color:#24292f}',
    'body._color-dark #__mdv_head,body._color-dark #__mdv_ws_list,body._color-dark #__mdv_tabs,body._color-dark #__mdv_tree{background:#161b22;color:#c9d1d9}',
    '#__mdv_head{display:flex;gap:6px;padding:8px;border-bottom:1px solid rgba(128,128,128,.3)}',
    '#__mdv_head button{flex:1;padding:5px 8px;font-size:12px;border-radius:6px;cursor:pointer;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit}',
    '#__mdv_head button:hover{background:rgba(128,128,128,.15)}',
    '#__mdv_ws_list{max-height:45%;overflow:auto;padding:4px 0;border-bottom:1px solid rgba(128,128,128,.3)}',
    '.__mdv_ws_row{display:flex;align-items:center;gap:4px;padding:5px 10px;cursor:pointer;font-size:12.5px;user-select:none}',
    '.__mdv_ws_row:hover{background:rgba(128,128,128,.12)}',
    '.__mdv_ws_row.__mdv-ws-active{background:rgba(9,105,218,.15)}',
    '.__mdv_ws_row .__mdv_ws_name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.__mdv_ws_row .__mdv_ws_close{flex:none;width:20px;height:20px;line-height:1;padding:0;border:none;background:transparent;color:inherit;font-size:16px;cursor:pointer;border-radius:4px;opacity:.5}',
    '.__mdv_ws_row .__mdv_ws_close:hover{background:rgba(128,128,128,.25);opacity:1}',
    '#__mdv_tabs{display:flex;border-bottom:1px solid rgba(128,128,128,.3)}',
    '#__mdv_tabs button{flex:1;padding:7px 0;font-size:12px;border:none;background:transparent;color:inherit;cursor:pointer;border-bottom:2px solid transparent;opacity:.7}',
    '#__mdv_tabs button.active{opacity:1;border-bottom-color:#0969da}',
    'body._color-dark #__mdv_tabs button.active{border-bottom-color:#58a6ff}',
    '#__mdv_tree{flex:1;overflow:auto;padding:6px 0}',
    '#__mdv_outline{flex:1;overflow:auto;padding:0}',
    '.__mdv_row{display:flex;align-items:center;gap:4px;padding:3px 10px;cursor:pointer;white-space:nowrap;font-size:12.5px;user-select:none}',
    '.__mdv_row:hover{background:rgba(128,128,128,.12)}',
    '.__mdv_row.__mdv-active{background:rgba(9,105,218,.15)}',
    '.__mdv_row .__mdv_arrow{width:11px;opacity:.6;flex:none}',
    '.__mdv_row .__mdv_label{overflow:hidden;text-overflow:ellipsis}',
    '.__mdv_children{display:none}',
    '.__mdv_dir.__mdv-open>.__mdv_children{display:block}',
    '.__mdv_empty{padding:14px;opacity:.6;font-size:12.5px}',
    '#__mdv_outline #_toc{position:static!important;width:auto!important;height:auto!important;border-right:none!important;overflow:visible!important}',
    '#__mdv_toggle{position:fixed;top:0;left:0;z-index:2147483001;padding:4px 10px;font-size:12px;border-radius:0 0 8px 0;cursor:pointer;border:1px solid rgba(128,128,128,.4);background:rgba(246,248,250,.95);color:#24292f;box-shadow:0 1px 4px rgba(0,0,0,.2)}',
    'body._color-dark #__mdv_toggle{background:rgba(22,27,34,.9);color:#c9d1d9}',
    '#__mdv_content{display:none}',
    'body.__mdv-swapped #_html,body.__mdv-swapped>pre{display:none!important}',
    'body.__mdv-swapped #__mdv_content{display:block}',
    '#__mdv_content{word-wrap:break-word;max-width:100%}'
  ].join('\n')

  var styleEl = document.createElement('style')
  styleEl.textContent = css
  document.head.appendChild(styleEl)

  // ---- sidebar DOM ----
  var bar = document.createElement('aside')
  bar.id = '__mdv_sidebar'
  bar.innerHTML =
    '<div id="__mdv_head">' +
      '<button id="__mdv_pick" type="button">打开工作空间</button>' +
      '<button id="__mdv_grant" type="button" style="display:none">重新授权</button>' +
    '</div>' +
    '<div id="__mdv_ws_list"></div>' +
    '<div id="__mdv_tabs">' +
      '<button id="__mdv_tab_files" class="active" type="button">文件</button>' +
      '<button id="__mdv_tab_outline" type="button">大纲</button>' +
    '</div>' +
    '<div id="__mdv_tree"></div>' +
    '<div id="__mdv_outline" style="display:none"></div>'
  document.body.appendChild(bar)

  var toggle = document.createElement('button')
  toggle.id = '__mdv_toggle'
  toggle.type = 'button'
  toggle.textContent = '\u00AB' // "«" (sidebar starts open)
  toggle.style.left = '300px'   // at the sidebar/content divider
  document.body.appendChild(toggle)

  var contentBox = document.createElement('div')
  contentBox.id = '__mdv_content'
  document.body.appendChild(contentBox)

  // ---- settings ----
  function getSettings () {
    return new Promise(function (resolve) {
      chrome.storage.sync.get(null, function (res) {
        settings = res || {}
        resolve(settings)
      })
    })
  }

  function wrapperClass () {
    var theme = settings.theme || 'github'
    var width = settings.themes && settings.themes.width
    return (/github(-dark)?/.test(theme) ? 'markdown-body' : 'markdown-theme') +
      (width && width !== 'auto' ? ' _width-' + width : '')
  }

  // ---- markdown pipeline (matches content/index.js) ----
  function frontmatter (md) {
    return md.replace(/^(?:-|\+){3}[\s\S]+?(?:-|\+){3}/, '')
  }

  function anchors (html) {
    return html.replace(
      /(<h[1-6] id="(.*?)">)/g,
      function (header, _, id) {
        return header + '<a class="anchor" name="' + id + '" href="#' + id + '">' +
          '<span class="octicon octicon-link"></span></a>'
      }
    )
  }

  function compileMarkdown (md) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({ message: 'markdown', markdown: md }, function (res) {
        resolve((res && res.html) || '')
      })
    })
  }

  function renderMermaid (html) {
    if (!window.mermaid) return
    var defs = []
    var re = /<pre><code class="mermaid">([\s\S]+?)<\/code><\/pre>/gi
    var m
    while ((m = re.exec(html))) defs.push(m[1])

    var theme = settings.theme || 'github'
    var scheme = THEME_COLORS[theme] || 'auto'
    var dark = scheme === 'dark' || (scheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    window.mermaid.initialize({ theme: dark ? 'dark' : 'default' })
    document.querySelectorAll('#__mdv_content pre code.mermaid').forEach(function (el, i) {
      el.removeAttribute('data-processed')
      el.innerHTML = defs[i] || ''
    })
    window.mermaid.init({ theme: dark ? 'dark' : 'default' }, '#__mdv_content code.mermaid')
  }

  // ---- file open (in-place swap) ----
  function openPath (relPath) {
    var handle = fileMap.get(relPath)
    if (!handle) return
    handle.getFile().then(function (file) {
      return file.text()
    }).then(function (text) {
      currentDir = relPath.indexOf('/') >= 0 ? relPath.slice(0, relPath.lastIndexOf('/') + 1) : ''

      return compileMarkdown(frontmatter(text)).then(function (html) {
        if (settings.content && settings.content.emoji && window.emojinator) html = window.emojinator(html)
        if (settings.content && settings.content.mermaid) {
          html = html.replace(/<code class="language-(?:mermaid|mmd)">/gi, '<code class="mermaid">')
        }
        html = anchors(html)

        contentBox.className = wrapperClass()
        contentBox.innerHTML = html

        document.body.classList.add('__mdv-swapped')
        swapped = true

        var st = settings.content || {}
        if (st.syntax !== false) setTimeout(function () { window.Prism && window.Prism.highlightAll() }, 20)
        if (st.mermaid) setTimeout(function () { renderMermaid(html) }, 40)
        if (st.mathjax) setTimeout(function () { window.mj && window.mj.render() }, 60)

        resolveMedia()
        buildOutline()
      })
    }).catch(function () {})
  }

  // ---- local media (relative images) ----
  function resolvePath (dir, ref) {
    var stack = []
    var parts = (dir + ref).split('/')
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i]
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
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return null
    var path = ref.split('#')[0].split('?')[0]
    if (!path) return null
    if (path.charAt(0) === '/') path = path.slice(1)
    return resolvePath(currentDir, path)
  }

  function resolveMedia () {
    var els = document.querySelectorAll('#__mdv_content img[src],#__mdv_content video[src],#__mdv_content audio[src],#__mdv_content source[src]')
    Array.from(els).forEach(function (el) {
      var target = resolveMediaRef(el.getAttribute('src'))
      if (!target || !fileMap.has(target)) return
      fileMap.get(target).getFile().then(function (file) {
        el.setAttribute('src', URL.createObjectURL(file))
      }).catch(function () {})
    })
  }

  // ---- outline ----
  function headingText (h) {
    var clone = h.cloneNode(true)
    clone.querySelectorAll('.anchor').forEach(function (a) { a.remove() })
    return clone.textContent.trim()
  }

  function tocHtml (root) {
    var html = ''
    root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function (h) {
      var level = parseInt(h.tagName.slice(1), 10)
      var id = h.id || ''
      html += '<div class="_ul">'.repeat(level) +
        '<a href="#' + id + '">' + headingText(h) + '</a>' +
        '</div>'.repeat(level)
    })
    return html
  }

  function buildOutline () {
    var outline = $('#__mdv_outline')
    var toc = document.getElementById('_toc')

    if (!toc) {
      toc = document.createElement('div')
      toc.id = '_toc'
      outline.appendChild(toc)
    } else if (toc.parentNode !== outline) {
      outline.appendChild(toc)
    }
    toc.style.setProperty('display', 'block', 'important')

    if (swapped) {
      toc.innerHTML = tocHtml(contentBox)
    } else if (!toc.querySelector('a')) {
      toc.innerHTML = tocHtml(document.getElementById('_html') || contentBox)
    }

    if (!toc.querySelector('a')) {
      toc.innerHTML = '<div class="__mdv_empty">\u672c\u6587\u6863\u65e0\u6807\u9898</div>'
    }
  }

  // ---- tree ----
  function naturalCompare (a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  }

  function buildTree (files) {
    var root = { dirs: new Map(), files: [] }
    files.forEach(function (f) {
      var parts = f.path.split('/')
      var node = root
      for (var i = 0; i < parts.length - 1; i++) {
        var d = parts[i]
        if (!node.dirs.has(d)) {
          node.dirs.set(d, { name: d, path: parts.slice(0, i + 1).join('/') + '/', dirs: new Map(), files: [] })
        }
        node = node.dirs.get(d)
      }
      node.files.push(f)
    })
    return root
  }

  function renderTree (root, total) {
    var el = $('#__mdv_tree')
    el.textContent = ''
    activeRow = null
    var dirs = Array.from(root.dirs.values()).sort(function (a, b) { return naturalCompare(a.name, b.name) })
    dirs.forEach(function (d) { el.appendChild(renderDir(d, 0)) })
    root.files.sort(function (a, b) { return naturalCompare(a.name, b.name) })
    root.files.forEach(function (f) { el.appendChild(renderFile(f, 0)) })
    if (!total) el.innerHTML = '<div class="__mdv_empty">\u6ca1\u6709\u53ef\u663e\u793a\u7684 Markdown \u6587\u4ef6</div>'
  }

  function renderDir (dir, depth) {
    var wrap = document.createElement('div')
    wrap.className = '__mdv_dir'
    var open = isDirOpen(dir.path)
    if (open) wrap.classList.add('__mdv-open')
    var row = document.createElement('div')
    row.className = '__mdv_row'
    row.style.paddingLeft = (depth * 13 + 10) + 'px'
    var arrow = document.createElement('span')
    arrow.className = '__mdv_arrow'
    arrow.textContent = open ? '\u25BE' : '\u25B8'
    var label = document.createElement('span')
    label.className = '__mdv_label'
    label.textContent = dir.name + '/'
    row.appendChild(arrow)
    row.appendChild(label)
    var children = document.createElement('div')
    children.className = '__mdv_children'
    Array.from(dir.dirs.values()).sort(function (a, b) { return naturalCompare(a.name, b.name) })
      .forEach(function (d) { children.appendChild(renderDir(d, depth + 1)) })
    dir.files.sort(function (a, b) { return naturalCompare(a.name, b.name) })
      .forEach(function (f) { children.appendChild(renderFile(f, depth + 1)) })
    row.addEventListener('click', function () {
      var nowOpen = wrap.classList.toggle('__mdv-open')
      arrow.textContent = nowOpen ? '\u25BE' : '\u25B8'
      toggleDirOpen(dir.path, nowOpen)
    })
    wrap.appendChild(row)
    wrap.appendChild(children)
    return wrap
  }

  function renderFile (f, depth) {
    var row = document.createElement('div')
    row.className = '__mdv_row __mdv_file'
    row.style.paddingLeft = (depth * 13 + 10) + 'px'
    row.textContent = f.name
    row.title = f.path
    row.setAttribute('data-path', f.path)
    row.addEventListener('click', function () { activateFile(f.path, row) })
    return row
  }

  function isDirOpen (path) {
    var ws = activeWs()
    return !!(ws && ws.open && ws.open.indexOf(path) >= 0)
  }

  function toggleDirOpen (path, open) {
    var ws = activeWs()
    if (!ws) return
    if (!ws.open) ws.open = []
    var i = ws.open.indexOf(path)
    if (open && i < 0) ws.open.push(path)
    else if (!open && i >= 0) ws.open.splice(i, 1)
    else return
    persistWorkspaces()
  }

  function highlightRow (row) {
    if (activeRow) activeRow.classList.remove('__mdv-active')
    activeRow = row
    row.classList.add('__mdv-active')
  }

  function activateFile (relPath, row) {
    var ws = activeWs()
    if (ws && ws.active !== relPath) {
      ws.active = relPath
      persistWorkspaces()
    }
    highlightRow(row)
    openPath(relPath)
  }

  function findFileRow (relPath) {
    var rows = document.querySelectorAll('.__mdv_file')
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute('data-path') === relPath) return rows[i]
    }
    return null
  }

  function restoreActiveFile () {
    var ws = activeWs()
    var relPath = ws && ws.active
    if (!relPath || !fileMap.has(relPath)) return
    var row = findFileRow(relPath)
    if (row) highlightRow(row)
    openPath(relPath)
  }

  function collect (dirHandle, prefix, out) {
    var it = dirHandle.entries()
    var next = function () {
      return it.next().then(function (res) {
        if (res.done) return out
        var name = res.value[0]
        var entry = res.value[1]
        if (name.charAt(0) === '.') return next()
        if (entry.kind === 'file') {
          if (MARKDOWN_RE.test(name)) out.push({ path: prefix + name, name: name, handle: entry })
          return next()
        }
        if (SKIP_DIRS.has(name)) return next()
        return collect(entry, prefix + name + '/', out).then(next)
      })
    }
    return next()
  }

  function listTree () {
    var handle = activeHandle()
    if (!handle) {
      fileMap = new Map()
      $('#__mdv_tree').innerHTML = '<div class="__mdv_empty">\u70b9\u51fb\u300c\u6253\u5f00\u5de5\u4f5c\u7a7a\u95f4\u300d\u6d4f\u89c8\u76ee\u5f55</div>'
      showGrant(false)
      return
    }
    ensurePermission(handle).then(function (ok) {
      if (!ok) {
        showGrant(true)
        return
      }
      showGrant(false)
      return collect(handle, '', []).then(function (files) {
        fileMap = new Map(files.map(function (f) { return [f.path, f.handle] }))
        renderTree(buildTree(files), files.length)
        restoreActiveFile()
      })
    })
  }

  // ---- IndexedDB (file:// origin, persists across file:// pages) ----
  // Stores an ordered workspace list (key 'list') and the active id (key 'active').
  function openDB () {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open('markdown-viewer-dir', 2)
      req.onupgradeneeded = function () {
        var db = req.result
        var tx = req.transaction
        if (!db.objectStoreNames.contains('workspaces')) db.createObjectStore('workspaces')
        if (db.objectStoreNames.contains('handles')) {
          // migrate the legacy single-handle record (key 'root')
          var getReq = tx.objectStore('handles').get('root')
          getReq.onsuccess = function () {
            var handle = getReq.result
            if (handle) {
              var ws = { id: 'ws' + Date.now().toString(36), name: handle.name || '', handle: handle, open: [], active: '' }
              tx.objectStore('workspaces').put([ws], 'list')
              tx.objectStore('workspaces').put(ws.id, 'active')
            }
            try { db.deleteObjectStore('handles') } catch (e) {}
          }
        }
      }
      req.onsuccess = function () { resolve(req.result) }
      req.onerror = function () { reject(req.error) }
    })
  }

  function idbSave (list, active) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('workspaces', 'readwrite')
        tx.objectStore('workspaces').put(list, 'list')
        tx.objectStore('workspaces').put(active, 'active')
        tx.oncomplete = function () { db.close(); resolve() }
        tx.onerror = function () { db.close(); reject(tx.error) }
        tx.onabort = function () { db.close(); reject(tx.error) }
      })
    })
  }

  function idbLoad () {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('workspaces', 'readonly')
        var listReq = tx.objectStore('workspaces').get('list')
        var activeReq = tx.objectStore('workspaces').get('active')
        tx.oncomplete = function () {
          db.close()
          resolve({ list: listReq.result || [], active: activeReq.result || null })
        }
        tx.onerror = function () { db.close(); reject(tx.error) }
        tx.onabort = function () { db.close(); reject(tx.error) }
      })
    })
  }

  // ---- directory picking ----
  function ensurePermission (handle) {
    return handle.queryPermission({ mode: 'read' }).then(function (perm) {
      if (perm === 'granted') return true
      if (perm === 'prompt') return handle.requestPermission({ mode: 'read' }).then(function (p) { return p === 'granted' })
      return false
    }).catch(function () { return false })
  }

  function pickDirectory () {
    if (typeof window.showDirectoryPicker !== 'function') return
    window.showDirectoryPicker({ mode: 'read' }).then(addWorkspace).catch(function () {})
  }

  function activeWs () {
    for (var i = 0; i < workspaces.length; i++) {
      if (workspaces[i].id === activeId) return workspaces[i]
    }
    return null
  }

  function activeHandle () {
    var ws = activeWs()
    return ws ? ws.handle : null
  }

  function persistWorkspaces () {
    return idbSave(workspaces, activeId)
  }

  function showGrant (on) {
    $('#__mdv_grant').style.display = on ? '' : 'none'
  }

  function renderWorkspaces () {
    var el = $('#__mdv_ws_list')
    el.textContent = ''
    workspaces.forEach(function (ws) {
      var row = document.createElement('div')
      row.className = '__mdv_ws_row' + (ws.id === activeId ? ' __mdv-ws-active' : '')

      var label = document.createElement('span')
      label.className = '__mdv_ws_name'
      label.textContent = ws.name || '\u672a\u547d\u540d'
      label.title = ws.name || ''

      var close = document.createElement('button')
      close.type = 'button'
      close.className = '__mdv_ws_close'
      close.textContent = '\u00D7'
      close.title = '\u5173\u95ed\u5de5\u4f5c\u7a7a\u95f4'
      close.addEventListener('click', function (e) {
        e.stopPropagation()
        closeWorkspace(ws.id)
      })

      row.appendChild(label)
      row.appendChild(close)
      row.addEventListener('click', function () { activateWorkspace(ws.id) })
      el.appendChild(row)
    })
    if (!workspaces.length) {
      el.innerHTML = '<div class="__mdv_empty">\u5c1a\u65e0\u5de5\u4f5c\u7a7a\u95f4\uff0c\u70b9\u51fb\u300c\u6253\u5f00\u5de5\u4f5c\u7a7a\u95f4\u300d\u9009\u62e9\u6587\u4ef6\u5939</div>'
    }
  }

  function activateWorkspace (id) {
    if (id === activeId) return
    activeId = id
    persistWorkspaces().then(function () {
      renderWorkspaces()
      listTree()
    })
  }

  function closeWorkspace (id) {
    var idx = -1
    for (var i = 0; i < workspaces.length; i++) {
      if (workspaces[i].id === id) { idx = i; break }
    }
    if (idx < 0) return
    var wasActive = id === activeId
    workspaces.splice(idx, 1)
    if (wasActive) {
      activeId = workspaces.length ? workspaces[Math.min(idx, workspaces.length - 1)].id : null
    }
    persistWorkspaces().then(function () {
      renderWorkspaces()
      if (wasActive) listTree()
    })
  }

  function addWorkspace (handle) {
    var pending = workspaces.map(function (ws) {
      if (typeof ws.handle.isSameEntry !== 'function') return Promise.resolve(null)
      return ws.handle.isSameEntry(handle).then(function (same) { return same ? ws : null })
        .catch(function () { return null })
    })
    return Promise.all(pending).then(function (results) {
      var match = null
      for (var i = 0; i < results.length; i++) {
        if (results[i]) { match = results[i]; break }
      }
      if (match) {
        activeId = match.id
      } else {
        var ws = {
          id: 'ws' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: handle.name || '',
          handle: handle,
          open: [],
          active: ''
        }
        workspaces.push(ws)
        activeId = ws.id
      }
      return persistWorkspaces().then(function () {
        renderWorkspaces()
        return listTree()
      })
    })
  }

  // ---- sidebar UI ----
  function setSideMode (mode) {
    sideMode = mode
    $('#__mdv_tab_files').classList.toggle('active', mode === 'files')
    $('#__mdv_tab_outline').classList.toggle('active', mode === 'outline')
    $('#__mdv_tree').style.display = mode === 'files' ? '' : 'none'
    $('#__mdv_outline').style.display = mode === 'outline' ? '' : 'none'
    if (mode === 'outline') buildOutline()
  }

  function toggleSidebar () {
    sidebarOn = !sidebarOn
    bar.classList.toggle('__mdv-hidden', !sidebarOn)
    document.body.classList.toggle('__mdv-sidebar-on', sidebarOn)
    toggle.style.left = sidebarOn ? '300px' : '0'
    toggle.textContent = sidebarOn ? '\u00AB' : '\u2630 \u76ee\u5f55'
  }

  // ---- init ----
  function init () {
    getSettings().then(function () {
      return idbLoad()
    }).then(function (data) {
      workspaces = (data.list || []).map(function (w) {
        return { id: w.id, name: w.name, handle: w.handle, open: w.open || [], active: w.active || '' }
      })
      activeId = data.active || null
      if (activeId && !activeWs()) activeId = workspaces.length ? workspaces[0].id : null
      renderWorkspaces()
      if (!activeHandle()) {
        listTree()
        return
      }
      return ensurePermission(activeHandle()).then(function (ok) {
        if (ok) return listTree()
        showGrant(true)
      })
    }).catch(function () {
      document.body.classList.add('__mdv-sidebar-on')
    })

    document.body.classList.add('__mdv-sidebar-on')
    bar.classList.remove('__mdv-hidden')
  }

  $('#__mdv_pick').addEventListener('click', pickDirectory)
  $('#__mdv_grant').addEventListener('click', function () {
    var handle = activeHandle()
    if (handle) ensurePermission(handle).then(function (ok) { if (ok) listTree() })
  })
  toggle.addEventListener('click', toggleSidebar)
  $('#__mdv_tab_files').addEventListener('click', function () { setSideMode('files') })
  $('#__mdv_tab_outline').addEventListener('click', function () { setSideMode('outline') })
  $('#__mdv_outline').addEventListener('click', function (e) {
    var a = e.target.closest('a')
    if (!a) return
    var href = a.getAttribute('href')
    if (!href || href.charAt(0) !== '#') return
    e.preventDefault()
    var el = document.getElementById(href.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  // move the extension's original #_toc into the outline tab once it appears
  new MutationObserver(function () {
    var toc = document.getElementById('_toc')
    var outline = $('#__mdv_outline')
    if (toc && toc.parentNode !== outline) {
      outline.appendChild(toc)
      toc.style.setProperty('display', 'block', 'important')
    }
  }).observe(document.body, { childList: true, subtree: true })

  init()
})()
