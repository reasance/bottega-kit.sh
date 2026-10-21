# Contributing

- Content about the kit lives in the kit repository. Fix it there, then run
  `npm run sync-kit` here; a hand edit inside an AUTOGEN block is overwritten
  on the next sync and fails `--check` in the meantime.
- Design tokens live in `src/styles/global.css`: soot, coal and cream, a serif
  for display, a monospace for anything the kit prints. The three status
  colours mean what the signals mean (ready, needs-work, blocked) and blue
  marks the human gate; do not reuse them decoratively. A `.band` section
  inverts to cream; every token has its on-cream counterpart.
- Keep the site static: no runtime JavaScript beyond `CodeBlock`'s copy
  button. CI fails a build whose gzipped JS exceeds 50 KB.
- Before a PR: `npm run check && npm run build`.
