#!/usr/bin/env node
// Sync the site from the bottega-kit checkout (source of truth).
//
// Reads (sibling repo, or BOTTEGA_KIT_ROOT):
//   package.json, CHANGELOG.md, README.md, docs/*.md, templates/task.md,
//   prompts/*.md, and the kit's own tables through python3: the version, the
//   effort sets, the roles, the exit codes, the starter configuration and the
//   harness matrix, imported from bin/lib. No command of the kit runs.
// Writes:
//   src/data/kit.json
//   the AUTOGEN block of src/pages/docs/*.md and src/pages/changelog/index.md
//
// Usage:
//   node scripts/sync-kit.mjs                     write everything
//   node scripts/sync-kit.mjs --check             exit 1 if out of sync (CI)
//   node scripts/sync-kit.mjs --allow-unreleased  sync from a checkout that is
//                                                 not at a clean release tag
//
// Syncs only from a clean kit checkout on the tag its package.json names;
// --check skips itself otherwise, so a refactor in progress next door cannot
// break or leak into the site. Nothing here dispatches a model or starts a
// harness: python3 imports the kit's modules and prints their tables.

import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, posix } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(__dirname, '..');
const kitRoot = resolve(process.env.BOTTEGA_KIT_ROOT ?? resolve(siteRoot, '..', 'bottega-kit'));
const isCheck = process.argv.includes('--check');
const allowUnreleased = process.argv.includes('--allow-unreleased');
const GITHUB = 'https://github.com/matteoscurati/bottega-kit';

const BEGIN = '<!-- BEGIN AUTOGEN -->';
const END = '<!-- END AUTOGEN -->';

function fail(message) {
  console.error(`sync-kit: ${message}`);
  process.exit(1);
}

try {
  await access(resolve(kitRoot, 'bin', 'bottega'));
} catch {
  if (isCheck) {
    console.log(`sync-kit: kit checkout not found at ${kitRoot}; skipping --check.`);
    process.exit(0);
  }
  fail(`kit checkout not found at ${kitRoot} (set BOTTEGA_KIT_ROOT)`);
}

