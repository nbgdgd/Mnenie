// Коннектор Hacker News (Firebase API, без ключей): топ-истории + комментарии +
// данные авторов (возраст аккаунта/активность → реальные бот-сигналы).
import { News, RawComment, Source } from '../types.js';
import {
  classifyTopic, cleanHtml, domainOf, fetchJson, platformSource, pool, reliabilityOf,
} from './util.js';

const HN = 'https://hacker-news.firebaseio.com/v0';

interface HnItem {
  id: number; type?: string; by?: string; time?: number;
  title?: string; url?: string; text?: string; score?: number;
  descendants?: number; kids?: number[]; deleted?: boolean; dead?: boolean;
}
interface HnUser { id: string; created?: number; karma?: number; submitted?: number[] }

export interface IngestResult { sources: Source[]; news: News[]; comments: RawComment[] }
export interface IngestOptions { storyCount?: number; commentsPerStory?: number }

export async function ingestHackerNews(opts: IngestOptions = {}): Promise<IngestResult> {
  const storyCount = opts.storyCount ?? 6;
  const commentsPerStory = opts.commentsPerStory ?? 22;

  const topIds = (await fetchJson<number[]>(`${HN}/topstories.json`)) || [];
  const stories = (
    await pool(topIds.slice(0, storyCount * 2), 8, (id) => fetchJson<HnItem>(`${HN}/item/${id}.json`))
  )
    .filter((s): s is HnItem => !!s && s.type === 'story' && !!s.title && (s.kids?.length ?? 0) > 0)
    .slice(0, storyCount);

  const sources = new Map<string, Source>();
  sources.set('hn', platformSource('hn', 'Hacker News', 'news.ycombinator.com', 0.55));

  const news: News[] = [];
  const comments: RawComment[] = [];
  const userCache = new Map<string, HnUser | null>();
  const getUser = async (h: string) => {
    if (userCache.has(h)) return userCache.get(h)!;
    const u = await fetchJson<HnUser>(`${HN}/user/${h}.json`);
    userCache.set(h, u);
    return u;
  };

  for (const story of stories) {
    const domain = domainOf(story.url) || 'news.ycombinator.com';
    const srcId = `src-${domain}`;
    if (!sources.has(srcId)) {
      sources.set(srcId, {
        id: srcId, name: domain, domain, type: 'media', country: 'US',
        politicalBias: 0, reliabilityScore: reliabilityOf(domain),
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
      country: 'US', language: 'en',
      publishedAt: new Date(storyTime).toISOString(),
      sourceIds: [srcId, 'hn'],
    });

    const kidIds = (story.kids ?? []).slice(0, commentsPerStory);
    const kidItems = (await pool(kidIds, 8, (id) => fetchJson<HnItem>(`${HN}/item/${id}.json`)))
      .filter((c): c is HnItem => !!c && c.type === 'comment' && !!c.text && !c.deleted && !c.dead && !!c.by);

    const authors = [...new Set(kidItems.map((c) => c.by!))];
    const users = await pool(authors, 8, getUser);
    const userByHandle = new Map(authors.map((h, i) => [h, users[i]]));

    for (const c of kidItems) {
      const u = userByHandle.get(c.by!) || null;
      const createdMs = (u?.created ?? story.time ?? 0) * 1000;
      const ageDays = Math.max(1, Math.round((storyTime - createdMs) / 86400000));
      const freq = Number(((u?.submitted?.length ?? 1) / ageDays).toFixed(2));
      const text = cleanHtml(c.text!);
      if (text.length < 2) continue;
      comments.push({
        id: `c-hn-${c.id}`, newsId: `hn-${story.id}`, sourceId: 'hn',
        authorHandle: c.by!, text, language: 'en', likes: 0, reposts: 0,
        createdAt: new Date((c.time ?? story.time ?? 0) * 1000).toISOString(),
        accountAgeDays: ageDays, postFrequencyPerDay: freq,
      });
    }
  }
  return { sources: [...sources.values()], news, comments };
}
