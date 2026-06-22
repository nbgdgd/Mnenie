// Доменные типы Mnenie. Используются движком анализа и API.

export type SourceType = 'media' | 'social' | 'forum';
export type Stance = 'believe' | 'disbelieve' | 'undecided';
export type Sentiment = 'positive' | 'negative' | 'neutral';
export type Emotion =
  | 'anger'
  | 'fear'
  | 'joy'
  | 'disgust'
  | 'surprise'
  | 'trust'
  | 'sadness'
  | 'neutral';

export interface Source {
  id: string;
  name: string;
  domain: string;
  type: SourceType;
  country: string;
  /** -1 (left) … 0 (center) … +1 (right) */
  politicalBias: number;
  /** 0..1 историческая достоверность домена */
  reliabilityScore: number;
}

export interface RawComment {
  id: string;
  newsId: string;
  sourceId: string;
  authorHandle: string;
  text: string;
  language: string;
  likes: number;
  reposts: number;
  createdAt: string; // ISO
  accountAgeDays: number;
  postFrequencyPerDay: number;
}

export interface News {
  id: string;
  title: string;
  summary: string;
  url: string;
  topic: string;
  country: string;
  language: string;
  publishedAt: string; // ISO
  sourceIds: string[];
}

// ----- результаты анализа -----

export interface CommentAnalysis {
  commentId: string;
  sentiment: Sentiment;
  sentimentScore: number; // -1..1
  emotion: Emotion;
  stance: Stance;
  botScore: number; // 0..1
  toxicity: number; // 0..1
  argumentClusterId: string | null;
  /** вес мнения после понижения за ботов/токсичность */
  weight: number;
}

export interface ArgumentCluster {
  id: string;
  side: Stance;
  label: string;
  size: number;
  representativeText: string;
}

export interface OpinionSnapshot {
  ts: string; // ISO
  believePct: number;
  disbelievePct: number;
  undecidedPct: number;
  trustIndex: number;
  forecast?: boolean;
}

export interface GeoOpinion {
  country: string;
  believePct: number;
  disbelievePct: number;
  volume: number;
}

export interface CampaignSignal {
  detected: boolean;
  score: number; // 0..1
  botRatio: number;
  kinds: string[];
  evidence: string[];
}

export interface Verdict {
  verdict:
    | 'Считают правдой'
    | 'Считают фейком'
    | 'Поддерживают'
    | 'Осуждают'
    | 'Не определились';
  confidence: number; // 0..1
  breakdown: {
    support: number;
    condemn: number;
    undecided: number;
    fake: number;
    truth: number;
  };
  majorityArguments: ArgumentCluster[];
  minorityArguments: ArgumentCluster[];
}

export interface EmotionBreakdown {
  emotion: Emotion;
  pct: number;
}

export interface NewsMetrics {
  trustIndex: number; // 0..100
  believePct: number;
  disbelievePct: number;
  undecidedPct: number;
  polarization: number; // 0..100
  truthProbability: number; // 0..100
  botRatio: number; // 0..1
  confidence: number; // 0..1
  sampleSize: number;
  emotions: EmotionBreakdown[];
}

export interface NewsAnalysis {
  news: News;
  sources: Source[];
  metrics: NewsMetrics;
  verdict: Verdict;
  timeline: OpinionSnapshot[];
  geo: GeoOpinion[];
  campaign: CampaignSignal;
  clusters: ArgumentCluster[];
}

export interface NewsCard {
  news: News;
  sources: Source[];
  metrics: NewsMetrics;
  campaignDetected: boolean;
}
