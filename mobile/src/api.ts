import Constants from 'expo-constants';
import type { CommentsAnalytics, Filters, NewsAnalysis, NewsCard, Stats } from './types';
import bundled from '../assets/snapshot.json';

// Базовый адрес backend (если запущен и доступен). По умолчанию — 10.0.2.2
// (host-машина из Android-эмулятора). Для физического устройства задайте IP в
// app.json → expo.extra.apiBase или EXPO_PUBLIC_API_BASE.
const extra = Constants.expoConfig?.extra as { apiBase?: string; snapshotUrl?: string } | undefined;

export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE || extra?.apiBase || 'http://10.0.2.2:4000';

// Удалённый снапшот: свежие данные тянутся ПО СЕТИ при запуске (обновляется при
// каждом `npm run ingest` + push), с откатом на вшитый в APK, если сети нет.
// Так приложение работает и офлайн, и получает новые новости без пересборки.
const REMOTE_SNAPSHOT_URL: string =
  process.env.EXPO_PUBLIC_SNAPSHOT_URL ||
  extra?.snapshotUrl ||
  'https://raw.githubusercontent.com/nbgdgd/Mnenie/refs/heads/claude/news-opinion-prediction-app-6k1eqb/mobile/assets/snapshot.json';

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

const BUNDLED = bundled as unknown as Snapshot;

// Мемоизированная загрузка снапшота: сначала пробуем сеть (свежие данные),
// иначе — вшитый в APK. Кэшируется на время сессии.
let snapshotPromise: Promise<Snapshot> | null = null;
export function loadSnapshot(force = false): Promise<Snapshot> {
  if (snapshotPromise && !force) return snapshotPromise;
  snapshotPromise = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(`${REMOTE_SNAPSHOT_URL}?t=${Date.now()}`, {
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`${res.status}`);
      const remote = (await res.json()) as Snapshot;
      // берём более СВЕЖИЙ из двух: если CDN отдал устаревшую копию — не
      // ухудшаем данные, оставляем вшитый снапшот.
      if (remote?.cards?.length) {
        const rt = Date.parse(remote.generatedAt || '') || 0;
        const bt = Date.parse(BUNDLED.generatedAt || '') || 0;
        return rt >= bt ? remote : BUNDLED;
      }
      throw new Error('empty');
    } catch {
      return BUNDLED; // офлайн-фолбэк
    }
  })();
  return snapshotPromise;
}

export interface FeedQuery {
  country?: string;
  topic?: string;
  q?: string;
  sort?: 'recent' | 'controversial' | 'trust' | 'campaigns';
}

function localFeed(snap: Snapshot, q: FeedQuery = {}): NewsCard[] {
  let items = snap.cards.slice();
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

// ---- live-backend с коротким таймаутом (если поднят), иначе снапшот ----
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
    const live = await tryGet<NewsCard[]>(`/news${qs(q)}`);
    if (live) return live;
    return localFeed(await loadSnapshot(), q);
  },
  async news(id: string): Promise<NewsAnalysis> {
    const live = await tryGet<NewsAnalysis>(`/news/${id}`);
    if (live) return live;
    const snap = await loadSnapshot();
    const offline = snap.analyses[id];
    if (!offline) throw new Error(`Новость ${id} не найдена`);
    return offline;
  },
  async comments(id: string): Promise<CommentsAnalytics> {
    const live = await tryGet<CommentsAnalytics>(`/news/${id}/comments`);
    if (live) return live;
    const snap = await loadSnapshot();
    const offline = snap.commentsAnalytics?.[id];
    if (!offline) throw new Error(`Аналитика комментариев для ${id} недоступна`);
    return offline;
  },
  async filters(): Promise<Filters> {
    return (await tryGet<Filters>('/filters')) ?? (await loadSnapshot()).filters;
  },
  async stats(): Promise<Stats> {
    return (await tryGet<Stats>('/stats')) ?? (await loadSnapshot()).stats;
  },
  async controversial(): Promise<NewsCard[]> {
    return (await tryGet<NewsCard[]>('/rankings/controversial')) ?? (await loadSnapshot()).controversial;
  },
  async polarized(): Promise<NewsCard[]> {
    return (await tryGet<NewsCard[]>('/rankings/polarized')) ?? (await loadSnapshot()).polarized;
  },
};