// ---- release guard -----------------------------------------------------------
function readFileSyncSafe(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}
function kitReleaseState() {
  const run = (args) => {
    try {
      return execFileSync('git', ['-C', kitRoot, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
    } catch {
      return null;
    }
  };
  const version =
    JSON.parse(readFileSyncSafe(resolve(kitRoot, 'package.json')) ?? '{}').version ?? null;
  const dirty = run(['status', '--porcelain']);
  const tag = run(['describe', '--tags', '--exact-match', 'HEAD']);
  const expected = version ? `bottega-kit--v${version}` : null;
  const released = dirty === '' && tag !== null && tag === expected;
  return { version, dirty: dirty === null ? null : dirty !== '', tag, expected, released };
}
const state = kitReleaseState();
if (!state.released) {
  const why = state.dirty
    ? 'the checkout has uncommitted changes'
    : `HEAD is ${state.tag ?? 'not on a tag'}, expected ${state.expected ?? 'a release tag'}`;
  if (isCheck) {
    console.log(`sync-kit: kit checkout is not at a clean release (${why}); skipping --check.`);
    process.exit(0);
  }
  if (!allowUnreleased)
    fail(`kit checkout is not at a clean release (${why}); pass --allow-unreleased to sync anyway`);
  console.warn(`sync-kit: syncing from an unreleased kit state (${why}).`);
}

let drift = [];
async function emit(relPath, content) {
  const abs = resolve(siteRoot, relPath);
  let current = null;
  try {
    current = await readFile(abs, 'utf8');
  } catch {}
  if (current === content) return;
  if (isCheck) {
    drift.push(relPath);
    return;
  }
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content);
  console.log(`sync-kit: wrote ${relPath}`);
}

// ---- version + release date ---------------------------------------------------
const pkg = JSON.parse(await readFile(resolve(kitRoot, 'package.json'), 'utf8'));
const changelog = await readFile(resolve(kitRoot, 'CHANGELOG.md'), 'utf8');
const head = changelog.match(/^## \[([^\]]+)\] — (\d{4}-\d{2}-\d{2})/m);
if (!head) fail('CHANGELOG.md has no `## [version] — date` heading');
if (head[1] !== pkg.version) fail(`CHANGELOG head ${head[1]} != package.json ${pkg.version}`);

// ---- the kit's own tables, through python3 ------------------------------------
// An import of the kit's modules (standard library only), isolated from the
// user's site-packages and PYTHONPATH. The placeholders of the harness matrix
// are rendered as <model>, <effort> and so on.
const PY = `
import json, sys
sys.path.insert(0, sys.argv[1])
from bottega import config, util
from bottega.harness import HARNESS_MATRIX, PROXY_STRIPPED, matrix_argv
from bottega.version import __version__
values = {"model": "<model>", "effort": "<effort>", "task_dir": "<task dir>",
          "run_dir": "<run dir>", "worktree": "<worktree>", "bottega": "<bottega>"}
matrix = {h: {r: matrix_argv(h, r, values) for r in HARNESS_MATRIX[h]["roles"]}
          for h in sorted(HARNESS_MATRIX)}
print(json.dumps({
    "version": __version__,
    "harnesses": sorted(HARNESS_MATRIX),
    "binaries": config.HARNESS_BINARIES,
    "efforts": config.HARNESS_EFFORTS,
    "roles": list(config.ROLES),
    "requiredRoles": list(config.REQUIRED_ROLES),
    "defaultRounds": config.DEFAULT_ROUNDS,
    "profileKeys": sorted(config.PROFILE_KEYS),
    "exitCodes": {"ok": util.EXIT_OK, "refused": util.EXIT_REFUSED,
                  "stopped": util.EXIT_STOPPED, "usage": util.EXIT_USAGE},
    "proxyStripped": list(PROXY_STRIPPED),
    "starter": config.starter(["claude", "codex"]),
    "matrix": matrix,
}))
`;
let tables;
try {
  tables = JSON.parse(
    execFileSync('python3', ['-I', '-c', PY, resolve(kitRoot, 'bin', 'lib')], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  );
} catch (error) {
  fail(`python3 could not read the kit's tables: ${error.stderr?.trim() || error.message}`);
}
if (tables.version !== pkg.version)
  fail(`version.py ${tables.version} != package.json ${pkg.version}`);

const kit = { ...tables, releaseDate: head[2], syncedAt: head[2] };
await emit('src/data/kit.json', `${JSON.stringify(kit, null, 2)}\n`);

// ---- markdown docs ------------------------------------------------------------
const routeFor = {
  'README.md': '/docs/',
  'CHANGELOG.md': '/changelog/',
  'docs/process.md': '/docs/process/',
  'docs/configuration.md': '/docs/configuration/',
  'docs/compatibility.md': '/docs/compatibility/',
  'docs/later.md': '/docs/later/',
  'templates/task.md': '/docs/prompts/#the-task-template',
  'prompts/planner.md': '/docs/prompts/#the-planner-prompt',
  'prompts/implementer.md': '/docs/prompts/#the-implementer-prompt',
  'prompts/reviewer.md': '/docs/prompts/#the-reviewer-prompt',
  'prompts/judge.md': '/docs/prompts/#the-judge-prompt'
};

function rewriteLinks(markdown, sourcePath) {
  const sourceDir = posix.dirname(sourcePath);
  return markdown.replace(
    /\]\(((?:\.\.?\/)?[A-Za-z0-9_./-]+\.(?:md|json|toml|sh|py))(#[^)\s]*)?\)/g,
    (match, target, hash = '') => {
      if (/^[a-z]+:/.test(target)) return match;
      const kitPath = posix.normalize(posix.join(sourceDir, target));
      if (routeFor[kitPath]) return `](${routeFor[kitPath]}${hash})`;
      return `](${GITHUB}/blob/main/${kitPath}${hash})`;
    }
  );
}

async function syncBlock(sitePath, body) {
  const abs = resolve(siteRoot, sitePath);
  let page;
  try {
    page = await readFile(abs, 'utf8');
  } catch {
    fail(`missing page ${sitePath}; create it with the ${BEGIN} / ${END} markers first`);
  }
  const b = page.indexOf(BEGIN);
  const e = page.indexOf(END, b + BEGIN.length);
  if (b === -1 || e === -1) fail(`markers missing from ${sitePath}`);
  await emit(sitePath, `${page.slice(0, b + BEGIN.length)}\n\n${body.trimEnd()}\n\n${page.slice(e)}`);
}

async function syncDoc(sourcePath, sitePath) {
  const source = await readFile(resolve(kitRoot, sourcePath), 'utf8');
  await syncBlock(sitePath, rewriteLinks(source, sourcePath));
}

await syncDoc('README.md', 'src/pages/docs/index.md');
await syncDoc('docs/process.md', 'src/pages/docs/process.md');
await syncDoc('docs/configuration.md', 'src/pages/docs/configuration.md');
await syncDoc('docs/compatibility.md', 'src/pages/docs/compatibility.md');
await syncDoc('docs/later.md', 'src/pages/docs/later.md');

// The task template and the four prompts, verbatim, each in a fence longer
// than any backtick run inside it.
const fence = (text) =>
  '`'.repeat(Math.max(3, (text.match(/`+/g) ?? []).reduce((m, r) => Math.max(m, r.length), 0) + 1));
async function verbatim(sourcePath) {
  const text = (await readFile(resolve(kitRoot, sourcePath), 'utf8')).trimEnd();
  const f = fence(text);
  return `${f}markdown\n${text}\n${f}`;
}
const prompts = [
  ['The task template', 'templates/task.md', 'What `bottega new` fills in with your title and your request, verbatim. The spaced `{{ … }}` markers are guidance for the planner; it follows the template section for section.'],
  ['The planner prompt', 'prompts/planner.md', 'Reads the repository without changing it; ends with the plan, or with questions for you.'],
  ['The implementer prompt', 'prompts/implementer.md', 'Works through the unchecked items in plan order, adds tests, ticks items; never commits.'],
  ['The reviewer prompt', 'prompts/reviewer.md', 'Verifies every ticked item, runs the tests and the manual QA, writes the findings and signals.'],
  ['The judge prompt', 'prompts/judge.md', 'Reads the plan and the diff and says whether it would merge; signals.']
];
let promptsBody = '';
for (const [heading, path, blurb] of prompts) {
  promptsBody += `## ${heading}\n\n\`${path}\`. ${blurb}\n\n${await verbatim(path)}\n\n`;
}
await syncBlock('src/pages/docs/prompts.md', promptsBody);

const firstVersion = changelog.match(/^## \[/m);
if (!firstVersion) fail('CHANGELOG.md has no version headings');
await syncBlock(
  'src/pages/changelog/index.md',
  rewriteLinks(changelog.slice(firstVersion.index), 'CHANGELOG.md')
);

if (isCheck) {
  if (drift.length) {
    console.error('sync-kit: out of sync with the kit checkout:');
    for (const p of drift) console.error(`  ${p}`);
    console.error('  Run `npm run sync-kit` to update.');
    process.exit(1);
  }
  console.log(`sync-kit: in sync with bottega-kit ${pkg.version} (${relative(siteRoot, kitRoot)}).`);
}
