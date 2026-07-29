// Коннектор Dev.to (dev.to/api) — сообщество разработчиков ПО: статьи о
// программах/софте + комментарии (тредами). Английский → переводится на русский
// в run.ts. Добавляет «софтовые» обсуждения в ленту.
import { News, RawComment, Source } from '../types.js';
import { classifyTopic, cleanHtml, fetchJson, platformSource, pool } from './util.js';
import type { IngestResult } from './hackernews.js';

interface DevArticle {
  id: number; title: string; url: string; comments_count: number;
  public_reactions_count?: number; tag_list?: string[]; published_at?: string;
}
interface DevComment {
  id_code: string; created_at: string; body_html?: string;
  user?: { username?: string }; children?: DevComment[];
}

// разворачиваем дерево комментариев в плоский список
function flatten(nodes: DevComment[], out: DevComment[] = []): DevComment[] {
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) flatten(n.children, out);
  }
  return out;
}

export async function ingestDevto(opts: { articleCount?: number; commentsPerArticle?: number } = {}): Promise<IngestResult> {
  const articleCount = opts.articleCount ?? 6;
  const commentsPerArticle = opts.commentsPerArticle ?? 24;

  const list = (await fetchJson<DevArticle[]>('https://dev.to/api/articles?per_page=30&top=7')) || [];
  const articles = list
    .filter((a) => (a.comments_count ?? 0) >= 4)
    .sort((a, b) => (b.comments_count ?? 0) - (a.comments_count ?? 0))
    .slice(0, articleCount);

  const sources = new Map<string, Source>();
  sources.set('devto', platformSource('devto', 'Dev.to', 'dev.to', 0.5));

  const news: News[] = [];
  const comments: RawComment[] = [];

  await pool(articles, 4, async (a) => {
    const artTime = a.published_at ? new Date(a.published_at).getTime() : Date.now();
    const tags = (a.tag_list || []).join(' ');
    news.push({
      id: `devto-${a.id}`,
      title: a.title,
      summary: `Обсуждение на Dev.to (${a.tag_list?.slice(0, 3).join(', ') || 'dev'}): ${a.comments_count} комментариев, ${a.public_reactions_count ?? 0} реакций.`,
      url: a.url || `https://dev.to/${a.id}`,
      topic: classifyTopic(`${a.title} ${tags}`),
      country: 'US', language: 'en',
      publishedAt: new Date(artTime).toISOString(),
      sourceIds: ['devto'],
    });

    const threads = (await fetchJson<DevComment[]>(`https://dev.to/api/comments?a_id=${a.id}`)) || [];
    const flat = flatten(threads).filter((c) => c.body_html && c.user?.username).slice(0, commentsPerArticle);
    for (const c of flat) {
      const text = cleanHtml(c.body_html || '').trim();
      if (text.length < 2) continue;
      comments.push({
        id: `c-devto-${c.id_code}`, newsId: `devto-${a.id}`, sourceId: 'devto',
        authorHandle: c.user!.username!, text, language: 'en', likes: 0, reposts: 0,
        createdAt: c.created_at ? new Date(c.created_at).toISOString() : new Date(artTime).toISOString(),
        accountAgeDays: 365, postFrequencyPerDay: 1,
      });
    }
  });

  return { sources: [...sources.values()], news, comments };
}
