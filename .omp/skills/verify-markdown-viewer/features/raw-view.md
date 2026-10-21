# Raw view

The extension can show the raw markdown source instead of the rendered HTML.
The popup's first button toggles this; when raw is on the page shows the source
in a `<pre>` with no rendered `<h1>`.

## Sub-features

- `raw-on` shows the markdown source as text.
- `raw-off` returns to rendered HTML.

## How to get to it (user POV)

- Click the extension icon to open the popup, then click the `MARKDOWN`/`HTML`
  button.

## Driving it with run.mjs

Preconditions:

- `launch.sh` state file in `$STATE`, `doctor.sh "$STATE"` all `PASS`.
- `FIX=$(python3 -c "import json;print(json.load(open('$STATE'))['fixtures'])")`
  and `EXT_ID=$(python3 -c "import json;print(json.load(open('$STATE'))['extensionId'])")`.
- The baseline is rendered view (`raw=false`); there is no need to load the file
  first to observe it.

- **Toggle raw on.** Open the popup and click the toggle button. Run
  `node scripts/run.mjs --state "$STATE" --url "chrome-extension://$EXT_ID/popup/index.html" --wait-ms 1500 --eval '(() => { const b = Array.from(document.querySelectorAll("button")).find(x => /MARKDOWN|HTML/.test(x.innerText.trim())); b.click(); return b.innerText.trim() })()'`.
  The `eval` field is `"HTML"`, meaning the view is now raw.
- **Observe raw.** Load the markdown file as this instance's only markdown
  navigation and read the body. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --eval 'JSON.stringify({ h1: !!document.querySelector("h1"), pre: !!document.querySelector("pre"), rawSource: document.body.innerText.includes("# Hello Markdown Viewer") })'`.
  The `eval` field has `"h1":false`, `"pre":true`, and `"rawSource":true`.
- **Proof.** Record the raw `eval` values and a screenshot at
  `$ART/raw-view/raw.png` showing the source text.

## Gotchas

- The popup button label reads `MARKDOWN` when the view is rendered and `HTML`
  when raw is on. It names the mode you would switch away from.
- The sidebar stays visible in raw mode; only the content area changes. Assert
  on `h1` absence and `pre` presence, not on the sidebar.
- Navigate to the markdown file after the popup toggle to observe the raw view.
  A fresh instance restores `raw=false`.
