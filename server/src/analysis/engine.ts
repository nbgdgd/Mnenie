// Движок анализа: из новости + комментариев + источников считает все метрики,
// вердикт, динамику, гео, кампании и кластеры аргументов.
import {
  ArgumentCluster,
  CampaignSignal,
  CommentAnalysis,
  EmotionBreakdown,
  Emotion,
  GeoOpinion,
  NewsAnalysis,
  NewsMetrics,
  News,
  OpinionSnapshot,
  RawComment,
  Source,
  Stance,
  Verdict,
} from '../types.js';
import { clusterArguments } from '../nlp/argumentClustering.js';
import { scoreBot, textFingerprint } from '../nlp/botDetection.js';
import { forecastOpinion } from '../nlp/predictor.js';
import { analyzeEmotion, analyzeSentiment } from '../nlp/sentiment.js';
import { classifyStance } from '../nlp/stance.js';

export interface AnalyzeInput {
  news: News;
  sources: Source[];
  comments: RawComment[];
}

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

/** Анализ каждого комментария + вес мнения (понижается за ботов/токсичность). */
function analyzeComments(comments: RawComment[]): CommentAnalysis[] {
  // отпечатки для поиска near-dup (координация)
  const fpCount = new Map<string, number>();
  for (const c of comments) {
    const fp = textFingerprint(c.text);
    fpCount.set(fp, (fpCount.get(fp) || 0) + 1);
  }

  return comments.map((c) => {
    const fp = textFingerprint(c.text);
    const dup = (fpCount.get(fp) || 1) - 1;
    const { sentiment, score } = analyzeSentiment(c.text);
    const emotion = analyzeEmotion(c.text);
    const { stance } = classifyStance(c.text);
    const { botScore, toxicity } = scoreBot(c, dup);

    // вес: реальные нетоксичные мнения важнее; немного учитываем лайки
    const credibility = (1 - botScore) * (1 - 0.5 * toxicity);
    const reach = 1 + Math.log10(1 + c.likes + c.reposts);
    const weight = Number((credibility * reach).toFixed(3));

    return {
      commentId: c.id,
      sentiment,
      sentimentScore: score,
      emotion,
      stance,
      botScore,
      toxicity,
      argumentClusterId: null,
      weight,
    };
  });
}

