// CLI-сбор: тянет живые новости из Hacker News, прогоняет через движок анализа
// и пишет два артефакта:
//   server/data/live.json      — сырой датасет {sources, news, comments} для backend
//   mobile/assets/snapshot.json — предрасчитанные ответы API для офлайн-работы APK
// Запуск: npm run ingest --workspace=server
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeNews } from '../analysis/engine.js';
import { NewsAnalysis, NewsCard } from '../types.js';
import { ingestHackerNews } from './hackernews.js';

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

async function main() {
  console.log('Сбор живых новостей из Hacker News…');
  const { sources, news, comments } = await ingestHackerNews({ storyCount: 8, commentsPerStory: 24 });
  console.log(`Собрано: ${news.length} новостей, ${comments.length} комментариев, ${sources.length} источников.`);

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

  const avg = (f: (a: NewsAnalysis) => number) =>
    Math.round(analyses.reduce((s, a) => s + f(a), 0) / Math.max(1, analyses.length));

  const snapshot = {
    generatedAt: new Date().toISOString(),
    cards: byRecent.map(toCard),
    analyses: analysisMap,
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
