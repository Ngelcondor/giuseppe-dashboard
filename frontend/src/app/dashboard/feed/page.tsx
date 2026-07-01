'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, Rss } from 'lucide-react';
import { getCybersecurityFeed, type FeedArticle } from '@/services/feedService';

/* ── Cyber Feed ────────────────────────────────────────────────────────────
   News di cybersecurity da fonti RSS reali, aggregate dal backend (cache 1h).
   Stati onesti: skeleton in caricamento, messaggio esplicito su errore o feed
   vuoto — mai articoli inventati. */

const mono = "'JetBrains Mono',monospace";

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};

// I summary RSS possono contenere markup: teniamo solo il testo.
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function relativeTime(ts: number): string {
  if (!ts) return '';
  const diffMin = Math.round((Date.now() / 1000 - ts) / 60);
  if (diffMin < 1) return 'ora';
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h fa`;
  const diffD = Math.round(diffH / 24);
  return diffD === 1 ? 'ieri' : `${diffD} giorni fa`;
}

const SOURCE_COLORS: Record<string, string> = {
  'The Hacker News': 'rgb(244 63 94)',
  darkreading: 'rgb(139 92 246)',
  SecurityWeek: 'rgb(16 185 129)',
};

function sourceColor(source: string): string {
  if (source.includes('Ars Technica')) return 'rgb(245 158 11)';
  return SOURCE_COLORS[source] ?? 'rgb(99 102 241)';
}

export default function FeedPage() {
  const [articles, setArticles] = useState<FeedArticle[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getCybersecurityFeed()
      .then((a) => { if (alive) setArticles(a); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <header className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Security news</div>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>
          Cyber <span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>Feed</span>
        </h1>
        <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>
          Ars Technica · Dark Reading · SecurityWeek · The Hacker News — aggiornato ogni ora.
        </p>
      </header>

      {error && (
        <div className="sd-reveal" style={{ ...card, padding: '26px 24px', maxWidth: 640, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Rss size={20} color="rgb(var(--color-tertiary))" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Feed non disponibile</div>
            <div style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))', marginTop: 3 }}>Le fonti RSS non rispondono. Riprova tra qualche minuto.</div>
          </div>
        </div>
      )}

      {!error && articles === null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sd-reveal" style={{ ['--i' as string]: 1 + i, ...card, padding: '20px 22px' }}>
              <div style={{ height: 11, width: 90, borderRadius: 6, background: 'rgb(var(--color-border))', marginBottom: 12 }} />
              <div style={{ height: 16, width: '75%', borderRadius: 6, background: 'rgb(var(--color-border))', marginBottom: 8 }} />
              <div style={{ height: 12, width: '95%', borderRadius: 6, background: 'rgb(var(--color-card-inner))' }} />
            </div>
          ))}
        </div>
      )}

      {!error && articles !== null && articles.length === 0 && (
        <div className="sd-reveal" style={{ ...card, padding: '26px 24px', maxWidth: 640 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Nessun articolo al momento</div>
          <div style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))', marginTop: 3 }}>Il feed è vuoto: le fonti verranno riprovate al prossimo aggiornamento orario.</div>
        </div>
      )}

      {!error && articles !== null && articles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
          {articles.map((a, i) => {
            const color = sourceColor(a.source);
            return (
              <a
                key={a.link}
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="sd-reveal sd-lift"
                style={{ ['--i' as string]: 1 + i, ...card, padding: '20px 22px', display: 'block', textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: mono, fontSize: 11, fontWeight: 600, color }}>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
                    {a.source}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'rgb(var(--color-tertiary))', fontFamily: mono }}>{relativeTime(a.published_ts)}</span>
                  <ExternalLink size={13} color="rgb(var(--color-muted))" style={{ marginLeft: 'auto', flex: 'none' }} />
                </div>
                <div style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.3, color: 'rgb(var(--color-heading))', letterSpacing: '-.01em' }}>{a.title}</div>
                {a.summary && (
                  <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'rgb(var(--color-tertiary))' }}>
                    {stripHtml(a.summary).slice(0, 180)}{stripHtml(a.summary).length > 180 ? '…' : ''}
                  </p>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
