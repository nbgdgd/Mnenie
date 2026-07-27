// Перевод текста на русский через публичный endpoint Google Translate (gtx),
// без ключей. Используется для иностранных источников (HN, Lobsters, Lemmy-EN),
// чтобы всё в приложении было на русском. Кэш + устойчивость к сбоям (при ошибке
// возвращаем оригинал, чтобы сбор не падал).
const cache = new Map<string, string>();

function parseGtx(json: unknown): string | null {
  // ответ: [[[translated, original, ...], ...], ...]
  if (!Array.isArray(json) || !Array.isArray(json[0])) return null;
  let out = '';
  for (const seg of json[0] as unknown[]) {
    if (Array.isArray(seg) && typeof seg[0] === 'string') out += seg[0];
  }
  return out || null;
}

export async function translateRu(text: string, from = 'auto'): Promise<string> {
  const t = text.trim();
  if (!t) return text;
  if (cache.has(t)) return cache.get(t)!;
  // длинные комментарии режем (gtx-лимит ~5000)
  const q = t.length > 4500 ? t.slice(0, 4500) : t;
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=ru&dt=t&q=` +
    encodeURIComponent(q);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MnenieBot/0.1)' },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`${res.status}`);
      const translated = parseGtx(await res.json());
      if (translated) {
        cache.set(t, translated);
        return translated;
      }
      throw new Error('empty');
    } catch {
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  return text; // fallback: оригинал
}

/** Содержит ли текст кириллицу (тогда перевод не нужен). */
export function isRussian(text: string): boolean {
  const cyr = (text.match(/[а-яё]/gi) || []).length;
  const lat = (text.match(/[a-z]/gi) || []).length;
  return cyr > lat;
}
