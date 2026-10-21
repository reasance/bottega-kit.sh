#!/usr/bin/env node
// Regenerate public/og-image.png: the card shown when a link to the site is
// shared. Twitter/X rejects SVG og:images and other networks render SVG
// inconsistently, so the site ships a PNG.
//
// The card is laid out here with satori, which sets the text in the site's
// own fonts (the @fontsource packages the pages use, so no font has to be
// installed on the machine that builds) and emits an SVG of outlines; sharp
// rasterises it. The result is the same on every machine.
//
// Sharp is an Astro transitive dependency (its image optimizer). If a future
// Astro release stops bundling it, add it as a devDependency.

import satori from 'satori';
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const pngPath = resolve(repoRoot, 'public', 'og-image.png');
const kit = JSON.parse(await readFile(resolve(repoRoot, 'src', 'data', 'kit.json'), 'utf8'));

const fontFile = (pkg, file) =>
  readFile(resolve(repoRoot, 'node_modules', '@fontsource', pkg, 'files', file));
const fonts = [
  {
    name: 'Instrument Serif',
    weight: 400,
    style: 'normal',
    data: await fontFile('instrument-serif', 'instrument-serif-latin-400-normal.woff')
  },
  {
    name: 'Instrument Serif',
    weight: 400,
    style: 'italic',
    data: await fontFile('instrument-serif', 'instrument-serif-latin-400-italic.woff')
  },
  {
    name: 'JetBrains Mono',
    weight: 400,
    style: 'normal',
    data: await fontFile('jetbrains-mono', 'jetbrains-mono-latin-400-normal.woff')
  },
  {
    name: 'Instrument Sans',
    weight: 400,
    style: 'normal',
    data: await fontFile('instrument-sans', 'instrument-sans-latin-400-normal.woff')
  }
];

// The tokens of src/styles/global.css that the card uses.
const c = {
  soot: '#161210',
  coalDeep: '#0e0b09',
  line: '#332b25',
  lineStrong: '#5f544b',
  cream: '#f3ece0',
  creamSoft: '#b5a99a',
  ready: '#5fc48f',
  work: '#ecaa3c',
  you: '#a9b8ff'
};

const el = (type, style, children) => ({ type, props: { style, children } });
const text = (content, style = {}) => el('span', { whiteSpace: 'pre', ...style }, content);
const row = (children, style = {}) =>
  el('div', { display: 'flex', flexDirection: 'row', alignItems: 'center', ...style }, children);

const mono = { fontFamily: 'JetBrains Mono', fontSize: 21, lineHeight: 1.7, color: c.cream };
// The arrow the kit prints, U+2192, is in none of the Google subsets of the
// fonts; the browser falls back to a system font for it, satori cannot.
const arrow = el('svg', { width: 15, height: 12, viewBox: '0 0 15 12', marginRight: 6 }, [
  {
    type: 'path',
    props: {
      d: 'M0 6 H13.5 M8.5 1.5 L13 6 L8.5 10.5',
      stroke: c.cream,
      'stroke-width': 1.6,
      fill: 'none'
    }
  }
]);
const dispatch = (seq, role, profile, model, result, tone, time) =>
  row([
    text(seq, { color: c.creamSoft }),
    text(` ${role.padEnd(11)} ${profile.padEnd(13)} `),
    text(model.padEnd(17), { color: c.creamSoft }),
    arrow,
    text(result, { color: tone }),
    text(` (${time})`, { color: c.creamSoft })
  ]);

const card = el(
  'div',
  {
    width: 1200,
    height: 630,
    display: 'flex',
    flexDirection: 'column',
    background: c.soot,
    padding: '52px 60px 56px',
    fontFamily: 'Instrument Sans'
  },
  [
    // the brand row
    row(
      [
        el(
          'div',
          { position: 'relative', display: 'flex', width: 20, height: 20, marginRight: 14 },
          [
            el(
              'div',
              { width: 20, height: 20, border: `3px solid ${c.cream}`, borderRadius: 999 },
              []
            ),
            el(
              'div',
              {
                position: 'absolute',
                top: -5,
                right: -6,
                width: 9,
                height: 9,
                borderRadius: 999,
                background: c.you
              },
              []
            )
          ]
        ),
        text('bottega-kit', {
          fontFamily: 'Instrument Serif',
          fontSize: 34,
          color: c.cream,
          marginRight: 16
        }),
        el(
          'div',
          {
            display: 'flex',
            fontFamily: 'JetBrains Mono',
            fontSize: 16,
            color: c.creamSoft,
            border: `1px solid ${c.line}`,
            padding: '3px 8px'
          },
          [`v${kit.version}`]
        )
      ],
      { height: 40 }
    ),
    text('A CODING-AGENT LOOP ON YOUR OWN MACHINE · CLAUDE CODE + CODEX', {
      fontFamily: 'JetBrains Mono',
      fontSize: 14,
      color: c.creamSoft,
      marginTop: 18
    }),
    // the headline
    el(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        marginTop: 24,
        fontFamily: 'Instrument Serif',
        fontSize: 86,
        lineHeight: 1,
        color: c.cream,
        letterSpacing: -1
      },
      [
        text('You approve the plan.'),
        row([text('The agents do '), text('the rounds.', { fontStyle: 'italic', color: c.you })])
      ]
    ),
    // the transcript
    el(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        marginTop: 46,
        padding: '18px 26px',
        background: c.coalDeep,
        border: `1px solid ${c.lineStrong}`,
        ...mono
      },
      [
        row([text('$ ', { color: c.you }), text('bottega run dry-run-flag')]),
        dispatch('002', 'implementer', 'opus-builder', 'claude-opus-5-5', 'done', c.ready, '6m02s'),
        dispatch(
          '003',
          'reviewer',
          'opus-reviewer',
          'claude-opus-5-5',
          'needs-work',
          c.work,
          '2m14s'
        ),
        dispatch('004', 'implementer', 'opus-builder', 'claude-opus-5-5', 'done', c.ready, '3m40s'),
        dispatch('005', 'reviewer', 'opus-reviewer', 'claude-opus-5-5', 'ready', c.ready, '1m55s'),
        dispatch('006', 'judge', 'fable', 'claude-fable-5-1', 'ready', c.ready, '48s')
      ]
    )
  ]
);

const svg = await satori(card, { width: 1200, height: 630, fonts });
const buf = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
await writeFile(pngPath, buf);

console.log(
  `og-image: ${relative(repoRoot, pngPath)} regenerated (${buf.byteLength.toLocaleString()} bytes)`
);
