import { BottomDock } from 'giuseppe-dashboard';

// BottomDock is a position:fixed dock anchored to the bottom. The single-card
// wrapper (.ds-single) is transformed, so it's the fixed containing block — a
// full-height spacer gives it real height so the dock lands at the bottom.
export const Dock = () => (
  <>
    <div style={{ height: '100vh', background: 'rgb(8 8 10)' }} />
    <BottomDock />
  </>
);
