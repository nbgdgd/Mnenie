// Запуск анализа по всем сидированным новостям и печать сводки.
// `npm run seed` — быстрый smoke-test движка без поднятия сервера.
import { getAllAnalyses } from './store.js';

const analyses = getAllAnalyses();
console.log(`Проанализировано новостей: ${analyses.length}\n`);
for (const a of analyses) {
  const m = a.metrics;
  console.log(`▸ ${a.news.title}`);
  console.log(
    `  доверие=${m.trustIndex} | верят=${m.believePct}% не верят=${m.disbelievePct}% не опр=${m.undecidedPct}% | ` +
      `поляризация=${m.polarization} | P(правда)=${m.truthProbability}% | боты=${Math.round(
        m.botRatio * 100,
      )}%`,
  );
  console.log(
    `  вердикт: ${a.verdict.verdict} (уверенность ${Math.round(a.verdict.confidence * 100)}%)` +
      (a.campaign.detected ? ` | ⚠ кампания: ${a.campaign.kinds.join(', ')}` : ''),
  );
  console.log('');
}
