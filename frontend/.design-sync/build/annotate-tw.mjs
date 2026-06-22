#!/usr/bin/env node
// Mark Tailwind-internal custom properties (--tw-*) as non-design-tokens.
//
// Tailwind's preflight + transform/ring/gradient/shadow utilities emit ~60
// internal `--tw-*` custom properties into the compiled CSS (cfg.cssEntry =
// .design-sync/build/ds.css). The /design-sync converter appends that file
// VERBATIM into _ds_bundle.css (package-build.mjs: appendFileSync), so the
// Claude Design token classifier sees every --tw-* as a design token and
// flags them as unclassified/unregistered. They are NOT design tokens.
//
// We can't strip them (the utilities reference them at runtime), so we append
// `/* @kind other */` after each --tw-* declaration; the classifier honors the
// comment and excludes them. Run this IN-PLACE on ds.css right after
// `tailwindcss` compiles it (see .design-sync/NOTES.md regeneration command),
// so the annotation is present in the cssEntry the converter appends — i.e. it
// survives every re-sync. Idempotent: skips already-annotated declarations.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node annotate-tw.mjs <css-file>'); process.exit(1); }

let count = 0;
const css = readFileSync(file, 'utf8').replace(
  /(--tw-[A-Za-z0-9-]+\s*:[^;{}]*;)(?!\s*\/\*\s*@kind)/g,
  (_, decl) => { count++; return `${decl} /* @kind other */`; },
);
writeFileSync(file, css);
console.error(`annotate-tw: marked ${count} --tw-* declaration(s) as /* @kind other */ in ${file}`);
