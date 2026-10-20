# Contributing

- Content about the kit lives in the kit repository. Fix it there, then run
  `npm run sync-kit` here; a hand edit inside an AUTOGEN block is overwritten
  on the next sync and fails `--check` in the meantime.
- Design tokens live in `src/styles/global.css`. The three status colours mean
  what the signals mean (ready, needs-work, blocked) and blue marks the human
  gate; do not reuse them decoratively.
- Keep the site static: no runtime JavaScript beyond `CodeBlock`'s copy
  button. CI fails a build whose gzipped JS exceeds 50 KB.
- Before a PR: `npm run check && npm run build`.
