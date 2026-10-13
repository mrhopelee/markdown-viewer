# Syntax highlighting

Fenced code blocks get Prism syntax highlighting: the source is split into
`span.token` spans (keywords, strings, operators), and a copy button plus line
numbers are added to the block.

## Sub-features

- `syntax-tokenize` emits Prism token spans for a fenced code block.
- `syntax-disabled` leaves the block un-tokenized when `content.syntax` is off.

## How to get to it (user POV)

- Open a markdown file containing a ```js fenced code block with the default
  `syntax` content option enabled.

## Driving it with run.mjs

Preconditions:

- `launch.sh` state file in `$STATE`, `doctor.sh "$STATE"` all `PASS`.
- `FIX=$(python3 -c "import json;print(json.load(open('$STATE'))['fixtures'])")`.
- `content.syntax` is the default `true`.

- **Tokenize.** Count Prism spans and read the keyword span. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --eval 'JSON.stringify({ tokens: document.querySelectorAll(".token").length, keyword: document.querySelector(".token.keyword")?.textContent })'`.
  The `eval` field is `{"tokens":3,"keyword":"var"}`.
- **Code block present.** Confirm the block rendered as `pre code`. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --eval 'JSON.stringify({ code: document.querySelectorAll("pre code").length })'`.
  The `eval` field is `{"code":1}`.
- **Proof.** Capture the highlighted block. Run
  `node scripts/run.mjs --state "$STATE" --url "file://$FIX/hello.md" --wait-ms 3000 --shot "$ART/syntax/code.png" --eval 'JSON.stringify({ tokens: document.querySelectorAll(".token").length })'`
  where `ART` is the `artifacts` dir from `state.json`.

## Gotchas

- Token spans are added by `content/prism.js` after injection; wait the same
  `--wait-ms 3000` as for render.
- The `var hello = 'hi'` fixture yields exactly three `.token` spans. A
  different fixture changes that count; assert the count the fixture defines.
- `content.syntax` defaults to `true`. If a prior recipe disabled it, restore it
  before this one.
