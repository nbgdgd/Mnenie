// Переиспользуемые визуальные компоненты и палитра.
import type { ReactNode } from 'react';

export const COLORS = {
  believe: '#34d399',
  disbelieve: '#f87171',
  undecided: '#94a3b8',
  trust: '#60a5fa',
  warn: '#fbbf24',
  bg: '#0f172a',
};

export const EMOTION_LABELS: Record<string, string> = {
  anger: 'Гнев',
  fear: 'Страх',
  joy: 'Радость',
  disgust: 'Отвращение',
  surprise: 'Удивление',
  trust: 'Доверие',
  sadness: 'Грусть',
  neutral: 'Нейтрально',
};

export function trustColor(v: number): string {
  if (v >= 66) return COLORS.believe;
  if (v >= 40) return COLORS.warn;
  return COLORS.disbelieve;
}

/** Полукруглый индикатор доверия (gauge) на SVG. */
export function Gauge({ value, label }: { value: number; label: string }) {
  const r = 70;
  const cx = 90;
  const cy = 90;
  const angle = Math.PI * (1 - value / 100); // 180°..0°
  const x = cx + r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);
  const color = trustColor(value);
  return (
    <div className="gauge">
      <svg viewBox="0 0 180 110" width="180" height="110">
        <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="#1e293b" strokeWidth="14" />
        <path
          d={`M20 90 A70 70 0 0 1 ${x} ${y}`}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <text x="90" y="80" textAnchor="middle" className="gauge-value" fill={color}>
          {value}
        </text>
      </svg>
      <div className="gauge-label">{label}</div>
    </div>
  );
}

/** Горизонтальная мини-полоса распределения позиций. */
export function StanceBar({
  believe,
  disbelieve,
  undecided,
}: {
  believe: number;
  disbelieve: number;
  undecided: number;
}) {
  return (
    <div className="stancebar" title={`верят ${believe}% / не верят ${disbelieve}% / не определились ${undecided}%`}>
      <span style={{ width: `${believe}%`, background: COLORS.believe }} />
      <span style={{ width: `${undecided}%`, background: COLORS.undecided }} />
      <span style={{ width: `${disbelieve}%`, background: COLORS.disbelieve }} />
    </div>
  );
}

export function Metric({ label, value, color, hint }: { label: string; value: ReactNode; color?: string; hint?: string }) {
  return (
    <div className="metric" title={hint}>
      <div className="metric-value" style={color ? { color } : undefined}>{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'warn' | 'info' | 'muted' }) {
  return <span className={`badge badge-${tone ?? 'info'}`}>{children}</span>;
}

export function Section({ title, children, subtitle }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        {subtitle && <span className="panel-sub">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}
