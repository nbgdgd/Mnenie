// Коннектор Lemmy (федеративная соцсеть, Reddit-подобная) — разнообразные и часто
// спорные темы (новости, политика, технологии). Даёт посты + комментарии,
// возраст аккаунта автора (creator.published) и счёт голосов (score → likes).
import { News, RawComment, Source } from '../types.js';
import { classifyTopic, cleanMarkdown, fetchJson, platformSource, pool } from './util.js';
import type { IngestResult } from './hackernews.js';

const INSTANCE = 'https://lemmy.world';

interface LemmyPost {
  post: { id: number; name: string; url?: string; body?: string; published: string; nsfw: boolean };
  community: { name: string; title?: string };
  creator: { name: string; published?: string };
  counts: { comments: number; score: number };
}
interface LemmyComment {
  comment: { id: number; content: string; published: string };
  creator: { name: string; published?: string };
  counts: { score: number };
}

// сообщества с осмысленной текстовой дискуссией (не картиночные/мемные)
function topicFromCommunity(community: string, title: string): string {
  const c = community.toLowerCase();
  if (/news|worldnews|politics|ukraine/.test(c)) return 'Политика';
  if (/tech|programming|technology|privacy|linux/.test(c)) return 'Технологии';
  if (/science|space|askscience/.test(c)) return 'Наука';
  if (/health|medicine/.test(c)) return 'Здоровье';
  if (/game|gaming|movies|music/.test(c)) return 'Культура';
  return classifyTopic(`${title} ${community}`);
}

export async function ingestLemmy(opts: { postCount?: number; commentsPerPost?: number } = {}): Promise<IngestResult> {
  const postCount = opts.postCount ?? 4;
  const commentsPerPost = opts.commentsPerPost ?? 22;

  const list = await fetchJson<{ posts?: LemmyPost[] }>(
    `${INSTANCE}/api/v3/post/list?sort=Active&limit=30&type_=All`,
  );
  const candidates = (list?.posts || [])
    .filter((p) => !p.post.nsfw && p.counts.comments >= 6)
    .sort((a, b) => b.counts.comments - a.counts.comments);

  const sources = new Map<string, Source>();
  sources.set('lemmy', platformSource('lemmy', 'Lemmy', 'lemmy.world', 0.45));

  const news: News[] = [];
  const comments: RawComment[] = [];

  let added = 0;
  for (const p of candidates) {
    if (added >= postCount) break;
    const postTime = new Date(p.post.published).getTime();

    const cl = await fetchJson<{ comments?: LemmyComment[] }>(
      `${INSTANCE}/api/v3/comment/list?post_id=${p.post.id}&limit=${commentsPerPost}&sort=Hot&max_depth=1&type_=All`,
    );
    const usable = (cl?.comments || [])
      .map((c) => ({ ...c, clean: cleanMarkdown(c.comment.content) }))
      .filter((c) => c.clean.length >= 8); // отбрасываем картинки/пустышки

    if (usable.length < 4) continue; // пропускаем мемные посты без текста

    const community = p.community.name;
    const srcId = `lemmy-c-${community}`;
    if (!sources.has(srcId)) {
      sources.set(srcId, {
        id: srcId, name: `c/${community}`, domain: 'lemmy.world', type: 'social',
        country: 'US', politicalBias: 0, reliabilityScore: 0.4,
      });
    }

    news.push({
      id: `lem-${p.post.id}`,
      title: p.post.name,
      summary: p.post.body
        ? cleanMarkdown(p.post.body).slice(0, 280)
        : `Обсуждение в Lemmy c/${community}: ${p.counts.comments} комментариев, score ${p.counts.score}.`,
      url: p.post.url || `${INSTANCE}/post/${p.post.id}`,
      topic: topicFromCommunity(community, p.post.name),
      country: 'US', language: 'en',
      publishedAt: new Date(postTime).toISOString(),
      sourceIds: [srcId, 'lemmy'],
    });

    for (const c of usable) {
      const createdMs = c.creator.published ? new Date(c.creator.published).getTime() : postTime;
      const ageDays = Math.max(1, Math.round((postTime - createdMs) / 86400000));
      comments.push({
        id: `c-lem-${c.comment.id}`, newsId: `lem-${p.post.id}`, sourceId: 'lemmy',
        authorHandle: c.creator.name, text: c.clean, language: 'en',
        likes: Math.max(0, c.counts.score ?? 0), reposts: 0,
        createdAt: new Date(c.comment.published).toISOString(),
        accountAgeDays: ageDays, postFrequencyPerDay: 1,
      });
    }
    added++;
  }
  return { sources: [...sources.values()], news, comments };
}
