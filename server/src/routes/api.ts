// REST API Mnenie. См. ARCHITECTURE.md §6.
import { Router } from 'express';
import { allSources, getAllAnalyses, getAnalysis, listFilters, toCard } from '../db/store.js';

export const api = Router();

// Лента карточек с фильтрами и сортировкой
api.get('/news', (req, res) => {
  const { country, topic, q, sort } = req.query as Record<string, string>;
  let items = getAllAnalyses();

  if (country) items = items.filter((a) => a.news.country === country);
  if (topic) items = items.filter((a) => a.news.topic === topic);
  if (q) {
    const needle = q.toLowerCase();
    items = items.filter(
      (a) =>
        a.news.title.toLowerCase().includes(needle) ||
        a.news.summary.toLowerCase().includes(needle),
    );
  }

  switch (sort) {
    case 'controversial':
      items.sort((a, b) => b.metrics.polarization - a.metrics.polarization);
      break;
    case 'trust':
      items.sort((a, b) => b.metrics.trustIndex - a.metrics.trustIndex);
      break;
    case 'campaigns':
      items.sort((a, b) => b.campaign.score - a.campaign.score);
      break;
    default:
      items.sort(
        (a, b) => new Date(b.news.publishedAt).getTime() - new Date(a.news.publishedAt).getTime(),
      );
  }

  res.json(items.map(toCard));
});

api.get('/filters', (_req, res) => res.json(listFilters()));

api.get('/sources', (_req, res) => res.json(allSources()));

api.get('/stats', (_req, res) => {
  const all = getAllAnalyses();
  const avg = (f: (a: ReturnType<typeof getAllAnalyses>[number]) => number) =>
    Math.round(all.reduce((s, a) => s + f(a), 0) / Math.max(1, all.length));
  res.json({
    totalNews: all.length,
    avgTrustIndex: avg((a) => a.metrics.trustIndex),
    avgPolarization: avg((a) => a.metrics.polarization),
    campaignsDetected: all.filter((a) => a.campaign.detected).length,
    topics: listFilters().topics.length,
    countries: listFilters().countries.length,
  });
});

api.get('/rankings/controversial', (_req, res) => {
  res.json(
    getAllAnalyses()
      .slice()
      .sort((a, b) => b.metrics.polarization - a.metrics.polarization)
      .map(toCard),
  );
});

api.get('/rankings/polarized', (_req, res) => {
  res.json(
    getAllAnalyses()
      .slice()
      .sort(
        (a, b) =>
          b.metrics.polarization + b.campaign.score * 10 -
          (a.metrics.polarization + a.campaign.score * 10),
      )
      .map(toCard),
  );
});

// Полная аналитика по новости
api.get('/news/:id', (req, res) => {
  const a = getAnalysis(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(a);
});

api.get('/news/:id/verdict', (req, res) => {
  const a = getAnalysis(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(a.verdict);
});

api.get('/news/:id/timeline', (req, res) => {
  const a = getAnalysis(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(a.timeline);
});

api.get('/news/:id/arguments', (req, res) => {
  const a = getAnalysis(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(a.clusters);
});

api.get('/news/:id/geo', (req, res) => {
  const a = getAnalysis(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(a.geo);
});

api.get('/news/:id/sources', (req, res) => {
  const a = getAnalysis(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(a.sources);
});

api.get('/news/:id/campaigns', (req, res) => {
  const a = getAnalysis(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(a.campaign);
});
