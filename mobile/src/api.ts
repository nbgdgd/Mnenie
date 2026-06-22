import Constants from 'expo-constants';
import type { CommentsAnalytics, Filters, NewsAnalysis, NewsCard, Stats } from './types';
import snapshot from '../assets/snapshot.json';

// Базовый адрес backend (если запущен). По умолчанию — 10.0.2.2 (host-машина из
// Android-эмулятора). Для физического устройства задайте IP компьютера в
// app.json → expo.extra.apiBase или EXPO_PUBLIC_API_BASE.
export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE ||
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ||
  'http://10.0.2.2:4000';

// Предрасчитанный снапшот реальных новостей (Hacker News), вшитый в APK.
// Формируется `npm run ingest --workspace=server`. Приложение работает офлайн.
interface Snapshot {
  generatedAt: string;
  cards: NewsCard[];
  analyses: Record<string, NewsAnalysis>;
  commentsAnalytics: Record<string, CommentsAnalytics>;
  filters: Filters;
  stats: Stats;
  controversial: NewsCard[];
  polarized: NewsCard[];
}
const SNAP = snapshot as unknown as Snapshot;

export const snapshotGeneratedAt = SNAP.generatedAt;

export interface FeedQuery {
  country?: string;
  topic?: string;
  q?: string;
  sort?: 'recent' | 'controversial' | 'trust' | 'campaigns';
}

// ---- офлайн-реализация поверх снапшота (фильтры/сортировка на клиенте) ----
function localFeed(q: FeedQuery = {}): NewsCard[] {
  let items = SNAP.cards.slice();
  if (q.country) items = items.filter((c) => c.news.country === q.country);
  if (q.topic) items = items.filter((c) => c.news.topic === q.topic);
  if (q.q) {
    const n = q.q.toLowerCase();
    items = items.filter(
      (c) => c.news.title.toLowerCase().includes(n) || c.news.summary.toLowerCase().includes(n),
    );
  }
  switch (q.sort) {
    case 'controversial':
      items.sort((a, b) => b.metrics.polarization - a.metrics.polarization);
      break;
    case 'trust':
      items.sort((a, b) => b.metrics.trustIndex - a.metrics.trustIndex);
      break;
    case 'campaigns':
      items.sort((a, b) => Number(b.campaignDetected) - Number(a.campaignDetected));
      break;
    default:
      items.sort(
        (a, b) => new Date(b.news.publishedAt).getTime() - new Date(a.news.publishedAt).getTime(),
      );
  }
  return items;
}

const local = {
  feed: (q: FeedQuery = {}) => localFeed(q),
  news: (id: string) => SNAP.analyses[id] ?? null,
  comments: (id: string) => SNAP.commentsAnalytics?.[id] ?? null,
  filters: () => SNAP.filters,
  stats: () => SNAP.stats,
  controversial: () => SNAP.controversial,
  polarized: () => SNAP.polarized,
};

// ---- сетевой клиент с коротким таймаутом и откатом на снапшот ----
async function tryGet<T>(path: string): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(`${API_BASE}/api${path}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function qs(q: FeedQuery): string {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => v && params.set(k, String(v)));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const api = {
  async feed(q: FeedQuery = {}): Promise<NewsCard[]> {
    return (await tryGet<NewsCard[]>(`/news${qs(q)}`)) ?? local.feed(q);
  },
  async news(id: string): Promise<NewsAnalysis> {
    const live = await tryGet<NewsAnalysis>(`/news/${id}`);
    if (live) return live;
    const offline = local.news(id);
    if (!offline) throw new Error(`Новость ${id} не найдена в офлайн-данных`);
    return offline;
  },
  async comments(id: string): Promise<CommentsAnalytics> {
    const live = await tryGet<CommentsAnalytics>(`/news/${id}/comments`);
    if (live) return live;
    const offline = local.comments(id);
    if (!offline) throw new Error(`Аналитика комментариев для ${id} недоступна офлайн`);
    return offline;
  },
  async filters(): Promise<Filters> {
    return (await tryGet<Filters>('/filters')) ?? local.filters();
  },
  async stats(): Promise<Stats> {
    return (await tryGet<Stats>('/stats')) ?? local.stats();
  },
  async controversial(): Promise<NewsCard[]> {
    return (await tryGet<NewsCard[]>('/rankings/controversial')) ?? local.controversial();
  },
  async polarized(): Promise<NewsCard[]> {
    return (await tryGet<NewsCard[]>('/rankings/polarized')) ?? local.polarized();
  },
};
