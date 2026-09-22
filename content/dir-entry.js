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

  var workspaces = []          // [{ id, name, kind, handle | files }] in open order
  var activeId = null          // id of the active workspace
  var TEMP_WS_ID = '__mdv_temp' // fixed id of the temporary workspace
  var TMP_NOTE_URL = 'file:///tmp/notes.md' // default note opened by the "打开 /tmp 笔记" button
  var fileMap = new Map()      // relative path -> FileSystemFileHandle
  var currentDir = ''          // directory of the swapped file
  var swapped = false          // showing swapped content vs original page content
  var sideMode = 'files'
  var sidebarOn = true
  var activeRow = null
  var scrollToActive = false  // scroll the active file row into view after next render
  var contextMenu = null      // right-click context menu element
  var paletteEl = null        // Ctrl+P file palette
  var paletteResults = []     // gathered file list for the palette
  var paletteActiveIdx = 0    // highlighted palette row
  var paletteLoading = false  // palette is still gathering files
  var wsFilesCache = {}       // workspaceId -> collected files (for the palette)
  var spyHeadings = []        // headings in the current content (scrollspy)
  var spyLinks = []           // matching outline links
  var findMatches = []        // <mark> elements for the current find
  var findIdx = -1            // current find match index
  var findbarEl = null        // find bar element
  var forceInlineOpen = false // open files in-place (skip navigation) for grep jumps
  var currentFileKey = null   // key of the file currently shown in the content area
  var scrollPositions = {}    // fileKey -> last scrollY (persisted across reloads)
  var fileTabs = []           // [{wsId, relPath, name}] open-file tabs (persisted)
  var treeNavIdx = -1         // keyboard-navigation index into the visible tree rows
  var filterbarEl = null      // tree filter input
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
    '#__mdv_head,#__mdv_ws_list,#__mdv_tabs,#__mdv_tree_wrap,#__mdv_status{background:#f6f8fa;color:#24292f}',
    'body._color-dark #__mdv_head,body._color-dark #__mdv_ws_list,body._color-dark #__mdv_tabs,body._color-dark #__mdv_tree_wrap,body._color-dark #__mdv_status{background:#161b22;color:#c9d1d9}',
    '#__mdv_head{display:flex;gap:6px;padding:8px;border-bottom:1px solid rgba(128,128,128,.3)}',
    '#__mdv_head button{flex:1;padding:5px 8px;font-size:12px;border-radius:6px;cursor:pointer;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit}',
    '#__mdv_head button:hover{background:rgba(128,128,128,.15)}',
    '#__mdv_ws_list{max-height:45%;overflow:auto;padding:4px 0;border-bottom:1px solid rgba(128,128,128,.3);background:rgba(0,0,0,.05)}',
    'body._color-dark #__mdv_ws_list{background:rgba(255,255,255,.05)}',
    '.__mdv_ws_row{display:flex;align-items:center;gap:4px;padding:5px 10px;cursor:pointer;font-size:12.5px;user-select:none}',
    '.__mdv_ws_row:hover{background:rgba(128,128,128,.12)}',
    '.__mdv_ws_row.__mdv-ws-active{background:rgba(9,105,218,.15);box-shadow:inset 3px 0 0 #0969da}',
    '.__mdv_ws_row .__mdv_ws_name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#__mdv_tabs{display:flex;border-bottom:1px solid rgba(128,128,128,.3)}',
    '#__mdv_tabs button{flex:1;padding:7px 0;font-size:12px;border:none;background:transparent;color:inherit;cursor:pointer;border-bottom:2px solid transparent;opacity:.7}',
    '#__mdv_tabs button.active{opacity:1;border-bottom-color:#0969da}',
    'body._color-dark #__mdv_tabs button.active{border-bottom-color:#58a6ff}',
    '#__mdv_tree_wrap{flex:1;display:flex;flex-direction:column;min-height:0}',
    '#__mdv_tree_bar{display:flex;justify-content:flex-end;gap:6px;padding:3px 6px}',
    '#__mdv_expand{padding:2px 10px;font-size:11px;border-radius:6px;cursor:pointer;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;opacity:.75}',
    '#__mdv_expand:hover{background:rgba(128,128,128,.15);opacity:1}',
    '#__mdv_tree{flex:1;overflow:auto;padding:6px 0}',
    '#__mdv_outline{flex:1;overflow:auto;padding:0}',
    '#__mdv_status{display:flex;gap:10px;padding:5px 10px;font-size:11px;border-top:1px solid rgba(128,128,128,.3);opacity:.8}',
    '#__mdv_status span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#__mdv_status_progress{text-align:right}',
    '#_toc a.__mdv-toc-active{color:#0969da!important;font-weight:bold!important}',
    'body._color-dark #_toc a.__mdv-toc-active{color:#58a6ff!important}',
    '#__mdv_search{flex:1;display:none;flex-direction:column;min-height:0}',
    '#__mdv_search_input{width:100%;padding:8px 10px;font-size:13px;border:none;border-bottom:1px solid rgba(128,128,128,.3);background:transparent;color:inherit;outline:none;box-sizing:border-box}',
    '#__mdv_search_results{flex:1;overflow:auto;padding:4px 0}',
    '.__mdv_grep_row{padding:6px 12px;cursor:pointer;border-bottom:1px solid rgba(128,128,128,.08)}',
    '.__mdv_grep_row:hover{background:rgba(128,128,128,.1)}',
    '.__mdv_grep_name{font-size:12px;font-weight:bold;margin-bottom:2px}',
    '.__mdv_grep_snippet{font-size:12px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.__mdv_grep_snippet mark{background:#ffd54f;color:#000}',
    '.__mdv_grep_empty{padding:12px;font-size:12.5px;opacity:.6}',
    '#__mdv_findbar{position:fixed;top:8px;right:16px;z-index:2147483001;display:none;align-items:center;gap:6px;padding:6px 8px;background:#f6f8fa;color:#24292f;border:1px solid rgba(128,128,128,.4);border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.2)}',
    'body._color-dark #__mdv_findbar{background:#161b22;color:#c9d1d9}',
    '#__mdv_findbar input{width:180px;padding:4px 8px;font-size:13px;border:1px solid rgba(128,128,128,.4);border-radius:5px;background:transparent;color:inherit;outline:none}',
    '#__mdv_findbar button{width:26px;height:26px;padding:0;border:none;background:transparent;color:inherit;font-size:14px;cursor:pointer;border-radius:4px;opacity:.7}',
    '#__mdv_findbar button:hover{background:rgba(128,128,128,.2);opacity:1}',
    '#__mdv_findbar .__mdv_find_count{font-size:12px;opacity:.7;min-width:44px;text-align:center}',
    'mark.__mdv_find{background:#ffd54f;color:#000}',
    'mark.__mdv_find.__mdv_find_current{background:#ff9800;color:#000}',
    'pre.__mdv_code_block{position:relative!important;padding-left:3.8em!important;line-height:1.5!important}',
    'pre.__mdv_code_block>code{position:relative!important;line-height:1.5!important}',
    '.__mdv_code_copy{position:absolute;top:6px;right:6px;z-index:2;padding:2px 8px;font-size:11px;border-radius:5px;border:1px solid rgba(128,128,128,.4);background:rgba(246,248,250,.92);color:#24292f;cursor:pointer;opacity:0;transition:opacity .15s}',
    'pre.__mdv_code_block:hover .__mdv_code_copy{opacity:1}',
    'body._color-dark .__mdv_code_copy{background:rgba(22,27,34,.9);color:#c9d1d9}',
    '.__mdv_line_rows{position:absolute;top:0;left:-3.8em;width:3em;height:100%;overflow:hidden;border-right:1px solid rgba(128,128,128,.3);text-align:right;user-select:none;pointer-events:none;counter-reset:__mdv_ln}',
    '.__mdv_line_rows>span{display:block;counter-increment:__mdv_ln;padding-right:.6em;color:rgba(128,128,128,.7)}',
    '.__mdv_line_rows>span::before{content:counter(__mdv_ln)}',
    '.__mdv_row{display:flex;align-items:center;gap:4px;padding:3px 10px;cursor:pointer;white-space:nowrap;font-size:12.5px;user-select:none}',
    '.__mdv_row:hover{background:rgba(128,128,128,.12)}',
    '.__mdv_row.__mdv-active{background:rgba(9,105,218,.15)}',
    '.__mdv_row .__mdv_arrow{width:11px;opacity:.6;flex:none}',
    '.__mdv_row .__mdv_label{flex:1;overflow:hidden;text-overflow:ellipsis}',
    '.__mdv_row .__mdv_file_close{flex:none;width:20px;height:20px;line-height:1;padding:0;border:none;background:transparent;color:inherit;font-size:16px;cursor:pointer;border-radius:4px;opacity:.5}',
    '.__mdv_row .__mdv_file_close:hover{background:rgba(128,128,128,.25);opacity:1}',
    '.__mdv_children{display:none}',
    '.__mdv_dir.__mdv-open>.__mdv_children{display:block}',
    '.__mdv_empty{padding:14px;opacity:.6;font-size:12.5px}',
    '#__mdv_outline #_toc{position:static!important;width:auto!important;height:auto!important;border-right:none!important;overflow:visible!important}',
    '#__mdv_toggle{position:fixed;top:0;left:0;z-index:2147483001;padding:4px 10px;font-size:12px;border-radius:0 0 8px 0;cursor:pointer;border:1px solid rgba(128,128,128,.4);background:rgba(246,248,250,.95);color:#24292f;box-shadow:0 1px 4px rgba(0,0,0,.2)}',
    'body._color-dark #__mdv_toggle{background:rgba(22,27,34,.9);color:#c9d1d9}',
    '#__mdv_content{display:none}',
    'body.__mdv-swapped #_html,body.__mdv-swapped>pre{display:none!important}',
    'body.__mdv-swapped #__mdv_content{display:block}',
    '#__mdv_menu{position:fixed;z-index:2147483002;min-width:200px;max-width:340px;background:#f6f8fa;color:#24292f;border:1px solid rgba(128,128,128,.4);border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.2);padding:4px 0}',
    'body._color-dark #__mdv_menu{background:#161b22;color:#c9d1d9}',
    '#__mdv_menu .__mdv_menu_path{padding:4px 12px;font-size:11.5px;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#__mdv_menu .__mdv_menu_item{padding:6px 12px;font-size:12.5px;cursor:pointer}',
    '#__mdv_menu .__mdv_menu_item:hover{background:rgba(9,105,218,.15)}',
    '#__mdv_palette{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483002;display:none;align-items:flex-start;justify-content:center;background:rgba(0,0,0,.25);padding-top:80px}',
    '#__mdv_palette_box{width:560px;max-width:90vw;background:#f6f8fa;color:#24292f;border:1px solid rgba(128,128,128,.4);border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.3);overflow:hidden}',
    'body._color-dark #__mdv_palette_box{background:#161b22;color:#c9d1d9}',
    '#__mdv_palette_input{width:100%;padding:12px 14px;font-size:14px;border:none;border-bottom:1px solid rgba(128,128,128,.3);background:transparent;color:inherit;outline:none;box-sizing:border-box}',
    '#__mdv_palette_results{max-height:320px;overflow:auto;padding:4px 0}',
    '.__mdv_palette_row{display:flex;align-items:center;gap:8px;padding:7px 14px;cursor:pointer}',
    '.__mdv_palette_row.__mdv_palette_active{background:rgba(9,105,218,.15)}',
    '.__mdv_palette_name{flex:none;font-size:13px}',
    '.__mdv_palette_path{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;opacity:.65}',
    '.__mdv_palette_empty{padding:12px 14px;font-size:12.5px;opacity:.6}',
    '.__mdv_table_wrap{overflow:auto;max-width:100%;max-height:75vh;margin:16px 0;-webkit-overflow-scrolling:touch}',
    '.__mdv_table_wrap table{margin:0;border-collapse:separate;border-spacing:0}',
    '.__mdv_table_wrap th{position:sticky;top:0;z-index:1}',
    '#__mdv_lightbox{position:fixed;inset:0;z-index:2147483003;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.85)}',
    '#__mdv_lightbox.__mdv-open{display:flex}',
    '#__mdv_lightbox img{max-width:92vw;max-height:88vh;object-fit:contain;transition:transform .12s ease;cursor:zoom-out;user-select:none}',
    '#__mdv_lightbox .__mdv_lb_close{position:fixed;top:14px;right:18px;z-index:2;width:40px;height:40px;font-size:26px;line-height:1;border:none;border-radius:50%;background:rgba(22,27,34,.7);color:#fff;cursor:pointer}',
    '#__mdv_lightbox .__mdv_lb_close:hover{background:rgba(22,27,34,.95)}',
    '#__mdv_lightbox .__mdv_lb_bar{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:8px;padding:6px 8px;background:rgba(22,27,34,.8);border-radius:8px;z-index:2}',
    '#__mdv_lightbox .__mdv_lb_bar button{min-width:38px;height:34px;padding:0 10px;font-size:15px;border:none;border-radius:6px;background:rgba(255,255,255,.12);color:#fff;cursor:pointer}',
    '#__mdv_lightbox .__mdv_lb_bar button:hover{background:rgba(255,255,255,.25)}',
    'body.__mdv-lb-lock{overflow:hidden}',
    '.__mdv_row.__mdv_nav{outline:1.5px solid #0969da;outline-offset:-1.5px}',
    '#__mdv_filterbar{flex:1;min-width:0;display:none;padding:3px 8px;font-size:12px;border:1px solid rgba(128,128,128,.4);border-radius:6px;background:transparent;color:inherit;outline:none}',
    '#__mdv_export{flex:none;padding:0 6px;font-size:11px;border:none;background:transparent;color:inherit;cursor:pointer;border-radius:4px;opacity:.8}',
    '#__mdv_export:hover{background:rgba(128,128,128,.15);opacity:1}',
    '#__mdv_export_menu{position:fixed;z-index:2147483002;min-width:160px;background:#f6f8fa;color:#24292f;border:1px solid rgba(128,128,128,.4);border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.2);padding:4px 0}',
    'body._color-dark #__mdv_export_menu{background:#161b22;color:#c9d1d9}',
    '#__mdv_export_menu .__mdv_export_item{padding:6px 12px;font-size:12.5px;cursor:pointer;white-space:nowrap}',
    '#__mdv_export_menu .__mdv_export_item:hover{background:rgba(9,105,218,.15)}',
    '@media print{#__mdv_sidebar,#__mdv_toggle,#__mdv_findbar,#__mdv_lightbox,#__mdv_filterbar,#__mdv_menu,#__mdv_palette,#__mdv_export_menu,#__mdv_breadcrumb,#__mdv_top,#__mdv_zen_exit{display:none!important}body.__mdv-sidebar-on{padding-left:0!important}}',
    '#__mdv_file_tabs{display:flex;flex-direction:column;overflow-y:auto;max-height:30vh;padding:4px 6px;gap:3px;border-bottom:1px solid rgba(128,128,128,.3)}',
    '#__mdv_file_tabs:empty{display:none}',
    '.__mdv_file_tab{display:flex;align-items:center;gap:4px;flex:none;width:100%;padding:4px 8px;font-size:12px;border-radius:5px;border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;cursor:pointer;box-sizing:border-box}',
    '.__mdv_file_tab .__mdv_ft_label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}',
    '.__mdv_file_tab .__mdv_ft_close{flex:none;width:15px;height:15px;line-height:1;border:none;background:transparent;color:inherit;font-size:13px;cursor:pointer;border-radius:3px;opacity:.6;padding:0}',
    '.__mdv_file_tab .__mdv_ft_close:hover{background:rgba(128,128,128,.25);opacity:1}',
    '.__mdv_file_tab.__mdv_ft_active{background:rgba(9,105,218,.15);border-color:#0969da}',
    'pre.__mdv_code_block.__mdv_folded{max-height:220px!important;overflow:hidden!important}',
    '.__mdv_code_fold{position:absolute;bottom:6px;right:6px;z-index:2;padding:2px 8px;font-size:11px;border-radius:5px;border:1px solid rgba(128,128,128,.4);background:rgba(246,248,250,.92);color:#24292f;cursor:pointer}',
    'body._color-dark .__mdv_code_fold{background:rgba(22,27,34,.9);color:#c9d1d9}',
    '#__mdv_breadcrumb{position:fixed;bottom:0;left:0;z-index:2147483000;padding:3px 14px;font-size:11.5px;border-radius:0 8px 0 0;background:rgba(246,248,250,.88);color:#24292f;opacity:.75;max-width:60vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none}',
    'body.__mdv-sidebar-on #__mdv_breadcrumb{left:300px}',
    'body.__mdv-zen #__mdv_breadcrumb{left:0}',
    'body._color-dark #__mdv_breadcrumb{background:rgba(22,27,34,.88);color:#c9d1d9}',
    '#__mdv_top{position:fixed;right:18px;bottom:20px;z-index:2147483001;width:40px;height:40px;border-radius:50%;border:1px solid rgba(128,128,128,.4);background:rgba(246,248,250,.9);color:#24292f;font-size:18px;cursor:pointer;opacity:0;visibility:hidden;transition:opacity .15s;box-shadow:0 2px 8px rgba(0,0,0,.15);padding:0}',
    '#__mdv_top.__mdv-show{opacity:.85;visibility:visible}',
    '#__mdv_top:hover{opacity:1}',
    'body._color-dark #__mdv_top{background:rgba(22,27,34,.9);color:#c9d1d9}',
    '#__mdv_zen{flex:none;padding:0 6px;font-size:11px;border:none;background:transparent;color:inherit;cursor:pointer;border-radius:4px;opacity:.8}',
    '#__mdv_zen:hover{background:rgba(128,128,128,.15);opacity:1}',
    'body.__mdv-zen{padding-left:0!important}',
    'body.__mdv-zen #__mdv_sidebar,body.__mdv-zen #__mdv_toggle{display:none!important}',
    '#__mdv_zen_exit{position:fixed;top:10px;right:14px;z-index:2147483001;display:none;padding:4px 12px;font-size:12px;border-radius:6px;cursor:pointer;border:1px solid rgba(128,128,128,.4);background:rgba(246,248,250,.9);color:#24292f;opacity:.35;transition:opacity .15s}',
    '#__mdv_zen_exit:hover{opacity:1}',
    'body._color-dark #__mdv_zen_exit{background:rgba(22,27,34,.9);color:#c9d1d9}',
    'body.__mdv-zen #__mdv_zen_exit{display:block}',
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
      '<button id="__mdv_file_pick" type="button">打开文件</button>' +
      '<button id="__mdv_pick" type="button">打开工作空间</button>' +
      '<button id="__mdv_tmp_note" type="button" title="打开 /tmp/notes.md">打开 /tmp 笔记</button>' +
      '<button id="__mdv_grant" type="button" style="display:none">重新授权</button>' +
    '</div>' +
    '<div id="__mdv_ws_list"></div>' +
    '<div id="__mdv_file_tabs"></div>' +
    '<div id="__mdv_tabs">' +
      '<button id="__mdv_tab_files" class="active" type="button">文件</button>' +
      '<button id="__mdv_tab_outline" type="button">大纲</button>' +
      '<button id="__mdv_tab_search" type="button">搜索</button>' +
    '</div>' +
    '<div id="__mdv_tree_wrap">' +
      '<div id="__mdv_tree_bar">' +
        '<input id="__mdv_filterbar" type="text" placeholder="\u7b5b\u9009\u6587\u4ef6\u2026 (Esc \u6e05\u9664)" style="display:none">' +
        '<button id="__mdv_expand" type="button">\u5c55\u5f00</button>' +
      '</div>' +
      '<div id="__mdv_tree"></div>' +
    '</div>' +
    '<div id="__mdv_outline" style="display:none"></div>' +
    '<div id="__mdv_search" style="display:none">' +
      '<input id="__mdv_search_input" type="text" placeholder="搜索文件内容...">' +
      '<div id="__mdv_search_results"></div>' +
    '</div>' +
    '<div id="__mdv_status">' +
      '<span id="__mdv_status_words"></span>' +
      '<span id="__mdv_status_time"></span>' +
      '<span id="__mdv_status_progress"></span>' +
      '<button id="__mdv_zen" type="button">\u4e13\u6ce8</button>' +
      '<button id="__mdv_export" type="button">\u5bfc\u51fa</button>' +
    '</div>'
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
  function openFileHandle (handle, relPath) {
    var ws = activeWs()
    var newKey = ws ? fileKey(ws, relPath) : null
    return handle.getFile().then(function (file) {
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
        enhanceCodeBlocks(contentBox)
        enhanceTables(contentBox)

        if (newKey) {
          currentFileKey = newKey
          var savedY = scrollPositions[newKey] || 0
          requestAnimationFrame(function () { window.scrollTo(0, savedY) })
        }

        document.body.classList.add('__mdv-swapped')
        swapped = true

        var st = settings.content || {}
        if (st.syntax !== false) setTimeout(function () { window.Prism && window.Prism.highlightAll() }, 20)
        if (st.mermaid) setTimeout(function () { renderMermaid(html) }, 40)
        if (st.mathjax) setTimeout(function () { window.mj && window.mj.render() }, 60)

        resolveMedia()
        buildOutline()
        updateReadingStats()
      })
    }).catch(function () {})
  }

  function fileUrl (ws, relPath) {
    if (!ws) return null
    if (ws.kind === 'dir') {
      if (!ws.rootPath) return null
      return 'file://' + ws.rootPath + relPath
    }
    var files = ws.files || []
    for (var i = 0; i < files.length; i++) {
      if (files[i].id === relPath) return files[i].url || null
    }
    return null
  }

  function sameFileUrl (url) {
    var cur = location.href
    if (cur === url) return true
    try { return decodeURIComponent(cur) === decodeURIComponent(url) } catch (e) { return false }
  }

  function openPath (relPath) {
    var ws = activeWs()
    if (!ws) return
    updateBreadcrumb()
    var newKey = fileKey(ws, relPath)
    if (currentFileKey && currentFileKey !== newKey) {
      saveCurrentScroll()
      persistScroll()
    }
    var url = fileUrl(ws, relPath)
    if (url && !forceInlineOpen) {
      if (!sameFileUrl(url)) {
        addFileTab(ws.id, relPath, fileNameOf(ws, relPath))
        location.href = url
      }
      return
    }
    var handle = resolveHandle(ws, relPath)
    if (handle) {
      addFileTab(ws.id, relPath, fileNameOf(ws, relPath))
      return openFileHandle(handle, relPath)
    }
  }

  function effectiveLineHeight (pre, code) {
    var preLH = parseFloat(getComputedStyle(pre).lineHeight) || 0
    var codeLH = parseFloat(getComputedStyle(code).lineHeight) || 0
    return Math.max(preLH, codeLH)
  }

  function addLineNumbers (pre, code) {
    if (code.querySelector('.__mdv_line_rows')) return
    var text = code.textContent.replace(/\n+$/, '')
    var count = text.split('\n').length
    var gutter = document.createElement('span')
    gutter.className = '__mdv_line_rows'
    gutter.setAttribute('aria-hidden', 'true')
    for (var i = 0; i < count; i++) gutter.appendChild(document.createElement('span'))
    code.appendChild(gutter)
    var cs = getComputedStyle(code)
    gutter.style.fontFamily = cs.fontFamily
    gutter.style.fontSize = cs.fontSize
    var lh = effectiveLineHeight(pre, code) || parseFloat(cs.lineHeight) || 16
    gutter.style.lineHeight = lh + 'px'
  }

  function addFold (pre, code) {
    var lines = code.textContent.replace(/\n+$/, '').split('\n').length
    if (lines <= 15) return
    pre.classList.add('__mdv_folded')
    var btn = document.createElement('button')
    btn.type = 'button'
    btn.className = '__mdv_code_fold'
    btn.textContent = '\u5c55\u5f00 ' + lines + ' \u884c'
    btn.addEventListener('click', function (e) {
      e.stopPropagation()
      var folded = pre.classList.toggle('__mdv_folded')
      btn.textContent = folded ? '\u5c55\u5f00 ' + lines + ' \u884c' : '\u6298\u53e0'
    })
    pre.appendChild(btn)
  }

  function enhanceOneCodeBlock (pre) {
    if (pre.classList.contains('__mdv_mermaid')) return
    if (pre.querySelector('.__mdv_code_copy')) return
    var code = pre.querySelector('code') || pre

    // Mermaid reads the code element's innerHTML to recover the diagram source;
    // injecting the copy button / line-number gutter corrupts it (parse error).
    if (code.classList && code.classList.contains('mermaid')) {
      pre.classList.add('__mdv_mermaid')
      return
    }

    var btn = document.createElement('button')
    btn.type = 'button'
    btn.className = '__mdv_code_copy'
    btn.textContent = '\u590d\u5236'
    btn.addEventListener('click', function () {
      copyText(code.textContent)
      btn.textContent = '\u5df2\u590d\u5236'
      setTimeout(function () { btn.textContent = '\u590d\u5236' }, 1200)
    })
    pre.appendChild(btn)

    pre.classList.add('__mdv_code_block')
    addLineNumbers(pre, code)
    addFold(pre, code)
  }

  function enhanceCodeBlocks (root) {
    if (!root) return
    root.querySelectorAll('pre').forEach(enhanceOneCodeBlock)
  }

  function enhanceTables (root) {
    if (!root) return
    root.querySelectorAll('table').forEach(function (table) {
      if (table.classList.contains('__mdv_table_done')) return
      table.classList.add('__mdv_table_done')
      var wrap = document.createElement('div')
      wrap.className = '__mdv_table_wrap'
      table.parentNode.insertBefore(wrap, table)
      wrap.appendChild(table)
    })
  }

  // ---- image lightbox ----
  var lightboxEl = null
  var lbScale = 1
  var lbRot = 0

  function applyLb () {
    lightboxEl.querySelector('img').style.transform = 'scale(' + lbScale + ') rotate(' + lbRot + 'deg)'
  }

  function closeLightbox () {
    if (!lightboxEl) return
    lightboxEl.classList.remove('__mdv-open')
    document.body.classList.remove('__mdv-lb-lock')
    var img = lightboxEl.querySelector('img')
    img.src = ''
    lbScale = 1
    lbRot = 0
    img.style.transform = ''
  }

  function openLightbox (src) {
    ensureLightbox()
    var img = lightboxEl.querySelector('img')
    img.src = src
    lbScale = 1
    lbRot = 0
    applyLb()
    lightboxEl.classList.add('__mdv-open')
    document.body.classList.add('__mdv-lb-lock')
  }

  function ensureLightbox () {
    if (lightboxEl) return lightboxEl
    lightboxEl = document.createElement('div')
    lightboxEl.id = '__mdv_lightbox'
    lightboxEl.innerHTML =
      '<img alt="">' +
      '<button type="button" class="__mdv_lb_close" data-lb="close" title="\u5173\u95ed">\u00D7</button>' +
      '<div class="__mdv_lb_bar">' +
        '<button type="button" data-lb="out" title="\u7f29\u5c0f">\u2212</button>' +
        '<button type="button" data-lb="in" title="\u653e\u5927">+</button>' +
        '<button type="button" data-lb="rotate" title="\u65cb\u8f6c">\u21BB</button>' +
        '<button type="button" data-lb="reset" title="\u91cd\u7f6e">\u539f\u59cb</button>' +
      '</div>'
    document.body.appendChild(lightboxEl)

    var img = lightboxEl.querySelector('img')

    lightboxEl.addEventListener('wheel', function (e) {
      e.preventDefault()
      lbScale *= e.deltaY < 0 ? 1.15 : 0.87
      lbScale = Math.max(0.05, Math.min(8, lbScale))
      applyLb()
    }, { passive: false })

    lightboxEl.addEventListener('click', function (e) {
      if (e.target === img) {
        lbScale = 1
        lbRot = 0
        applyLb()
        return
      }
      var btn = e.target.closest ? e.target.closest('button') : null
      if (btn) {
        var act = btn.getAttribute('data-lb')
        if (act === 'close') closeLightbox()
        else if (act === 'in') { lbScale = Math.min(8, lbScale * 1.25); applyLb() }
        else if (act === 'out') { lbScale = Math.max(0.05, lbScale / 1.25); applyLb() }
        else if (act === 'rotate') { lbRot = (lbRot + 90) % 360; applyLb() }
        else if (act === 'reset') { lbScale = 1; lbRot = 0; applyLb() }
        return
      }
      if (e.target === lightboxEl) closeLightbox()
    })

    return lightboxEl
  }

  // ---- export (PDF / standalone HTML) ----
  var exportMenuEl = null

  function hideExportMenu () {
    if (exportMenuEl) exportMenuEl.style.display = 'none'
  }

  function ensureExportMenu () {
    if (exportMenuEl) return exportMenuEl
    exportMenuEl = document.createElement('div')
    exportMenuEl.id = '__mdv_export_menu'
    exportMenuEl.style.display = 'none'

    var pdf = document.createElement('div')
    pdf.className = '__mdv_export_item'
    pdf.textContent = '\u5bfc\u51fa PDF'
    pdf.addEventListener('click', function () { hideExportMenu(); window.print() })

    var html = document.createElement('div')
    html.className = '__mdv_export_item'
    html.textContent = '\u6253\u5305\u4e3a\u5355\u6587\u4ef6 HTML'
    html.addEventListener('click', function () { hideExportMenu(); exportHtml() })

    exportMenuEl.appendChild(pdf)
    exportMenuEl.appendChild(html)
    document.body.appendChild(exportMenuEl)
    return exportMenuEl
  }

  function showExportMenu (anchor) {
    ensureExportMenu()
    var r = anchor.getBoundingClientRect()
    exportMenuEl.style.display = ''
    var left = Math.min(r.left, window.innerWidth - 180)
    var top = r.top - exportMenuEl.offsetHeight - 6
    if (top < 0) top = r.bottom + 6
    exportMenuEl.style.left = left + 'px'
    exportMenuEl.style.top = top + 'px'
  }

  function exportFileName () {
    var ws = activeWs()
    var rel = (ws && ws.active) || currentFilePath().split('/').filter(Boolean).pop() || ''
    var base = rel.split('/').filter(Boolean).pop() || 'export'
    base = base.replace(/\.(?:markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text)$/i, '')
    return base || 'export'
  }

  function inlineImages (clone) {
    var imgs = Array.from(clone.querySelectorAll('img'))
    return Promise.all(imgs.map(function (img) {
      var src = img.currentSrc || img.getAttribute('src')
      if (!src || /^(?:data:|https?:|chrome-extension:)/.test(src)) return Promise.resolve()
      return fetch(src).then(function (r) { return r.blob() }).then(function (blob) {
        return new Promise(function (resolve) {
          var reader = new FileReader()
          reader.onloadend = function () { img.setAttribute('src', reader.result); resolve() }
          reader.onerror = function () { resolve() }
          reader.readAsDataURL(blob)
        })
      }).catch(function () {})
    }))
  }

  function downloadHtml (contentHtml, css) {
    var title = exportFileName()
    var doc = '<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + title + '</title>\n<style>\n' + css + '\n</style>\n</head>\n<body>\n' + contentHtml + '\n</body>\n</html>'
    var blob = new Blob([doc], { type: 'text/html;charset=utf-8' })
    var url = URL.createObjectURL(blob)
    var a = document.createElement('a')
    a.href = url
    a.download = title + '.html'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
  }

  function exportHtml () {
    var root = currentContentRoot()
    if (!root) return
    var wrapper = document.createElement('div')
    wrapper.className = root.className
    wrapper.innerHTML = root.innerHTML
    var dark = document.body.classList.contains('_color-dark')
    chrome.runtime.sendMessage({ message: 'export.css', dark: dark }, function (res) {
      var css = (res && res.css) || ''
      inlineImages(wrapper).then(function () {
        downloadHtml(wrapper.outerHTML, css)
      })
    })
  }

  // ---- zen (focus) mode ----
  var zenOn = false
  var zenExitEl = null

  function ensureZenExit () {
    if (zenExitEl) return zenExitEl
    zenExitEl = document.createElement('button')
    zenExitEl.id = '__mdv_zen_exit'
    zenExitEl.type = 'button'
    zenExitEl.textContent = '\u9000\u51fa\u4e13\u6ce8'
    zenExitEl.addEventListener('click', function () { setZen(false) })
    document.body.appendChild(zenExitEl)
    return zenExitEl
  }

  function setZen (on) {
    zenOn = on
    document.body.classList.toggle('__mdv-zen', on)
    if (on) ensureZenExit()
  }

  // ---- breadcrumb + back-to-top ----
  var breadcrumbEl = null
  var topBtnEl = null

  function ensureBreadcrumb () {
    if (breadcrumbEl) return breadcrumbEl
    breadcrumbEl = document.createElement('div')
    breadcrumbEl.id = '__mdv_breadcrumb'
    breadcrumbEl.style.display = 'none'
    document.body.appendChild(breadcrumbEl)
    return breadcrumbEl
  }

  function updateBreadcrumb () {
    ensureBreadcrumb()
    var ws = activeWs()
    var rel = ''
    if (ws && ws.active) rel = ws.kind === 'temp' ? fileNameOf(ws, ws.active) : ws.active
    else if (location.protocol === 'file:') rel = currentFilePath()
    breadcrumbEl.textContent = rel
    breadcrumbEl.style.display = rel ? '' : 'none'
  }

  function ensureTopButton () {
    if (topBtnEl) return topBtnEl
    topBtnEl = document.createElement('button')
    topBtnEl.id = '__mdv_top'
    topBtnEl.type = 'button'
    topBtnEl.textContent = '\u2191'
    topBtnEl.title = '\u56de\u5230\u9876\u90e8'
    topBtnEl.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
    document.body.appendChild(topBtnEl)
    return topBtnEl
  }

  // ---- file tabs ----
  function tabKey (t) { return t.wsId + '::' + t.relPath }

  function fileNameOf (ws, relPath) {
    if (ws && ws.kind === 'temp') {
      var files = ws.files || []
      for (var i = 0; i < files.length; i++) {
        if (files[i].id === relPath) return files[i].name
      }
    }
    return relPath.split('/').filter(Boolean).pop() || relPath
  }

  function persistFileTabs () {
    idbSaveTabs(fileTabs).catch(function () {})
  }

  function sortedFileTabs () {
    return fileTabs.slice().sort(function (a, b) { return naturalCompare(a.name, b.name) })
  }

  function renderFileTabs () {
    var el = $('#__mdv_file_tabs')
    if (!el) return
    el.textContent = ''
    var ws = activeWs()
    var activeKey = ws ? fileKey(ws, ws.active) : ''
    sortedFileTabs().forEach(function (t) {
      var tab = document.createElement('div')
      tab.className = '__mdv_file_tab' + (tabKey(t) === activeKey ? ' __mdv_ft_active' : '')
      var label = document.createElement('span')
      label.className = '__mdv_ft_label'
      label.textContent = t.name
      label.title = t.relPath
      var close = document.createElement('button')
      close.type = 'button'
      close.className = '__mdv_ft_close'
      close.textContent = '\u00D7'
      close.title = '\u5173\u95ed'
      close.addEventListener('click', function (e) {
        e.stopPropagation()
        removeFileTab(t)
      })
      tab.appendChild(label)
      tab.appendChild(close)
      tab.addEventListener('click', function () {
        if (tabKey(t) !== activeKey) activateTab(t)
      })
      tab.addEventListener('contextmenu', function (e) {
        e.preventDefault()
        showTabMenu(e.clientX, e.clientY, t)
      })
      el.appendChild(tab)
    })
  }

  function closeOtherTabs (t) {
    var key = tabKey(t)
    fileTabs = fileTabs.filter(function (x) { return tabKey(x) === key })
    persistFileTabs()
    renderFileTabs()
  }

  function closeTabsBelow (t) {
    var sorted = sortedFileTabs()
    var idx = -1
    for (var i = 0; i < sorted.length; i++) {
      if (tabKey(sorted[i]) === tabKey(t)) { idx = i; break }
    }
    if (idx < 0) return
    var below = {}
    for (var i = idx + 1; i < sorted.length; i++) below[tabKey(sorted[i])] = true
    fileTabs = fileTabs.filter(function (x) { return !below[tabKey(x)] })
    persistFileTabs()
    renderFileTabs()
  }

  function showTabMenu (x, y, t) {
    hideContextMenu()
    contextMenu = document.createElement('div')
    contextMenu.id = '__mdv_menu'

    var closeOthers = document.createElement('div')
    closeOthers.className = '__mdv_menu_item'
    closeOthers.textContent = '\u5173\u95ed\u5176\u4ed6\u6807\u7b7e'
    closeOthers.addEventListener('click', function (e) {
      e.stopPropagation()
      closeOtherTabs(t)
      hideContextMenu()
    })

    var closeBelow = document.createElement('div')
    closeBelow.className = '__mdv_menu_item'
    closeBelow.textContent = '\u5173\u95ed\u4ee5\u4e0b\u6807\u7b7e'
    closeBelow.addEventListener('click', function (e) {
      e.stopPropagation()
      closeTabsBelow(t)
      hideContextMenu()
    })

    contextMenu.appendChild(closeOthers)
    contextMenu.appendChild(closeBelow)
    document.body.appendChild(contextMenu)
    contextMenu.style.left = Math.min(x, window.innerWidth - 220) + 'px'
    contextMenu.style.top = Math.min(y, window.innerHeight - 80) + 'px'
  }

  function addFileTab (wsId, relPath, name) {
    var key = wsId + '::' + relPath
    for (var i = 0; i < fileTabs.length; i++) {
      if (tabKey(fileTabs[i]) === key) { renderFileTabs(); return }
    }
    fileTabs.push({ wsId: wsId, relPath: relPath, name: name })
    persistFileTabs()
    renderFileTabs()
  }

  function removeFileTab (t) {
    var i = fileTabs.indexOf(t)
    if (i < 0) return
    fileTabs.splice(i, 1)
    persistFileTabs()
    renderFileTabs()
  }

  function activateTab (t) {
    var ws = null
    for (var i = 0; i < workspaces.length; i++) {
      if (workspaces[i].id === t.wsId) { ws = workspaces[i]; break }
    }
    if (!ws) { removeFileTab(t); return }
    activeId = ws.id
    ws.active = t.relPath
    scrollToActive = true
    persistWorkspaces().then(function () {
      renderWorkspaces()
      return listTree()
    })
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
    refreshSpy()
  }

  function currentContentRoot () {
    return swapped ? contentBox : (document.getElementById('_html') || contentBox)
  }

  function countReadingStats (text) {
    var cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
    var words = (text.match(/[a-zA-Z0-9]+/g) || []).length
    var minutes = Math.max(1, Math.ceil(cjk / 400 + words / 200))
    return { total: cjk + words, minutes: minutes }
  }

  function updateReadingStats () {
    var content = currentContentRoot()
    if (!content) return
    var stats = countReadingStats(content.textContent || '')
    var wordsEl = $('#__mdv_status_words')
    var timeEl = $('#__mdv_status_time')
    if (wordsEl) wordsEl.textContent = stats.total + ' \u5b57'
    if (timeEl) timeEl.textContent = '\u7ea6 ' + stats.minutes + ' \u5206\u949f'
  }

  function updateProgress () {
    var el = $('#__mdv_status_progress')
    if (!el) return
    var doc = document.documentElement
    var max = doc.scrollHeight - window.innerHeight
    var pct = max > 0 ? Math.round((window.scrollY / max) * 100) : 0
    if (pct < 0) pct = 0
    if (pct > 100) pct = 100
    el.textContent = pct + '%'
  }

  function refreshSpy () {
    var content = currentContentRoot()
    spyHeadings = content ? Array.from(content.querySelectorAll('h1,h2,h3,h4,h5,h6')) : []
    spyLinks = Array.from(document.querySelectorAll('#_toc a'))
    updateScrollSpy()
  }

  function updateScrollSpy () {
    if (!spyLinks.length) return
    var idx = -1
    var threshold = 90
    for (var i = 0; i < spyHeadings.length; i++) {
      if (spyHeadings[i].getBoundingClientRect().top <= threshold) idx = i
      else break
    }
    spyLinks.forEach(function (a, i) {
      a.classList.toggle('__mdv-toc-active', i === idx)
    })
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
    treeNavIdx = -1
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
    row.setAttribute('data-copy-path', dir.path)
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
    row.setAttribute('data-copy-path', f.path)
    row.addEventListener('click', function () { activateFile(f.path, row) })
    return row
  }

  function renderTempTree (ws) {
    var el = $('#__mdv_tree')
    el.textContent = ''
    activeRow = null
    treeNavIdx = -1
    var files = ws.files || []
    files.forEach(function (f) {
      var row = document.createElement('div')
      row.className = '__mdv_row __mdv_file'
      row.style.paddingLeft = '10px'
      row.setAttribute('data-path', f.id)
      row.setAttribute('data-copy-path', f.url ? urlToPath(f.url) : f.name)

      var label = document.createElement('span')
      label.className = '__mdv_label'
      label.textContent = f.name
      label.title = f.name

      var close = document.createElement('button')
      close.type = 'button'
      close.className = '__mdv_file_close'
      close.textContent = '\u00D7'
      close.title = '\u79fb\u9664'
      close.addEventListener('click', function (e) {
        e.stopPropagation()
        removeTempFile(f.id)
      })

      row.appendChild(label)
      row.appendChild(close)
      row.addEventListener('click', function () { activateFile(f.id, row) })
      el.appendChild(row)
    })
    if (!files.length) {
      el.innerHTML = '<div class="__mdv_empty">\u5c1a\u65e0\u4e34\u65f6\u6587\u4ef6\uff0c\u70b9\u51fb\u300c\u6253\u5f00\u6587\u4ef6\u300d\u9009\u62e9 md \u6587\u4ef6</div>'
    }
  }

  function removeTempFile (id) {
    var ws = activeWs()
    if (!ws || ws.kind !== 'temp') return
    var idx = -1
    for (var i = 0; i < (ws.files || []).length; i++) {
      if (ws.files[i].id === id) { idx = i; break }
    }
    if (idx < 0) return
    var wasActive = ws.active === id
    ws.files.splice(idx, 1)
    if (wasActive) {
      ws.active = ws.files.length ? ws.files[Math.min(idx, ws.files.length - 1)].id : ''
    }
    persistWorkspaces().then(function () { listTree() })
  }

  function absPath (relPath) {
    var ws = activeWs()
    if (ws && ws.kind === 'dir' && ws.rootPath) return ws.rootPath + relPath
    return relPath
  }

  function urlToPath (url) {
    try { return decodeURIComponent(new URL(url).pathname) } catch (e) { return url }
  }

  function fallbackCopy (text) {
    return new Promise(function (resolve) {
      var ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch (e) {}
      document.body.removeChild(ta)
      resolve()
    })
  }

  function copyText (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return fallbackCopy(text) })
    }
    return fallbackCopy(text)
  }

  function hideContextMenu () {
    if (contextMenu) { contextMenu.remove(); contextMenu = null }
  }

  function showContextMenu (x, y, path) {
    hideContextMenu()
    contextMenu = document.createElement('div')
    contextMenu.id = '__mdv_menu'

    var label = document.createElement('div')
    label.className = '__mdv_menu_path'
    label.textContent = path
    label.title = path

    var item = document.createElement('div')
    item.className = '__mdv_menu_item'
    item.textContent = '\u590d\u5236\u8def\u5f84'
    item.addEventListener('click', function (e) {
      e.stopPropagation()
      copyText(path)
      hideContextMenu()
    })

    contextMenu.appendChild(label)
    contextMenu.appendChild(item)
    document.body.appendChild(contextMenu)
    contextMenu.style.left = Math.min(x, window.innerWidth - 220) + 'px'
    contextMenu.style.top = Math.min(y, window.innerHeight - 90) + 'px'
  }

  function showWorkspaceMenu (x, y, wsId) {
    hideContextMenu()
    var ws = null
    for (var i = 0; i < workspaces.length; i++) {
      if (workspaces[i].id === wsId) { ws = workspaces[i]; break }
    }
    contextMenu = document.createElement('div')
    contextMenu.id = '__mdv_menu'

    if (ws && ws.kind === 'dir') {
      var setRoot = document.createElement('div')
      setRoot.className = '__mdv_menu_item'
      setRoot.textContent = '\u8bbe\u7f6e\u6839\u8def\u5f84'
      setRoot.addEventListener('click', function (e) {
        e.stopPropagation()
        var path = window.prompt('\u8f93\u5165\u5de5\u4f5c\u7a7a\u95f4\u6839\u76ee\u5f55\u7684\u7edd\u5bf9\u8def\u5f84\uff08\u5982 /Users/me/notes\uff09', ws.rootPath || '')
        hideContextMenu()
        if (path == null) return
        path = path.trim()
        if (path && path.charAt(path.length - 1) !== '/') path += '/'
        ws.rootPath = path || null
        persistWorkspaces()
      })
      contextMenu.appendChild(setRoot)
    }

    var item = document.createElement('div')
    item.className = '__mdv_menu_item'
    item.textContent = '\u5173\u95ed\u5de5\u4f5c\u7a7a\u95f4'
    item.addEventListener('click', function (e) {
      e.stopPropagation()
      closeWorkspace(wsId)
      hideContextMenu()
    })

    contextMenu.appendChild(item)
    document.body.appendChild(contextMenu)
    contextMenu.style.left = Math.min(x, window.innerWidth - 220) + 'px'
    contextMenu.style.top = Math.min(y, window.innerHeight - 100) + 'px'
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

  // ---- keyboard navigation of the file tree ----
  function treeRows () {
    return Array.from(document.querySelectorAll('#__mdv_tree .__mdv_row')).filter(function (r) {
      return r.offsetParent !== null // only visible rows (skips collapsed/filtered-out)
    })
  }

  function isDirRow (row) {
    return !row.classList.contains('__mdv_file')
  }

  function setTreeNav (idx) {
    var rows = treeRows()
    if (!rows.length) { treeNavIdx = -1; return }
    if (idx < 0) idx = 0
    if (idx >= rows.length) idx = rows.length - 1
    treeNavIdx = idx
    rows.forEach(function (r, i) { r.classList.toggle('__mdv_nav', i === idx) })
    rows[idx].scrollIntoView({ block: 'nearest' })
  }

  function focusRow (row) {
    var idx = treeRows().indexOf(row)
    if (idx >= 0) setTreeNav(idx)
  }

  function parentDirWrap (row) {
    if (isDirRow(row)) return row.parentElement.parentElement.closest('.__mdv_dir')
    return row.closest('.__mdv_dir')
  }

  function moveToParent (row) {
    var pw = parentDirWrap(row)
    if (!pw) return
    focusRow(pw.querySelector(':scope > .__mdv_row'))
  }

  function navLeft () {
    var rows = treeRows()
    var row = rows[treeNavIdx]
    if (!row) return
    if (isDirRow(row) && row.parentElement.classList.contains('__mdv-open')) {
      row.click() // collapse
      focusRow(row)
    } else {
      moveToParent(row)
    }
  }

  function navRight () {
    var rows = treeRows()
    var row = rows[treeNavIdx]
    if (!row || !isDirRow(row)) return
    var wrap = row.parentElement
    if (!wrap.classList.contains('__mdv-open')) {
      row.click() // expand
      focusRow(row)
    } else {
      setTreeNav(treeNavIdx + 1) // move to first visible child
    }
  }

  function activateRow (row) {
    if (row.classList.contains('__mdv_file')) {
      activateFile(row.getAttribute('data-path'), row)
    } else {
      row.click() // toggle dir open/close
      focusRow(row)
    }
  }

  function rowLabel (row) {
    var l = row.querySelector('.__mdv_label')
    return (l || row).textContent.toLowerCase()
  }

  function restoreTreeVisuals () {
    document.querySelectorAll('#__mdv_tree .__mdv_dir').forEach(function (wrap) {
      var row = wrap.querySelector(':scope > .__mdv_row')
      var path = row && row.getAttribute('data-copy-path')
      var open = isDirOpen(path)
      wrap.classList.toggle('__mdv-open', open)
      if (row) {
        var arrow = row.querySelector('.__mdv_arrow')
        if (arrow) arrow.textContent = open ? '\u25BE' : '\u25B8'
      }
    })
    document.querySelectorAll('#__mdv_tree .__mdv_row').forEach(function (r) { r.style.display = '' })
  }

  function syncNavIdx () {
    var rows = treeRows()
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].classList.contains('__mdv_nav')) { treeNavIdx = i; return }
    }
    treeNavIdx = -1
  }

  // persist (into ws.open) the transient expansions along the current selection
  // path, so clearing the filter keeps the selected directory reachable.
  function persistSelectionPath () {
    var rows = treeRows()
    var cur = treeNavIdx >= 0 ? rows[treeNavIdx] : null
    if (!cur) return
    var wrap = isDirRow(cur) ? cur.parentElement : cur.closest('.__mdv_dir')
    while (wrap && wrap.classList && wrap.classList.contains('__mdv_dir')) {
      var row = wrap.querySelector(':scope > .__mdv_row')
      var path = row && row.getAttribute('data-copy-path')
      if (path && wrap.classList.contains('__mdv-open')) toggleDirOpen(path, true)
      wrap = wrap.parentElement ? wrap.parentElement.closest('.__mdv_dir') : null
    }
  }

  function applyTreeFilter (q) {
    q = (q || '').trim().toLowerCase()
    var rows = document.querySelectorAll('#__mdv_tree .__mdv_row')
    if (!q) {
      rows.forEach(function (r) { r.style.display = '' })
      restoreTreeVisuals()
      syncNavIdx()
      return
    }
    treeNavIdx = -1
    document.querySelectorAll('#__mdv_tree .__mdv_row.__mdv_nav').forEach(function (r) { r.classList.remove('__mdv_nav') })
    rows.forEach(function (row) {
      if (row.classList.contains('__mdv_file')) {
        row.style.display = rowLabel(row).indexOf(q) >= 0 ? '' : 'none'
        return
      }
      var wrap = row.parentElement
      var hasMatch = Array.from(wrap.querySelectorAll('.__mdv_file')).some(function (f) {
        return rowLabel(f).indexOf(q) >= 0
      }) || rowLabel(row).indexOf(q) >= 0
      row.style.display = hasMatch ? '' : 'none'
      if (hasMatch) {
        wrap.classList.add('__mdv-open')
        var arrow = row.querySelector('.__mdv_arrow')
        if (arrow) arrow.textContent = '\u25BE'
      }
    })
  }

  function ensureFilterbar () {
    if (filterbarEl) return filterbarEl
    filterbarEl = $('#__mdv_filterbar')
    filterbarEl.addEventListener('input', function () { applyTreeFilter(filterbarEl.value) })
    filterbarEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        clearTreeFilter()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        var rows = treeRows()
        if (rows.length) setTreeNav(treeNavIdx < 0 ? 0 : treeNavIdx + 1)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        var rows = treeRows()
        if (rows.length) setTreeNav(treeNavIdx < 0 ? rows.length - 1 : treeNavIdx - 1)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        var rows = treeRows()
        var row = treeNavIdx >= 0 ? rows[treeNavIdx] : null
        if (row) {
          activateRow(row)
          if (row.classList.contains('__mdv_file')) clearTreeFilter()
        }
      }
    })
    return filterbarEl
  }

  function openFilter () {
    ensureFilterbar()
    filterbarEl.style.display = 'block'
    filterbarEl.focus()
    treeNavIdx = -1
    document.querySelectorAll('#__mdv_tree .__mdv_row.__mdv_nav').forEach(function (r) { r.classList.remove('__mdv_nav') })
  }

  function clearTreeFilter () {
    if (filterbarEl) {
      filterbarEl.value = ''
      filterbarEl.style.display = 'none'
      filterbarEl.blur()
    }
    persistSelectionPath()
    applyTreeFilter('')
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

  function resolveHandle (ws, relPath) {
    if (!ws) return null
    if (ws.kind === 'temp') {
      var files = ws.files || []
      for (var i = 0; i < files.length; i++) {
        if (files[i].id === relPath) return files[i].handle || null
      }
      return null
    }
    return fileMap.get(relPath) || null
  }

  function restoreActiveFile () {
    var ws = activeWs()
    var relPath = ws && ws.active
    if (!relPath) return
    var row = findFileRow(relPath)
    if (row) {
      highlightRow(row)
      if (scrollToActive) {
        scrollToActive = false
        row.scrollIntoView({ block: 'center' })
      }
    }
    return openPath(relPath)
  }

  function allDirPaths () {
    var paths = new Set()
    fileMap.forEach(function (_, filePath) {
      var parts = filePath.split('/')
      for (var i = 0; i < parts.length - 1; i++) {
        paths.add(parts.slice(0, i + 1).join('/') + '/')
      }
    })
    return Array.from(paths)
  }

  function updateExpandButton () {
    var btn = $('#__mdv_expand')
    if (!btn) return
    var ws = activeWs()
    if (ws && ws.kind === 'temp') {
      btn.style.display = 'none'
      return
    }
    btn.style.display = ''
    var paths = allDirPaths()
    var allOpen = paths.length > 0 && paths.every(function (p) { return ((ws && ws.open) || []).indexOf(p) >= 0 })
    btn.textContent = allOpen ? '\u6298\u53e0' : '\u5c55\u5f00'
    btn.title = allOpen ? '\u6298\u53e0\u5168\u90e8\u76ee\u5f55' : '\u5c55\u5f00\u5168\u90e8\u76ee\u5f55'
  }

  function toggleExpandAll () {
    var ws = activeWs()
    if (!ws) return
    var paths = allDirPaths()
    var allOpen = paths.length > 0 && paths.every(function (p) { return (ws.open || []).indexOf(p) >= 0 })
    ws.open = allOpen ? [] : paths
    persistWorkspaces().then(function () { listTree() })
  }

  function collect (dirHandle, prefix, out) {
    var it = dirHandle.entries()
    var next = function () {
      return it.next().then(function (res) {
        if (res.done) return out
        var name = res.value[0]
        var entry = res.value[1]
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
    var ws = activeWs()
    if (!ws) {
      fileMap = new Map()
      $('#__mdv_tree').innerHTML = '<div class="__mdv_empty">\u70b9\u51fb\u300c\u6253\u5f00\u5de5\u4f5c\u7a7a\u95f4\u300d\u6d4f\u89c8\u76ee\u5f55</div>'
      showGrant(false)
      updateExpandButton()
      return Promise.resolve()
    }
    if (ws.kind === 'temp') {
      renderTempTree(ws)
      updateExpandButton()
      return restoreActiveFile()
    }
    var handle = ws.handle
    return ensurePermission(handle).then(function (ok) {
      if (!ok) {
        showGrant(true)
        return
      }
      showGrant(false)
      return collect(handle, '', []).then(function (files) {
        wsFilesCache[ws.id] = files
        fileMap = new Map(files.map(function (f) { return [f.path, f.handle] }))
        renderTree(buildTree(files), files.length)
        updateExpandButton()
        return restoreActiveFile()
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
              var ws = { id: 'ws' + Date.now().toString(36), name: handle.name || '', handle: handle, kind: 'dir', files: [], open: [], active: '', rootPath: null }
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
        var scrollReq = tx.objectStore('workspaces').get('scrollPos')
        var tabsReq = tx.objectStore('workspaces').get('fileTabs')
        tx.oncomplete = function () {
          db.close()
          resolve({ list: listReq.result || [], active: activeReq.result || null, scroll: scrollReq.result || {}, tabs: tabsReq.result || [] })
        }
        tx.onerror = function () { db.close(); reject(tx.error) }
        tx.onabort = function () { db.close(); reject(tx.error) }
      })
    })
  }

  function idbSaveTabs (tabs) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('workspaces', 'readwrite')
        tx.objectStore('workspaces').put(tabs, 'fileTabs')
        tx.oncomplete = function () { db.close(); resolve() }
        tx.onerror = function () { db.close(); reject(tx.error) }
        tx.onabort = function () { db.close(); reject(tx.error) }
      })
    })
  }

  // ---- per-file reading position (persisted across file:// reloads) ----
  function fileKey (ws, relPath) {
    return ws.id + '::' + relPath
  }

  function persistScroll () {
    var snapshot = scrollPositions
    openDB().then(function (db) {
      var tx = db.transaction('workspaces', 'readwrite')
      tx.objectStore('workspaces').put(snapshot, 'scrollPos')
      tx.oncomplete = function () { db.close() }
      tx.onerror = function () { db.close() }
      tx.onabort = function () { db.close() }
    }).catch(function () {})
  }

  var scrollSaveTimer = null
  function scheduleScrollSave () {
    clearTimeout(scrollSaveTimer)
    scrollSaveTimer = setTimeout(function () {
      scrollSaveTimer = null
      persistScroll()
    }, 400)
  }

  function saveCurrentScroll () {
    if (currentFileKey) scrollPositions[currentFileKey] = window.scrollY || 0
  }

  function restoreCurrentScroll () {
    var ws = activeWs()
    var relPath = ws && ws.active
    if (!ws || !relPath) return
    currentFileKey = fileKey(ws, relPath)
    var y = scrollPositions[currentFileKey]
    if (!y) return
    var tries = 0
    var attempt = function () {
      var maxScroll = document.body.scrollHeight - window.innerHeight
      if (maxScroll >= y || tries >= 30) {
        window.scrollTo(0, y)
        return
      }
      tries++
      requestAnimationFrame(attempt)
    }
    requestAnimationFrame(attempt)
  }

  // ---- directory picking ----
  function ensurePermission (handle) {
    return handle.queryPermission({ mode: 'read' }).then(function (perm) {
      if (perm === 'granted') return true
      if (perm === 'prompt') return handle.requestPermission({ mode: 'read' }).then(function (p) { return p === 'granted' })
      return false
    }).catch(function () { return false })
  }

  function hasPermission (handle) {
    return handle.queryPermission({ mode: 'read' }).then(function (p) { return p === 'granted' }).catch(function () { return false })
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
    var sorted = workspaces.slice().sort(function (a, b) {
      if (a.id === TEMP_WS_ID) return -1
      if (b.id === TEMP_WS_ID) return 1
      return naturalCompare(a.name, b.name)
    })
    sorted.forEach(function (ws) {
      var row = document.createElement('div')
      row.className = '__mdv_ws_row' + (ws.id === activeId ? ' __mdv-ws-active' : '')

      var label = document.createElement('span')
      label.className = '__mdv_ws_name'
      label.textContent = ws.name || '\u672a\u547d\u540d'
      label.title = ws.name || ''

      row.appendChild(label)
      row.addEventListener('click', function () { activateWorkspace(ws.id) })
      row.addEventListener('contextmenu', function (e) {
        e.preventDefault()
        showWorkspaceMenu(e.clientX, e.clientY, ws.id)
      })
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
    delete wsFilesCache[id]
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
      if (ws.kind === 'temp' || !ws.handle || typeof ws.handle.isSameEntry !== 'function') return Promise.resolve(null)
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
          kind: 'dir',
          files: [],
          open: [],
          active: '',
          rootPath: null
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

  function findTemp () {
    for (var i = 0; i < workspaces.length; i++) {
      if (workspaces[i].id === TEMP_WS_ID) return workspaces[i]
    }
    return null
  }

  function pickFile () {
    if (typeof window.showOpenFilePicker !== 'function') return
    window.showOpenFilePicker({
      multiple: true,
      types: [{
        description: 'Markdown',
        accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkdn', '.mkd', '.mdwn', '.mdtxt', '.mdtext', '.text'] }
      }]
    }).then(function (handles) {
      return handlePickedFiles(handles)
    }).catch(function () {})
  }

  function handlePickedFiles (handles) {
    var chain = Promise.resolve()
    handles.forEach(function (h) {
      chain = chain.then(function () { return addOpenedFile(h) })
    })
    return chain
  }

  function findInFileMap (map, fileHandle) {
    var entries = Array.from(map.entries())
    var i = 0
    function next () {
      if (i >= entries.length) return Promise.resolve(null)
      var e = entries[i++]
      var h = e[1]
      if (typeof h.isSameEntry !== 'function') return next()
      return h.isSameEntry(fileHandle).then(function (same) { return same ? e[0] : next() }).catch(function () { return next() })
    }
    return next()
  }

  function findInDir (ws, fileHandle) {
    return hasPermission(ws.handle).then(function (ok) {
      if (!ok) return null
      return collect(ws.handle, '', []).then(function (files) {
        var i = 0
        function next () {
          if (i >= files.length) return Promise.resolve(null)
          var f = files[i++]
          if (typeof f.handle.isSameEntry !== 'function') return next()
          return f.handle.isSameEntry(fileHandle).then(function (same) { return same ? f.path : next() }).catch(function () { return next() })
        }
        return next()
      })
    })
  }

  function findWorkspaceByFile (fileHandle) {
    var active = activeWs()
    var checkActive = (active && active.kind !== 'temp')
      ? findInFileMap(fileMap, fileHandle).then(function (rel) { return rel ? { ws: active, rel: rel } : null })
      : Promise.resolve(null)

    return checkActive.then(function (found) {
      if (found) return found
      var dirs = workspaces.filter(function (w) { return w.kind !== 'temp' && w !== active })
      var i = 0
      function next () {
        if (i >= dirs.length) return Promise.resolve(null)
        var ws = dirs[i++]
        return findInDir(ws, fileHandle).then(function (rel) {
          return rel ? { ws: ws, rel: rel } : next()
        })
      }
      return next()
    })
  }

  function findInTemp (temp, fileHandle) {
    var i = 0
    function next () {
      if (i >= temp.files.length) return Promise.resolve(null)
      var f = temp.files[i++]
      if (typeof f.handle.isSameEntry !== 'function') return next()
      return f.handle.isSameEntry(fileHandle).then(function (same) { return same ? f : next() }).catch(function () { return next() })
    }
    return next()
  }

  function addToTemp (fileHandle) {
    var temp = findTemp()
    if (!temp) {
      temp = { id: TEMP_WS_ID, name: '\u4e34\u65f6\u5de5\u4f5c\u7a7a\u95f4', kind: 'temp', files: [], open: [], active: '' }
      workspaces.push(temp)
    }
    return findInTemp(temp, fileHandle).then(function (existing) {
      if (existing) {
        activeId = temp.id
        temp.active = existing.id
      } else {
        var entry = {
          id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: fileHandle.name || '\u672a\u547d\u540d',
          handle: fileHandle
        }
        temp.files.push(entry)
        activeId = temp.id
        temp.active = entry.id
      }
      scrollToActive = true
      return persistWorkspaces().then(function () {
        renderWorkspaces()
        return listTree()
      })
    })
  }

  function addOpenedFile (fileHandle) {
    return findWorkspaceByFile(fileHandle).then(function (match) {
      if (match) {
        activeId = match.ws.id
        match.ws.active = match.rel
        if (!match.ws.open) match.ws.open = []
        ancestorDirs(match.rel).forEach(function (d) {
          if (match.ws.open.indexOf(d) < 0) match.ws.open.push(d)
        })
        scrollToActive = true
        return persistWorkspaces().then(function () {
          renderWorkspaces()
          return listTree()
        })
      }
      return addToTemp(fileHandle)
    })
  }

  function addCurrentToTemp () {
    var url = location.href
    var name = currentFilePath().split('/').filter(Boolean).pop() || '\u672a\u547d\u540d'
    var temp = findTemp()
    if (!temp) {
      temp = { id: TEMP_WS_ID, name: '\u4e34\u65f6\u5de5\u4f5c\u7a7a\u95f4', kind: 'temp', files: [], open: [], active: '' }
      workspaces.push(temp)
    }
    var existing = null
    for (var i = 0; i < temp.files.length; i++) {
      if (temp.files[i].url === url) { existing = temp.files[i]; break }
    }
    if (existing) {
      temp.active = existing.id
    } else {
      var entry = {
        id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name,
        url: url
      }
      temp.files.push(entry)
      temp.active = entry.id
    }
    activeId = temp.id
    scrollToActive = true
    return persistWorkspaces().then(function () {
      renderWorkspaces()
      return listTree().then(function () { return true })
    })
  }

  function currentFilePath () {
    var p = location.pathname
    try { p = decodeURIComponent(p) } catch (e) {}
    return p
  }

  function ancestorDirs (relPath) {
    var parts = relPath.split('/')
    var dirs = []
    for (var i = 0; i < parts.length - 1; i++) {
      dirs.push(parts.slice(0, i + 1).join('/') + '/')
    }
    return dirs
  }

  function resolveUnder (dirHandle, relPath) {
    var parts = relPath.split('/').filter(Boolean)
    if (!parts.length) return Promise.resolve(false)
    function step (handle, idx) {
      if (idx === parts.length - 1) {
        return handle.getFileHandle(parts[idx]).then(function () { return true }).catch(function () { return false })
      }
      return handle.getDirectoryHandle(parts[idx]).then(function (sub) {
        return step(sub, idx + 1)
      }).catch(function () { return false })
    }
    return ensurePermission(dirHandle).then(function (ok) {
      return ok ? step(dirHandle, 0) : false
    })
  }

  function findCurrentWorkspace () {
    var segments = currentFilePath().split('/').filter(Boolean)
    if (!segments.length) return Promise.resolve(null)
    var i = 0
    function next () {
      if (i >= workspaces.length) return Promise.resolve(null)
      var ws = workspaces[i++]
      if (!ws.name) return next()
      if (ws.kind === 'temp' || !ws.handle) return next()
      var idx = -1
      for (var j = segments.length - 1; j >= 0; j--) {
        if (segments[j] === ws.name) { idx = j; break }
      }
      if (idx < 0 || idx === segments.length - 1) return next()
      var rel = segments.slice(idx + 1).join('/')
      if (!rel) return next()
      return resolveUnder(ws.handle, rel).then(function (ok) {
        return ok ? { ws: ws, rel: rel } : next()
      })
    }
    return next()
  }

  function quickFocus () {
    if (location.protocol !== 'file:') return Promise.resolve(false)
    var path = currentFilePath()
    if (!path || !MARKDOWN_RE.test(path)) return Promise.resolve(false)
    return findCurrentWorkspace().then(function (match) {
      if (!match) return addCurrentToTemp()
      var ws = match.ws
      activeId = ws.id
      ws.active = match.rel
      if (!ws.rootPath) {
        ws.rootPath = path.slice(0, -(match.rel.length + 1)) + '/'
      }
      if (!ws.open) ws.open = []
      ancestorDirs(match.rel).forEach(function (d) {
        if (ws.open.indexOf(d) < 0) ws.open.push(d)
      })
      scrollToActive = true
      return persistWorkspaces().then(function () {
        renderWorkspaces()
        return listTree().then(function () {
          restoreCurrentScroll()
          return true
        })
      })
    })
  }

  // ---- palette (Ctrl+P global file open) ----
  function scoreFile (f, q) {
    var name = f.name.toLowerCase()
    var idx = name.indexOf(q)
    if (idx === 0) return 0
    if (idx > 0) return 1
    var path = f.path.toLowerCase()
    if (path.indexOf(q) >= 0) return 2
    var i = 0
    for (var j = 0; j < name.length && i < q.length; j++) {
      if (name[j] === q[i]) i++
    }
    return i === q.length ? 3 : -1
  }

  function filterPalette (query) {
    var q = query.trim().toLowerCase()
    var out
    if (!q) {
      out = paletteResults.slice()
    } else {
      out = []
      paletteResults.forEach(function (f) {
        var s = scoreFile(f, q)
        if (s >= 0) out.push({ f: f, s: s })
      })
      out.sort(function (a, b) { return a.s - b.s || naturalCompare(a.f.name, b.f.name) })
      out = out.map(function (x) { return x.f })
    }
    return out.slice(0, 50)
  }

  function renderPalette () {
    var box = $('#__mdv_palette_results')
    box.textContent = ''
    paletteActiveIdx = 0
    var q = $('#__mdv_palette_input').value
    var results = filterPalette(q)
    if (!results.length) {
      var empty = document.createElement('div')
      empty.className = '__mdv_palette_empty'
      empty.textContent = paletteLoading ? '\u52a0\u8f7d\u4e2d\u2026' : (workspaces.length ? '\u65e0\u5339\u914d\u6587\u4ef6' : '\u5c1a\u65e0\u5de5\u4f5c\u7a7a\u95f4')
      box.appendChild(empty)
      return
    }
    results.forEach(function (f, i) {
      var row = document.createElement('div')
      row.className = '__mdv_palette_row' + (i === paletteActiveIdx ? ' __mdv_palette_active' : '')
      var name = document.createElement('span')
      name.className = '__mdv_palette_name'
      name.textContent = f.name
      var path = document.createElement('span')
      path.className = '__mdv_palette_path'
      path.textContent = f.ws.name + ' \u00b7 ' + f.path
      row.appendChild(name)
      row.appendChild(path)
      row.addEventListener('mousemove', function () { setPaletteActive(i) })
      row.addEventListener('click', function () { selectPaletteFile(f) })
      box.appendChild(row)
    })
  }

  function setPaletteActive (idx) {
    var rows = document.querySelectorAll('.__mdv_palette_row')
    if (idx < 0) idx = 0
    if (idx >= rows.length) idx = Math.max(0, rows.length - 1)
    paletteActiveIdx = idx
    Array.from(rows).forEach(function (r, i) {
      r.classList.toggle('__mdv_palette_active', i === idx)
    })
    if (rows[idx]) rows[idx].scrollIntoView({ block: 'nearest' })
  }

  function paletteSelection () {
    var results = filterPalette($('#__mdv_palette_input').value)
    if (!results.length) return null
    var idx = Math.max(0, Math.min(paletteActiveIdx, results.length - 1))
    return results[idx]
  }

  function selectPaletteFile (f) {
    closePalette()
    var ws = f.ws
    activeId = ws.id
    ws.active = ws.kind === 'temp' ? f.id : f.path
    if (ws.kind === 'dir') {
      if (!ws.open) ws.open = []
      ancestorDirs(f.path).forEach(function (d) {
        if (ws.open.indexOf(d) < 0) ws.open.push(d)
      })
    }
    scrollToActive = true
    persistWorkspaces().then(function () {
      renderWorkspaces()
      listTree()
    })
  }

  function gatherFiles () {
    var list = []
    var tasks = workspaces.map(function (ws) {
      if (ws.kind === 'temp') {
        (ws.files || []).forEach(function (f) {
          list.push({ id: f.id, path: f.url ? urlToPath(f.url) : f.name, name: f.name, ws: ws })
        })
        return Promise.resolve()
      }
      if (wsFilesCache[ws.id]) {
        wsFilesCache[ws.id].forEach(function (f) {
          list.push({ path: f.path, name: f.name, ws: ws })
        })
        return Promise.resolve()
      }
      return hasPermission(ws.handle).then(function (ok) {
        if (!ok) return
        return collect(ws.handle, '', []).then(function (files) {
          wsFilesCache[ws.id] = files
          files.forEach(function (f) {
            list.push({ path: f.path, name: f.name, ws: ws })
          })
        })
      })
    })
    return Promise.all(tasks).then(function () {
      return list.sort(function (a, b) { return naturalCompare(a.name, b.name) })
    })
  }

  function ensurePalette () {
    if (paletteEl) return
    paletteEl = document.createElement('div')
    paletteEl.id = '__mdv_palette'
    paletteEl.innerHTML =
      '<div id="__mdv_palette_box">' +
        '<input id="__mdv_palette_input" type="text" placeholder="\u641c\u7d22\u6587\u4ef6\u540d\uff08\u8de8\u5de5\u4f5c\u7a7a\u95f4\uff09\u2026">' +
        '<div id="__mdv_palette_results"></div>' +
      '</div>'
    document.body.appendChild(paletteEl)

    paletteEl.addEventListener('click', function (e) {
      if (e.target === paletteEl) closePalette()
    })

    $('#__mdv_palette_input').addEventListener('input', function () {
      renderPalette()
    })

    $('#__mdv_palette_input').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setPaletteActive(paletteActiveIdx + 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setPaletteActive(paletteActiveIdx - 1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        var f = paletteSelection()
        if (f) selectPaletteFile(f)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        closePalette()
      }
    })
  }

  function openPalette () {
    ensurePalette()
    paletteEl.style.display = 'flex'
    $('#__mdv_palette_input').value = ''
    $('#__mdv_palette_input').focus()
    paletteLoading = true
    renderPalette()
    gatherFiles().then(function (files) {
      paletteResults = files
      paletteLoading = false
      renderPalette()
    })
  }

  function closePalette () {
    if (paletteEl) paletteEl.style.display = 'none'
  }

  // ---- find (Cmd+F) + workspace grep ----
  function escapeRegExp (s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function clearFind () {
    var root = currentContentRoot()
    if (root) {
      root.querySelectorAll('mark.__mdv_find').forEach(function (mark) {
        var parent = mark.parentNode
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent), mark)
          parent.normalize()
        }
      })
    }
    findMatches = []
    findIdx = -1
  }

  function highlightMatches (root, query) {
    var textNodes = []
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    var node
    while ((node = walker.nextNode())) textNodes.push(node)
    if (!query) return []
    var matches = []
    var re = new RegExp(escapeRegExp(query), 'gi')
    textNodes.forEach(function (tn) {
      var parent = tn.parentNode
      if (!parent) return
      var text = tn.nodeValue
      var frag = document.createDocumentFragment()
      var lastIndex = 0
      var m
      re.lastIndex = 0
      while ((m = re.exec(text))) {
        if (m.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)))
        var mark = document.createElement('mark')
        mark.className = '__mdv_find'
        mark.textContent = m[0]
        frag.appendChild(mark)
        matches.push(mark)
        lastIndex = m.index + m[0].length
        if (m[0].length === 0) re.lastIndex++
      }
      if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)))
      if (lastIndex > 0) parent.replaceChild(frag, tn)
    })
    return matches
  }

  function doFind (query) {
    clearFind()
    var root = currentContentRoot()
    if (!root || !query) return
    findMatches = highlightMatches(root, query)
    findIdx = findMatches.length ? 0 : -1
    updateFindCurrent()
  }

  function updateFindCurrent () {
    findMatches.forEach(function (m, i) {
      m.classList.toggle('__mdv_find_current', i === findIdx)
    })
    if (findMatches[findIdx]) findMatches[findIdx].scrollIntoView({ block: 'center' })
    var countEl = findbarEl && findbarEl.querySelector('.__mdv_find_count')
    if (countEl) countEl.textContent = findMatches.length ? (findIdx + 1) + '/' + findMatches.length : '0/0'
  }

  function findNext (delta) {
    if (!findMatches.length) return
    findIdx = (findIdx + delta + findMatches.length) % findMatches.length
    updateFindCurrent()
  }

  function ensureFindbar () {
    if (findbarEl) return
    findbarEl = document.createElement('div')
    findbarEl.id = '__mdv_findbar'
    findbarEl.innerHTML =
      '<input id="__mdv_find_input" type="text" placeholder="\u67e5\u627e\u2026">' +
      '<span class="__mdv_find_count">0/0</span>' +
      '<button id="__mdv_find_prev" type="button">\u2191</button>' +
      '<button id="__mdv_find_next" type="button">\u2193</button>' +
      '<button id="__mdv_find_close" type="button">\u00d7</button>'
    document.body.appendChild(findbarEl)

    findbarEl.querySelector('#__mdv_find_input').addEventListener('input', function (e) {
      doFind(e.target.value)
    })
    findbarEl.querySelector('#__mdv_find_input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); findNext(e.shiftKey ? -1 : 1) }
      else if (e.key === 'Escape') { e.preventDefault(); closeFind() }
    })
    findbarEl.querySelector('#__mdv_find_prev').addEventListener('click', function () { findNext(-1) })
    findbarEl.querySelector('#__mdv_find_next').addEventListener('click', function () { findNext(1) })
    findbarEl.querySelector('#__mdv_find_close').addEventListener('click', closeFind)
  }

  function openFind (query) {
    ensureFindbar()
    findbarEl.style.display = 'flex'
    var input = findbarEl.querySelector('#__mdv_find_input')
    if (query != null) input.value = query
    input.focus()
    input.select()
    doFind(input.value)
  }

  function closeFind () {
    clearFind()
    if (findbarEl) findbarEl.style.display = 'none'
  }

  function grepFiles (query) {
    var q = query.toLowerCase()
    var files = []
    workspaces.forEach(function (ws) {
      if (ws.kind === 'temp') {
        (ws.files || []).forEach(function (f) {
          if (f.handle) files.push({ id: f.id, path: f.name, name: f.name, handle: f.handle, ws: ws })
        })
      } else if (wsFilesCache[ws.id]) {
        wsFilesCache[ws.id].forEach(function (f) {
          files.push({ path: f.path, name: f.name, handle: f.handle, ws: ws })
        })
      }
    })
    var results = []
    var i = 0
    function next () {
      if (i >= files.length) return Promise.resolve(results)
      var f = files[i++]
      return f.handle.getFile().then(function (file) { return file.text() }).then(function (text) {
        text.split('\n').forEach(function (line, li) {
          var idx = line.toLowerCase().indexOf(q)
          if (idx >= 0) results.push({ file: f, lineNo: li + 1, line: line, idx: idx })
        })
        return next()
      }).catch(function () { return next() })
    }
    return next()
  }

  function renderGrepResults (results) {
    var box = $('#__mdv_search_results')
    box.textContent = ''
    if (!results.length) {
      box.innerHTML = '<div class="__mdv_grep_empty">\u65e0\u5339\u914d\u7ed3\u679c</div>'
      return
    }
    var q = $('#__mdv_search_input').value
    results.slice(0, 200).forEach(function (r) {
      var row = document.createElement('div')
      row.className = '__mdv_grep_row'
      var name = document.createElement('div')
      name.className = '__mdv_grep_name'
      name.textContent = r.file.name + ':' + r.lineNo
      var snippet = document.createElement('div')
      snippet.className = '__mdv_grep_snippet'
      var before = r.line.slice(0, r.idx)
      var match = r.line.slice(r.idx, r.idx + q.length)
      var after = r.line.slice(r.idx + q.length)
      snippet.appendChild(document.createTextNode(before))
      var mk = document.createElement('mark')
      mk.textContent = match
      snippet.appendChild(mk)
      snippet.appendChild(document.createTextNode(after))
      row.appendChild(name)
      row.appendChild(snippet)
      row.addEventListener('click', function () { openGrepResult(r, q) })
      box.appendChild(row)
    })
  }

  function openGrepResult (r, query) {
    setSideMode('files')
    var ws = r.file.ws
    activeId = ws.id
    ws.active = ws.kind === 'temp' ? r.file.id : r.file.path
    if (ws.kind === 'dir') {
      if (!ws.open) ws.open = []
      ancestorDirs(r.file.path).forEach(function (d) {
        if (ws.open.indexOf(d) < 0) ws.open.push(d)
      })
    }
    scrollToActive = true
    forceInlineOpen = true
    persistWorkspaces().then(function () {
      renderWorkspaces()
      listTree().then(function () {
        forceInlineOpen = false
        openFind(query)
      })
    })
  }

  // ---- sidebar UI ----
  function setSideMode (mode) {
    sideMode = mode
    $('#__mdv_tab_files').classList.toggle('active', mode === 'files')
    $('#__mdv_tab_outline').classList.toggle('active', mode === 'outline')
    $('#__mdv_tab_search').classList.toggle('active', mode === 'search')
    $('#__mdv_tree_wrap').style.display = mode === 'files' ? '' : 'none'
    $('#__mdv_outline').style.display = mode === 'outline' ? '' : 'none'
    $('#__mdv_search').style.display = mode === 'search' ? 'flex' : 'none'
    if (mode === 'outline') buildOutline()
    if (mode === 'search') $('#__mdv_search_input').focus()
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
        return { id: w.id, name: w.name, handle: w.handle, kind: w.kind || 'dir', files: w.files || [], open: w.open || [], active: w.active || '', rootPath: w.rootPath || null }
      })
      activeId = data.active || null
      scrollPositions = data.scroll || {}
      fileTabs = data.tabs || []
      if (activeId && !activeWs()) activeId = workspaces.length ? workspaces[0].id : null
      renderWorkspaces()
      renderFileTabs()
      return quickFocus()
    }).then(function (focused) {
      if (focused) return
      var handle = activeHandle()
      if (!handle) { listTree(); return }
      return ensurePermission(handle).then(function (ok) {
        if (ok) return listTree()
        showGrant(true)
      })
    }).catch(function () {
      document.body.classList.add('__mdv-sidebar-on')
    })

    document.body.classList.add('__mdv-sidebar-on')
    bar.classList.remove('__mdv-hidden')
    enhanceCodeBlocks(document.getElementById('_html'))
    enhanceTables(document.getElementById('_html'))
    ensureLightbox()
    ensureBreadcrumb()
    ensureTopButton()
    updateBreadcrumb()
    updateReadingStats()
    refreshSpy()
    updateProgress()
  }

  $('#__mdv_pick').addEventListener('click', pickDirectory)
  $('#__mdv_file_pick').addEventListener('click', pickFile)
  $('#__mdv_tmp_note').addEventListener('click', function () {
    location.href = TMP_NOTE_URL
  })
  $('#__mdv_grant').addEventListener('click', function () {
    var handle = activeHandle()
    if (handle) ensurePermission(handle).then(function (ok) { if (ok) listTree() })
  })
  toggle.addEventListener('click', toggleSidebar)
  $('#__mdv_tab_files').addEventListener('click', function () { setSideMode('files') })
  $('#__mdv_tab_outline').addEventListener('click', function () { setSideMode('outline') })
  $('#__mdv_tab_search').addEventListener('click', function () { setSideMode('search') })
  $('#__mdv_expand').addEventListener('click', toggleExpandAll)
  $('#__mdv_zen').addEventListener('click', function () { setZen(true) })
  $('#__mdv_export').addEventListener('click', function (e) {
    e.stopPropagation()
    showExportMenu(e.currentTarget)
  })
  document.addEventListener('click', function (e) {
    if (exportMenuEl && exportMenuEl.style.display !== 'none' && !exportMenuEl.contains(e.target)) hideExportMenu()
  })

  var grepTimer = null
  $('#__mdv_search_input').addEventListener('input', function (e) {
    clearTimeout(grepTimer)
    var q = e.target.value.trim()
    if (!q) {
      $('#__mdv_search_results').innerHTML = '<div class="__mdv_grep_empty">\u8f93\u5165\u5185\u5bb9\u641c\u7d22\u6587\u4ef6\u2026</div>'
      return
    }
    $('#__mdv_search_results').innerHTML = '<div class="__mdv_grep_empty">\u641c\u7d22\u4e2d\u2026</div>'
    grepTimer = setTimeout(function () {
      grepFiles(q).then(function (results) {
        renderGrepResults(results)
      })
    }, 350)
  })
  $('#__mdv_tree').addEventListener('contextmenu', function (e) {
    var row = e.target.closest('.__mdv_row')
    if (!row) return
    var path = row.getAttribute('data-copy-path')
    if (!path) return
    e.preventDefault()
    showContextMenu(e.clientX, e.clientY, absPath(path))
  })
  document.addEventListener('click', hideContextMenu)
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hideContextMenu(); hideExportMenu() } })
  document.addEventListener('scroll', hideContextMenu, true)
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault()
      openPalette()
    }
  })
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      openFind()
    }
  })
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      setZen(!zenOn)
    }
  })
  window.addEventListener('scroll', function () {
    updateScrollSpy()
    updateProgress()
    if (topBtnEl) topBtnEl.classList.toggle('__mdv-show', window.scrollY > 400)
    if (currentFileKey) {
      scrollPositions[currentFileKey] = window.scrollY || 0
      scheduleScrollSave()
    }
  })
  window.addEventListener('pagehide', function () {
    saveCurrentScroll()
    persistScroll()
  })
  $('#__mdv_outline').addEventListener('click', function (e) {
    var a = e.target.closest('a')
    if (!a) return
    var href = a.getAttribute('href')
    if (!href || href.charAt(0) !== '#') return
    e.preventDefault()
    var el = document.getElementById(href.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  // move the extension's original #_toc into the outline tab once it appears,
  // and enhance code blocks in the original page content as it renders
  new MutationObserver(function () {
    var toc = document.getElementById('_toc')
    var outline = $('#__mdv_outline')
    if (toc && toc.parentNode !== outline) {
      outline.appendChild(toc)
      toc.style.setProperty('display', 'block', 'important')
    }
    var html = document.getElementById('_html')
    if (html && html.querySelector('pre:not(.__mdv_code_block):not(.__mdv_mermaid)')) {
      enhanceCodeBlocks(html)
    }
    if (html && html.querySelector('table:not(.__mdv_table_done)')) {
      enhanceTables(html)
    }
  }).observe(document.body, { childList: true, subtree: true })

  // re-add line numbers after Prism highlights (highlighting replaces the code's
  // innerHTML, which discards the gutter added above)
  if (window.Prism && window.Prism.hooks) {
    window.Prism.hooks.add('complete', function (env) {
      var pre = env.element && env.element.parentNode
      if (pre && pre.nodeName === 'PRE') {
        pre.classList.add('__mdv_code_block')
        addLineNumbers(pre, env.element)
      }
    })
  }

  // open the lightbox when a content image is clicked
  document.addEventListener('click', function (e) {
    if (lightboxEl && lightboxEl.classList.contains('__mdv-open')) return
    var t = e.target
    if (!t || t.nodeName !== 'IMG') return
    if (t.closest('#__mdv_lightbox')) return
    if (!t.closest('#_html, #__mdv_content')) return
    var src = t.currentSrc || t.src
    if (src) openLightbox(src)
  })
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lightboxEl && lightboxEl.classList.contains('__mdv-open')) closeLightbox()
  })

  // file-tree keyboard navigation (↑/↓, Enter, ←/→, / filter)
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (sideMode !== 'files' || !sidebarOn) return
    if (lightboxEl && lightboxEl.classList.contains('__mdv-open')) return
    if (paletteEl && paletteEl.style.display !== 'none') return
    var t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

    if (e.key === '/') {
      e.preventDefault()
      openFilter()
      return
    }
    var rows = treeRows()
    if (!rows.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setTreeNav(treeNavIdx < 0 ? 0 : treeNavIdx + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setTreeNav(treeNavIdx < 0 ? rows.length - 1 : treeNavIdx - 1)
    } else if (e.key === 'Enter') {
      if (treeNavIdx >= 0 && rows[treeNavIdx]) { e.preventDefault(); activateRow(rows[treeNavIdx]) }
    } else if (e.key === 'ArrowLeft') {
      if (treeNavIdx >= 0 && rows[treeNavIdx]) { e.preventDefault(); navLeft() }
    } else if (e.key === 'ArrowRight') {
      if (treeNavIdx >= 0 && rows[treeNavIdx]) { e.preventDefault(); navRight() }
    }
  })

  init()
})()
