import { Parlay, Plan } from '@/types/parlay';

export const sampleParlay: Parlay = {
  id: '1',
  title: "TONIGHT'S NBA SLATE",
  legCount: 4,
  combinedOdds: '+850',
  sport: 'NBA',
  date: 'Tonight',
  legs: [
    {
      id: '1',
      pick: 'Celtics -6.5',
      details: 'vs Lakers · Home favorite',
      confidence: 78,
      odds: '-110',
    },
    {
      id: '2',
      pick: 'Nuggets ML',
      details: 'vs Rockets · Jokic triple-double watch',
      confidence: 72,
      odds: '-145',
    },
    {
      id: '3',
      pick: 'SGA Over 29.5 pts',
      details: 'vs Wizards · MVP averaging 31',
      confidence: 65,
      odds: '-120',
    },
    {
      id: '4',
      pick: 'Under 224.5',
      details: 'Knicks vs Cavs · Defensive battle',
      confidence: 62,
      odds: '-105',
    },
  ],
};

export const sampleNFLParlay: Parlay = {
  id: '2',
  title: "SUNDAY NFL LOCKS",
  legCount: 3,
  combinedOdds: '+520',
  sport: 'NFL',
  date: 'Sunday',
  legs: [
    {
      id: '1',
      pick: 'Chiefs -3.5',
      details: 'vs Raiders · Mahomes at home',
      confidence: 81,
      odds: '-115',
    },
    {
      id: '2',
      pick: 'Bills ML',
      details: 'vs Dolphins · Allen revenge game',
      confidence: 74,
      odds: '-160',
    },
    {
      id: '3',
      pick: 'Lions Over 27.5 TT',
      details: 'vs Panthers · Top-5 offense',
      confidence: 68,
      odds: '-110',
    },
  ],
};

export const plans: Plan[] = [
  {
    tier: 'free',
    name: 'Starter',
    price: '$0',
    period: 'forever',
    features: [
      '1 AI parlay per day',
      'Basic analysis',
      'Up to 3-leg parlays',
      'Standard confidence scores',
    ],
    highlighted: false,
    cta: 'Get Started',
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    features: [
      'Unlimited AI parlays',
      'Deep analysis with reasoning',
      'Up to 6-leg parlays',
      'Pick analyzer tool',
      'Multi-sport support',
      'Early access to picks',
    ],
    highlighted: true,
    cta: 'Go Pro',
  },
  {
    tier: 'vip',
    name: 'VIP',
    price: '$24.99',
    period: '/month',
    features: [
      'Everything in Pro',
      'VIP-only high-confidence picks',
      'Prop builder with AI',
      'Same-game parlay optimizer',
      'Real-time line movement alerts',
      'Priority support',
      'Bankroll management tools',
    ],
    highlighted: false,
    cta: 'Go VIP',
  },
];

export const sportOptions = ['NBA', 'NFL', 'MLB', 'NHL', 'Soccer', 'UFC'] as const;

export const legCountOptions = [2, 3, 4, 5, 6] as const;
