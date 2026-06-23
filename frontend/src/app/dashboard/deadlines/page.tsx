import { redirect } from 'next/navigation';

// Scadenze now live inside Budget (Budget → "Scadenze" tab). This route is kept
// as a redirect so old links/bookmarks land on the integrated view.
export default function DeadlinesRedirect() {
  redirect('/dashboard/budget?view=scadenze');
}
