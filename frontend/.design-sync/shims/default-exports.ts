// Sync-time barrel. The synth bundle entry uses `export * from <file>`, which
// drops DEFAULT exports — so default-exported components never land on
// window.<GLOBAL>. Re-export them as named here (merged into the bundle via
// cfg.extraEntries) so their preview cards and real-design usage resolve.
// @ts-nocheck
export { default as CalendarView } from '../../src/components/calendar/CalendarView';
export { default as EventModal } from '../../src/components/calendar/EventModal';
export { default as ConnectionSetup } from '../../src/components/calendar/ConnectionSetup';
export { default as SleepWidget } from '../../src/components/widgets/SleepWidget';
