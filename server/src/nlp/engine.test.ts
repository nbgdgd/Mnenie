// Базовые проверки движка анализа (node --test).
import assert from 'node:assert';
import { test } from 'node:test';
import { analyzeSentiment } from './sentiment.js';
import { classifyStance } from './stance.js';
import { scoreBot } from './botDetection.js';
import { analyzeNews } from '../analysis/engine.js';
import { news, sources, comments } from '../db/seedData.js';

test('sentiment: позитив/негатив/отрицание', () => {
  assert.equal(analyzeSentiment('это отлично и честно').sentiment, 'positive');
  assert.equal(analyzeSentiment('это ужас и обман').sentiment, 'negative');
  assert.equal(analyzeSentiment('это не хорошо').score < 0, true);
});

test('stance: верю / фейк / неопределённость', () => {
  assert.equal(classifyStance('это правда, подтверждаю').stance, 'believe');
  assert.equal(classifyStance('это фейк и вброс').stance, 'disbelieve');
  assert.equal(classifyStance('не верю этому').stance, 'disbelieve');
  assert.equal(classifyStance('нужны доказательства, не знаю').stance, 'undecided');
});

test('bot detection: молодой аккаунт + дубли', () => {
  const c = {
    id: 'x', newsId: 'n', sourceId: 's', authorHandle: 'user12345',
    text: 'СРОЧНО РЕПОСТ', language: 'ru', likes: 0, reposts: 40,
    createdAt: new Date().toISOString(), accountAgeDays: 5, postFrequencyPerDay: 60,
  };
  assert.equal(scoreBot(c, 4).botScore > 0.6, true);
});

test('engine: метрики в допустимых диапазонах', () => {
  const n = news[0];
  const a = analyzeNews({
    news: n,
    sources: n.sourceIds.map((id) => sources.find((s) => s.id === id)!),
    comments: comments.filter((c) => c.newsId === n.id),
  });
  const m = a.metrics;
  assert.equal(m.trustIndex >= 0 && m.trustIndex <= 100, true);
  assert.equal(m.believePct + m.disbelievePct + m.undecidedPct <= 101, true);
  assert.ok(a.verdict.verdict.length > 0);
  assert.ok(a.timeline.some((s) => s.forecast));
});

test('engine: координированная кампания детектируется на n2', () => {
  const n = news.find((x) => x.id === 'n2')!;
  const a = analyzeNews({
    news: n,
    sources: n.sourceIds.map((id) => sources.find((s) => s.id === id)!),
    comments: comments.filter((c) => c.newsId === n.id),
  });
  assert.equal(a.campaign.detected, true);
});
