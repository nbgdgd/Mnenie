import Constants from 'expo-constants';
import type { Filters, NewsAnalysis, NewsCard, Stats } from './types';

// Базовый адрес backend. По умолчанию — 10.0.2.2 (host-машина из Android-эмулятора).
// Для физического устройства задайте IP компьютера в app.json → expo.extra.apiBase,
// либо через переменную окружения EXPO_PUBLIC_API_BASE.
export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE ||
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ||
  'http://10.0.2.2:4000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return (await res.json()) as T;
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
