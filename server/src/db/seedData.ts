// Сидированные данные: источники, новости и сгенерированные комментарии.
// Имитируют поток из СМИ/соцсетей/форумов с реалистичным распределением
// мнений, эмоций и вкраплением ботов/координации.
import { News, RawComment, Source } from '../types.js';

export const sources: Source[] = [
  { id: 's1', name: 'Reuters', domain: 'reuters.com', type: 'media', country: 'UK', politicalBias: 0, reliabilityScore: 0.92 },
  { id: 's2', name: 'РИА Новости', domain: 'ria.ru', type: 'media', country: 'RU', politicalBias: 0.4, reliabilityScore: 0.6 },
  { id: 's3', name: 'BBC', domain: 'bbc.com', type: 'media', country: 'UK', politicalBias: -0.1, reliabilityScore: 0.88 },
  { id: 's4', name: 'Telegram', domain: 't.me', type: 'social', country: 'RU', politicalBias: 0, reliabilityScore: 0.3 },
  { id: 's5', name: 'X (Twitter)', domain: 'x.com', type: 'social', country: 'US', politicalBias: 0, reliabilityScore: 0.35 },
  { id: 's6', name: 'Reddit', domain: 'reddit.com', type: 'forum', country: 'US', politicalBias: -0.2, reliabilityScore: 0.45 },
  { id: 's7', name: 'VK', domain: 'vk.com', type: 'social', country: 'RU', politicalBias: 0.1, reliabilityScore: 0.33 },
  { id: 's8', name: 'CNN', domain: 'cnn.com', type: 'media', country: 'US', politicalBias: -0.4, reliabilityScore: 0.7 },
];

export const news: News[] = [
  {
    id: 'n1',
    title: 'Учёные заявили о прорыве в термоядерной энергетике',
    summary:
      'Лаборатория сообщила о реакции с положительным выходом энергии. Часть экспертов сомневается в воспроизводимости результата.',
    url: 'https://reuters.com/fusion-breakthrough',
    topic: 'Наука',
    country: 'US',
    language: 'ru',
    publishedAt: '2026-06-18T09:00:00Z',
    sourceIds: ['s1', 's3', 's5', 's6'],
  },
  {
    id: 'n2',
    title: 'В сети распространяется видео «инцидента» в центре города',
    summary:
      'Анонимный аккаунт опубликовал видео, которое быстро набрало миллионы просмотров. Подлинность ролика не подтверждена.',
    url: 'https://t.me/cityincident',
    topic: 'Происшествия',
    country: 'RU',
    language: 'ru',
    publishedAt: '2026-06-20T14:30:00Z',
    sourceIds: ['s4', 's7', 's2'],
  },
  {
    id: 'n3',
    title: 'Правительство анонсировало новую налоговую реформу',
    summary:
      'Предложен пересмотр ставок для среднего класса. Реформа вызвала ожесточённые споры между сторонниками и противниками.',
    url: 'https://bbc.com/tax-reform',
    topic: 'Политика',
    country: 'UK',
    language: 'ru',
    publishedAt: '2026-06-19T08:00:00Z',
    sourceIds: ['s3', 's1', 's8'],
  },
  {
    id: 'n4',
    title: 'Компания обещает «лекарство от старения» к 2030 году',
    summary:
      'Стартап заявил о препарате, замедляющем старение. Научное сообщество призывает к осторожности и независимой проверке.',
    url: 'https://x.com/longevity',
    topic: 'Здоровье',
    country: 'US',
    language: 'ru',
    publishedAt: '2026-06-17T12:00:00Z',
    sourceIds: ['s5', 's6', 's8'],
  },
  {
    id: 'n5',
    title: 'Утечка данных крупного банка: под угрозой миллионы клиентов',
    summary:
      'Сообщается о компрометации базы данных. Банк официально подтвердил инцидент и начал расследование.',
    url: 'https://reuters.com/bank-leak',
    topic: 'Технологии',
    country: 'US',
    language: 'ru',
    publishedAt: '2026-06-21T07:15:00Z',
    sourceIds: ['s1', 's8', 's6'],
  },
  {
    id: 'n6',
    title: 'Новый климатический отчёт: прогнозы оказались мрачнее ожиданий',
    summary:
      'Международная группа представила данные о темпах потепления. Часть аудитории обвиняет авторов в нагнетании.',
    url: 'https://bbc.com/climate-report',
    topic: 'Экология',
    country: 'UK',
    language: 'ru',
    publishedAt: '2026-06-16T10:00:00Z',
    sourceIds: ['s3', 's1', 's5', 's7'],
  },
];

// ---- Генерация комментариев ----

type Tmpl = { text: string; stance: 'believe' | 'disbelieve' | 'undecided' };

