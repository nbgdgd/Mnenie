// Коннектор Habr (kek/v2 API) — РУССКОЯЗЫЧНЫЕ технические статьи с активными
// комментариями. Список статей → комментарии по каждой.
import { News, RawComment, Source } from '../types.js';
import { classifyTopic, cleanHtml, fetchJson, platformSource } from './util.js';
import type { IngestResult } from './hackernews.js';

const BASE = 'https://habr.com/kek/v2';

interface HabrRef {
  id: string; titleHtml?: string; timePublished?: string;
  statistics?: { commentsCount?: number; score?: number };
  hubs?: { title?: string }[];
}
interface HabrList { publicationRefs?: Record<string, HabrRef>; publicationIds?: string[] }
interface HabrComment {
  id: string; timePublished?: string; score?: number; message?: string;
  author?: { alias?: string }; isSuspended?: boolean;
}

function topicOf(title: string, hubs: string): string {
  const s = (title + ' ' + hubs).toLowerCase();
  if (/ии|нейросет|gpt|машинн|ml\b|llm/.test(s)) return 'ИИ';
  if (/безопасн|уязвим|взлом|шифр|приватн/.test(s)) return 'Безопасность';
  if (/эконом|бизнес|стартап|финанс|рынок/.test(s)) return 'Экономика';
  if (/наук|физик|космос|математ|биолог/.test(s)) return 'Наука';
  if (/здоров|медицин|мозг/.test(s)) return 'Здоровье';
  const c = classifyTopic(title);
  return c === 'Технологии' ? 'Технологии' : c;
}

export async function ingestHabr(opts: { articleCount?: number; commentsPerArticle?: number } = {}): Promise<IngestResult> {
  const articleCount = opts.articleCount ?? 8;
  const commentsPerArticle = opts.commentsPerArticle ?? 40;

  const list = await fetchJson<HabrList>(
    `${BASE}/articles/?fl=ru&hl=ru&sort=rating&types[]=article&page=1`,
  );
  const refs = list?.publicationRefs || {};
  const articles = Object.values(refs)
    .filter((a) => (a.statistics?.commentsCount ?? 0) >= 5 && a.titleHtml)
    .sort((a, b) => (b.statistics?.commentsCount ?? 0) - (a.statistics?.commentsCount ?? 0))
    .slice(0, articleCount);

  const sources = new Map<string, Source>();
  sources.set('habr', platformSource('habr', 'Habr', 'habr.com', 0.6));

  const news: News[] = [];
  const comments: RawComment[] = [];

  for (const a of articles) {
    const title = cleanHtml(a.titleHtml || '').trim();
    if (!title) continue;
    const hubs = (a.hubs || []).map((h) => h.title).filter(Boolean).join(' ');
    const artTime = a.timePublished ? new Date(a.timePublished).getTime() : Date.now();
    news.push({
      id: `habr-${a.id}`,
      title,
      summary: `Статья на Habr: ${a.statistics?.commentsCount ?? 0} комментариев, рейтинг ${a.statistics?.score ?? 0}.`,
      url: `https://habr.com/ru/articles/${a.id}/`,
      topic: topicOf(title, hubs),
      country: 'RU', language: 'ru',
      publishedAt: new Date(artTime).toISOString(),
      sourceIds: ['habr'],
    });

    const cl = await fetchJson<{ comments?: Record<string, HabrComment> }>(
      `${BASE}/articles/${a.id}/comments/?fl=ru&hl=ru`,
    );
    const raw = Object.values(cl?.comments || {})
      .filter((c) => !c.isSuspended && c.message && c.author?.alias)
      .slice(0, commentsPerArticle);

    for (const c of raw) {
      const text = cleanHtml(c.message || '').trim();
      if (text.length < 2) continue;
      comments.push({
        id: `c-habr-${c.id}`, newsId: `habr-${a.id}`, sourceId: 'habr',
        authorHandle: c.author!.alias!, text, language: 'ru',
        likes: Math.max(0, c.score ?? 0), reposts: 0,
        createdAt: c.timePublished ? new Date(c.timePublished).toISOString() : new Date(artTime).toISOString(),
        accountAgeDays: 365, postFrequencyPerDay: 1,
      });
    }
  }
  return { sources: [...sources.values()], news, comments };
}
