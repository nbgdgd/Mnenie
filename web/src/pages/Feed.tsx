import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type FeedQuery } from '../api';
import type { Filters, NewsCard } from '../types';
import { Badge, StanceBar, trustColor } from '../ui';

export default function Feed() {
  const [cards, setCards] = useState<NewsCard[]>([]);
  const [filters, setFilters] = useState<Filters>({ countries: [], topics: [] });
  const [query, setQuery] = useState<FeedQuery>({ sort: 'recent' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.filters().then(setFilters).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.feed(query).then((c) => { setCards(c); setLoading(false); });
  }, [query]);

  return (
    <div>
      <div className="hero">
        <h1>Что общество думает о новости?</h1>
        <p>
          Mnenie собирает обсуждения из СМИ, соцсетей и форумов и прогнозирует
          реакцию: доверие, поляризацию и вероятный вердикт.
        </p>
      </div>

      <div className="filters">
        <input
          placeholder="Поиск по новостям…"
          value={query.q ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, q: e.target.value }))}
        />
        <select value={query.country ?? ''} onChange={(e) => setQuery((q) => ({ ...q, country: e.target.value || undefined }))}>
          <option value="">Все страны</option>
          {filters.countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={query.topic ?? ''} onChange={(e) => setQuery((q) => ({ ...q, topic: e.target.value || undefined }))}>
          <option value="">Все темы</option>
          {filters.topics.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={query.sort} onChange={(e) => setQuery((q) => ({ ...q, sort: e.target.value as FeedQuery['sort'] }))}>
          <option value="recent">Свежие</option>
          <option value="controversial">Самые спорные</option>
          <option value="campaigns">Признаки кампаний</option>
          <option value="trust">Доверие ↓</option>
        </select>
      </div>

      {loading ? (
        <div className="muted">Загрузка…</div>
      ) : (
        <div className="grid">
          {cards.map((c) => (
            <Link to={`/news/${c.news.id}`} className="card" key={c.news.id}>
              <div className="card-top">
                <Badge tone="muted">{c.news.topic}</Badge>
                <Badge tone="muted">{c.news.country}</Badge>
                {c.campaignDetected && <Badge tone="warn">⚠ кампания</Badge>}
              </div>
              <h3 className="card-title">{c.news.title}</h3>
              <p className="card-summary">{c.news.summary}</p>

              <div className="card-metrics">
                <div className="trust-pill" style={{ borderColor: trustColor(c.metrics.trustIndex) }}>
                  <b style={{ color: trustColor(c.metrics.trustIndex) }}>{c.metrics.trustIndex}</b>
                  <span>индекс доверия</span>
                </div>
                <div className="poltag">поляризация {c.metrics.polarization}</div>
                <div className="poltag">P(правда) {c.metrics.truthProbability}%</div>
              </div>

              <StanceBar
                believe={c.metrics.believePct}
                disbelieve={c.metrics.disbelievePct}
                undecided={c.metrics.undecidedPct}
              />
              <div className="card-legend">
                <span>верят {c.metrics.believePct}%</span>
                <span>не опр. {c.metrics.undecidedPct}%</span>
                <span>не верят {c.metrics.disbelievePct}%</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
