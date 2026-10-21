# Markdown Viewer verification map

This directory is the maintained source for verifying the user-facing behavior
of the Markdown Viewer extension. Read this index before driving the app, then
use the matching feature file as the recipe.

## Baseline preconditions

- `launch.sh` produced a state file; every recipe reads it via `$STATE`.
- `doctor.sh "$STATE"` reports all `PASS` and exit 0.
- The fixture `<fixtures>/hello.md` contains one H1, one H2, a bold phrase, a
  link, a three-item list, one `js` fenced code block, and a blockquote.
- Defaults are `theme=github`, `raw=false`, `content.syntax=true`. If a recipe
  changes a setting, it restores it before finishing.
- Never drive an instance that was not started by this verification run.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say
  otherwise.
- One `run.mjs` invocation is one user step. Assert on rendered DOM, not on
  `window.state`.
- Use stable handles: heading selectors `h1`/`h2`, `h1 .anchor`, the sidebar
  `#__mdv_sidebar` and `#__mdv_tab_outline`, `.token` for Prism spans, and
  `document.body.className` for the active theme/color.
- Popup-backed steps navigate the tab to `chrome-extension://$EXT_ID/popup/index.html`,
  mutate a control, then load the markdown file.
- After navigating to a markdown file, pass `--wait-ms 3000` so the content
  script has injected.
- Reload and re-navigation are safe: the content script re-injects on a second
  navigation and on F5. One instance can drive every feature; the render,
  syntax-highlighting, and outline recipes all assert on the same navigation.

## Proof and skip reporting

- Capture the action and the resulting state, not only the final screen.
- UI proof is a screenshot (`run.mjs --shot`) plus the `eval` field carrying the
  literal DOM values asserted.
- Mutation proof (theme, raw) includes the before control and the after state,
  observed by reopening the markdown file.
- Record the feature ID and entry point with every artifact.
- Report an unreachable path with the attempted command and the unmet
  precondition. Do not report a skipped entry point as verified through a
  different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the
user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with run.mjs` starts with `Preconditions:` and uses labeled
   bullets that pair each user action with an exact command and observable
   result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [Render markdown](./render.md) — the core `.md`-to-HTML render plus the
  embedded sidebar.
- [Syntax highlighting](./syntax-highlighting.md) — Prism token spans in fenced
  code blocks.
- [Outline](./outline.md) — the sidebar heading outline for the open file.
- [Themes](./themes.md) — switching the content theme via the popup.
- [Raw view](./raw-view.md) — toggling raw markdown vs rendered HTML via the
  popup.
- [Task lists](./task-lists.md) — interactive GFM task-list checkboxes that
  flip the `[ ]`/`[x]` marker in the source.

## Out of scope for automated drive

The workspace features (file tree, open workspace, cross-workspace search,
command palette, file tabs) require the File System Access API folder picker,
which needs a native dialog. These are not headless-driveable with this harness;
verify them manually or through the popup/options surfaces only where noted.

The task-list feature's disk write-back is also only manual: it persists through
a workspace `FileSystemFileHandle`, which requires the folder picker. The
interactive toggle itself (flipping `[ ]`/`[x]` in the source) is fully
headless-driveable and covered by `task-lists.md`.
