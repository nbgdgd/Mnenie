// CLI-сбор: тянет живые новости и комментарии из нескольких источников
// (RU + переведённые EN), прогоняет через движок анализа и пишет:
//   server/data/live.json      — сырой датасет {sources, news, comments} для backend
//   mobile/assets/snapshot.json — предрасчитанные ответы API для приложения
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
import { ingestDtf, ingestVc } from './osnova.js';
import { ingestHabr } from './habr.js';
import { translateRu, isRussian } from './translate.js';
import { pool } from './util.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

function toCard(a: NewsAnalysis): NewsCard {
  return { news: a.news, sources: a.sources, metrics: a.metrics, campaignDetected: a.campaign.detected };
}

function write(path: string, data: unknown) {
  const full = resolve(ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(data, null, 2));
  const kb = (JSON.stringify(data).length / 1024).toFixed(0);
  console.log(`  → ${path} (${kb} KB)`);
}

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

// Убираем новости без комментариев и дубли по заголовку.
function cleanup({ sources, news, comments }: IngestResult): IngestResult {
  const countByNews = new Map<string, number>();
  for (const c of comments) countByNews.set(c.newsId, (countByNews.get(c.newsId) || 0) + 1);

  const normTitle = (t: string) => t.toLowerCase().replace(/[^a-zа-я0-9]+/gi, ' ').trim();
  const bestByTitle = new Map<string, News>();
  for (const n of news) {
    if ((countByNews.get(n.id) || 0) < 3) continue;
    const key = normTitle(n.title);
    const prev = bestByTitle.get(key);
    if (!prev || (countByNews.get(n.id) || 0) > (countByNews.get(prev.id) || 0)) bestByTitle.set(key, n);
  }
  const keptNews = [...bestByTitle.values()];
  const keptIds = new Set(keptNews.map((n) => n.id));
  const keptComments = comments.filter((c) => keptIds.has(c.newsId));
  const usedSources = new Set<string>();
  for (const n of keptNews) n.sourceIds.forEach((id) => usedSources.add(id));
  for (const c of keptComments) usedSources.add(c.sourceId);
  return { sources: sources.filter((s) => usedSources.has(s.id)), news: keptNews, comments: keptComments };
}

