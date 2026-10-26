# Contributing

- Content about the kit lives in the kit repository. Fix it there, then run
  `npm run sync-kit` here; a hand edit inside an AUTOGEN block is overwritten
  on the next sync and fails `--check` in the meantime.
- Design tokens live in `src/styles/global.css`: soot, coal and cream, a serif
  for display, a monospace for anything the kit prints. The three status
  colours mean what the signals mean (ready, needs-work, blocked) and blue
  marks the human gate; do not reuse them decoratively. A `.band` section
  inverts to cream; every token has its on-cream counterpart.
- The home page's copy is `src/data/copy.json`; the template in
  `src/pages/index.astro` only lays it out. Keep the fixed values (command
  names, stop reasons, role names, receipt files) and the placeholders as
  they are; the numbers come from the kit.
- Keep the site static: no runtime JavaScript beyond `CodeBlock`'s copy
  button and the home page's motion (`src/scripts/motion.ts`). The motion
  only reveals what the HTML already holds, and with JavaScript off or
  reduced motion on the page is its still, final self. CI fails a build
  whose gzipped JS exceeds 50 KB.
- Before a PR: `npm run check && npm run build`.
