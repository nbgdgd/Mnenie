import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { api } from './api';
import type { Stats } from './types';

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">⚖</span> Mnenie
          <span className="brand-sub">суд общества над новостями</span>
        </Link>
        <nav className="nav">
          <NavLink to="/" end>Лента</NavLink>
          <NavLink to="/rankings">Рейтинги</NavLink>
        </nav>
        {stats && (
          <div className="topstats">
            <span>{stats.totalNews} новостей</span>
            <span>доверие ~{stats.avgTrustIndex}</span>
            <span className="warn">{stats.campaignsDetected} кампаний</span>
          </div>
        )}
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="foot">
        Mnenie MVP · NLP-анализ мнений, прогноз вердикта общества ·{' '}
        <a href="https://github.com/nbgdgd/mnenie" target="_blank" rel="noreferrer">
          архитектура в ARCHITECTURE.md
        </a>
      </footer>
    </div>
  );
}
