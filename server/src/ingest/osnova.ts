// Коннектор платформы Osnova (единый движок DTF и VC.ru) — РУССКОЯЗЫЧНЫЕ
// обсуждения. timeline → записи; /comments?contentId=ID → комментарии.
import { News, RawComment, Source } from '../types.js';
import { classifyTopic, cleanHtml, fetchJson, platformSource } from './util.js';
import type { IngestResult } from './hackernews.js';

interface OsEntry {
  id: number; title: string; date: number; url?: string;
  counters?: { comments?: number }; subsite?: { name?: string };
}
interface OsComment {
  id: number; date: number; text?: string; html?: string;
  author?: { id?: number; name?: string }; likes?: { summ?: number };
  isRemoved?: boolean;
}

export interface OsnovaConfig {
  host: string; // api.dtf.ru | api.vc.ru
  sourceId: string; // dtf | vc
  name: string; // DTF | VC.ru
  domain: string; // dtf.ru | vc.ru
  defaultTopic: string; // Культура | Экономика
}

function topicOf(cfg: OsnovaConfig, subsite: string, title: string): string {
  const s = (subsite + ' ' + title).toLowerCase();
  if (/игр|game|gaming|инди|киберспорт/.test(s)) return 'Культура';
  if (/кино|сериал|аниме|музык|комикс|арт|культур/.test(s)) return 'Культура';
  if (/политик|война|власт|закон|санкци|общество/.test(s)) return 'Политика';
  if (/эконом|бизнес|деньг|рынок|крипт|финанс|стартап|маркетинг/.test(s)) return 'Экономика';
  if (/наук|космос|физик|исследован/.test(s)) return 'Наука';
  if (/ии|нейросет|gpt|\bai\b/.test(s)) return 'ИИ';
  if (/техн|гаджет|софт|девайс|железо|разраб|код/.test(s)) return 'Технологии';
  const c = classifyTopic(title);
  return c === 'Технологии' ? cfg.defaultTopic : c;
}

export async function ingestOsnova(
  cfg: OsnovaConfig,
  opts: { entryCount?: number; commentsPerEntry?: number } = {},
): Promise<IngestResult> {
  const entryCount = opts.entryCount ?? 8;
  const commentsPerEntry = opts.commentsPerEntry ?? 40;
  const API = `https://${cfg.host}/v2.1`;

  // берём несколько лент, чтобы набрать больше записей
  const feeds = ['sorting=hotness', 'sorting=date'];
  const seen = new Set<number>();
  const entries: OsEntry[] = [];
  for (const f of feeds) {
    const tl = await fetchJson<{ result?: { items?: { data?: OsEntry }[] } }>(`${API}/timeline?${f}`);
    for (const it of tl?.result?.items || []) {
      const e = it.data;
      if (e && e.id && e.title && (e.counters?.comments ?? 0) >= 5 && !seen.has(e.id)) {
        seen.add(e.id);
        entries.push(e);
      }
    }
    if (entries.length >= entryCount) break;
  }
  const picked = entries.slice(0, entryCount);

  const sources = new Map<string, Source>();
  sources.set(cfg.sourceId, platformSource(cfg.sourceId, cfg.name, cfg.domain, 0.42));

  const news: News[] = [];
  const comments: RawComment[] = [];

  for (const e of picked) {
    const subsite = e.subsite?.name || cfg.name;
    const srcId = `${cfg.sourceId}-c-${subsite}`;
    if (!sources.has(srcId)) {
      sources.set(srcId, {
        id: srcId, name: subsite, domain: cfg.domain, type: 'social',
        country: 'RU', politicalBias: 0, reliabilityScore: 0.42,
      });
    }
    const entryTime = e.date * 1000;
    news.push({
      id: `${cfg.sourceId}-${e.id}`,
      title: e.title,
      summary: `Обсуждение на ${cfg.name} (${subsite}): ${e.counters?.comments ?? 0} комментариев.`,
      url: e.url || `https://${cfg.domain}/${e.id}`,
      topic: topicOf(cfg, subsite, e.title),
      country: 'RU', language: 'ru',
      publishedAt: new Date(entryTime).toISOString(),
      sourceIds: [srcId, cfg.sourceId],
    });

    const cl = await fetchJson<{ result?: { items?: OsComment[] } }>(
      `${API}/comments?contentId=${e.id}&order=popularity`,
    );
    const raw = (cl?.result?.items || [])
      .filter((c) => !c.isRemoved && (c.text || c.html) && c.author?.name)
      .slice(0, commentsPerEntry);

    for (const c of raw) {
      const text = cleanHtml(c.text || c.html || '').trim();
      if (text.length < 2) continue;
      comments.push({
        id: `c-${cfg.sourceId}-${c.id}`, newsId: `${cfg.sourceId}-${e.id}`, sourceId: cfg.sourceId,
        authorHandle: c.author!.name!, text, language: 'ru',
        likes: Math.max(0, c.likes?.summ ?? 0), reposts: 0,
        createdAt: new Date(c.date * 1000).toISOString(),
        accountAgeDays: 365, postFrequencyPerDay: 1,
      });
    }
  }
  return { sources: [...sources.values()], news, comments };
}

export const ingestDtf = (o?: { entryCount?: number; commentsPerEntry?: number }) =>
  ingestOsnova({ host: 'api.dtf.ru', sourceId: 'dtf', name: 'DTF', domain: 'dtf.ru', defaultTopic: 'Культура' }, o);

export const ingestVc = (o?: { entryCount?: number; commentsPerEntry?: number }) =>
  ingestOsnova({ host: 'api.vc.ru', sourceId: 'vc', name: 'VC.ru', domain: 'vc.ru', defaultTopic: 'Экономика' }, o);
