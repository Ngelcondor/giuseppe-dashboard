import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy · Giuseppe Dashboard',
  description: 'How Giuseppe Dashboard handles personal data.',
};

// Privacy contact — change here if you prefer a different address.
const CONTACT = 'giuseppe.dianasr@hotmail.it';
const UPDATED = 'October 8, 2026';

const page: React.CSSProperties = {
  minHeight: '100vh', background: '#ffffff', color: '#1a1a1f',
  fontFamily: "'Inter Tight', system-ui, -apple-system, sans-serif",
  padding: '64px 20px', lineHeight: 1.65,
};
const wrap: React.CSSProperties = { maxWidth: 720, margin: '0 auto' };
const h1: React.CSSProperties = { fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px' };
const h2: React.CSSProperties = { fontSize: 18, fontWeight: 600, margin: '34px 0 10px' };
const p: React.CSSProperties = { margin: '0 0 14px', fontSize: 15.5, color: '#33333a' };
const muted: React.CSSProperties = { fontSize: 13, color: '#70707a', margin: '0 0 28px' };
const a: React.CSSProperties = { color: '#4f46e5', textDecoration: 'none' };

export default function PrivacyPage() {
  return (
    <main style={page}>
      <article style={wrap}>
        <h1 style={h1}>Privacy Policy</h1>
        <p style={muted}>Last updated: {UPDATED}</p>

        <p style={p}>
          Giuseppe Dashboard (&ldquo;the App&rdquo;, <a style={a} href="https://dashboard.elcondor.dev">dashboard.elcondor.dev</a>)
          is a personal, non-commercial application used by a single individual to manage their own
          studies, deadlines and personal finances. This policy explains what data the App processes
          and why.
        </p>

        <h2 style={h2}>Who is responsible</h2>
        <p style={p}>
          The App is operated privately by its sole user, who acts as the data controller. For any
          privacy request, contact <a style={a} href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <h2 style={h2}>What data is processed</h2>
        <p style={p}>
          <strong>Account data</strong>: the email address and credentials used to sign in to the App.
          <br />
          <strong>Personal finance data</strong>: transactions and payment deadlines that the user
          enters manually or imports from bank statement files (CSV).
        </p>

        <h2 style={h2}>Bank connections (until October 2026)</h2>
        <p style={p}>
          Between June and October 2026 the App retrieved — read-only — account details, balances and
          transactions from the user&rsquo;s own bank accounts through Enable Banking Oy, a licensed
          Account Information Service Provider (AISP) under PSD2. The App never received or stored
          online banking login credentials. All bank connections were revoked on October 8, 2026: the
          App no longer contacts Enable Banking or any bank. Transactions retrieved before that date
          remain stored as part of the user&rsquo;s history.
        </p>

        <h2 style={h2}>Purpose &amp; legal basis</h2>
        <p style={p}>
          Data is processed solely to display the user&rsquo;s own financial overview (income,
          spending by category, upcoming payments) — i.e. at the user&rsquo;s own request and for their
          own personal use. The data is never sold, shared with third parties, used for advertising,
          or processed by third-party analytics.
        </p>

        <h2 style={h2}>Storage &amp; retention</h2>
        <p style={p}>
          Data is stored on a private, access-controlled server located in the EU, and is retained
          until the user deletes it or closes the account. Cached bank balances were deleted when the
          bank connections were revoked.
        </p>

        <h2 style={h2}>Your rights</h2>
        <p style={p}>
          Under the GDPR you may request access to, correction of, or deletion of your data. To
          exercise these rights, contact{' '}
          <a style={a} href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <h2 style={h2}>Changes</h2>
        <p style={p}>This policy may be updated; the date above reflects the latest revision.</p>

        <p style={{ ...muted, marginTop: 36 }}>
          <a style={a} href="/terms">Terms of Service</a> · <a style={a} href="https://dashboard.elcondor.dev">Home</a>
        </p>
      </article>
    </main>
  );
}
