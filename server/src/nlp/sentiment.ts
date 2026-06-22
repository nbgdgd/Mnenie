// 5.1 Анализ тональности + 5.3 эмоции (интерпретируемая реализация).
import { Emotion, Sentiment } from '../types.js';
import { EMOTION_LEXICON, INTENSIFIERS, NEGATORS, NEGATIVE, POSITIVE } from './lexicons.js';
import { capsRatio, exclamationIntensity, normalize, tokenize } from './text.js';

export interface SentimentResult {
  sentiment: Sentiment;
  score: number; // -1..1
}

/**
 * Лексиконная тональность с учётом отрицаний и усилителей.
 * Окно отрицания/усиления — 2 токена.
 */
export function analyzeSentiment(text: string): SentimentResult {
  const tokens = tokenize(text);
  let score = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    let polarity = 0;
    if (POSITIVE.some((w) => t.startsWith(w))) polarity = 1;
    else if (NEGATIVE.some((w) => t.startsWith(w))) polarity = -1;
    if (polarity === 0) continue;

    let mult = 1;
    for (let j = Math.max(0, i - 2); j < i; j++) {
      if (NEGATORS.includes(tokens[j])) mult *= -1;
      if (INTENSIFIERS.includes(tokens[j])) mult *= 1.5;
    }
    score += polarity * mult;
  }

  // нормализуем по длине, насыщение через tanh
  const norm = tokens.length ? score / Math.sqrt(tokens.length) : 0;
  const bounded = Math.tanh(norm);
  let sentiment: Sentiment = 'neutral';
  if (bounded > 0.15) sentiment = 'positive';
  else if (bounded < -0.15) sentiment = 'negative';
  return { sentiment, score: Number(bounded.toFixed(3)) };
}

export function analyzeEmotion(text: string): Emotion {
  const norm = normalize(text);
  const scores: Record<string, number> = {};
  for (const [emotion, words] of Object.entries(EMOTION_LEXICON)) {
    scores[emotion] = words.reduce((acc, w) => acc + (norm.includes(w) ? 1 : 0), 0);
  }
  // усиление по капсу/восклицаниям тянет к anger/surprise
  const intensity = capsRatio(text) + exclamationIntensity(text);
  if (intensity > 0.6) scores.anger += 0.5;

  let best: Emotion = 'neutral';
  let bestScore = 0;
  for (const [emotion, s] of Object.entries(scores)) {
    if (s > bestScore) {
      bestScore = s;
      best = emotion as Emotion;
    }
  }
  return best;
}
