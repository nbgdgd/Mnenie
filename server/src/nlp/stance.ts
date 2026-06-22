// 5.2 Классификация позиции/мнения: верит / не верит / не определился.
import { Stance } from '../types.js';
import { BELIEVE_MARKERS, DISBELIEVE_MARKERS, NEGATORS, UNDECIDED_MARKERS } from './lexicons.js';
import { containsAny, normalize, tokenize } from './text.js';

export interface StanceResult {
  stance: Stance;
  confidence: number; // 0..1
}

/**
 * Stance detection относительно тезиса новости.
 * Сигналы: явные маркеры доверия/недоверия/неопределённости + вопросительность.
 * Отрицание у маркера доверия инвертирует его («не верю» → disbelieve).
 */
export function classifyStance(text: string): StanceResult {
  const norm = normalize(text);
  const tokens = tokenize(text);

  let believe = containsAny(norm, BELIEVE_MARKERS);
  let disbelieve = containsAny(norm, DISBELIEVE_MARKERS);
  const undecided = containsAny(norm, UNDECIDED_MARKERS);

  // инверсия: "не верю", "не правда"
  for (let i = 1; i < tokens.length; i++) {
    if (NEGATORS.includes(tokens[i - 1])) {
      if (['верю', 'правда', 'true', 'believe', 'real'].some((w) => tokens[i].startsWith(w))) {
        believe = Math.max(0, believe - 1);
        disbelieve += 1;
      }
    }
  }

  // вопросительность повышает неопределённость
  const questions = (text.match(/\?/g) || []).length;
  const undecidedScore = undecided + (questions > 0 ? 0.5 : 0);

  const scores: Record<Stance, number> = {
    believe,
    disbelieve,
    undecided: undecidedScore,
  };

  const total = scores.believe + scores.disbelieve + scores.undecided;
  if (total === 0) {
    // нет явных сигналов → склоняемся к неопределённости
    return { stance: 'undecided', confidence: 0.25 };
  }

  let best: Stance = 'undecided';
  let bestVal = -1;
  (Object.keys(scores) as Stance[]).forEach((k) => {
    if (scores[k] > bestVal) {
      bestVal = scores[k];
      best = k;
    }
  });

  return { stance: best, confidence: Number((bestVal / total).toFixed(3)) };
}
