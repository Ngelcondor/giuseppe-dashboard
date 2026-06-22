#!/usr/bin/env node
// Tag custom properties for the Claude Design adherence check.
//
// The app's self-check regenerates _adherence.oxlintrc.json's `x-omelette`
// (tokens + tokenKinds) by scanning the compiled CSS, honoring a trailing,
// SAME-LINE `/* @kind <k> */` comment on each declaration. The /design-sync
// converter appends cfg.cssEntry (.design-sync/build/ds.css) VERBATIM into
// _ds_bundle.css (no minify → comments survive), so annotating ds.css here is
// what reaches the bundle the app classifies. Run IN-PLACE on ds.css right
// after `tailwindcss` (see .design-sync/NOTES.md). Idempotent.
//
// Valid @kind values (Claude Design adherence check): color, spacing, radius,
// shadow, font, other. ("ignore" is NOT valid — it fails the check.)
//
// Rules:
//   --tw-*    Tailwind preflight/utility internals (~40 unique, ~98 decls across
//             *,::before,::after,::backdrop and .space-y-*)  -> /* @kind other */
//             (runtime vars, not design tokens — can't be stripped, so tag them
//              "other"; true exclusion would need a token-ignore in the converter
//              config, which doesn't exist — the app scrapes tokens from the CSS)
//   --accent-{primary,secondary,tertiary,warning,danger,success}  brand colors
//             -> /* @kind color */  (else the classifier defaults them to "other")
//
// PostCSS/Tailwind pushes a same-line source comment (e.g. one we put in
// globals.css) onto its OWN line, where the app won't associate it with the
// declaration. So first drop standalone @kind comment lines, then re-attach
// @kind inline — that placement is the one the check reads.
import { readFileSync, writeFileSync } from 'node:fs';

const RULES = [
  { re: /(--tw-[A-Za-z0-9-]+\s*:[^;{}]*;)(?![ \t]*\/\*\s*@kind)/g, kind: 'other' },
  { re: /(--accent-(?:primary|secondary|tertiary|warning|danger|success)\s*:[^;{}]*;)(?![ \t]*\/\*\s*@kind)/g, kind: 'color' },
];

const file = process.argv[2];
if (!file) { console.error('usage: node annotate-tw.mjs <css-file>'); process.exit(1); }

let css = readFileSync(file, 'utf8');
// Drop standalone @kind comment lines (PostCSS-orphaned), so we can re-attach inline.
css = css.replace(/^[ \t]*\/\*\s*@kind\s+\w+\s*\*\/[ \t]*\r?\n/gm, '');
const counts = {};
for (const { re, kind } of RULES) {
  counts[kind] = 0;
  css = css.replace(re, (_, decl) => { counts[kind]++; return `${decl} /* @kind ${kind} */`; });
}
writeFileSync(file, css);
console.error(`annotate-tw: ${counts.other} --tw-* -> @kind other, ${counts.color} --accent-* -> @kind color in ${file}`);
