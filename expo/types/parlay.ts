export interface ParlayLeg {
  id: string;
  pick: string;
  details: string;
  confidence: number;
  odds: string;
}

export interface Parlay {
  id: string;
  title: string;
  legCount: number;
  combinedOdds: string;
  legs: ParlayLeg[];
  sport: string;
  date: string;
}

export interface AnalysisResult {
  pick: string;
  confidence: number;
  reasoning: string;
  factors: { label: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }[];
  verdict: string;
}

export type PlanTier = 'free' | 'pro' | 'vip';

export interface Plan {
  tier: PlanTier;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}
