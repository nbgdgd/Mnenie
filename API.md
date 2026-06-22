# Mnenie API

База: `http://localhost:4000`. Все ответы — JSON. Формат типов — см.
`server/src/types.ts`.

## Служебные

### `GET /health`
```json
{ "status": "ok", "service": "mnenie-api" }
```

## Лента и фильтры

### `GET /api/news`
Лента карточек новостей.

Query-параметры:
| параметр | значения | описание |
|----------|----------|----------|
| `country` | код страны | фильтр по стране |
| `topic` | тема | фильтр по теме |
| `q` | строка | поиск по заголовку/сводке |
| `sort` | `recent` \| `controversial` \| `trust` \| `campaigns` | сортировка |

Ответ — массив `NewsCard`:
```json
[{
  "news": { "id": "n1", "title": "...", "summary": "...", "topic": "Наука",
            "country": "US", "publishedAt": "2026-06-18T09:00:00Z", "sourceIds": ["s1"] },
  "sources": [ { "id": "s1", "name": "Reuters", "reliabilityScore": 0.92 } ],
  "metrics": { "trustIndex": 65, "believePct": 53, "disbelievePct": 23,
               "undecidedPct": 24, "polarization": 46, "truthProbability": 78,
               "botRatio": 0.04, "confidence": 0.85, "sampleSize": 26, "emotions": [] },
  "campaignDetected": false
}]
```

### `GET /api/filters`
```json
{ "countries": ["RU","UK","US"], "topics": ["Наука","Политика","..."] }
```

### `GET /api/stats`
Сводка по платформе: `totalNews`, `avgTrustIndex`, `avgPolarization`,
`campaignsDetected`, `topics`, `countries`.

## Рейтинги

### `GET /api/rankings/controversial`
Новости, отсортированные по поляризации (`NewsCard[]`).

### `GET /api/rankings/polarized`
Поляризация с поправкой на координацию/кампании (`NewsCard[]`).

## Аналитика новости

### `GET /api/news/:id`
Полный `NewsAnalysis`: `news`, `sources`, `metrics`, `verdict`, `timeline`,
`geo`, `campaign`, `clusters`.

### `GET /api/news/:id/verdict`
«Суд общества»:
```json
{
  "verdict": "Считают фейком",
  "confidence": 0.77,
  "breakdown": { "support": 20, "condemn": 21, "undecided": 15, "fake": 46, "truth": 39 },
  "majorityArguments": [ { "side": "disbelieve", "label": "Достоверность источника",
                           "size": 4, "representativeText": "..." } ],
  "minorityArguments": [ ... ]
}
```

### `GET /api/news/:id/timeline`
Массив `OpinionSnapshot` (история + прогноз, у прогнозных `forecast: true`):
```json
[{ "ts": "2026-06-20T18:00:00Z", "believePct": 41, "disbelievePct": 44,
   "undecidedPct": 15, "trustIndex": 48, "forecast": false }]
```

### `GET /api/news/:id/arguments`
Кластеры аргументов сторон (`ArgumentCluster[]`).

### `GET /api/news/:id/geo`
Распределение мнений по странам (`GeoOpinion[]`).

### `GET /api/news/:id/sources`
Источники новости (`Source[]`).

### `GET /api/news/:id/campaigns`
Сигнал кампании:
```json
{ "detected": true, "score": 0.42, "botRatio": 0.39,
  "kinds": ["Сеть ботов","Скоординированные сообщения"],
  "evidence": ["Доля подозрительных аккаунтов: 39%", "..."] }
```

## COMMENTS ANALYTICS

### `GET /api/news/:id/comments`
Полная аналитика комментариев для экрана COMMENTS ANALYTICS: сводка,
кластеры, система выявления влияния, heatmap и лента с маркерами.

Query-параметр `filter` фильтрует ленту `comments` (сводка/кластеры/влияние
не меняются):
`support` | `against` | `neutral` | `controversial` | `suspicious` | `minority`.

Ответ — `CommentsAnalytics`:
```json
{
  "newsId": "hn-123",
  "summary": {
    "totalComments": 31, "supportPct": 23, "againstPct": 68, "neutralPct": 9,
    "controversialPct": 13, "botLikelihoodPct": 42, "influenceScorePct": 62
  },
  "clusters": [
    { "kind": "opposition", "label": "Основная оппозиция", "size": 4,
      "sharePct": 13, "sentiment": "against", "representative": "...",
      "commentIds": ["c-1","c-2"] },
    { "kind": "minority", "label": "Меньшинство / редкие мнения", "size": 5, "sharePct": 16, "...": "" },
    { "kind": "suspicious", "label": "Подозрительные / повторяющиеся", "size": 19, "sharePct": 61, "...": "" }
  ],
  "influence": {
    "score": 62, "flag": "high",
    "signals": [
      { "kind": "coordinated", "label": "Координированная сеть",
        "severity": "medium", "detail": "42% комментариев похожи на ботов", "score": 55 },
      { "kind": "propaganda_repetition", "label": "Повторяющиеся шаблоны",
        "severity": "high", "detail": "Групп одинаковых сообщений: 1 (42% потока)", "score": 67 },
      { "kind": "sentiment_spike", "label": "Всплеск одного мнения",
        "severity": "high", "detail": "В одном окне до 100% реакций в одну сторону", "score": 80 }
    ]
  },
  "heatmap": [17, 0, 18, 18, 0, 18, 21, 18],
  "comments": [
    { "id": "c-1", "author": "user42", "text": "...", "createdAt": "2026-06-20T14:30:00Z",
      "sentiment": "against", "sentimentScore": -0.4, "emotion": "anger",
      "controversyScore": 72, "botProbability": 80, "influence": "high",
      "isRepetitive": true, "duplicateOf": "c-0", "cluster": "suspicious", "likes": 0 }
  ]
}
```

Маркеры комментария: `sentiment` (support/against/neutral), `controversyScore`
(0–100), `botProbability` (0–100), `influence` (low/medium/high), `isRepetitive`
(+ `duplicateOf`), `cluster`. UI подсвечивает противоречивые красной рамкой,
подозрительные — предупреждающим цветом. Меньшинство НЕ удаляется — отдельный
кластер и фильтр.

Ошибки: `404 { "error": "not found" }` для несуществующего `:id`.
