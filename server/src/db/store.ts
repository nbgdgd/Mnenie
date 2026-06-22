// In-memory store. Если есть собранный живой датасет (server/data/live.json,
// формируется `npm run ingest`), грузит его; иначе откатывается на сид-данные.
// Кэширует результаты анализа. В проде заменяется на Postgres/ClickHouse.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { News, NewsAnalysis, NewsCard, RawComment, Source } from '../types.js';
import { analyzeNews } from '../analysis/engine.js';
import {
  comments as seedComments,
  news as seedNews,
  sources as seedSources,
} from './seedData.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIVE_PATH = resolve(__dirname, '../../data/live.json');

interface Dataset {
  sources: Source[];
  news: News[];
  comments: RawComment[];
}

function loadDataset(): { data: Dataset; live: boolean } {
  if (existsSync(LIVE_PATH)) {
    try {
      const parsed = JSON.parse(readFileSync(LIVE_PATH, 'utf8')) as Dataset;
      if (parsed.news?.length) {
        console.log(`[store] живой датасет: ${parsed.news.length} новостей из Hacker News`);
        return { data: parsed, live: true };
      }
    } catch (e) {
      console.warn('[store] не удалось прочитать live.json, использую сид-данные:', e);
    }
  }
  return { data: { sources: seedSources, news: seedNews, comments: seedComments }, live: false };
}

const { data } = loadDataset();
const { sources, news, comments } = data;

const sourceById = new Map(sources.map((s) => [s.id, s]));
const commentsByNews = new Map<string, RawComment[]>();
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
