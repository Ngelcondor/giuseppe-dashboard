import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service · Giuseppe Dashboard',
  description: 'Terms of use for Giuseppe Dashboard.',
};

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

export default function TermsPage() {
  return (
    <main style={page}>
      <article style={wrap}>
        <h1 style={h1}>Terms of Service</h1>
        <p style={muted}>Last updated: {UPDATED}</p>

        <p style={p}>
          Giuseppe Dashboard (&ldquo;the App&rdquo;) is a personal, non-commercial application operated
          privately by, and for the sole use of, a single individual. By using the App you agree to
          these terms.
        </p>

        <h2 style={h2}>What the App does</h2>
        <p style={p}>
          The App aggregates the user&rsquo;s own information — studies, deadlines and personal
          finances. For finances it connects, read-only, to the user&rsquo;s own bank accounts through
          Enable Banking&rsquo;s Account Information Service (AIS) to display balances and transactions.
          The App does not initiate payments and does not provide financial, investment, tax or legal
          advice.
        </p>

        <h2 style={h2}>Personal use</h2>
        <p style={p}>
          The App is for personal, non-commercial use by its owner. You are responsible for keeping
          your sign-in credentials secure and for the accuracy of any data you enter manually.
        </p>

        <h2 style={h2}>Open banking</h2>
        <p style={p}>
          Bank connectivity is provided by Enable Banking Oy, a licensed AISP under PSD2. Use of the
          bank-connection feature is also subject to Enable Banking&rsquo;s terms and to your
          bank&rsquo;s conditions. Connections require periodic re-authentication and can be revoked at
          any time.
        </p>

        <h2 style={h2}>No warranty</h2>
        <p style={p}>
          The App is provided &ldquo;as is&rdquo;, without warranties of any kind. Figures shown are for
          personal information only and may be incomplete or delayed; they are not a substitute for
          your bank&rsquo;s official statements.
        </p>

        <h2 style={h2}>Limitation of liability</h2>
        <p style={p}>
          To the extent permitted by law, the operator is not liable for any loss arising from use of,
          or inability to use, the App or the third-party services it relies on.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>Questions: <a style={a} href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>

        <p style={{ ...muted, marginTop: 36 }}>
          <a style={a} href="/privacy">Privacy Policy</a> · <a style={a} href="https://dashboard.elcondor.dev">Home</a>
        </p>
      </article>
    </main>
  );
}