function computeMetrics(
  comments: RawComment[],
  analyses: CommentAnalysis[],
  sources: Source[],
  campaign: CampaignSignal,
): NewsMetrics {
  // взвешенные доли позиций
  const wSum: Record<Stance, number> = { believe: 0, disbelieve: 0, undecided: 0 };
  let totalWeight = 0;
  for (const a of analyses) {
    wSum[a.stance] += a.weight;
    totalWeight += a.weight;
  }
  const believePct = pct(wSum.believe, totalWeight);
  const disbelievePct = pct(wSum.disbelieve, totalWeight);
  const undecidedPct = Math.max(0, 100 - believePct - disbelievePct);

  // поляризация: максимум при сильном расколе believe vs disbelieve
  const decided = wSum.believe + wSum.disbelieve;
  const balance = decided === 0 ? 0 : 1 - Math.abs(wSum.believe - wSum.disbelieve) / decided;
  const engagement = totalWeight === 0 ? 0 : decided / totalWeight;
  const polarization = Math.round(balance * engagement * 100);

  // репутация источников и кросс-подтверждение
  const avgReliability =
    sources.reduce((s, x) => s + x.reliabilityScore, 0) / Math.max(1, sources.length);
  const independentSources = new Set(sources.map((s) => s.domain)).size;
  const crossConfirm = Math.min(1, independentSources / 3);

  // вероятность правды: источники × подтверждение × (1 - координация) × сигнал доверия аудитории
  const audienceSignal = totalWeight === 0 ? 0.5 : wSum.believe / Math.max(1, decided);
  const truthProbability = Math.round(
    100 *
      clamp01(
        0.45 * avgReliability +
          0.2 * crossConfirm +
          0.2 * (1 - campaign.score) +
          0.15 * audienceSignal,
      ),
  );

  // индекс доверия аудитории (0..100)
  const trustIndex = Math.round(
    clamp01(
      0.55 * (believePct / 100) +
        0.25 * avgReliability +
        0.2 * (1 - campaign.botRatio),
    ) * 100,
  );

  // уверенность прогноза: объём данных × согласованность × чистота от ботов
  const volumeFactor = Math.min(1, comments.length / 25);
  const consistency = Math.max(believePct, disbelievePct, undecidedPct) / 100;
  const confidence = Number(
    clamp01(0.5 * volumeFactor + 0.3 * consistency + 0.2 * (1 - campaign.botRatio)).toFixed(2),
  );

  // эмоции
  const emoCount = new Map<Emotion, number>();
  for (const a of analyses) emoCount.set(a.emotion, (emoCount.get(a.emotion) || 0) + 1);
  const emotions: EmotionBreakdown[] = [...emoCount.entries()]
    .map(([emotion, n]) => ({ emotion, pct: pct(n, analyses.length) }))
    .sort((a, b) => b.pct - a.pct);

  return {
    trustIndex,
    believePct,
    disbelievePct,
    undecidedPct,
    polarization,
    truthProbability,
    botRatio: campaign.botRatio,
    confidence,
    sampleSize: comments.length,
    emotions,
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function detectCampaign(comments: RawComment[], analyses: CommentAnalysis[]): CampaignSignal {
  const botScores = analyses.map((a) => a.botScore);
  const botRatio = botScores.length
    ? Number((botScores.filter((s) => s >= 0.5).length / botScores.length).toFixed(3))
    : 0;

  // координация: доля near-dup сообщений
  const fpCount = new Map<string, number>();
  for (const c of comments) {
    const fp = textFingerprint(c.text);
    fpCount.set(fp, (fpCount.get(fp) || 0) + 1);
  }
  const dupMessages = [...fpCount.values()].filter((v) => v >= 3).reduce((a, b) => a + b, 0);
  const dupRatio = comments.length ? dupMessages / comments.length : 0;

  // временной всплеск: много новых аккаунтов в узком окне
  const youngBurst =
    comments.length === 0
      ? 0
      : comments.filter((c) => c.accountAgeDays < 30 && c.postFrequencyPerDay > 20).length /
        comments.length;

  const score = Number(clamp01(0.45 * botRatio + 0.35 * dupRatio + 0.2 * youngBurst).toFixed(3));
  const kinds: string[] = [];
  const evidence: string[] = [];
  if (botRatio > 0.25) {
    kinds.push('Сеть ботов');
    evidence.push(`Доля подозрительных аккаунтов: ${Math.round(botRatio * 100)}%`);
  }
  if (dupRatio > 0.15) {
    kinds.push('Скоординированные сообщения');
    evidence.push(`Повторяющиеся (near-dup) сообщения: ${Math.round(dupRatio * 100)}%`);
  }
  if (youngBurst > 0.2) {
    kinds.push('Всплеск молодых аккаунтов');
    evidence.push(`Молодые аккаунты с высокой активностью: ${Math.round(youngBurst * 100)}%`);
  }

  return { detected: score >= 0.3, score, botRatio, kinds, evidence };
}

function buildVerdict(
  metrics: NewsMetrics,
  analyses: CommentAnalysis[],
  comments: RawComment[],
): Verdict {
  const tagged = analyses.map((a) => {
    const c = comments.find((x) => x.id === a.commentId)!;
    return { comment: c, stance: a.stance, weight: a.weight };
  });
  const clusters = clusterArguments(tagged);

  // распределение для «суда общества»
  let support = 0,
    condemn = 0;
  for (const a of analyses) {
    if (a.sentimentScore > 0.15) support += a.weight;
    else if (a.sentimentScore < -0.15) condemn += a.weight;
  }
  const totalW = analyses.reduce((s, a) => s + a.weight, 0) || 1;
  const breakdown = {
    support: Math.round((support / totalW) * 100),
    condemn: Math.round((condemn / totalW) * 100),
    undecided: metrics.undecidedPct,
    fake: metrics.disbelievePct,
    truth: metrics.believePct,
  };

  // итоговый вердикт
  let verdict: Verdict['verdict'];
  if (metrics.believePct >= 55) verdict = 'Считают правдой';
  else if (metrics.disbelievePct >= 55) verdict = 'Считают фейком';
  else if (breakdown.support - breakdown.condemn >= 20) verdict = 'Поддерживают';
  else if (breakdown.condemn - breakdown.support >= 20) verdict = 'Осуждают';
  else verdict = 'Не определились';

  // мажоритарная сторона по позиции
  const majoritySide: Stance = metrics.believePct >= metrics.disbelievePct ? 'believe' : 'disbelieve';
  const minoritySide: Stance = majoritySide === 'believe' ? 'disbelieve' : 'believe';

  return {
    verdict,
    confidence: metrics.confidence,
    breakdown,
    majorityArguments: clusters.filter((c) => c.side === majoritySide).slice(0, 3),
    minorityArguments: clusters.filter((c) => c.side === minoritySide).slice(0, 3),
  };
}

function buildGeo(comments: RawComment[], analyses: CommentAnalysis[], sources: Source[]): GeoOpinion[] {
  const sourceCountry = new Map(sources.map((s) => [s.id, s.country]));
  const byCountry = new Map<string, { believe: number; disbelieve: number; total: number }>();
  for (const a of analyses) {
    const c = comments.find((x) => x.id === a.commentId)!;
    const country = sourceCountry.get(c.sourceId) || 'Other';
    if (!byCountry.has(country)) byCountry.set(country, { believe: 0, disbelieve: 0, total: 0 });
    const g = byCountry.get(country)!;
    g.total += 1;
    if (a.stance === 'believe') g.believe += 1;
    else if (a.stance === 'disbelieve') g.disbelieve += 1;
  }
  return [...byCountry.entries()]
    .map(([country, g]) => ({
      country,
      believePct: pct(g.believe, g.total),
      disbelievePct: pct(g.disbelieve, g.total),
      volume: g.total,
    }))
    .sort((a, b) => b.volume - a.volume);
}

/**
 * Восстанавливает «историю мнения» из временных меток комментариев:
 * скользящее накопление позиций по окнам времени.
 */
function buildTimeline(
  comments: RawComment[],
  analyses: CommentAnalysis[],
  truthProbability: number,
): OpinionSnapshot[] {
  if (comments.length === 0) return [];
  const byId = new Map(analyses.map((a) => [a.commentId, a]));
  const sorted = comments
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const start = new Date(sorted[0].createdAt).getTime();
  const end = new Date(sorted[sorted.length - 1].createdAt).getTime();
  const buckets = 6;
  const span = Math.max(1, end - start);
  const step = span / buckets;

  const snapshots: OpinionSnapshot[] = [];
  for (let b = 1; b <= buckets; b++) {
    const cutoff = start + step * b;
    let believe = 0,
      disbelieve = 0,
      undecided = 0,
      total = 0;
    for (const c of sorted) {
      if (new Date(c.createdAt).getTime() > cutoff) break;
      const a = byId.get(c.id)!;
      total += a.weight;
      if (a.stance === 'believe') believe += a.weight;
      else if (a.stance === 'disbelieve') disbelieve += a.weight;
      else undecided += a.weight;
    }
    if (total === 0) continue;
    const bp = Math.round((believe / total) * 100);
    const dp = Math.round((disbelieve / total) * 100);
    snapshots.push({
      ts: new Date(cutoff).toISOString(),
      believePct: bp,
      disbelievePct: dp,
      undecidedPct: Math.max(0, 100 - bp - dp),
      trustIndex: Math.round(bp * 0.7 + truthProbability * 0.3),
    });
  }

  const forecast = forecastOpinion(snapshots, truthProbability);
  return [...snapshots, ...forecast];
}

export function analyzeNews(input: AnalyzeInput): NewsAnalysis {
  const { news, sources, comments } = input;
  const analyses = analyzeComments(comments);
  const campaign = detectCampaign(comments, analyses);
  const metrics = computeMetrics(comments, analyses, sources, campaign);
  const verdict = buildVerdict(metrics, analyses, comments);
  const timeline = buildTimeline(comments, analyses, metrics.truthProbability);
  const geo = buildGeo(comments, analyses, sources);
  const tagged = analyses.map((a) => ({
    comment: comments.find((x) => x.id === a.commentId)!,
    stance: a.stance,
    weight: a.weight,
  }));
  const clusters = clusterArguments(tagged);

  return { news, sources, metrics, verdict, timeline, geo, campaign, clusters };
}
