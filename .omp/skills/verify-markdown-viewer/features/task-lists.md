# Task lists

GFM task lists (`- [ ]` / `- [x]`) render as interactive checkboxes. Clicking a
checkbox flips the `[ ]`/`[x]` marker in the markdown source. Rendering the
checkboxes requires the `tasklists` compiler option (markdown-it), while the
`marked` and `remark` compilers render them automatically.

## Sub-features

- `task-render` renders `- [ ]`/`- [x]` as checkboxes.
- `task-toggle` flips the checkbox and the matching source marker.
- `task-persist` writes the updated source back to disk (workspace mode only).

## How to get to it (user POV)

- Open a markdown file containing `- [ ]` / `- [x]` lines.
- On markdown-it, enable `tasklists` in the popup Compiler tab first; marked and
  remark need no option.
- Click a checkbox to check or uncheck it.

## Driving it with run.mjs

Preconditions:

- `launch.sh` state file in `$STATE`, `doctor.sh "$STATE"` all `PASS`.
- `EXT_ID=$(python3 -c "import json;print(json.load(open('$STATE'))['extensionId'])")`.
- Rendered view (`raw=false`), which is the default.

- **Fixture.** Create a task-list file. Run
  `printf -- '# Tasks\n\n- [x] done item\n- [ ] todo item\n' > /tmp/mdv-task/tasks.md`.
- **Enable tasklists.** Open the popup Compiler tab and check `tasklists`. Run
  `node scripts/run.mjs --state "$STATE" --url "chrome-extension://$EXT_ID/popup/index.html" --wait-ms 1500 --eval '(() => { const t = document.querySelector("a[href=\"#tab-compiler\"]"); if (t) t.click(); const cb = Array.from(document.querySelectorAll("input[type=checkbox]")).find(x => x.name === "tasklists"); if (cb && !cb.checked) cb.click(); return cb ? cb.checked : "missing" })()'`.
  The `eval` field is `true`. `"missing"` means the compiler is marked or remark
  and renders task lists without this option.
- **Interactive checkboxes.** Load the fixture and read the checkbox states. Run
  `node scripts/run.mjs --state "$STATE" --url "file:///tmp/mdv-task/tasks.md" --wait-ms 4000 --eval 'JSON.stringify(Array.from(document.querySelectorAll("li input[type=checkbox]")).map(cb => ({ disabled: cb.disabled, checked: cb.checked })))'`.
  The `eval` field is `[{"disabled":false,"checked":true},{"disabled":false,"checked":false}]`.
- **Toggle.** Click the second checkbox and confirm the source marker flips. Run
  `node scripts/run.mjs --state "$STATE" --url "file:///tmp/mdv-task/tasks.md" --wait-ms 4000 --eval '(() => { const b = document.querySelectorAll("li input[type=checkbox]")[1]; b.click(); return JSON.stringify({ checked: b.checked, source: document.querySelector("pre")?.textContent }) })()`.
  The `eval` field has `"checked":true` and `source` containing
  `- [x] todo item`.
- **Proof.** Capture the toggled state. Run
  `node scripts/run.mjs --state "$STATE" --url "file:///tmp/mdv-task/tasks.md" --wait-ms 4000 --shot "$ART/task-lists/tasks.png" --eval 'JSON.stringify({ disabled: Array.from(document.querySelectorAll("li input[type=checkbox]")).filter(cb => cb.disabled).length })'`
  where `ART` is the `artifacts` dir from `state.json`.

## Gotchas

- `tasklists` defaults to `false` on markdown-it; without it `- [ ]` renders as
  literal `[ ]` text, not a checkbox, and there is nothing to click.
- `marked` and `remark` render task lists via GFM and have no `tasklists`
  option; the enable step reports `"missing"` for them, which is expected.
- The raw view shows the markdown source, not rendered checkboxes. Ensure
  `raw=false` (the default) before driving this feature.
- The checkbox selector is `li input[type=checkbox]`, which matches all three
  compilers. Do not use the markdown-it-only `.task-list-item-checkbox` class.
- Disk write-back needs a workspace `FileSystemFileHandle` (folder picker); it
  is not headless-driveable. The in-page toggle and source flip are.
