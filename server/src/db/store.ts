// In-memory store, сидированный из seedData. Кэширует результаты анализа.
// В проде заменяется на Postgres/ClickHouse (см. schema.sql).
import { NewsAnalysis, NewsCard } from '../types.js';
import { analyzeNews } from '../analysis/engine.js';
import { comments, news, sources } from './seedData.js';

const sourceById = new Map(sources.map((s) => [s.id, s]));
const commentsByNews = new Map<string, typeof comments>();
for (const c of comments) {
  if (!commentsByNews.has(c.newsId)) commentsByNews.set(c.newsId, []);
  commentsByNews.get(c.newsId)!.push(c);
}

const analysisCache = new Map<string, NewsAnalysis>();

export function getAnalysis(newsId: string): NewsAnalysis | null {
  if (analysisCache.has(newsId)) return analysisCache.get(newsId)!;
  const n = news.find((x) => x.id === newsId);
  if (!n) return null;
  const result = analyzeNews({
    news: n,
    sources: n.sourceIds.map((id) => sourceById.get(id)!).filter(Boolean),
    comments: commentsByNews.get(newsId) || [],
  });
  analysisCache.set(newsId, result);
  return result;
}

export function getAllAnalyses(): NewsAnalysis[] {
  return news.map((n) => getAnalysis(n.id)!).filter(Boolean);
}

export function toCard(a: NewsAnalysis): NewsCard {
  return {
    news: a.news,
    sources: a.sources,
    metrics: a.metrics,
    campaignDetected: a.campaign.detected,
  };
}

export function listFilters() {
  return {
    countries: [...new Set(news.map((n) => n.country))].sort(),
    topics: [...new Set(news.map((n) => n.topic))].sort(),
  };
}

export function allSources() {
  return sources;
}
