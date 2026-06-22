// Типы ответов API (зеркало server/src/types.ts).
export type Stance = 'believe' | 'disbelieve' | 'undecided';
export type Emotion =
  | 'anger' | 'fear' | 'joy' | 'disgust' | 'surprise' | 'trust' | 'sadness' | 'neutral';

export interface Source {
  id: string;
  name: string;
  domain: string;
  type: 'media' | 'social' | 'forum';
  country: string;
  politicalBias: number;
  reliabilityScore: number;
}

export interface News {
  id: string;
  title: string;
  summary: string;
  url: string;
  topic: string;
  country: string;
  language: string;
  publishedAt: string;
  sourceIds: string[];
}

export interface EmotionBreakdown { emotion: Emotion; pct: number; }

export interface NewsMetrics {
  trustIndex: number;
  believePct: number;
  disbelievePct: number;
  undecidedPct: number;
  polarization: number;
  truthProbability: number;
  botRatio: number;
  confidence: number;
  sampleSize: number;
  emotions: EmotionBreakdown[];
}

export interface ArgumentCluster {
  id: string;
  side: Stance;
  label: string;
  size: number;
  representativeText: string;
}

export interface OpinionSnapshot {
  ts: string;
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
  score: number;
  botRatio: number;
  kinds: string[];
  evidence: string[];
}

export interface Verdict {
  verdict: string;
  confidence: number;
  breakdown: { support: number; condemn: number; undecided: number; fake: number; truth: number; };
  majorityArguments: ArgumentCluster[];
  minorityArguments: ArgumentCluster[];
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

export interface Filters { countries: string[]; topics: string[]; }

export interface Stats {
  totalNews: number;
  avgTrustIndex: number;
  avgPolarization: number;
  campaignsDetected: number;
  topics: number;
  countries: number;
}
