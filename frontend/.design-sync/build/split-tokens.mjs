#!/usr/bin/env node
// Keep Tailwind's runtime --tw-* vars out of the file the Claude Design
// adherence check scrapes for design tokens.
//
// The app regenerates x-omelette.tokens by scraping custom-property
// declarations from _ds_bundle.css and flags every custom property declared
// under a *style* selector (*, ::before, ::after, ::backdrop, .space-y-* …)
// rather than :root/[data-*] — that's all ~98 Tailwind --tw-* internals. There
// is NO ignore mechanism (converter config is strict; @kind only classifies,
// not excludes; project-side ignoreTokens isn't honored). So we physically
// move every rule that mentions --tw-* (declaration OR var() usage) into a
// sibling _ds_tw.css, leaving the scraped _ds_bundle.css with zero --tw- text.
// Both files are imported by styles.css, so the render closure is unchanged.
//
// This module is consumed two ways:
//   1. AUTOMATICALLY by the /design-sync converter via the .design-sync/
//      overrides/css.mjs fork (its writeStylesCss calls splitTwFile, then adds
//      the _ds_tw.css @import) — so every re-sync keeps the bundle --tw--free.
//   2. Manually as a CLI: `node split-tokens.mjs <_ds_bundle.css>` (also
//      rewrites the sibling styles.css). Kept for debugging / out-of-band runs.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Split CSS into top-level units (statements ending at top-level `;` and blocks
// with balanced braces), skipping comments and strings so braces inside them
// don't throw off the depth count. Comments/strings are preserved in output.
export function topLevelUnits(css) {
  const units = [];
  let buf = '', depth = 0, i = 0;
  const n = css.length;
  while (i < n) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      buf += css.slice(i, stop); i = stop; continue;
    }
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && css[j] !== ch) { if (css[j] === '\\') j++; j++; }
      j = Math.min(j + 1, n);
      buf += css.slice(i, j); i = j; continue;
    }
    buf += ch;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { units.push(buf); buf = ''; } }
    else if (ch === ';' && depth === 0) { units.push(buf); buf = ''; }
    i++;
  }
  if (buf.trim()) units.push(buf);
  return units;
}

// Partition CSS text into the --tw--free bundle and the --tw- sidecar.
export function splitTw(css) {
  const tw = [], rest = [];
  for (const u of topLevelUnits(css)) (u.includes('--tw-') ? tw : rest).push(u);
  return {
    bundle: rest.join('').trimStart() + '\n',
    tw: tw.join('').trimStart() + '\n',
    twRules: tw.length,
    twDecls: (css.match(/--tw-[A-Za-z0-9-]+\s*:/g) || []).length,
  };
}

// In-place split of a bundle CSS file. Rewrites `bundlePath` without any --tw-
// and writes the sibling `_ds_tw.css`. No-op (no sidecar written) when the
// bundle has no --tw-. Does NOT touch styles.css — the caller wires the import.
export function splitTwFile(bundlePath, { twName = '_ds_tw.css' } = {}) {
  const { bundle, tw, twRules, twDecls } = splitTw(readFileSync(bundlePath, 'utf8'));
  if (twRules === 0) return { twWritten: false, twName, twRules: 0, twDecls: 0 };
  writeFileSync(bundlePath, bundle);
  writeFileSync(join(dirname(bundlePath), twName), tw);
  return { twWritten: true, twName, twRules, twDecls };
}

// ── CLI (manual / debugging) — also rewrites styles.css next to the bundle ──
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const bundle = process.argv[2];
  if (!bundle) { console.error('usage: node split-tokens.mjs <_ds_bundle.css>'); process.exit(1); }
  const r = splitTwFile(bundle);
  if (r.twWritten) {
    writeFileSync(join(dirname(bundle), 'styles.css'), `@import "./${r.twName}";\n@import "./_ds_bundle.css";\n`);
  }
  console.error(`split-tokens: ${r.twRules} rule(s) with --tw-* (${r.twDecls} decls) -> ${r.twName}; styles.css rewritten`);
}
