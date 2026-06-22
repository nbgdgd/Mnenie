// Утилиты нормализации и токенизации текста.

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' url ')
    .replace(/[«»"“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-zа-яё0-9]+/i)
    .filter((t) => t.length > 1);
}

/** Простой детектор языка по преобладанию кириллицы/латиницы. */
export function detectLanguage(text: string): string {
  const cyr = (text.match(/[а-яё]/gi) || []).length;
  const lat = (text.match(/[a-z]/gi) || []).length;
  if (cyr === 0 && lat === 0) return 'unknown';
  return cyr >= lat ? 'ru' : 'en';
}

/** Содержит ли текст одну из фраз (учитывает многословные маркеры). */
export function containsAny(normalizedText: string, phrases: string[]): number {
  let count = 0;
  for (const p of phrases) {
    if (normalizedText.includes(p)) count++;
  }
  return count;
}

export function capsRatio(text: string): number {
  const letters = text.replace(/[^a-zа-яё]/gi, '');
  if (!letters.length) return 0;
  const caps = (text.match(/[A-ZА-ЯЁ]/g) || []).length;
  return caps / letters.length;
}

export function exclamationIntensity(text: string): number {
  const marks = (text.match(/[!?]/g) || []).length;
  return Math.min(1, marks / 4);
}
