import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../api';
import type { NewsAnalysis } from '../types';
import { Badge, COLORS, EMOTION_LABELS, Gauge, Metric, Section, StanceBar } from '../ui';

export default function NewsDetail() {
  const { id } = useParams();
  const [data, setData] = useState<NewsAnalysis | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.news(id).then(setData).catch(() => setError(true));
  }, [id]);

  if (error) return <div className="muted">Не удалось загрузить новость.</div>;
  if (!data) return <div className="muted">Загрузка…</div>;

  const { news, sources, metrics, verdict, timeline, geo, campaign, clusters } = data;

  const stancePie = [
    { name: 'Верят', value: metrics.believePct, color: COLORS.believe },
    { name: 'Не определились', value: metrics.undecidedPct, color: COLORS.undecided },
    { name: 'Не верят', value: metrics.disbelievePct, color: COLORS.disbelieve },
  ];

  const tlData = timeline.map((s) => ({
    t: new Date(s.ts).toLocaleString('ru', { day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    believe: s.believePct,
    disbelieve: s.disbelievePct,
    trust: s.trustIndex,
    forecast: s.forecast,
  }));
  const forecastStart = tlData.findIndex((d) => d.forecast);

  return (
    <div className="detail">
      <Link to="/" className="back">← к ленте</Link>

      <div className="detail-head">
        <div className="detail-badges">
          <Badge tone="muted">{news.topic}</Badge>
          <Badge tone="muted">{news.country}</Badge>
          {campaign.detected && <Badge tone="warn">⚠ обнаружена кампания</Badge>}
        </div>
        <h1>{news.title}</h1>
        <p className="detail-summary">{news.summary}</p>
        <div className="sources-row">
          Источники:&nbsp;
          {sources.map((s) => (
            <span key={s.id} className="src-chip" title={`надёжность ${(s.reliabilityScore * 100).toFixed(0)}%`}>
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* Ключевые метрики */}
      <div className="detail-top">
        <Section title="Индекс доверия">
          <Gauge value={metrics.trustIndex} label={`выборка: ${metrics.sampleSize} реакций`} />
        </Section>

        <Section title="Распределение позиций" subtitle="взвешено по достоверности авторов">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={stancePie} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {stancePie.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Показатели">
          <div className="metric-grid">
            <Metric label="Верят" value={`${metrics.believePct}%`} color={COLORS.believe} />
            <Metric label="Не верят" value={`${metrics.disbelievePct}%`} color={COLORS.disbelieve} />
            <Metric label="Не определились" value={`${metrics.undecidedPct}%`} color={COLORS.undecided} />
            <Metric label="Поляризация" value={metrics.polarization} hint="0 — консенсус, 100 — раскол 50/50" />
            <Metric label="P(правда)" value={`${metrics.truthProbability}%`} color={COLORS.trust} />
            <Metric label="Доля ботов" value={`${Math.round(metrics.botRatio * 100)}%`} color={COLORS.warn} />
          </div>
        </Section>
      </div>

      {/* Суд общества */}
      <Section title="⚖ Суд общества" subtitle={`уверенность прогноза ${Math.round(verdict.confidence * 100)}%`}>
        <div className="verdict">
          <div className="verdict-main">
            <div className="verdict-label">Вероятный вердикт</div>
            <div className="verdict-value">{verdict.verdict}</div>
            <StanceBar believe={metrics.believePct} disbelieve={metrics.disbelievePct} undecided={metrics.undecidedPct} />
            <div className="verdict-breakdown">
              <span>Поддерживают: <b>{verdict.breakdown.support}%</b></span>
              <span>Осуждают: <b>{verdict.breakdown.condemn}%</b></span>
              <span>Считают правдой: <b>{verdict.breakdown.truth}%</b></span>
              <span>Считают фейком: <b>{verdict.breakdown.fake}%</b></span>
              <span>Не определились: <b>{verdict.breakdown.undecided}%</b></span>
            </div>
          </div>
          <div className="verdict-args">
            <div className="args-col">
              <h4>Аргументы большинства</h4>
              {verdict.majorityArguments.length === 0 && <p className="muted">—</p>}
              {verdict.majorityArguments.map((a) => (
                <div className="arg" key={a.id}>
                  <div className="arg-label">{a.label} · {a.size}</div>
                  <div className="arg-text">«{a.representativeText}»</div>
                </div>
              ))}
            </div>
            <div className="args-col">
              <h4>Аргументы меньшинства</h4>
              {verdict.minorityArguments.length === 0 && <p className="muted">—</p>}
              {verdict.minorityArguments.map((a) => (
                <div className="arg" key={a.id}>
                  <div className="arg-label">{a.label} · {a.size}</div>
                  <div className="arg-text">«{a.representativeText}»</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Динамика мнения + прогноз */}
      <Section title="Динамика мнения во времени" subtitle="пунктир — прогноз модели">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={tlData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="t" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" domain={[0, 100]} fontSize={11} />
            <Tooltip />
            <Legend />
            {forecastStart > 0 && (
              <Line type="monotone" dataKey="believe" data={tlData.slice(0, forecastStart)} stroke={COLORS.believe} name="Верят (факт)" dot={false} strokeWidth={2} />
            )}
            <Line type="monotone" dataKey="believe" stroke={COLORS.believe} name="Верят" strokeDasharray="4 4" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="trust" stroke={COLORS.trust} name="Индекс доверия" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      <div className="detail-row2">
        {/* Эмоции */}
        <Section title="Эмоциональная реакция">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics.emotions.map((e) => ({ name: EMOTION_LABELS[e.emotion] ?? e.emotion, pct: e.pct }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip />
              <Bar dataKey="pct" fill={COLORS.trust} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Карта распространения мнений по странам */}
        <Section title="Карта распространения мнений" subtitle="по странам источников">
          <div className="geo">
            {geo.map((g) => (
              <div className="geo-row" key={g.country}>
                <span className="geo-country">{g.country}</span>
                <div className="geo-bar">
                  <span style={{ width: `${g.believePct}%`, background: COLORS.believe }} />
                  <span style={{ width: `${g.disbelievePct}%`, background: COLORS.disbelieve }} />
                </div>
                <span className="geo-vol">{g.volume}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="detail-row2">
        {/* Кластеры аргументов */}
        <Section title="Кластеры аргументов">
          <div className="clusters">
            {clusters.slice(0, 8).map((c) => (
              <div className={`cluster ${c.side}`} key={c.id}>
                <div className="cluster-head">
                  <span className={`dot ${c.side}`} />
                  {c.label} · {c.size}
                </div>
                <div className="cluster-text">«{c.representativeText}»</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Сравнение источников + кампании */}
        <Section title="Источники и достоверность">
          <table className="srctable">
            <thead>
              <tr><th>Источник</th><th>Тип</th><th>Надёжность</th></tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.type}</td>
                  <td>
                    <div className="rel-bar"><span style={{ width: `${s.reliabilityScore * 100}%` }} /></div>
                    {Math.round(s.reliabilityScore * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {campaign.detected && (
            <div className="campaign">
              <div className="campaign-title">⚠ Обнаружены признаки информационной кампании</div>
              <div className="campaign-kinds">{campaign.kinds.map((k) => <Badge tone="warn" key={k}>{k}</Badge>)}</div>
              <ul>{campaign.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
