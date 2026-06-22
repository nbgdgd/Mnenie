// Анализ комментариев под экран COMMENTS ANALYTICS.
// Per-comment: тональность (support/against/neutral), controversy, bot-probability,
// influence, repetition; затем кластеризация (включая ОТДЕЛЬНЫЙ кластер меньшинства
// — мнения меньшинства не удаляются), система выявления влияния (ИПСО) и heatmap.
//
// ML-пайплайн (объяснимый, без внешних API; [PROD]-замены см. ARCHITECTURE.md §5):
//   sentiment (лексикон + отрицания) → stance (маркеры доверия) →
//   bot-score (возраст/частота/near-dup/хэндл) → controversy (конфликт с
//   мажоритарным мнением + тональная сила + токсичность) → influence (бот ×
//   повтор × охват) → кластеризация → детекторы координации/пропаганды/всплесков.
import {
  CommentClusterGroup,
  CommentClusterKind,
  CommentDetail,
  CommentSentiment,
  CommentsAnalytics,
  InfluenceFlag,
  InfluenceSignal,
  RawComment,
} from '../types.js';
import { scoreBot, textFingerprint } from '../nlp/botDetection.js';
import { analyzeEmotion, analyzeSentiment } from '../nlp/sentiment.js';
import { classifyStance } from '../nlp/stance.js';

const CLUSTER_LABELS: Record<CommentClusterKind, string> = {
  support: 'Основная поддержка',
  opposition: 'Основная оппозиция',
  neutral: 'Нейтральные',
  minority: 'Меньшинство / редкие мнения',
  suspicious: 'Подозрительные / повторяющиеся',
};

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const flagOf = (score0to100: number): InfluenceFlag =>
  score0to100 >= 60 ? 'high' : score0to100 >= 35 ? 'medium' : 'low';

interface Enriched extends CommentDetail {
  fingerprint: string;
}

/** Главная точка входа: считает полную аналитику комментариев для новости. */
export function analyzeCommentsAnalytics(newsId: string, comments: RawComment[]): CommentsAnalytics {
  const total = comments.length;
  if (total === 0) {
    return {
      newsId,
      summary: {
        totalComments: 0, supportPct: 0, againstPct: 0, neutralPct: 0,
        controversialPct: 0, botLikelihoodPct: 0, influenceScorePct: 0,
      },
      clusters: [],
      influence: { score: 0, flag: 'low', signals: [] },
      heatmap: [],
      comments: [],
    };
  }

  // near-dup: считаем частоту отпечатков (координация/повторы)
  const fpCount = new Map<string, number>();
  const fpFirst = new Map<string, string>();
  for (const c of comments) {
    const fp = textFingerprint(c.text);
    fpCount.set(fp, (fpCount.get(fp) || 0) + 1);
    if (!fpFirst.has(fp)) fpFirst.set(fp, c.id);
  }

  // 1-й проход: тональность/позиция/бот/повтор
  const pre = comments.map((c) => {
    const fp = textFingerprint(c.text);
    const dup = (fpCount.get(fp) || 1) - 1;
    const { sentiment: sLabel, score } = analyzeSentiment(c.text);
    const emotion = analyzeEmotion(c.text);
    const { stance } = classifyStance(c.text);
    const { botScore, toxicity } = scoreBot(c, dup);

    // support/against/neutral: тональность + сдвиг по позиции к новости
    const lean = score + (stance === 'believe' ? 0.2 : stance === 'disbelieve' ? -0.2 : 0);
    const sentiment: CommentSentiment =
      lean > 0.15 ? 'support' : lean < -0.15 ? 'against' : 'neutral';

    const isRepetitive = dup >= 1;
    const duplicateOf = isRepetitive ? (fpFirst.get(fp) === c.id ? null : fpFirst.get(fp)!) : null;

    return {
      raw: c, fp, sentiment, score, emotion, toxicity,
      botProbability: Math.round(botScore * 100), isRepetitive, duplicateOf,
    };
  });

  // мажоритарное направление (для controversy)
  const decided = pre.filter((p) => p.sentiment !== 'neutral');
  const supN = decided.filter((p) => p.sentiment === 'support').length;
  const agnN = decided.filter((p) => p.sentiment === 'against').length;
  const majoritySide: CommentSentiment = supN >= agnN ? 'support' : 'against';
  const minoritySide: CommentSentiment = majoritySide === 'support' ? 'against' : 'support';
  const minorityShare = decided.length ? Math.min(supN, agnN) / decided.length : 0;

  // 2-й проход: controversy, influence, кластер
  const enriched: Enriched[] = pre.map((p) => {
    const opposesMajority = p.sentiment !== 'neutral' && p.sentiment !== majoritySide;
    const angerLike = p.emotion === 'anger' || p.emotion === 'disgust';
    const controversyScore = Math.round(
      clamp(
        (opposesMajority ? 50 : p.sentiment === 'neutral' ? 18 : 8) +
          Math.abs(p.score) * 25 +
          p.toxicity * 25 +
          (angerLike ? 12 : 0),
      ),
    );

    const reach = Math.min(1, Math.log10(1 + p.raw.likes + p.raw.reposts) / 2);
    const influenceRaw =
      0.5 * (p.botProbability / 100) + 0.3 * (p.isRepetitive ? 1 : 0) +
      0.1 * Math.abs(p.score) + 0.1 * reach;
    const influence = flagOf(Math.round(influenceRaw * 100));

    // приоритетная партиция по кластерам
    const suspicious = p.botProbability >= 50 || p.isRepetitive;
    const isMinority =
      !suspicious && p.sentiment === minoritySide && minorityShare > 0 && minorityShare <= 0.25;
    let cluster: CommentClusterKind;
    if (suspicious) cluster = 'suspicious';
    else if (isMinority) cluster = 'minority';
    else if (p.sentiment === 'support') cluster = 'support';
    else if (p.sentiment === 'against') cluster = 'opposition';
    else cluster = 'neutral';

    return {
      id: p.raw.id,
      author: p.raw.authorHandle,
      text: p.raw.text,
      createdAt: p.raw.createdAt,
      sentiment: p.sentiment,
      sentimentScore: p.score,
      emotion: p.emotion,
      controversyScore,
      botProbability: p.botProbability,
      influence,
      isRepetitive: p.isRepetitive,
      duplicateOf: p.duplicateOf,
      cluster,
      likes: p.raw.likes,
      fingerprint: p.fp,
    };
  });

  // ---- сводка ----
  const share = (n: number) => Math.round((n / total) * 100);
  const supportPct = share(enriched.filter((e) => e.sentiment === 'support').length);
  const againstPct = share(enriched.filter((e) => e.sentiment === 'against').length);
  const neutralPct = Math.max(0, 100 - supportPct - againstPct);
  const controversialPct = share(enriched.filter((e) => e.controversyScore >= 60).length);
  const botLikelihoodPct = Math.round(
    enriched.reduce((s, e) => s + e.botProbability, 0) / total,
  );

  // ---- система выявления влияния ----
  const influence = detectInfluence(enriched, fpCount, total);

  // ---- кластеры ----
  const clusters = buildClusters(enriched, total);

  // ---- heatmap контроверсивности по времени ----
  const heatmap = buildHeatmap(enriched);

  return {
    newsId,
    summary: {
      totalComments: total,
      supportPct, againstPct, neutralPct,
      controversialPct,
      botLikelihoodPct,
      influenceScorePct: influence.score,
    },
    clusters,
    influence,
    heatmap,
    comments: enriched.map(({ fingerprint, ...c }) => c),
  };
}