// Переводит на русский всё, что не на русском (заголовки/сводки/комментарии).
async function translateAll({ news, comments }: IngestResult): Promise<void> {
  const titles = news.filter((n) => !isRussian(n.title));
  const summaries = news.filter((n) => n.summary && !isRussian(n.summary));
  const cmts = comments.filter((c) => !isRussian(c.text));
  console.log(
    `Перевод на русский: ${titles.length} заголовков, ${summaries.length} сводок, ${cmts.length} комментариев…`,
  );
  await pool(titles, 8, async (n) => { n.title = await translateRu(n.title); n.language = 'ru'; });
  await pool(summaries, 8, async (n) => { n.summary = await translateRu(n.summary); });
  await pool(cmts, 10, async (c) => { c.text = await translateRu(c.text); c.language = 'ru'; });
}

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
    safe('Hacker News', () => ingestHackerNews({ storyCount: 8, commentsPerStory: 22 })),
    safe('Lobsters', () => ingestLobsters({ storyCount: 6, commentsPerStory: 20 })),
    safe('Lemmy', () => ingestLemmy({ postCount: 7, commentsPerPost: 24 })),
    safe('DTF (RU)', () => ingestDtf({ entryCount: 8, commentsPerEntry: 45 })),
    safe('VC.ru (RU)', () => ingestVc({ entryCount: 8, commentsPerEntry: 45 })),
    safe('Habr (RU)', () => ingestHabr({ articleCount: 8, commentsPerArticle: 45 })),
  ]);
  const { sources, news, comments } = cleanup(merge(parts));
  console.log(`Собрано: ${news.length} новостей, ${comments.length} комментариев, ${sources.length} источников.`);

  if (news.length === 0) {
    console.error('Не удалось собрать новости. Артефакты не перезаписаны.');
    process.exit(1);
  }

  await translateAll({ sources, news, comments });

  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const commentsByNews = new Map<string, RawComment[]>();
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
  const commentsMap: Record<string, CommentsAnalytics> = {};
  for (const n of news) commentsMap[n.id] = analyzeCommentsAnalytics(n.id, commentsByNews.get(n.id) || []);

  console.log('Запись артефактов:');
  write('server/data/live.json', { generatedAt: new Date().toISOString(), sources, news, comments });

  const cards = analyses.map(toCard);
  const byRecent = [...analyses].sort(
    (a, b) => new Date(b.news.publishedAt).getTime() - new Date(a.news.publishedAt).getTime(),
  );
  const analysisMap: Record<string, NewsAnalysis> = {};
  for (const a of analyses) analysisMap[a.news.id] = a;

  const avg = (f: (a: NewsAnalysis) => number) =>
    Math.round(analyses.reduce((s, a) => s + f(a), 0) / Math.max(1, analyses.length));
  const avgC = (f: (c: CommentsAnalytics) => number) => {
    const vals = Object.values(commentsMap);
    return Math.round(vals.reduce((s, c) => s + f(c), 0) / Math.max(1, vals.length));
  };

  // разбивка по источникам и темам (расширенная статистика)
  const platformSources = sources.filter((s) => ['hn', 'lobsters', 'lemmy', 'dtf', 'vc', 'habr'].includes(s.id));
  const bySource = platformSources.map((s) => ({
    id: s.id,
    name: s.name,
    news: news.filter((n) => n.sourceIds.includes(s.id)).length,
    comments: comments.filter((c) => c.sourceId === s.id).length,
  })).filter((x) => x.news > 0);
  const topicsList = [...new Set(news.map((n) => n.topic))].sort();
  const byTopic = topicsList.map((t) => ({ topic: t, news: news.filter((n) => n.topic === t).length }));

  const stats = {
    totalNews: analyses.length,
    totalComments: comments.length,
    totalSources: platformSources.length,
    avgTrustIndex: avg((a) => a.metrics.trustIndex),
    avgPolarization: avg((a) => a.metrics.polarization),
    avgControversy: avgC((c) => c.summary.controversialPct),
    avgBotLikelihood: avgC((c) => c.summary.botLikelihoodPct),
    avgInfluence: avgC((c) => c.summary.influenceScorePct),
    campaignsDetected: analyses.filter((a) => a.campaign.detected).length,
    influenceAlerts: Object.values(commentsMap).filter((c) => c.influence.flag !== 'low').length,
    topics: topicsList.length,
    countries: [...new Set(news.map((n) => n.country))].length,
    bySource,
    byTopic,
  };

  const snapshot = {
    generatedAt: new Date().toISOString(),
    cards: byRecent.map(toCard),
    analyses: analysisMap,
    commentsAnalytics: commentsMap,
    filters: { countries: [...new Set(news.map((n) => n.country))].sort(), topics: topicsList },
    stats,
    controversial: [...cards].sort((a, b) => b.metrics.polarization - a.metrics.polarization),
    polarized: [...analyses]
      .sort((a, b) => b.metrics.polarization + b.campaign.score * 10 - (a.metrics.polarization + a.campaign.score * 10))
      .map(toCard),
  };
  write('mobile/assets/snapshot.json', snapshot);

  console.log(`\nГотово. ${stats.totalNews} новостей, ${stats.totalComments} комментариев из ${stats.totalSources} источников.`);
  console.log('Разбивка по источникам:', bySource.map((s) => `${s.name} ${s.news}н/${s.comments}к`).join(', '));
  console.log('Темы:', byTopic.map((t) => `${t.topic}(${t.news})`).join(', '));
}

main().catch((e) => {
  console.error('Сбой сбора:', e);
  process.exit(1);
});
