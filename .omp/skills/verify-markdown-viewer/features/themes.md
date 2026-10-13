# Themes

The extension renders markdown with a selectable theme. The default is `github`
(light); switching the theme changes the page's `_theme-<name>` and
`_color-light|dark` classes and the applied stylesheet.

## Sub-features

- `theme-switch` changes the active theme via the popup.
- `theme-color` sets `_color-light` or `_color-dark` to match the theme.

## How to get to it (user POV)

- Click the extension icon to open the popup, then choose a theme from the
  first select.

## Driving it with run.mjs

Preconditions:

- A fresh `launch.sh` state file in `$STATE` (do not reuse an instance that has
  already loaded a markdown URL), `doctor.sh "$STATE"` all `PASS`.
- `FIX=$(python3 -c "import json;print(json.load(open('$STATE'))['fixtures'])")`
  and `EXT_ID=$(python3 -c "import json;print(json.load(open('$STATE'))['extensionId'])")`.
- The baseline is the default `github` theme; there is no need to load the file
  first to observe it.

- **Switch theme.** Open the popup and change the first select to `water-dark`.
  Run
  `node scripts/run.mjs --state "$STATE" --url "chrome-extension://$EXT_ID/popup/index.html" --wait-ms 1500 --eval '(() => { const s = document.querySelector("select"); s.value = "water-dark"; s.dispatchEvent(new Event("change", { bubbles: true })); return s.value })()'`.
  The `eval` field is `"water-dark"`.
- **Observe the re-render.** Load the markdown file as this instance's only
  markdown navigation and read the body class. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --eval 'JSON.stringify({ theme: document.body.className })'`.
  The `eval` field contains `_theme-water-dark` and `_color-dark`.
- **Proof.** Capture the rendered `water-dark` state. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --shot "$ART/themes/water-dark.png" --eval 'JSON.stringify({ theme: document.body.className })'`
  where `ART` is the `artifacts` dir from `state.json`. The PNG and the `eval`
  value show the `water-dark` theme applied.

## Gotchas

- Theme switching goes through the popup select, not `chrome.storage` setters.
  The select's `value` is the theme slug; dispatch `change`, not `input`.
- The theme re-render only happens on a fresh load. Load the markdown file once,
  after the popup change, and never load it twice in the same instance (a second
  markdown navigation or an F5 reload does not re-inject the content script).
- The popup label for the raw toggle is uppercased by CSS (`MARKDOWN`/`HTML`);
  do not confuse it with the theme select, which is the first `select` element.
- The active theme is per-browser-profile storage. A fresh instance restores the
  `github` default, so no explicit restore step is needed.
