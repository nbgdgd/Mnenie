// Общие утилиты для коннекторов сбора (HN, Lobsters, Lemmy).
import { Source } from '../types.js';

/** GET JSON с таймаутом и ретраями. */
export async function fetchJson<T>(url: string, tries = 3): Promise<T | null> {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'MnenieBot/0.1 (news-opinion-analysis)' },
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`${res.status}`);
      return (await res.json()) as T;
    } catch {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return null;
}

/** Пул с ограничением параллелизма. */
export async function pool<I, O>(items: I[], limit: number, fn: (i: I) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      out[cur] = await fn(items[cur]);
    }
  });
  await Promise.all(workers);
  return out;
}

const ENTITIES: Record<string, string> = {
  '&gt;': '>', '&lt;': '<', '&amp;': '&', '&quot;': '"',
  '&#x27;': "'", '&#x2f;': '/', '&#62;': '>', '&#60;': '<', '&#38;': '&', '&nbsp;': ' ',
};

/** Очистка HTML → текст (комментарии HN/Lobsters). */
export function cleanHtml(html: string): string {
  let t = html.replace(/<p>/gi, '\n').replace(/<\/?[a-z][^>]*>/gi, ' ');
  t = t.replace(/&#x?[0-9a-f]+;|&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? ' ');
  return t.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

/** Очистка Markdown → текст (комментарии Lemmy). */
export function cleanMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // картинки
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // ссылки → текст
    .replace(/```[\s\S]*?```/g, ' ') // блоки кода
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^>+\s?/gm, '') // цитаты
    .replace(/[*_#~]/g, '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function domainOf(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Грубая репутация по известным доменам (0..1); незнакомым — нейтральные 0.55.
export const DOMAIN_RELIABILITY: Record<string, number> = {
  'nytimes.com': 0.85, 'bbc.com': 0.88, 'reuters.com': 0.92, 'theguardian.com': 0.82,
  'wsj.com': 0.84, 'arstechnica.com': 0.8, 'nature.com': 0.95, 'science.org': 0.94,
  'github.com': 0.9, 'wikipedia.org': 0.8, 'bloomberg.com': 0.83, 'apnews.com': 0.9,
  'theverge.com': 0.7, 'techcrunch.com': 0.68, 'medium.com': 0.5, 'substack.com': 0.5,
  'youtube.com': 0.4, 'twitter.com': 0.35, 'x.com': 0.35, 'reddit.com': 0.45,
};

export function reliabilityOf(domain: string): number {
  return DOMAIN_RELIABILITY[domain] ?? 0.55;
}

/** Классификация темы по тексту заголовка/тегам → русские лейблы (как в UI). */
export function classifyTopic(text: string): string {
  const t = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (has('ai', 'gpt', 'llm', ' model', 'neural', 'machine learning', 'openai', 'anthropic')) return 'ИИ';
  if (has('security', 'breach', 'hack', 'leak', 'vulnerab', 'exploit', 'malware', 'cve', 'privacy')) return 'Безопасность';
  if (has('climate', 'energy', 'carbon', 'solar', 'nuclear', 'environment', 'emission', 'weather')) return 'Экология';
  if (has('health', 'medical', 'cancer', 'drug', 'vaccine', 'brain', 'disease', 'bio', 'covid')) return 'Здоровье';
  if (has('space', 'physics', 'quantum', 'research', 'scientist', 'study', 'discovery', 'math', 'science')) return 'Наука';
  if (has('government', 'election', 'policy', 'senate', 'court', 'law', 'regulation', 'ban', 'politic', 'war', 'protest')) return 'Политика';
  if (has('economy', 'market', 'startup', 'funding', 'ipo', 'layoff', 'revenue', 'bank', 'tax', 'price', 'inflation')) return 'Экономика';
  if (has('game', 'gaming', 'movie', 'music', 'art', 'meme', 'funny', 'sport', 'film')) return 'Культура';
  return 'Технологии';
}

/** Источник-площадка (форум/соцсеть), откуда пришли комментарии. */
export function platformSource(
  id: string, name: string, domain: string, reliability: number,
): Source {
  return { id, name, domain, type: 'forum', country: 'US', politicalBias: 0, reliabilityScore: reliability };
}
