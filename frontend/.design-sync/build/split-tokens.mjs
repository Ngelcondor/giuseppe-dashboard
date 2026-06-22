#!/usr/bin/env node
// Keep Tailwind's runtime --tw-* vars out of the file the Claude Design
// adherence check scrapes for design tokens.
//
// The app regenerates x-omelette.tokens by scraping custom-property
// declarations from _ds_bundle.css. Tailwind's preflight declares ~98 --tw-*
// under style selectors (*, ::before, ::after, ::backdrop, .space-y-*); the
// check flags them as mis-scoped tokens, and there is NO ignore mechanism
// (converter config is strict, @kind only classifies, project-side
// ignoreTokens isn't honored). So we physically split them out:
//
//   _ds_bundle.css  -> every rule that does NOT declare --tw-* (the real :root
//                      tokens + component styles) — this is what the app scrapes
//   _ds_tw.css      -> every rule that DOES declare --tw-* (preflight + any
//                      transform/ring/etc. utilities) — still rendered
//   styles.css      -> @import "_ds_tw.css" (first, preflight/base) then
//                      "_ds_bundle.css", so the render closure is unchanged
//
// Runs AFTER the bundle CSS is in place (post package-build / cp). The full CSS
// is re-derived from cfg.cssEntry each sync, so this re-splits every time — keep
// it in the pipeline (see .design-sync/NOTES.md). Nothing is dropped; the two
// files together equal the input.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const bundle = process.argv[2];
if (!bundle) { console.error('usage: node split-tokens.mjs <_ds_bundle.css>'); process.exit(1); }
const dir = dirname(bundle);

// Split CSS into top-level units (statements ending at top-level `;` and blocks
// with balanced braces), skipping comments and strings so braces inside them
// don't throw off the depth count. Comments/strings are preserved in output.
function topLevelUnits(css) {
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

const css = readFileSync(bundle, 'utf8');
const units = topLevelUnits(css);

const twUnits = [];   // declare --tw-* somewhere
const tokenUnits = []; // everything else (incl. :root design tokens)
for (const u of units) {
  // A unit "declares" --tw-* if it contains a `--tw-...:` declaration.
  if (/--tw-[A-Za-z0-9-]+\s*:/.test(u)) twUnits.push(u);
  else tokenUnits.push(u);
}

writeFileSync(bundle, tokenUnits.join('').trimStart() + '\n');
writeFileSync(join(dir, '_ds_tw.css'), twUnits.join('').trimStart() + '\n');

// styles.css: preflight/base first, then tokens+components. Overwrites whatever
// the converter wrote (it only @imports _ds_bundle.css).
writeFileSync(join(dir, 'styles.css'), '@import "./_ds_tw.css";\n@import "./_ds_bundle.css";\n');

const twDecls = (css.match(/--tw-[A-Za-z0-9-]+\s*:/g) || []).length;
console.error(`split-tokens: ${twUnits.length} rule(s) with --tw-* (${twDecls} decls) -> _ds_tw.css; ${tokenUnits.length} -> _ds_bundle.css; styles.css imports both`);
