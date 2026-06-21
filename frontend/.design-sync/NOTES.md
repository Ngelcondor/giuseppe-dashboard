# design-sync notes — giuseppe-dashboard frontend

This repo is a **Next.js app**, not a packaged component library. The design system
is `src/components/**` (primarily `src/components/ui`). The converter runs in
**synth-entry mode** (no `dist/`): esbuild bundles components straight from `src/`.

## Build setup (why the config looks the way it does)

- **Install with `npm ci --legacy-peer-deps`.** Plain `npm ci` fails: `qrcode.react@1.0.1`
  peer-depends on React ≤17 while the app is on React 18 (ERESOLVE). The lockfile was
  created with legacy peer resolution.
- **`--entry ./dist/index.es.js` is passed but does NOT exist.** That's intentional: the
  missing path makes the converter walk up to `frontend/package.json` (so `PKG_DIR = frontend`)
  while still falling back to synth-entry mode. Do not create that file.
- **`srcDir: "src/components"`** scopes synth discovery to components (default `src` would pull
  in stores/hooks/app pages as bogus PascalCase "components").
- **`tsconfig: .design-sync/tsconfig.sync.json`** is a sync-only tsconfig. It mirrors the
  `@/*` → `src/*` alias AND adds `paths` shims for `next/link` and `next/navigation`
  (`.design-sync/shims/`) so the 4 Next.js-coupled components (AppShell, EditorialPage,
  Header, Sidebar) bundle and render outside the Next runtime. The app's real tsconfig is untouched.
- **`cssEntry: .design-sync/build/ds.css`** is Tailwind compiled from `globals.css`. Regenerate with:
  `cat src/app/globals.css .design-sync/_extra.css > .design-sync/build/input.css && npx tailwindcss -c ./tailwind.config.ts -i .design-sync/build/input.css -o .design-sync/build/ds.css`
  Tailwind JIT only emits classes it finds in `content` (src/**), so the shipped CSS covers the
  vocabulary the app actually uses — net-new utility classes a design agent invents may be absent.

## Sync-time shims & forks (all in .design-sync/)

- **tsconfig.sync.json** must be PURE JSON (no `"//"` comment keys — the converter's
  comment-stripper corrupts them and the paths plugin silently disables). It declares ONLY
  `next/link` + `next/navigation` paths → shims. Do NOT add `@/*` here: the plugin resolves
  barrel dirs (e.g. `@/types`) to the directory itself and esbuild errors; let esbuild's native
  tsconfig auto-detection (frontend/tsconfig.json) handle `@/*`.
- **shims/process-polyfill.ts** (first cfg.extraEntries) — bundled modules read
  `process.env.NEXT_PUBLIC_API_URL` (constants.ts/useApi.ts/appleHealthService.ts) at load
  time; esbuild only replaces NODE_ENV. The polyfill defines `globalThis.process={env:{}}`
  FIRST in the IIFE so it doesn't throw (in previews AND real designs). Must stay first.
- **shims/default-exports.ts** (second cfg.extraEntries) — the synth entry uses `export *`,
  which DROPS default exports. CalendarView, EventModal, ConnectionSetup, SleepWidget are
  default-exported, so they were missing from window.GiuseppeDS. This barrel re-exports them as
  named. If a new default-exported component is added, add it here.
- **overrides/dts.mjs** (cfg.libOverrides) — loads src/*.ts(x) into the ts-morph project so
  `<Name>Props` interfaces resolve (no shipped .d.ts in synth mode); also drops next's global
  `tw` JSX augmentation (@vercel/og). Needs `.design-sync/node_modules` symlink →
  `../.ds-sync/node_modules` (recreate on fresh clone: `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules`).
- Render check after these: 45/45 import; floor-card form fields (Input/Textarea/Checkbox/
  Toggle) and tiny components (StatusDot/Progress/CopyPromptButton) flag blank/thin until real
  previews are authored.

## Findings in the repo

- `src/components/ui/Surface.tsx` (Surface default/accent, SectionHeader, StatusDot) references
  CSS classes `card-glass`, `card-accent`, `section-label`, `status-dot` that are **undefined**
  anywhere in `globals.css` — a refactor (`.panel`/`.chip`/`.eyebrow`) left them behind. In the
  live app those bits render largely unstyled. `.design-sync/_extra.css` reconstructs them
  for the previews; mirror those into `globals.css` to fix the app.

## Preview authoring learnings (folded from waves)

- **All previews use a dark stage** `{ background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 }` — the DS is dark-first, components are invisible on white.
- **Overlay components are position:fixed** (Modal, ConfirmModal, EventModal, ConnectionSetup, BottomDock). The single-card wrapper `.ds-single` has `transform:translateZ(0)`, making it the fixed containing block — which collapses to ~0 height, clipping centered overlays. FIX: each overlay preview starts with a `<div style={{height:'100vh', background:'rgb(8 8 10)'}}/>` spacer so the wrapper gets real height. These also have `cardMode:single` + a generous `viewport` in config.
- **Skeleton/SkeletonBlock** are nearly invisible on the standard dark stage (gradient `from-input`→`to-surface-hover` ≈ bg). Their previews wrap the shimmer in a lighter inner panel `background: rgb(64 64 72)` so the bars read.
- **Grid-overflow → cardMode:column** for Button, CompactWidget, Stepper, Header, WidgetWrapper (stories wider than a grid cell).
- **Full-page shells** (PageShell, EditorialPage, AppShell) + Sidebar + BottomDock get `cardMode:single` (they paint min-h-screen / fixed dock).
- **Known component quirks (real, not preview bugs):** Toggle's visual track always shows OFF (uses `peer-checked:` but the input lacks the `peer` class); StatBlock ignores its `trend` prop; Header's MenuOpen vs Default look identical on a desktop viewport (menu button is `md:hidden`).
- **Two `ProgressBar`-named exports**: `ProgressBar` (ui/ProgressBar.tsx, captioned bar) and `Progress` (ui/Surface.tsx, bare thin bar) — separate components/cards.
- **Data-coupled widgets** (NextTaskWidget, QuickActions, SleepWidget, WeatherWidget, CalendarView) render default/empty states with no props — graded good as-is.
- lucide icons work in previews: `import { Inbox } from 'lucide-react'; icon={Inbox}` for EmptyState/SectionHeader/StatusDot.

## Re-sync risks

- CSS is compiled at sync time, not by the converter. If `globals.css` or component class usage
  changes, re-run the Tailwind compile above before the converter, or the shipped CSS goes stale.
- The `_extra.css` reconstructions are sync-owned, tied to Surface's current class names — if those
  classes get defined (or renamed) in `globals.css`, reconcile `_extra.css`.
