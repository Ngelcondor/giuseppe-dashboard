import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy · Giuseppe Dashboard',
  description: 'How Giuseppe Dashboard handles personal and bank account data.',
};

// Privacy contact — change here if you prefer a different address.
const CONTACT = 'giuseppe.dianasr@hotmail.it';
const UPDATED = 'June 23, 2026';

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
          <strong>Bank account data</strong>: when you connect a bank account, the App retrieves —
          read-only — account details, balances and transactions through Enable Banking&rsquo;s
          Account Information Service (AIS). The App never receives or stores your online banking
          login credentials; authentication happens on your bank&rsquo;s own page.
        </p>

        <h2 style={h2}>Role of Enable Banking</h2>
        <p style={p}>
          Bank connectivity is provided by Enable Banking Oy, a licensed Account Information Service
          Provider (AISP) under PSD2, acting as a processor for the account data retrieval. Their
          handling of the bank interaction is governed by Enable Banking&rsquo;s own terms and privacy
          policy.
        </p>

        <h2 style={h2}>Purpose &amp; legal basis</h2>
        <p style={p}>
          Data is processed solely to display the user&rsquo;s own financial overview (balances,
          spending by category, upcoming payments) — i.e. at the user&rsquo;s own request and for their
          own personal use. The data is never sold, shared with third parties, used for advertising,
          or processed by third-party analytics.
        </p>

        <h2 style={h2}>Storage &amp; retention</h2>
        <p style={p}>
          Data is stored on a private, access-controlled server located in the EU, and is retained
          only while the account/bank connection is active. Bank connections expire automatically
          (PSD2 requires re-authentication at least every 90 days) and can be disconnected at any
          time, which removes the associated access.
        </p>

        <h2 style={h2}>Your rights</h2>
        <p style={p}>
          Under the GDPR you may request access to, correction of, or deletion of your data, and you
          may withdraw a bank connection at any time. To exercise these rights, contact{' '}
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
