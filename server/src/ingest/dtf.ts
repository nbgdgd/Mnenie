// Коннектор DTF (api.dtf.ru, платформа Osnova) — РУССКОЯЗЫЧНЫЕ обсуждения
// (игры, технологии, культура). Активирует RU-лексиконы NLP-движка.
// timeline → записи; /comments?contentId=ID → комментарии (текст, автор, лайки).
import { News, RawComment, Source } from '../types.js';
import { classifyTopic, cleanHtml, fetchJson, platformSource } from './util.js';
import type { IngestResult } from './hackernews.js';

const API = 'https://api.dtf.ru/v2.1';

interface DtfEntry {
  id: number; title: string; date: number; url?: string;
  counters?: { comments?: number }; subsite?: { name?: string };
}
interface DtfComment {
  id: number; date: number; text?: string; html?: string;
  author?: { id?: number; name?: string }; likes?: { summ?: number };
  isRemoved?: boolean; level?: number;
}

// тема по сабсайту/заголовку (RU)
function topicOf(subsite: string, title: string): string {
  const s = (subsite + ' ' + title).toLowerCase();
  if (/игр|game|gaming|инди|киберспорт/.test(s)) return 'Культура';
  if (/кино|сериал|аниме|музык|комикс|арт/.test(s)) return 'Культура';
  if (/политик|война|власт|закон|санкци/.test(s)) return 'Политика';
  if (/эконом|бизнес|деньг|рынок|крипт/.test(s)) return 'Экономика';
  if (/наук|космос|физик|исследован/.test(s)) return 'Наука';
  if (/ии|нейросет|gpt|ai/.test(s)) return 'ИИ';
  if (/техн|гаджет|софт|девайс|железо/.test(s)) return 'Технологии';
  return classifyTopic(title) === 'Технологии' ? 'Культура' : classifyTopic(title);
}

export async function ingestDtf(opts: { entryCount?: number; commentsPerEntry?: number } = {}): Promise<IngestResult> {
  const entryCount = opts.entryCount ?? 4;
  const commentsPerEntry = opts.commentsPerEntry ?? 26;

  const tl = await fetchJson<{ result?: { items?: { type?: string; data?: DtfEntry }[] } }>(
    `${API}/timeline?sorting=hotness`,
  );
  const entries = (tl?.result?.items || [])
    .map((x) => x.data)
    .filter((e): e is DtfEntry => !!e && !!e.id && !!e.title && (e.counters?.comments ?? 0) >= 6)
    .slice(0, entryCount);

  const sources = new Map<string, Source>();
  sources.set('dtf', platformSource('dtf', 'DTF', 'dtf.ru', 0.4));

  const news: News[] = [];
  const comments: RawComment[] = [];

  for (const e of entries) {
    const subsite = e.subsite?.name || 'DTF';
    const srcId = `dtf-c-${subsite}`;
    if (!sources.has(srcId)) {
      sources.set(srcId, {
        id: srcId, name: subsite, domain: 'dtf.ru', type: 'social',
        country: 'RU', politicalBias: 0, reliabilityScore: 0.4,
      });
    }
    const entryTime = e.date * 1000;
    news.push({
      id: `dtf-${e.id}`,
      title: e.title,
      summary: `Обсуждение на DTF (${subsite}): ${e.counters?.comments ?? 0} комментариев.`,
      url: e.url || `https://dtf.ru/${e.id}`,
      topic: topicOf(subsite, e.title),
      country: 'RU', language: 'ru',
      publishedAt: new Date(entryTime).toISOString(),
      sourceIds: [srcId, 'dtf'],
    });

    const cl = await fetchJson<{ result?: { items?: DtfComment[] } }>(
      `${API}/comments?contentId=${e.id}&order=popularity`,
    );
    const raw = (cl?.result?.items || [])
      .filter((c) => !c.isRemoved && (c.text || c.html) && c.author?.name)
      .slice(0, commentsPerEntry);

    for (const c of raw) {
      const text = cleanHtml(c.text || c.html || '').trim();
      if (text.length < 2) continue;
      comments.push({
        id: `c-dtf-${c.id}`, newsId: `dtf-${e.id}`, sourceId: 'dtf',
        authorHandle: c.author!.name!, text, language: 'ru',
        likes: Math.max(0, c.likes?.summ ?? 0), reposts: 0,
        createdAt: new Date(c.date * 1000).toISOString(),
        accountAgeDays: 365, postFrequencyPerDay: 1,
      });
    }
  }
  return { sources: [...sources.values()], news, comments };
}
