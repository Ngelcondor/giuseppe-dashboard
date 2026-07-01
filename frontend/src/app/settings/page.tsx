import { redirect } from 'next/navigation';

// Le impostazioni vivono in /dashboard/impostazioni. Questa route legacy resta
// solo come redirect per vecchi link/bookmark.
export default function SettingsRedirect() {
  redirect('/dashboard/impostazioni');
}
