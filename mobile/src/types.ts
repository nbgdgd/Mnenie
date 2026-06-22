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

// ---- Comments Analytics ----
export type CommentSentiment = 'support' | 'against' | 'neutral';
export type InfluenceFlag = 'low' | 'medium' | 'high';
export type CommentClusterKind = 'support' | 'opposition' | 'neutral' | 'minority' | 'suspicious';

export interface CommentDetail {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  sentiment: CommentSentiment;
  sentimentScore: number;
  emotion: Emotion;
  controversyScore: number;
  botProbability: number;
  influence: InfluenceFlag;
  isRepetitive: boolean;
  duplicateOf: string | null;
  cluster: CommentClusterKind;
  likes: number;
}

export interface CommentClusterGroup {
  kind: CommentClusterKind;
  label: string;
  size: number;
  sharePct: number;
  sentiment: CommentSentiment | 'mixed';
  representative: string;
  commentIds: string[];
}

export interface InfluenceSignal {
  kind: 'coordinated' | 'propaganda_repetition' | 'sentiment_spike' | 'velocity_anomaly';
  label: string;
  severity: InfluenceFlag;
  detail: string;
  score: number;
}

export interface CommentsSummary {
  totalComments: number;
  supportPct: number;
  againstPct: number;
  neutralPct: number;
  controversialPct: number;
  botLikelihoodPct: number;
  influenceScorePct: number;
}

export interface CommentsAnalytics {
  newsId: string;
  summary: CommentsSummary;
  clusters: CommentClusterGroup[];
  influence: { score: number; flag: InfluenceFlag; signals: InfluenceSignal[] };
  heatmap: number[];
  comments: CommentDetail[];
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