const believeTexts = [
  'Это правда, источник надёжный, я верю этим данным.',
  'Подтверждаю, об этом писали и другие издания. Факт.',
  'Реально похоже на правду, аргументы убедительные.',
  'Доверяю, доказательства выглядят достоверно.',
  'Так и есть, давно этого ждали. Отличная новость!',
  'Логично и правдоподобно, ссылки на исследование есть.',
];
const disbelieveTexts = [
  'Это фейк, классический вброс без доказательств.',
  'Не верю, постановка чистой воды, где пруфы?',
  'Манипуляция и пропаганда, источник сомнительный.',
  'Очередная дезинформация, видео явно смонтировано.',
  'Ложь, это просто попытка отвлечь внимание.',
  'Сомнительно, ни одного независимого подтверждения.',
];
const undecidedTexts = [
  'Не знаю, нужны доказательства, пока непонятно.',
  'Спорно, надо проверить источники, а так ли это?',
  'Может быть, но неоднозначно. Кто знает.',
  'Пока неясно, подождём официальных комментариев.',
];
const botTexts = [
  'СРОЧНО РЕПОСТ всем это фейк не верьте!!!',
  'СРОЧНО РЕПОСТ всем это фейк не верьте!!!',
  'СРОЧНО РЕПОСТ всем это фейк не верьте!!!',
];

function build(
  newsId: string,
  sourceIds: string[],
  spec: { believe: number; disbelieve: number; undecided: number; bots: number },
  startTs: string,
): RawComment[] {
  const out: RawComment[] = [];
  const start = new Date(startTs).getTime();
  let idx = 0;

  const push = (t: Tmpl, isBot: boolean) => {
    const sourceId = sourceIds[idx % sourceIds.length];
    const createdAt = new Date(start + idx * 45 * 60 * 1000).toISOString();
    out.push({
      id: `${newsId}-c${idx}`,
      newsId,
      sourceId,
      authorHandle: isBot ? `user${1000 + idx}${Math.floor(Math.random() * 9000)}` : `user_${idx}`,
      text: t.text,
      language: 'ru',
      likes: isBot ? 0 : Math.floor(Math.random() * 40),
      reposts: isBot ? Math.floor(Math.random() * 50) : Math.floor(Math.random() * 6),
      createdAt,
      accountAgeDays: isBot ? Math.floor(Math.random() * 20) + 3 : Math.floor(Math.random() * 1500) + 200,
      postFrequencyPerDay: isBot ? 30 + Math.floor(Math.random() * 60) : Math.floor(Math.random() * 5) + 1,
    });
    idx++;
  };

  for (let i = 0; i < spec.believe; i++) push({ text: believeTexts[i % believeTexts.length], stance: 'believe' }, false);
  for (let i = 0; i < spec.disbelieve; i++) push({ text: disbelieveTexts[i % disbelieveTexts.length], stance: 'disbelieve' }, false);
  for (let i = 0; i < spec.undecided; i++) push({ text: undecidedTexts[i % undecidedTexts.length], stance: 'undecided' }, false);
  for (let i = 0; i < spec.bots; i++) push({ text: botTexts[i % botTexts.length], stance: 'disbelieve' }, true);

  return out;
}

export const comments: RawComment[] = [
  // n1: скорее верят, мало ботов, умеренная поляризация
  ...build('n1', ['s1', 's3', 's5', 's6'], { believe: 14, disbelieve: 5, undecided: 6, bots: 1 }, '2026-06-18T10:00:00Z'),
  // n2: сильная поляризация + координированная кампания (много ботов и дублей)
  ...build('n2', ['s4', 's7', 's2'], { believe: 7, disbelieve: 8, undecided: 3, bots: 13 }, '2026-06-20T15:00:00Z'),
  // n3: политика, раскол почти 50/50
  ...build('n3', ['s3', 's1', 's8'], { believe: 11, disbelieve: 10, undecided: 5, bots: 2 }, '2026-06-19T09:00:00Z'),
  // n4: скорее не верят (скептицизм науки)
  ...build('n4', ['s5', 's6', 's8'], { believe: 6, disbelieve: 15, undecided: 7, bots: 3 }, '2026-06-17T13:00:00Z'),
  // n5: подтверждённый факт, высокий уровень доверия
  ...build('n5', ['s1', 's8', 's6'], { believe: 18, disbelieve: 3, undecided: 4, bots: 0 }, '2026-06-21T08:00:00Z'),
  // n6: спорная экология, заметная поляризация и боты
  ...build('n6', ['s3', 's1', 's5', 's7'], { believe: 12, disbelieve: 11, undecided: 6, bots: 5 }, '2026-06-16T11:00:00Z'),
];
