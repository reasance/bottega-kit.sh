#!/usr/bin/env node
// Regenerate public/og-image.png from public/og-image.svg.
//
// Twitter/X rejects SVG og:images; LinkedIn/Facebook render SVG inconsistently.
// We ship a PNG copy as the canonical og:image and keep the SVG as a small,
// hand-editable source of truth.
//
// Sharp is an Astro transitive dependency (used by Astro's image optimizer).
// If a future Astro release stops bundling sharp, add it as an explicit
// devDependency in package.json.

import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const svgPath = resolve(repoRoot, 'public', 'og-image.svg');
const pngPath = resolve(repoRoot, 'public', 'og-image.png');

const svg = await readFile(svgPath);
const buf = await sharp(svg, { density: 300 }).resize(1200, 630).png({ quality: 90 }).toBuffer();
await writeFile(pngPath, buf);

console.log(
  `og-image: ${relative(repoRoot, pngPath)} regenerated ` +
    `(${buf.byteLength.toLocaleString()} bytes)`
);
