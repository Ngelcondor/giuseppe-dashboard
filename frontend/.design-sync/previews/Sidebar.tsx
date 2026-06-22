import { Sidebar } from 'giuseppe-dashboard';

// Sidebar renders its own full-height bg-card-solid panel. No stage wrapper.
// Uses next/link + usePathname (shimmed → '/'), so no item is active by default.

export const Expanded = () => (
  <div style={{ height: 720, display: 'flex' }}>
    <Sidebar isOpen />
  </div>
);
