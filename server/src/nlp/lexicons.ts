// Лексиконы для интерпретируемого NLP (RU + EN).
// В проде заменяются трансформерными моделями [PROD]; здесь — детерминированные
// сигналы, чтобы движок работал без внешних API и был объясним.

export const POSITIVE = [
  // ru
  'хорошо', 'отлично', 'поддерживаю', 'согласен', 'правильно', 'молодцы',
  'рад', 'надежда', 'польза', 'честно', 'справедливо', 'верю', 'правда',
  'доверяю', 'спасибо', 'успех', 'прорыв', 'позитив', 'логично',
  // en
  'good', 'great', 'support', 'agree', 'right', 'hope', 'benefit', 'honest',
  'fair', 'true', 'trust', 'success', 'breakthrough', 'positive', 'logical',
];

export const NEGATIVE = [
  // ru
  'плохо', 'ужас', 'ложь', 'обман', 'позор', 'провал', 'опасно', 'катастрофа',
  'возмутительно', 'против', 'не согласен', 'разочарование', 'страшно', 'вред',
  'коррупция', 'манипуляция', 'абсурд', 'бред',
  // en
  'bad', 'awful', 'lie', 'scam', 'shame', 'fail', 'dangerous', 'disaster',
  'against', 'disagree', 'harm', 'corruption', 'manipulation', 'absurd',
];

// Маркеры доверия новости (stance = believe).
// Включают согласие/подтверждение в дискуссиях (для форумов вроде Hacker News,
// где «верю» = согласен с тезисом / считаю достоверным).
export const BELIEVE_MARKERS = [
  'верю', 'это правда', 'так и есть', 'подтверждаю', 'подтвердилось',
  'очевидно правда', 'реально', 'факт', 'достоверно', 'правдоподобно',
  'i believe', 'this is true', 'confirmed', 'it is real', 'fact', 'credible',
  // дискуссионное согласие (en)
  'agreed', 'i agree', 'exactly this', 'makes sense', 'good point', 'spot on',
  'this is correct', 'well said', 'absolutely right', 'convincing', 'makes total sense',
  'this matches', 'can confirm', 'in my experience', 'this is accurate',
];

// Маркеры недоверия (stance = disbelieve).
// Включают скепсис/несогласие в дискуссиях (сомнение в тезисе/источнике).
export const DISBELIEVE_MARKERS = [
  'фейк', 'вброс', 'не верю', 'ложь', 'постановка', 'фотошоп', 'пропаганда',
  'манипуляция', 'обман', 'выдумка', 'неправда', 'дезинформация', 'сомнительно',
  'fake', 'hoax', 'i dont believe', "i don't believe", 'staged', 'propaganda',
  'misinformation', 'doubtful', 'debunked',
  // дискуссионный скепсис/несогласие (en)
  'i disagree', 'disagree', 'not convinced', 'skeptical', 'citation needed',
  'this is wrong', 'simply wrong', 'incorrect', 'misleading', 'overblown',
  'clickbait', 'snake oil', 'nonsense', 'not buying', 'no evidence',
  'sounds dubious', 'i doubt', 'unsubstantiated', 'sensationalism',
];

// Маркеры неопределённости (stance = undecided)
export const UNDECIDED_MARKERS = [
  'не знаю', 'непонятно', 'нужны доказательства', 'возможно', 'может быть',
  'спорно', 'надо проверить', 'кто знает', 'неоднозначно', 'а так ли это',
  'not sure', 'unclear', 'need proof', 'maybe', 'possibly', 'who knows',
  'questionable', 'need to verify',
];

export const NEGATORS = ['не', 'нет', 'ни', 'not', "don't", 'dont', 'no', 'never'];
export const INTENSIFIERS = ['очень', 'крайне', 'совершенно', 'абсолютно', 'very', 'extremely', 'totally'];

export const TOXIC = [
  'идиот', 'дурак', 'тупой', 'ненавижу', 'мрази', 'придурок', 'заткнись',
  'idiot', 'stupid', 'hate', 'shut up', 'moron', 'trash',
];

// Эмоциональные лексиконы (Plutchik/Ekman, упрощённо)
export const EMOTION_LEXICON: Record<string, string[]> = {
  anger: ['злость', 'бесит', 'ненавижу', 'возмутительно', 'гнев', 'angry', 'furious', 'rage', 'outrage'],
  fear: ['страшно', 'боюсь', 'опасно', 'паника', 'угроза', 'fear', 'scared', 'danger', 'threat', 'panic'],
  joy: ['рад', 'счастье', 'отлично', 'ура', 'класс', 'joy', 'happy', 'great', 'awesome'],
  disgust: ['отвратительно', 'мерзость', 'противно', 'позор', 'disgust', 'gross', 'shameful'],
  surprise: ['вау', 'неожиданно', 'шок', 'удивительно', 'wow', 'shocking', 'unexpected', 'surprise'],
  trust: ['доверяю', 'верю', 'надёжно', 'честно', 'trust', 'reliable', 'honest'],
  sadness: ['грустно', 'печально', 'жаль', 'sad', 'unfortunate', 'sorry'],
};

// Тематические якоря для кластеризации аргументов.
export const ARGUMENT_THEMES: { label: string; keywords: string[] }[] = [
  { label: 'Достоверность источника', keywords: ['источник', 'ссылк', 'доказательств', 'пруф', 'source', 'proof', 'evidence', 'link'] },
  { label: 'Экономические последствия', keywords: ['деньг', 'эконом', 'цены', 'налог', 'бюджет', 'money', 'econom', 'price', 'tax'] },
  { label: 'Политическая мотивация', keywords: ['политик', 'власт', 'выбор', 'партия', 'politic', 'government', 'election'] },
  { label: 'Этика и мораль', keywords: ['мораль', 'этик', 'справедлив', 'право', 'moral', 'ethic', 'justice', 'right'] },
  { label: 'Технические детали', keywords: ['техн', 'данн', 'исследован', 'наук', 'tech', 'data', 'research', 'science'] },
  { label: 'Эмоциональная реакция', keywords: ['чувств', 'эмоц', 'страх', 'надежд', 'feel', 'emotion', 'fear', 'hope'] },
  { label: 'Манипуляция и СМИ', keywords: ['манипул', 'сми', 'пропаганд', 'медиа', 'manipul', 'media', 'propaganda'] },
];
