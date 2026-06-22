import { Header } from 'giuseppe-dashboard';

// Header renders its own sticky bar background (bg-card-solid). No stage wrapper.
// It uses next/link (shimmed) and reads auth/theme stores; when no user is set
// it falls back to the "Ciao!" greeting.

export const Default = () => (
  <div style={{ width: 720 }}>
    <Header />
  </div>
);

export const MenuOpen = () => (
  <div style={{ width: 720 }}>
    <Header isMenuOpen onMenuToggle={() => {}} />
  </div>
);
