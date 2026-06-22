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

Ошибки: `404 { "error": "not found" }` для несуществующего `:id`.
