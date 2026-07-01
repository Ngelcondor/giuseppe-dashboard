import api from '@/lib/api';

// Articolo dal feed RSS reale (Ars Technica, Dark Reading, SecurityWeek,
// The Hacker News) — aggregato e cachato 1h dal backend.
export interface FeedArticle {
  title: string;
  link: string;
  published: string;      // stringa RSS originale (timezone della testata)
  published_ts: number;   // epoch UTC, 0 se sconosciuto
  summary: string;        // può contenere HTML: va sanificato prima del render
  source: string;
}

export async function getCybersecurityFeed(): Promise<FeedArticle[]> {
  const { data } = await api.get<{ articles: FeedArticle[] }>('/feed/cybersecurity');
  return data.articles ?? [];
}
