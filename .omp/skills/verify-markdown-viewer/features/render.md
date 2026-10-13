# Render markdown

The extension detects a markdown document and replaces the plain `<pre>` with
themed HTML: headings with anchor links, paragraphs, emphasis, lists, links,
fenced code blocks, and blockquotes, plus an embedded sidebar on the left.

## Sub-features

- `render-heading` renders H1/H2 with anchor links.
- `render-inline` renders bold and links.
- `render-list` renders bullet lists.
- `render-code` renders a fenced code block.
- `render-sidebar` injects the sidebar for the rendered page.

## How to get to it (user POV)

- Open a `.md` file on a `file://` URL while the extension is loaded and file
  access is granted.
- Open a markdown document on an enabled remote origin.

## Driving it with run.mjs

Preconditions:

- `launch.sh` state file in `$STATE`, `doctor.sh "$STATE"` all `PASS`.
- `FIX=$(python3 -c "import json;print(json.load(open('$STATE'))['fixtures'])")`.

- **Open the file.** Navigate to the fixture and wait for injection. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --eval 'JSON.stringify({ h1: document.querySelector("h1")?.textContent })'`.
  The `eval` field is `{"h1":"Hello Markdown Viewer"}`.
- **Headings and anchors.** Evaluate heading text and anchor presence. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --eval 'JSON.stringify({ h1: document.querySelector("h1")?.textContent, h2: document.querySelector("h2")?.textContent, anchors: document.querySelectorAll("h1 .anchor").length })'`.
  The `eval` field is `{"h1":"Hello Markdown Viewer","h2":"Second Section","anchors":1}`.
- **Inline and list.** Count bold phrases and list items. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --eval 'JSON.stringify({ strong: document.querySelectorAll("strong").length, li: document.querySelectorAll("li").length })'`.
  The `eval` field is `{"strong":1,"li":3}`.
- **Code block.** Confirm the fenced block rendered as `pre code`. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --eval 'JSON.stringify({ code: document.querySelectorAll("pre code").length })'`.
  The `eval` field is `{"code":1}`.
- **Sidebar.** Confirm the sidebar root and default theme. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --eval 'JSON.stringify({ sidebar: !!document.getElementById("__mdv_sidebar"), theme: document.body.className })'`.
  The `eval` field contains `"sidebar":true` and a class list with
  `_theme-github` and `_color-light`.
- **Proof.** Capture the rendered state. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --shot "$ART/render/hello.png" --eval 'JSON.stringify({ h1: document.querySelector("h1")?.textContent, h2: document.querySelector("h2")?.textContent, strong: document.querySelectorAll("strong").length, li: document.querySelectorAll("li").length, anchors: document.querySelectorAll("h1 .anchor").length, sidebar: !!document.getElementById("__mdv_sidebar") })'`
  where `ART` is the `artifacts` dir from `state.json`. The PNG and the `eval`
  values identify the rendered headings, list, and sidebar.

## Gotchas

- The content script injects after the tab loads. Always `--wait-ms 3000`
  before asserting on a markdown file.
- Do not assert on `window.state`; it is in the content script's world and
  reads `undefined` from the page.
- The `.md` extension must match the path regexp; a file named `hello.txt` with
  markdown content only renders if header detection also matches.
- File access is granted automatically under CfT. Branded Chrome ignores
  `--load-extension`, so a render there proves nothing.
