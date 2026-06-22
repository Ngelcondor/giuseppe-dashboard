// FORK of design-sync lib/css.mjs (declared in config.json → libOverrides).
//
// Identical to the bundled css.mjs EXCEPT writeStylesCss, which integrates the
// Tailwind --tw-* split (see ../build/split-tokens.mjs) so the token scrape
// never sees --tw-*. Without this, a /design-sync re-sync regenerates
// _ds_bundle.css with the ~98 --tw-* preflight vars back under style selectors
// and the adherence check flags them again. Doing the split HERE (the converter
// step that owns styles.css + knows the bundle path) makes the fix automatic on
// every build — no manual post-step.
//
// Inlined `ls` (bundled css.mjs imports it from ./common.mjs, which doesn't
// resolve from .design-sync/overrides/). Everything else is verbatim — keep it
// in sync if the bundled css.mjs changes (the other 3 exports are stable utils).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { splitTwFile } from '../build/split-tokens.mjs';

const ls = (d, o) => readdirSync(d, o).sort((a, b) => (a.name ?? a).localeCompare(b.name ?? b));

// ── verbatim from bundled css.mjs ──────────────────────────────────────────
export function extractFonts(cssPath, srcDir, { fontsOut, roots }) {
  const realOf = (p) => { try { return realpathSync(p); } catch { return null; } };
  const rootsReal = (Array.isArray(roots) ? roots : [roots]).map((r) => realOf(resolve(r)) ?? resolve(r));
  const insideRoots = (p) => rootsReal.some((root) => {
    const rel = relative(root, p);
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
  });
  if (!existsSync(cssPath)) return [];
  const css = readFileSync(cssPath, 'utf8');
  const rules = [];
  for (const m of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
    const body = m[1];
    const fam = body.match(/font-family\s*:\s*['"]?([^;'"\n]+)['"]?/)?.[1]?.trim();
    const urls = [...body.matchAll(/url\(\s*['"]?([^'")]+?\.(?:woff2?|ttf|otf))['"]?\s*\)/gi)].map((u) => u[1]);
    if (!fam || !urls.length) continue;
    let rewritten = body;
    for (const u of urls) {
      if (/^(https?:|data:)/.test(u)) continue;
      const src = resolve(srcDir, u.replace(/^\.\//, ''));
      const real = realOf(src);
      if (!real || !insideRoots(real)) continue;
      const name = basename(src);
      mkdirSync(fontsOut, { recursive: true });
      cpSync(real, join(fontsOut, name));
      rewritten = rewritten.split(u).join(`./${name}`);
    }
    rules.push(`@font-face{${rewritten}}`);
  }
  return rules;
}

export function copyTokens({ tokensPkg, tokensGlob, nodeModules, out }) {
  const tokenFiles = [];
  if (!tokensPkg) return tokenFiles;
  const tdir = join(nodeModules, tokensPkg);
  const tjson = JSON.parse(readFileSync(join(tdir, 'package.json'), 'utf8'));
  if (tokensGlob) {
    const parts = tokensGlob.split('/');
    const pat = parts.pop();
    const rx = new RegExp('^' + pat.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    const deep = parts.includes('**');
    const base = join(tdir, ...parts.filter((p) => p !== '**'));
    (function collect(d, rel = '') {
      if (!existsSync(d)) return;
      for (const e of ls(d, { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory() && deep) collect(join(d, e.name), r);
        else if (e.isFile() && rx.test(e.name)) {
          mkdirSync(dirname(join(out, 'tokens', r)), { recursive: true });
          cpSync(join(d, e.name), join(out, 'tokens', r));
          tokenFiles.push(r);
        }
      }
    })(base);
  } else {
    for (const sub of ['dist/css', 'css', 'dist', '.']) {
      const d = join(tdir, sub);
      if (!existsSync(d)) continue;
      for (const f of ls(d)) {
        if (f.endsWith('.css')) {
          cpSync(join(d, f), join(out, 'tokens', f));
          tokenFiles.push(f);
        }
      }
      if (tokenFiles.length) break;
    }
  }
  console.error(`  tokens: ${tokenFiles.length} files from ${tokensPkg}@${tjson.version}`);
  return tokenFiles;
}

export function rewriteBundleFontFaces({ out, bundleCss }) {
  const p = bundleCss ?? join(out, '_ds_bundle.css');
  let css;
  try { css = readFileSync(p, 'utf8'); } catch { return; }
  if (!/@font-face/i.test(css)) return;
  let dropped = 0, rewrote = 0;
  const next = css.replace(/@font-face\s*\{[^}]*\}/gi, (block) => {
    let b = block;
    for (const m of block.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
      const u = m[1];
      if (/^(?:https?:|data:|\.\/fonts\/)/.test(u)) continue;
      const name = basename(u.split(/[?#]/)[0]);
      if (existsSync(join(out, 'fonts', name))) { b = b.split(u).join(`./fonts/${name}`); rewrote++; }
    }
    if (/url\(\s*['"]?(?!https?:|data:|\.\/fonts\/)/i.test(b)) { dropped++; return '/* @ds-font-face-dropped: unresolvable src */'; }
    return b;
  });
  if (rewrote || dropped) {
    writeFileSync(p, next);
    console.error(`  _ds_bundle.css fonts: ${rewrote} url(s) rewritten to fonts/${dropped ? `, ${dropped} dead @font-face block(s) dropped` : ''}`);
  }
}

// ── MODIFIED: split --tw-* out of the scraped bundle before wiring imports ──
export function writeStylesCss({ out, tokenFiles, bundleCss, fontRules, remoteImports }) {
  const bundlePath = bundleCss ?? join(out, '_ds_bundle.css');
  let hasBundleCss = false;
  try {
    const css = readFileSync(bundlePath, 'utf8');
    hasBundleCss = css.trim().length > 0 && !css.startsWith('/* @ds-css-runtime');
  } catch { /* absent */ }
  // [FORK] Move Tailwind --tw-* runtime vars into a sibling _ds_tw.css so the
  // app's token scrape of _ds_bundle.css never sees them. _ds_tw.css is still
  // imported below (preflight/base first), so designs render identically.
  let twImport = null;
  if (hasBundleCss) {
    const r = splitTwFile(bundlePath);
    if (r.twWritten) {
      twImport = `@import "./${r.twName}";`;
      console.error(`  [css-fork] split ${r.twRules} --tw-* rule(s) (${r.twDecls} decls) -> ${r.twName} (kept out of the token scrape)`);
    }
  }
  const styleImports = [
    ...tokenFiles.map((f) => `@import "./tokens/${f}";`),
    ...(fontRules.length ? ['@import "./fonts/fonts.css";'] : []),
    ...remoteImports.map((u) => `@import url("${u}");`),
    ...(twImport ? [twImport] : []),
    ...(hasBundleCss ? ['@import "./_ds_bundle.css";'] : []),
  ];
  if (styleImports.length) {
    writeFileSync(join(out, 'styles.css'), styleImports.join('\n') + '\n');
    console.error(`  styles.css: ${styleImports.length} @import(s)${hasBundleCss ? ` (incl. _ds_bundle.css${twImport ? ' + _ds_tw.css' : ''} — component styles ship to designs via this closure)` : ''}`);
    return;
  }
  writeFileSync(
    join(out, 'styles.css'),
    '/* @ds-styles: runtime — this design system injects its styles at runtime (CSS-in-JS); no static stylesheet to import. */\n',
  );
  console.error('[CSS_RUNTIME] no static CSS found (tokens/component/fonts/remote all empty) — wrote a self-styling styles.css. Expected for CSS-in-JS DSes; if this DS does ship a stylesheet, set cfg.cssEntry to it. If cfg.cssEntry is ALREADY set and renders verify, this line refers only to the scrape — do not chase it.');
}
