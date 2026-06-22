// 5.4 Выявление ботов и подозрительной активности + токсичность.
import { RawComment } from '../types.js';
import { TOXIC } from './lexicons.js';
import { containsAny, normalize, tokenize } from './text.js';

export interface BotResult {
  botScore: number; // 0..1
  toxicity: number; // 0..1
}

/** SimHash-подобный отпечаток для поиска near-dup сообщений. */
export function textFingerprint(text: string): string {
  const tokens = tokenize(text).sort();
  return tokens.slice(0, 12).join(' ');
}

/**
 * Эвристический бот-скор по признакам аккаунта и сообщения.
 * dupCount — сколько других комментариев имеют такой же отпечаток (координация).
 */
export function scoreBot(c: RawComment, dupCount: number): BotResult {
  let score = 0;

  // молодой аккаунт
  if (c.accountAgeDays < 30) score += 0.3;
  else if (c.accountAgeDays < 120) score += 0.15;

  // аномальная частота постинга
  if (c.postFrequencyPerDay > 50) score += 0.3;
  else if (c.postFrequencyPerDay > 20) score += 0.15;

  // шаблонность / near-dup с другими аккаунтами
  if (dupCount >= 3) score += 0.3;
  else if (dupCount >= 1) score += 0.15;

  // очень короткие лозунговые сообщения
  const tokens = tokenize(c.text);
  if (tokens.length <= 3) score += 0.1;

  // подозрительный хэндл (цифровой хвост)
  if (/\d{4,}$/.test(c.authorHandle)) score += 0.1;

  const norm = normalize(c.text);
  const toxHits = containsAny(norm, TOXIC);
  const toxicity = Math.min(1, toxHits / 2);

  return {
    botScore: Number(Math.min(1, score).toFixed(3)),
    toxicity: Number(toxicity.toFixed(3)),
  };
}
