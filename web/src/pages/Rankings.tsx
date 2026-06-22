import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { NewsCard } from '../types';
import { Badge, Section, StanceBar, trustColor } from '../ui';

function RankList({ items, metric }: { items: NewsCard[]; metric: 'polarization' | 'campaign' }) {
  return (
    <div className="ranklist">
      {items.map((c, i) => (
        <Link to={`/news/${c.news.id}`} className="rankrow" key={c.news.id}>
          <span className="rank-num">{i + 1}</span>
          <div className="rank-body">
            <div className="rank-title">
              {c.news.title}
              {c.campaignDetected && <Badge tone="warn">⚠</Badge>}
            </div>
            <StanceBar believe={c.metrics.believePct} disbelieve={c.metrics.disbelievePct} undecided={c.metrics.undecidedPct} />
          </div>
          <div className="rank-score" style={{ color: metric === 'polarization' ? trustColor(100 - c.metrics.polarization) : '#fbbf24' }}>
            {metric === 'polarization' ? c.metrics.polarization : `${c.metrics.believePct > 0 ? Math.round(c.metrics.botRatio * 100) : 0}%`}
            <span>{metric === 'polarization' ? 'поляризация' : 'боты'}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function Rankings() {
  const [controversial, setControversial] = useState<NewsCard[]>([]);
  const [polarized, setPolarized] = useState<NewsCard[]>([]);

  useEffect(() => {
    api.controversial().then(setControversial);
    api.polarized().then(setPolarized);
  }, []);

  return (
    <div className="rankings">
      <h1>Рейтинги</h1>
      <div className="detail-row2">
        <Section title="🔥 Самые спорные новости" subtitle="по уровню поляризации общества">
          <RankList items={controversial} metric="polarization" />
        </Section>
        <Section title="🤖 Наибольшая поляризация + кампании" subtitle="поляризация с поправкой на координацию">
          <RankList items={polarized} metric="campaign" />
        </Section>
      </div>
    </div>
  );
}
