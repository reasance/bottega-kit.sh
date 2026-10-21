# bottega-kit.sh

Showcase and docs site for [`bottega-kit`](https://github.com/matteoscurati/bottega-kit):
a planner, an implementer, a reviewer and an optional judge on the coding
agents you already have, Claude Code and Codex, one role each, in a git
worktree, with a receipt for every step.

Built with **Astro 5** + **Tailwind v4** + **TypeScript**. Static-only output.
The only runtime JavaScript is the copy button on code blocks. The loop
diagram on the home page is inline SVG. Fonts (Instrument Serif, Instrument
Sans, JetBrains Mono) are self-hosted from the `@fontsource` packages: no
request leaves the site but the analytics beacon.

## What the site shows, and where it comes from

Everything that describes the kit is generated from the kit checkout, never
written by hand here:

| on the site                                                                                                  | source in `../bottega-kit`                                                              |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| version and release date in the footer and the hero                                                          | `package.json`, `CHANGELOG.md`                                                          |
| the starter configuration, the effort sets, the default round cap, the exit codes, the harness argv per role | `bin/lib/bottega/config.py`, `util.py`, `harness/__init__.py`, imported through python3 |
| `/docs/` (the README), `/docs/process`, `/docs/configuration`, `/docs/compatibility`, `/docs/later`          | `README.md`, `docs/*.md`                                                                |
| `/docs/prompts`                                                                                              | `templates/task.md`, `prompts/*.md`                                                     |
| `/changelog`                                                                                                 | `CHANGELOG.md`                                                                          |

`scripts/sync-kit.mjs` reads those files, asks python3 for the kit's tables
(an import of its modules, no command of the kit runs) and rewrites the synced
blocks between `<!-- BEGIN AUTOGEN -->` / `<!-- END AUTOGEN -->` markers. It
never dispatches a model.

```bash
npm run sync-kit                      # refresh from ../bottega-kit (or BOTTEGA_KIT_ROOT)
npm run sync-kit -- --check           # exit 1 if out of sync; skipped when the kit checkout is absent (CI)
npm run sync-kit -- --allow-unreleased  # from a checkout that is not at its clean release tag
```

`npm run build` runs the check first, then regenerates `public/og-image.png`
with `scripts/generate-og-image.mjs`: satori lays the card out in the site's
own fonts and sharp rasterises it, so the image is the same on every machine.

The home page (`src/pages/index.astro`) is the one hand-written description of
the kit: the copy there is reviewed at every release against the README.

## Develop

```bash
npm install
npm run dev       # http://localhost:4321
npm run check     # astro check: TypeScript + templates
npm run build     # static output in dist/
npm run preview
```

## Release sync

When the kit ships a version (its `CLAUDE.md`, "Release tagging", step "sync
the showcase site"): after the tag exists and npm serves the version,
`npm run sync-kit`, `npm run build`, commit, deploy.

## Deploy

Production runs on **Cloudflare Workers with Static Assets**, configured in
`wrangler.jsonc` (Worker `bottega-kit-sh`, assets from `dist/`). Until a custom
domain exists it is served at `https://bottega-kit-sh.8004dev.workers.dev`;
the origin is set in `astro.config.mjs` and `public/robots.txt`, and the
custom domain goes in `wrangler.jsonc` when there is one. Two ways to deploy,
same result:

- **From CI** — `.github/workflows/deploy.yml` builds and runs `wrangler
deploy` on every push to `main`. It needs the repository secrets
  `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit) and `CLOUDFLARE_ACCOUNT_ID`,
  and the optional variable `PUBLIC_CF_BEACON_TOKEN`.
- **From a machine** — `npx wrangler login` once, then `npm run deploy`
  (`npm run build && wrangler deploy`).

## Analytics

Cloudflare Web Analytics, through `src/components/CloudflareAnalytics.astro`.
Off unless `PUBLIC_CF_BEACON_TOKEN` is set at build time; see `.env.example`
and `/privacy`.

## Layout

```
src/
  components/   CodeBlock, Transcript, LoopDiagram, CloudflareAnalytics
  data/         kit.json  (generated)
  layouts/      BaseLayout, DocLayout
  pages/        index.astro, 404.astro, privacy.md, docs/*.md, changelog/index.md
  styles/       global.css (design tokens)
scripts/        sync-kit.mjs, generate-og-image.mjs
public/         favicon.svg, og-image.png (generated), prose.css, _headers, robots.txt
wrangler.jsonc  Workers Static Assets config
```

## License

MIT. Content synced from the kit repository is MIT there too.
