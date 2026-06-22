// 5.7 Прогноз изменения общественного мнения во времени.
import { OpinionSnapshot } from '../types.js';

/**
 * Прогнозирует траекторию %верят на горизонт `steps` шагов.
 * Модель MVP: затухающий импульс + регрессия к равновесию.
 *
 *   equilibrium ~ truthProbability (правдивые новости со временем набирают доверие)
 *   momentum    — последняя динамика тренда
 *   на каждом шаге: believe += momentum*decay + (equilibrium - believe)*pull
 *
 * [PROD]: заменяется на Temporal Fusion Transformer / Prophet с фичами
 * (скорость роста обсуждения, доля ботов, репутация источников, сила сторон).
 */
export function forecastOpinion(
  history: OpinionSnapshot[],
  truthProbability: number,
  steps = 5,
  stepHours = 12,
): OpinionSnapshot[] {
  if (history.length === 0) return [];
  const last = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : last;

  const equilibrium = truthProbability; // 0..100
  let believe = last.believePct;
  let momentum = last.believePct - prev.believePct;
  const decay = 0.6;
  const pull = 0.25;

  const out: OpinionSnapshot[] = [];
  let ts = new Date(last.ts).getTime();
  for (let i = 0; i < steps; i++) {
    ts += stepHours * 3600 * 1000;
    momentum *= decay;
    believe += momentum + (equilibrium - believe) * pull;
    believe = Math.max(0, Math.min(100, believe));

    // не определившиеся медленно перетекают в определившихся
    let undecided = Math.max(5, last.undecidedPct * Math.pow(0.85, i + 1));
    let disbelieve = 100 - believe - undecided;
    if (disbelieve < 0) {
      undecided = Math.max(0, 100 - believe);
      disbelieve = 0;
    }

    out.push({
      ts: new Date(ts).toISOString(),
      believePct: Math.round(believe),
      disbelievePct: Math.round(disbelieve),
      undecidedPct: Math.round(undecided),
      trustIndex: Math.round(believe * 0.7 + equilibrium * 0.3),
      forecast: true,
    });
  }
  return out;
}
