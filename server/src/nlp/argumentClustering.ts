// 5.5 Кластеризация аргументов сторон по тематическим якорям.
import { ArgumentCluster, RawComment, Stance } from '../types.js';
import { ARGUMENT_THEMES } from './lexicons.js';
import { normalize } from './text.js';

interface Tagged {
  comment: RawComment;
  stance: Stance;
  weight: number;
}

/** Назначает комментарию тематический кластер по ключевым словам. */
export function assignTheme(text: string): string {
  const norm = normalize(text);
  let best = 'Прочее';
  let bestHits = 0;
  for (const theme of ARGUMENT_THEMES) {
    const hits = theme.keywords.reduce((acc, k) => acc + (norm.includes(k) ? 1 : 0), 0);
    if (hits > bestHits) {
      bestHits = hits;
      best = theme.label;
    }
  }
  return best;
}

/**
 * Строит кластеры аргументов: группирует по (сторона + тема), выбирает
 * репрезентативную цитату (самый «весомый» по лайкам и весу комментарий).
 */
export function clusterArguments(tagged: Tagged[]): ArgumentCluster[] {
  const groups = new Map<string, { side: Stance; theme: string; items: Tagged[] }>();

  for (const t of tagged) {
    if (t.stance === 'undecided') continue;
    const theme = assignTheme(t.comment.text);
    const key = `${t.stance}::${theme}`;
    if (!groups.has(key)) groups.set(key, { side: t.stance, theme, items: [] });
    groups.get(key)!.items.push(t);
  }

  const clusters: ArgumentCluster[] = [];
  for (const [key, g] of groups) {
    if (g.items.length === 0) continue;
    const rep = g.items
      .slice()
      .sort((a, b) => b.comment.likes * b.weight - a.comment.likes * a.weight)[0];
    clusters.push({
      id: Buffer.from(key).toString('base64url').slice(0, 16),
      side: g.side,
      label: g.theme,
      size: g.items.length,
      representativeText: rep.comment.text,
    });
  }

  return clusters.sort((a, b) => b.size - a.size);
}
