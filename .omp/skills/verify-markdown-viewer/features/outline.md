# Outline

The sidebar's Outline tab shows a heading outline of the currently open file,
with one link per heading and nesting that mirrors the heading levels. Clicking
a link scrolls to that heading.

## Sub-features

- `outline-list` lists every heading of the open file in the sidebar.
- `outline-nest` nests deeper headings under their parents.
- `outline-empty` shows an empty message for a file with no headings.

## How to get to it (user POV)

- On a rendered markdown page, click the sidebar tab labeled `大纲` (Outline).

## Driving it with run.mjs

Preconditions:

- `launch.sh` state file in `$STATE`, `doctor.sh "$STATE"` all `PASS`.
- `FIX=$(python3 -c "import json;print(json.load(open('$STATE'))['fixtures'])")`.

- **Open the outline.** Navigate to the file, click `#__mdv_tab_outline`, and
  read the outline links. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --eval '(() => { document.getElementById("__mdv_tab_outline").click(); return JSON.stringify({ links: Array.from(document.querySelectorAll("#__mdv_outline a")).map(a => a.textContent.trim()) }) })()'`.
  The `eval` field is
  `{"links":["Hello Markdown Viewer","Second Section"]}`.
- **Nesting.** Confirm the H2 nests one level deeper than the H1. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --eval '(() => { document.getElementById("__mdv_tab_outline").click(); const a = document.querySelector("#__mdv_outline a[href=\"#second-section\"]"); return JSON.stringify({ depth: (a.closest(\"._ul\")?.parentElement.querySelectorAll(\":scope > ._ul\").length) || 0, href: a.getAttribute(\"href\") }) })()'`.
  The `href` is `#second-section`.
- **Proof.** Capture the open outline. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --eval 'document.getElementById("__mdv_tab_outline").click()' --shot "$ART/outline/outline.png"`
  where `ART` is the `artifacts` dir from `state.json`.

## Gotchas

- The outline builds from the extension's `#_toc` element, moved into
  `#__mdv_outline`. Click `#__mdv_tab_outline` by id; matching the button by
  text `大纲` can select the wrong node.
- Headings without an id produce an empty `href`; the fixture's headings all
  get slug ids (`hello-markdown-viewer`, `second-section`).
- The outline appears only after the content script has injected; keep
  `--wait-ms 3000`.
