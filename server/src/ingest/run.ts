// CLI-сбор: тянет живые новости из Hacker News, прогоняет через движок анализа
// и пишет два артефакта:
//   server/data/live.json      — сырой датасет {sources, news, comments} для backend
//   mobile/assets/snapshot.json — предрасчитанные ответы API для офлайн-работы APK
// Запуск: npm run ingest --workspace=server
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeNews } from '../analysis/engine.js';
import { analyzeCommentsAnalytics } from '../analysis/comments.js';
import { CommentsAnalytics, News, NewsAnalysis, NewsCard, RawComment, Source } from '../types.js';
import { ingestHackerNews, type IngestResult } from './hackernews.js';
import { ingestLobsters } from './lobsters.js';
import { ingestLemmy } from './lemmy.js';
import { ingestDtf } from './dtf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..'); // корень репозитория

function toCard(a: NewsAnalysis): NewsCard {
  return { news: a.news, sources: a.sources, metrics: a.metrics, campaignDetected: a.campaign.detected };
}

function write(path: string, data: unknown) {
  const full = resolve(ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(data, null, 2));
  console.log(`  → ${path}`);
}

// Объединяет результаты коннекторов, дедуплицируя источники по id.
function merge(parts: IngestResult[]): IngestResult {
  const sources = new Map<string, Source>();
  const news: News[] = [];
  const comments: RawComment[] = [];
  for (const p of parts) {
    for (const s of p.sources) if (!sources.has(s.id)) sources.set(s.id, s);
    news.push(...p.news);
    comments.push(...p.comments);
  }
  return { sources: [...sources.values()], news, comments };
}

// Чистка датасета: убираем новости без комментариев и дубли по заголовку
// (одна история может обсуждаться на нескольких площадках — оставляем версию
// с наибольшим числом комментариев).
function cleanup({ sources, news, comments }: IngestResult): IngestResult {
  const countByNews = new Map<string, number>();
  for (const c of comments) countByNews.set(c.newsId, (countByNews.get(c.newsId) || 0) + 1);

  const normTitle = (t: string) => t.toLowerCase().replace(/[^a-zа-я0-9]+/gi, ' ').trim();
  const bestByTitle = new Map<string, News>();
  for (const n of news) {
    if ((countByNews.get(n.id) || 0) < 3) continue; // нужен минимум для анализа
    const key = normTitle(n.title);
    const prev = bestByTitle.get(key);
    if (!prev || (countByNews.get(n.id) || 0) > (countByNews.get(prev.id) || 0)) {
      bestByTitle.set(key, n);
    }
  }
  const keptNews = [...bestByTitle.values()];
  const keptIds = new Set(keptNews.map((n) => n.id));
  const keptComments = comments.filter((c) => keptIds.has(c.newsId));
  const usedSources = new Set<string>();
  for (const n of keptNews) n.sourceIds.forEach((id) => usedSources.add(id));
  for (const c of keptComments) usedSources.add(c.sourceId);
  return {
    sources: sources.filter((s) => usedSources.has(s.id)),
    news: keptNews,
    comments: keptComments,
  };
}

// Запускает коннектор, не роняя весь сбор при сбое одного источника.
async function safe(name: string, fn: () => Promise<IngestResult>): Promise<IngestResult> {
  try {
    const r = await fn();
    console.log(`  ✓ ${name}: ${r.news.length} новостей, ${r.comments.length} комментариев`);
    return r;
  } catch (e) {
    console.warn(`  ✗ ${name}: пропущен (${(e as Error).message})`);
    return { sources: [], news: [], comments: [] };
  }
}

async function main() {
  console.log('Сбор живых новостей из нескольких источников…');
  const parts = await Promise.all([
    safe('Hacker News', () => ingestHackerNews({ storyCount: 5, commentsPerStory: 22 })),
    safe('Lobsters', () => ingestLobsters({ storyCount: 4, commentsPerStory: 20 })),
    safe('Lemmy', () => ingestLemmy({ postCount: 4, commentsPerPost: 22 })),
    safe('DTF (RU)', () => ingestDtf({ entryCount: 4, commentsPerEntry: 26 })),
  ]);
  const merged = merge(parts);
  const { sources, news, comments } = cleanup(merged);
  console.log(`Итого: ${news.length} новостей, ${comments.length} комментариев, ${sources.length} источников.`);

  if (news.length === 0) {
    console.error('Не удалось собрать новости (сеть/лимиты). Артефакты не перезаписаны.');
    process.exit(1);
  }

  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const commentsByNews = new Map<string, typeof comments>();
  for (const c of comments) {
    if (!commentsByNews.has(c.newsId)) commentsByNews.set(c.newsId, []);
    commentsByNews.get(c.newsId)!.push(c);
  }

  const analyses: NewsAnalysis[] = news.map((n) =>
    analyzeNews({
      news: n,
      sources: n.sourceIds.map((id) => sourceById.get(id)!).filter(Boolean),
      comments: commentsByNews.get(n.id) || [],
    }),
  );

  // сырой датасет для backend
  console.log('Запись артефактов:');
  write('server/data/live.json', { generatedAt: new Date().toISOString(), sources, news, comments });

  // предрасчитанный снапшот для офлайн-приложения
  const cards = analyses.map(toCard);
  const byRecent = [...analyses].sort(
    (a, b) => new Date(b.news.publishedAt).getTime() - new Date(a.news.publishedAt).getTime(),
  );
  const analysisMap: Record<string, NewsAnalysis> = {};
  for (const a of analyses) analysisMap[a.news.id] = a;

  // аналитика комментариев для каждой новости (экран COMMENTS ANALYTICS)
  const commentsMap: Record<string, CommentsAnalytics> = {};
  for (const n of news) {
    commentsMap[n.id] = analyzeCommentsAnalytics(n.id, commentsByNews.get(n.id) || []);
  }

  const avg = (f: (a: NewsAnalysis) => number) =>
    Math.round(analyses.reduce((s, a) => s + f(a), 0) / Math.max(1, analyses.length));

  const snapshot = {
    generatedAt: new Date().toISOString(),
    cards: byRecent.map(toCard),
    analyses: analysisMap,
    commentsAnalytics: commentsMap,
    filters: {
      countries: [...new Set(news.map((n) => n.country))].sort(),
      topics: [...new Set(news.map((n) => n.topic))].sort(),
    },
    stats: {
      totalNews: analyses.length,
      avgTrustIndex: avg((a) => a.metrics.trustIndex),
      avgPolarization: avg((a) => a.metrics.polarization),
      campaignsDetected: analyses.filter((a) => a.campaign.detected).length,
      topics: [...new Set(news.map((n) => n.topic))].length,
      countries: [...new Set(news.map((n) => n.country))].length,
    },
    controversial: [...cards].sort((a, b) => b.metrics.polarization - a.metrics.polarization),
    polarized: [...analyses]
      .sort((a, b) => b.metrics.polarization + b.campaign.score * 10 - (a.metrics.polarization + a.campaign.score * 10))
      .map(toCard),
  };
  write('mobile/assets/snapshot.json', snapshot);

  console.log('\nГотово. Топ собранных тем:');
  for (const a of byRecent.slice(0, 8)) {
    console.log(
      `  • [${a.news.topic}] ${a.news.title.slice(0, 60)} — доверие ${a.metrics.trustIndex}, поляр. ${a.metrics.polarization}${a.campaign.detected ? ', ⚠ кампания' : ''}`,
    );
  }
}

main().catch((e) => {
  console.error('Сбой сбора:', e);
  process.exit(1);
});
