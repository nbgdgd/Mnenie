-- Mnenie — каноническая схема аналитического хранилища.
-- Postgres-совместимый DDL. В MVP используется как документация модели данных
-- (рантайм работает на in-memory store, сидированном из seedData.ts).

CREATE TABLE sources (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    domain            TEXT NOT NULL,
    type              TEXT NOT NULL CHECK (type IN ('media','social','forum')),
    country           TEXT NOT NULL,
    political_bias    REAL NOT NULL DEFAULT 0,   -- -1..1
    reliability_score REAL NOT NULL DEFAULT 0.5, -- 0..1
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE news (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    summary      TEXT NOT NULL,
    url          TEXT,
    topic        TEXT NOT NULL,
    country      TEXT NOT NULL,
    language     TEXT NOT NULL DEFAULT 'ru',
    published_at TIMESTAMPTZ NOT NULL,
    ingested_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE news_sources (
    news_id   TEXT NOT NULL REFERENCES news(id),
    source_id TEXT NOT NULL REFERENCES sources(id),
    PRIMARY KEY (news_id, source_id)
);

CREATE TABLE comments (
    id                  TEXT PRIMARY KEY,
    news_id             TEXT NOT NULL REFERENCES news(id),
    source_id           TEXT NOT NULL REFERENCES sources(id),
    author_handle       TEXT NOT NULL,
    text                TEXT NOT NULL,
    language            TEXT NOT NULL DEFAULT 'ru',
    likes               INTEGER NOT NULL DEFAULT 0,
    reposts             INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL,
    account_age_days    INTEGER NOT NULL DEFAULT 365,
    post_frequency      REAL NOT NULL DEFAULT 1
);
CREATE INDEX idx_comments_news ON comments(news_id);

CREATE TABLE comment_analysis (
    comment_id          TEXT PRIMARY KEY REFERENCES comments(id),
    sentiment           TEXT NOT NULL,
    sentiment_score     REAL NOT NULL,
    emotion             TEXT NOT NULL,
    stance              TEXT NOT NULL CHECK (stance IN ('believe','disbelieve','undecided')),
    bot_score           REAL NOT NULL,
    toxicity            REAL NOT NULL,
    argument_cluster_id TEXT,
    weight              REAL NOT NULL DEFAULT 1
);

-- Экран COMMENTS ANALYTICS: per-comment маркеры для ленты с фильтрами.
-- support/against/neutral, контроверсивность, бот-вероятность, влияние, повтор.
CREATE TABLE comment_markers (
    comment_id        TEXT PRIMARY KEY REFERENCES comments(id),
    news_id           TEXT NOT NULL REFERENCES news(id),
    sentiment         TEXT NOT NULL CHECK (sentiment IN ('support','against','neutral')),
    controversy_score INTEGER NOT NULL,                    -- 0..100
    bot_probability   INTEGER NOT NULL,                    -- 0..100
    influence         TEXT NOT NULL CHECK (influence IN ('low','medium','high')),
    is_repetitive     BOOLEAN NOT NULL DEFAULT false,
    duplicate_of      TEXT REFERENCES comments(id),        -- репрезентант near-dup
    cluster_kind      TEXT NOT NULL CHECK (cluster_kind IN
                        ('support','opposition','neutral','minority','suspicious'))
);
CREATE INDEX idx_markers_news ON comment_markers(news_id, cluster_kind);

-- Агрегированная сводка комментариев по новости (кэш для дашборда).
CREATE TABLE comments_summary (
    news_id           TEXT PRIMARY KEY REFERENCES news(id),
    total_comments    INTEGER NOT NULL,
    support_pct       INTEGER NOT NULL,
    against_pct       INTEGER NOT NULL,
    neutral_pct       INTEGER NOT NULL,
    controversial_pct INTEGER NOT NULL,
    bot_likelihood    INTEGER NOT NULL,                    -- средняя бот-вероятность
    influence_score   INTEGER NOT NULL,                    -- 0..100
    influence_flag    TEXT NOT NULL CHECK (influence_flag IN ('low','medium','high')),
    heatmap           JSONB,                               -- контроверсивность по корзинам
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Сигналы системы выявления влияния (ИПСО) для обсуждения.
CREATE TABLE influence_signals (
    id          BIGSERIAL PRIMARY KEY,
    news_id     TEXT NOT NULL REFERENCES news(id),
    kind        TEXT NOT NULL CHECK (kind IN
                  ('coordinated','propaganda_repetition','sentiment_spike','velocity_anomaly')),
    label       TEXT NOT NULL,
    severity    TEXT NOT NULL CHECK (severity IN ('low','medium','high')),
    detail      TEXT,
    score       INTEGER NOT NULL,                          -- 0..100
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_influence_news ON influence_signals(news_id);

CREATE TABLE news_metrics (
    news_id           TEXT PRIMARY KEY REFERENCES news(id),
    trust_index       REAL NOT NULL,
    believe_pct       REAL NOT NULL,
    disbelieve_pct    REAL NOT NULL,
    undecided_pct     REAL NOT NULL,
    polarization      REAL NOT NULL,
    truth_probability REAL NOT NULL,
    bot_ratio         REAL NOT NULL,
    confidence        REAL NOT NULL,
    verdict           TEXT NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE opinion_snapshots (
    id             BIGSERIAL PRIMARY KEY,
    news_id        TEXT NOT NULL REFERENCES news(id),
    ts             TIMESTAMPTZ NOT NULL,
    believe_pct    REAL NOT NULL,
    disbelieve_pct REAL NOT NULL,
    undecided_pct  REAL NOT NULL,
    trust_index    REAL NOT NULL,
    is_forecast    BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_snapshots_news_ts ON opinion_snapshots(news_id, ts);

CREATE TABLE argument_clusters (
    id                 TEXT PRIMARY KEY,
    news_id            TEXT NOT NULL REFERENCES news(id),
    side               TEXT NOT NULL,
    label              TEXT NOT NULL,
    size               INTEGER NOT NULL,
    representative_text TEXT
);

CREATE TABLE geo_opinion (
    news_id        TEXT NOT NULL REFERENCES news(id),
    country        TEXT NOT NULL,
    believe_pct    REAL NOT NULL,
    disbelieve_pct REAL NOT NULL,
    volume         INTEGER NOT NULL,
    PRIMARY KEY (news_id, country)
);

CREATE TABLE campaigns (
    id          BIGSERIAL PRIMARY KEY,
    news_id     TEXT NOT NULL REFERENCES news(id),
    score       REAL NOT NULL,
    kind        TEXT NOT NULL,
    evidence    TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