function buildClusters(enriched: Enriched[], total: number): CommentClusterGroup[] {
  const order: CommentClusterKind[] = ['support', 'opposition', 'neutral', 'minority', 'suspicious'];
  const groups: CommentClusterGroup[] = [];
  for (const kind of order) {
    const members = enriched.filter((e) => e.cluster === kind);
    if (members.length === 0) continue;
    // репрезентант — самый «содержательный» (по длине, но не повтор)
    const rep =
      members.slice().sort((a, b) => b.text.length - a.text.length).find((m) => !m.isRepetitive) ||
      members[0];
    const sentiments = new Set(members.map((m) => m.sentiment));
    const sentiment: CommentSentiment | 'mixed' =
      sentiments.size === 1 ? [...sentiments][0] : 'mixed';
    groups.push({
      kind,
      label: CLUSTER_LABELS[kind],
      size: members.length,
      sharePct: Math.round((members.length / total) * 100),
      sentiment,
      representative: rep.text.replace(/\s+/g, ' ').slice(0, 160),
      commentIds: members.map((m) => m.id),
    });
  }
  return groups;
}

function detectInfluence(
  enriched: Enriched[],
  fpCount: Map<string, number>,
  total: number,
): CommentsAnalytics['influence'] {
  const signals: InfluenceSignal[] = [];

  // координированная сеть: доля вероятных ботов
  const botRatio = enriched.filter((e) => e.botProbability >= 50).length / total;
  if (botRatio > 0.2) {
    const score = Math.round(clamp(botRatio * 130));
    signals.push({
      kind: 'coordinated',
      label: 'Координированная сеть',
      severity: flagOf(score),
      detail: `${Math.round(botRatio * 100)}% комментариев похожи на ботов/автоматизацию`,
      score,
    });
  }

  // пропаганда-повторы: группы одинаковых сообщений
  const dupGroups = [...fpCount.values()].filter((v) => v >= 3);
  const dupMessages = dupGroups.reduce((a, b) => a + b, 0);
  const dupRatio = dupMessages / total;
  if (dupGroups.length > 0 && dupRatio > 0.12) {
    const score = Math.round(clamp(dupRatio * 160));
    signals.push({
      kind: 'propaganda_repetition',
      label: 'Повторяющиеся шаблоны',
      severity: flagOf(score),
      detail: `Групп одинаковых сообщений: ${dupGroups.length} (${Math.round(dupRatio * 100)}% потока)`,
      score,
    });
  }

  // сортировка по времени для всплесков/скорости
  const sorted = enriched
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const start = new Date(sorted[0].createdAt).getTime();
  const end = new Date(sorted[sorted.length - 1].createdAt).getTime();
  const span = Math.max(1, end - start);

  // всплеск в одном направлении: окно с резким перекосом support/against
  const buckets = 8;
  const step = span / buckets;
  let maxSkew = 0;
  for (let b = 0; b < buckets; b++) {
    const lo = start + step * b;
    const hi = lo + step;
    const inBucket = sorted.filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return t >= lo && t < hi;
    });
    if (inBucket.length < 4) continue;
    const sup = inBucket.filter((c) => c.sentiment === 'support').length / inBucket.length;
    const agn = inBucket.filter((c) => c.sentiment === 'against').length / inBucket.length;
    maxSkew = Math.max(maxSkew, sup, agn);
  }
  if (maxSkew >= 0.8) {
    const score = Math.round(clamp((maxSkew - 0.5) * 160));
    signals.push({
      kind: 'sentiment_spike',
      label: 'Всплеск одного мнения',
      severity: flagOf(score),
      detail: `В одном временном окне до ${Math.round(maxSkew * 100)}% реакций в одну сторону`,
      score,
    });
  }

  // аномальная скорость: пик сообщений/окно против медианы.
  // ВАЖНО: всплеск сразу после публикации — обычно органический интерес, а не
  // координация. Поэтому скорость показываем как сигнал, но она НЕ формирует
  // influence score сама по себе — только усиливает фон при наличии ботов/повторов.
  const perBucket = new Array(buckets).fill(0);
  for (const c of sorted) {
    const idx = Math.min(buckets - 1, Math.floor((new Date(c.createdAt).getTime() - start) / step));
    perBucket[idx]++;
  }
  const nonZero = perBucket.filter((v) => v > 0).sort((a, b) => a - b);
  const median = nonZero.length ? nonZero[Math.floor(nonZero.length / 2)] : 0;
  const peak = Math.max(...perBucket);
  const velocityRatio = median > 0 ? peak / median : 0;
  const suspiciousBackground = botRatio > 0.12 || dupRatio > 0.1;
  if (median > 0 && velocityRatio >= 4 && peak >= 6) {
    // органический всплеск → low/medium; с подозрительным фоном → выше
    const raw = Math.round(clamp(velocityRatio * 12));
    const score = suspiciousBackground ? raw : Math.min(35, raw);
    signals.push({
      kind: 'velocity_anomaly',
      label: 'Аномальная скорость',
      severity: suspiciousBackground ? flagOf(score) : 'low',
      detail: `Пик ${peak} комм./окно при медиане ${median}${
        suspiciousBackground ? ' на фоне подозрительной активности' : ' (вероятно органический интерес)'
      }`,
      score,
    });
  }

  // Итоговый influence score формируют ТОЛЬКО манипулятивные признаки:
  // доля ботов, повторы (пропаганда) и резкий перекос мнения в окне.
  // Скорость даёт небольшой бонус лишь при подозрительном фоне.
  const manipulation = 48 * botRatio + 34 * dupRatio + 90 * Math.max(0, maxSkew - 0.72);
  const velocityBonus = suspiciousBackground ? Math.min(15, velocityRatio * 2) : 0;
  const score = Math.round(clamp(manipulation + velocityBonus));

  return { score, flag: flagOf(score), signals };
}

function buildHeatmap(enriched: Enriched[]): number[] {
  const buckets = 12;
  const sorted = enriched
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (sorted.length === 0) return [];
  const start = new Date(sorted[0].createdAt).getTime();
  const end = new Date(sorted[sorted.length - 1].createdAt).getTime();
  const span = Math.max(1, end - start);
  const step = span / buckets;
  const cells = new Array(buckets).fill(0);
  const counts = new Array(buckets).fill(0);
  for (const c of sorted) {
    const idx = Math.min(buckets - 1, Math.floor((new Date(c.createdAt).getTime() - start) / step));
    cells[idx] += c.controversyScore;
    counts[idx]++;
  }
  return cells.map((sum, i) => (counts[i] ? Math.round(sum / counts[i]) : 0));
}
