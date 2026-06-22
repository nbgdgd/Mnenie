import type { Filters, NewsAnalysis, NewsCard, Stats } from './types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export interface FeedQuery {
  country?: string;
  topic?: string;
  q?: string;
  sort?: 'recent' | 'controversial' | 'trust' | 'campaigns';
}

export const api = {
  feed(q: FeedQuery = {}): Promise<NewsCard[]> {
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v && params.set(k, String(v)));
    const qs = params.toString();
    return get<NewsCard[]>(`/news${qs ? `?${qs}` : ''}`);
  },
  news: (id: string) => get<NewsAnalysis>(`/news/${id}`),
  filters: () => get<Filters>('/filters'),
  stats: () => get<Stats>('/stats'),
  controversial: () => get<NewsCard[]>('/rankings/controversial'),
  polarized: () => get<NewsCard[]>('/rankings/polarized'),
};
