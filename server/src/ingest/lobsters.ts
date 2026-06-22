// Коннектор Lobsters (lobste.rs) — tech-сообщество с приглашениями (ботов мало).
// hottest.json → истории; /s/{id}.json → комментарии (есть comment_plain и score).
import { News, RawComment, Source } from '../types.js';
import {
  classifyTopic, domainOf, fetchJson, platformSource, pool, reliabilityOf,
} from './util.js';
import type { IngestResult } from './hackernews.js';

interface LobStory {
  short_id: string; title: string; url: string; score: number;
  comment_count: number; created_at: string; tags: string[];
}
interface LobComment {
  short_id: string; created_at: string; score: number; is_deleted?: boolean;
  comment_plain?: string; comment?: string; commenting_user?: string;
}
interface LobUser { username: string; created_at?: string; karma?: number }

export async function ingestLobsters(opts: { storyCount?: number; commentsPerStory?: number } = {}): Promise<IngestResult> {
  const storyCount = opts.storyCount ?? 4;
  const commentsPerStory = opts.commentsPerStory ?? 20;

  const hottest = (await fetchJson<LobStory[]>('https://lobste.rs/hottest.json')) || [];
  const stories = hottest.filter((s) => s.comment_count > 1).slice(0, storyCount);

  const sources = new Map<string, Source>();
  sources.set('lobsters', platformSource('lobsters', 'Lobsters', 'lobste.rs', 0.6));

  const news: News[] = [];
  const comments: RawComment[] = [];
  const userCache = new Map<string, LobUser | null>();
  const getUser = async (h: string) => {
    if (userCache.has(h)) return userCache.get(h)!;
    const u = await fetchJson<LobUser>(`https://lobste.rs/u/${h}.json`);
    userCache.set(h, u);
    return u;
  };

  for (const story of stories) {
    const domain = domainOf(story.url) || 'lobste.rs';
    const srcId = `src-${domain}`;
    if (!sources.has(srcId)) {
      sources.set(srcId, {
        id: srcId, name: domain, domain, type: 'media', country: 'US',
        politicalBias: 0, reliabilityScore: reliabilityOf(domain),
      });
    }
    const storyTime = new Date(story.created_at).getTime();
    news.push({
      id: `lob-${story.short_id}`,
      title: story.title,
      summary: `Обсуждение на Lobsters (${story.tags?.join(', ') || 'tech'}): ${story.comment_count} комментариев, score ${story.score}.`,
      url: story.url || `https://lobste.rs/s/${story.short_id}`,
      topic: classifyTopic(`${story.title} ${story.tags?.join(' ') || ''}`),
      country: 'US', language: 'en',
      publishedAt: new Date(storyTime).toISOString(),
      sourceIds: [srcId, 'lobsters'],
    });

    const full = await fetchJson<{ comments?: LobComment[] }>(`https://lobste.rs/s/${story.short_id}.json`);
    const raw = (full?.comments || [])
      .filter((c) => !c.is_deleted && (c.comment_plain || c.comment) && c.commenting_user)
      .slice(0, commentsPerStory);

    const authors = [...new Set(raw.map((c) => c.commenting_user!))];
    const users = await pool(authors, 6, getUser);
    const userByHandle = new Map(authors.map((h, i) => [h, users[i]]));

    for (const c of raw) {
      const u = userByHandle.get(c.commenting_user!) || null;
      const createdMs = u?.created_at ? new Date(u.created_at).getTime() : storyTime;
      const ageDays = Math.max(1, Math.round((storyTime - createdMs) / 86400000));
      const text = (c.comment_plain || c.comment || '').replace(/\s+/g, ' ').trim();
      if (text.length < 2) continue;
      comments.push({
        id: `c-lob-${c.short_id}`, newsId: `lob-${story.short_id}`, sourceId: 'lobsters',
        authorHandle: c.commenting_user!, text, language: 'en',
        likes: Math.max(0, c.score ?? 0), reposts: 0,
        createdAt: new Date(c.created_at).toISOString(),
        accountAgeDays: ageDays, postFrequencyPerDay: 1,
      });
    }
  }
  return { sources: [...sources.values()], news, comments };
}
