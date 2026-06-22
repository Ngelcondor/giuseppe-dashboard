// Sync-time polyfill. This is a Next.js app: bundled modules read
// `process.env.NEXT_PUBLIC_*` at load time, which esbuild does not replace.
// Prepended to the bundle entry (cfg.extraEntries) so it runs FIRST in the
// IIFE — `process.env.X` then yields undefined instead of throwing, in both
// the preview cards and real designs built with this DS.
// @ts-nocheck
(globalThis as any).process ||= { env: {} };
export {};
