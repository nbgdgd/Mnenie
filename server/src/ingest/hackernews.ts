// Реальный сбор данных из Hacker News (Firebase API, без ключей).
// Тянет топ-истории, их комментарии и данные авторов, маппит в доменные типы
// Mnenie (News + Source + RawComment). Это «Collect/Normalize/Enrich» из §3
// ARCHITECTURE.md на живых данных вместо сидов.
import { News, RawComment, Source } from '../types.js';

const HN = 'https://hacker-news.firebaseio.com/v0';

interface HnItem {
  id: number;
  type?: string;
  by?: string;
  time?: number; // unix sec
  title?: string;
  url?: string;
  text?: string;
  score?: number;
  descendants?: number;
  kids?: number[];
  deleted?: boolean;
  dead?: boolean;
}

interface HnUser {
  id: string;
  created?: number; // unix sec
  karma?: number;
  submitted?: number[];
}

async function fetchJson<T>(url: string, tries = 3): Promise<T | null> {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`${res.status}`);
      return (await res.json()) as T;
    } catch {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return null;
}

/** Пул с ограничением параллелизма, чтобы не долбить API. */
async function pool<I, O>(items: I[], limit: number, fn: (i: I) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      out[cur] = await fn(items[cur]);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---- очистка HTML из комментариев HN ----
const ENTITIES: Record<string, string> = {
  '&gt;': '>',
  '&lt;': '<',
  '&amp;': '&',
  '&quot;': '"',
  '&#x27;': "'",
  '&#x2F;': '/',
  '&#62;': '>',
  '&#60;': '<',
};

export function cleanHtml(html: string): string {
  let t = html.replace(/<p>/gi, '\n').replace(/<\/?[a-z][^>]*>/gi, ' ');
  t = t.replace(/&#x?[0-9a-f]+;|&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? ' ');
  return t.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

function domainOf(url?: string): string {
  if (!url) return 'news.ycombinator.com';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'news.ycombinator.com';
  }
}

// Грубая репутация по известным доменам (0..1). Незнакомым — нейтральные 0.55.
const DOMAIN_RELIABILITY: Record<string, number> = {
  'nytimes.com': 0.85, 'bbc.com': 0.88, 'reuters.com': 0.92, 'theguardian.com': 0.82,
  'wsj.com': 0.84, 'arstechnica.com': 0.8, 'nature.com': 0.95, 'science.org': 0.94,
  'github.com': 0.9, 'wikipedia.org': 0.8, 'bloomberg.com': 0.83, 'apnews.com': 0.9,
  'theverge.com': 0.7, 'techcrunch.com': 0.68, 'medium.com': 0.5, 'substack.com': 0.5,
  'youtube.com': 0.4, 'twitter.com': 0.35, 'x.com': 0.35, 'reddit.com': 0.45,
};

// Классификация темы по ключевым словам заголовка → русские лейблы (как в UI).
function classifyTopic(title: string): string {
  const t = title.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (has('ai', 'gpt', 'llm', 'model', 'neural', 'machine learning', 'openai', 'anthropic')) return 'ИИ';
  if (has('security', 'breach', 'hack', 'leak', 'vulnerab', 'exploit', 'malware', 'cve')) return 'Безопасность';
  if (has('climate', 'energy', 'carbon', 'solar', 'nuclear', 'environment', 'emission')) return 'Экология';
  if (has('health', 'medical', 'cancer', 'drug', 'vaccine', 'brain', 'disease', 'bio')) return 'Здоровье';
  if (has('space', 'physics', 'quantum', 'research', 'scientist', 'study', 'discovery', 'math')) return 'Наука';
  if (has('government', 'election', '政', 'policy', 'senate', 'court', 'law', 'regulation', 'ban')) return 'Политика';
  if (has('economy', 'market', 'startup', 'funding', 'ipo', 'layoff', 'revenue', 'bank')) return 'Экономика';
  return 'Технологии';
}

export interface IngestResult {
  sources: Source[];
  news: News[];
  comments: RawComment[];
}

export interface IngestOptions {
  storyCount?: number; // сколько топ-историй взять
  commentsPerStory?: number; // сколько комментариев на историю
}

/** Собрать живой датасет из Hacker News. */
export async function ingestHackerNews(opts: IngestOptions = {}): Promise<IngestResult> {
  const storyCount = opts.storyCount ?? 8;
  const commentsPerStory = opts.commentsPerStory ?? 24;

  const topIds = (await fetchJson<number[]>(`${HN}/topstories.json`)) || [];
  const stories = (
    await pool(topIds.slice(0, storyCount * 2), 8, (id) => fetchJson<HnItem>(`${HN}/item/${id}.json`))
  )
    .filter((s): s is HnItem => !!s && s.type === 'story' && !!s.title && (s.kids?.length ?? 0) > 0)
    .slice(0, storyCount);

  const sources = new Map<string, Source>();
  sources.set('hn', {
    id: 'hn', name: 'Hacker News', domain: 'news.ycombinator.com',
    type: 'forum', country: 'US', politicalBias: 0, reliabilityScore: 0.55,
  });

  const news: News[] = [];
  const comments: RawComment[] = [];
  const userCache = new Map<string, HnUser | null>();

  async function getUser(handle: string): Promise<HnUser | null> {
    if (userCache.has(handle)) return userCache.get(handle)!;
    const u = await fetchJson<HnUser>(`${HN}/user/${handle}.json`);
    userCache.set(handle, u);
    return u;
  }

  for (const story of stories) {
    const domain = domainOf(story.url);
    const srcId = `src-${domain}`;
    if (!sources.has(srcId)) {
      sources.set(srcId, {
        id: srcId, name: domain, domain, type: 'media', country: 'US',
        politicalBias: 0, reliabilityScore: DOMAIN_RELIABILITY[domain] ?? 0.55,
      });
    }

    const storyTime = (story.time ?? Math.floor(Date.now() / 1000)) * 1000;
    news.push({
      id: `hn-${story.id}`,
      title: story.title!,
      summary: story.text ? cleanHtml(story.text).slice(0, 280)
        : `Обсуждение на Hacker News: ${story.descendants ?? 0} комментариев, ${story.score ?? 0} голосов.`,
      url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
      topic: classifyTopic(story.title!),
      country: 'US',
      language: 'en',
      publishedAt: new Date(storyTime).toISOString(),
      sourceIds: [srcId, 'hn'],
    });

    // верхнеуровневые комментарии истории
    const kidIds = (story.kids ?? []).slice(0, commentsPerStory);
    const kidItems = (await pool(kidIds, 8, (id) => fetchJson<HnItem>(`${HN}/item/${id}.json`)))
      .filter((c): c is HnItem => !!c && c.type === 'comment' && !!c.text && !c.deleted && !c.dead && !!c.by);

    // данные авторов (возраст аккаунта/активность) — реальные бот-сигналы
    const authors = [...new Set(kidItems.map((c) => c.by!))];
    const users = await pool(authors, 8, getUser);
    const userByHandle = new Map(authors.map((h, i) => [h, users[i]]));

    for (const c of kidItems) {
      const u = userByHandle.get(c.by!) || null;
      const createdMs = (u?.created ?? story.time ?? 0) * 1000;
      const ageDays = Math.max(1, Math.round((storyTime - createdMs) / 86400000));
      const submissions = u?.submitted?.length ?? 1;
      const freq = Number((submissions / ageDays).toFixed(2));
      const text = cleanHtml(c.text!);
      if (text.length < 2) continue;
      comments.push({
        id: `c-${c.id}`,
        newsId: `hn-${story.id}`,
        sourceId: 'hn',
        authorHandle: c.by!,
        text,
        language: 'en',
        likes: 0,
        reposts: 0,
        createdAt: new Date((c.time ?? story.time ?? 0) * 1000).toISOString(),
        accountAgeDays: ageDays,
        postFrequencyPerDay: freq,
      });
    }
  }

  return { sources: [...sources.values()], news, comments };
}
