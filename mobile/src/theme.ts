// Палитра и хелперы цвета (общие с веб-версией).
export const COLORS = {
  bg: '#0b1120',
  panel: '#111a2e',
  panel2: '#0f172a',
  border: '#1e293b',
  text: '#e2e8f0',
  muted: '#94a3b8',
  accent: '#60a5fa',
  believe: '#34d399',
  disbelieve: '#f87171',
  undecided: '#94a3b8',
  trust: '#60a5fa',
  warn: '#fbbf24',
};

export const EMOTION_LABELS: Record<string, string> = {
  anger: 'Гнев',
  fear: 'Страх',
  joy: 'Радость',
  disgust: 'Отвращение',
  surprise: 'Удивление',
  trust: 'Доверие',
  sadness: 'Грусть',
  neutral: 'Нейтр.',
};

export function trustColor(v: number): string {
  if (v >= 66) return COLORS.believe;
  if (v >= 40) return COLORS.warn;
  return COLORS.disbelieve;
}
