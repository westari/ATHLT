import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Image,
  Animated, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Play, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path, Rect, Line, G } from 'react-native-svg';
import Colors from '@/constants/colors';
import AuthScreen from '@/components/AuthScreen';
import { usePlanStore } from '@/store/planStore';

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Branched onboarding with interstitials and scouting report.
 * Steps: regular questions, interstitials (info screens), and a final scouting-report screen.
 */

interface Step {
  id: string;
  section: string;
  type: 'select' | 'multiselect' | 'text' | 'numberGrid' | 'statGrid' | 'interstitial';
  question?: string;
  subtitle?: string;
  options?: { label: string; value?: string; subtitle?: string; disabled?: boolean }[];
  placeholder?: string;
  numberFields?: { id: string; label: string; max?: number }[];
  statFields?: { id: string; label: string; placeholder?: string }[];
  showIf?: (answers: Record<string, any>) => boolean;
  // Interstitial-specific
  interstitialTitle?: string;
  interstitialBody?: string;
  interstitialIllustration?: 'profile' | 'stats' | 'shot' | 'plan';
}

const ANSWER_DEPENDENCIES: Record<string, string[]> = {
  grade: ['schoolTeam', 'playsAAU', 'aauCircuit', 'aauStarter', 'starter', 'collegeLevel', 'adultPlay', 'role', 'stats'],
  playsAAU: ['aauCircuit', 'aauStarter'],
  schoolTeam: ['starter'],
  collegeLevel: ['starter'],
  adultPlay: ['role', 'stats'],
};

const STEPS: Step[] = [
  // ============ About You ============
  {
    id: 'sport', section: 'About You', type: 'select',
    question: 'What sport do you play?',
    subtitle: "We'll tailor everything to your game.",
    options: [
      { label: 'Basketball' },
      { label: 'Soccer', subtitle: 'Coming soon', disabled: true },
      { label: 'Baseball', subtitle: 'Coming soon', disabled: true },
      { label: 'Football', subtitle: 'Coming soon', disabled: true },
    ],
  },
  {
    id: 'position', section: 'About You', type: 'select',
    question: 'What position do you play?',
    subtitle: 'This shapes your skill priorities.',
    options: [
      { label: 'Point Guard' }, { label: 'Shooting Guard' }, { label: 'Small Forward' },
      { label: 'Power Forward' }, { label: 'Center' },
    ],
  },
  {
    id: 'description', section: 'About You', type: 'text',
    question: 'Describe yourself.',
    subtitle: "Height, jersey color, hair, anything so Coach X knows who you are.",
    placeholder: 'e.g. 5\'10", red jersey #5, curly hair',
  },

  // ============ Where You Play ============
  {
    id: 'grade', section: 'Where You Play', type: 'select',
    question: 'What grade are you in?',
    options: [
      { label: 'Middle school (6-8)' },
      { label: 'High school (9-12)' },
      { label: 'College' },
      { label: 'Out of school / adult' },
    ],
  },
  {
    id: 'schoolTeam', section: 'Where You Play', type: 'select',
    question: 'Do you play on a school team?',
    options: [
      { label: 'Varsity' }, { label: 'JV' }, { label: 'Freshman team' },
      { label: 'Middle school team' }, { label: 'No school team' },
    ],
    showIf: (a) => a.grade === 'Middle school (6-8)' || a.grade === 'High school (9-12)',
  },
  {
    id: 'playsAAU', section: 'Where You Play', type: 'select',
    question: 'Do you play AAU or club ball?',
    options: [{ label: 'Yes' }, { label: 'No' }],
    showIf: (a) => a.grade === 'Middle school (6-8)' || a.grade === 'High school (9-12)',
  },
  {
    id: 'aauCircuit', section: 'Where You Play', type: 'select',
    question: 'What circuit?',
    subtitle: 'This helps us know your level of competition.',
    options: [
      { label: 'Top shoe circuit', subtitle: 'Nike EYBL, Under Armour UAA, Adidas 3SSB' },
      { label: 'Mid shoe circuit', subtitle: 'Puma Pro 16, New Balance, other shoe' },
      { label: 'Independent circuit', subtitle: 'Made Hoops, AGame Hoops, other national' },
      { label: 'Local circuit', subtitle: 'Regional/state tournaments only' },
    ],
    showIf: (a) => a.playsAAU === 'Yes',
  },
  {
    id: 'aauStarter', section: 'Where You Play', type: 'select',
    question: 'Are you a starter on your AAU team?',
    options: [
      { label: 'Yes, starter' }, { label: '6th man' },
      { label: 'Rotation player' }, { label: 'Bench' },
    ],
    showIf: (a) => a.playsAAU === 'Yes',
  },
  {
    id: 'collegeLevel', section: 'Where You Play', type: 'select',
    question: 'What level do you play at?',
    options: [
      { label: 'D1' }, { label: 'D2' }, { label: 'D3' }, { label: 'JUCO' },
      { label: 'NAIA' }, { label: 'Club / intramural' }, { label: 'No college team' },
    ],
    showIf: (a) => a.grade === 'College',
  },
  {
    id: 'starter', section: 'Where You Play', type: 'select',
    question: 'Are you a starter on the team?',
    options: [
      { label: 'Yes, starter' }, { label: '6th man' },
      { label: 'Rotation player' }, { label: 'Bench' },
    ],
    showIf: (a) => {
      if (a.playsAAU === 'Yes') return false;
      const isSchoolTeamPlayer = ['Varsity', 'JV', 'Freshman team', 'Middle school team'].includes(a.schoolTeam);
      if (isSchoolTeamPlayer) return true;
      if (a.grade === 'College' && a.collegeLevel && a.collegeLevel !== 'No college team') return true;
      return false;
    },
  },
  {
    id: 'adultPlay', section: 'Where You Play', type: 'select',
    question: 'Where do you play?',
    options: [
      { label: 'Competitive rec league' }, { label: 'Casual rec league' },
      { label: 'Pickup / open gym' }, { label: 'Mostly alone / driveway' },
    ],
    showIf: (a) => a.grade === 'Out of school / adult',
  },

  // ============ INTERSTITIAL 1: after where-you-play ============
  {
    id: 'int_where', section: 'Where You Play', type: 'interstitial',
    interstitialIllustration: 'profile',
    interstitialTitle: 'We know where you play.',
    interstitialBody: 'Coach X uses your level and role to match drills to the competition you actually face.',
  },

  // ============ Role on team ============
  {
    id: 'role', section: 'Your Role', type: 'select',
    question: "What's your role on the team?",
    subtitle: 'So Coach X knows what kind of player you are.',
    options: [
      { label: 'Primary scorer', subtitle: 'Plays are run for you' },
      { label: 'Secondary scorer', subtitle: "You score but aren't the first option" },
      { label: 'Playmaker', subtitle: 'Pass-first, set others up' },
      { label: 'Two-way wing', subtitle: 'Score + defend' },
      { label: 'Defensive stopper', subtitle: 'Guard the best player' },
      { label: 'Rebounder / rim protector', subtitle: 'Big-man role' },
      { label: '3-and-D specialist', subtitle: 'Shoot + defend' },
      { label: 'Energy off the bench', subtitle: 'Spark plug' },
      { label: 'Still figuring out my role' },
    ],
    showIf: (a) => playsOnTeam(a),
  },

  // ============ Stats ============
  {
    id: 'stats', section: 'Your Stats', type: 'statGrid',
    question: 'Estimate your stats per game.',
    subtitle: "It's fine if you don't know exactly. Leave blank if you don't track.",
    statFields: [
      { id: 'minutes', label: 'Minutes per game', placeholder: '0' },
      { id: 'ppg', label: 'Points per game', placeholder: '0' },
      { id: 'apg', label: 'Assists per game', placeholder: '0' },
      { id: 'rpg', label: 'Rebounds per game', placeholder: '0' },
    ],
    showIf: (a) => playsOnTeam(a),
  },

  // ============ INTERSTITIAL 2: after stats ============
  {
    id: 'int_stats', section: 'Your Stats', type: 'interstitial',
    interstitialIllustration: 'stats',
    interstitialTitle: 'Numbers locked.',
    interstitialBody: "A 2 ppg bench player at EYBL is better than a 20 ppg scorer at rec. We read your stats through the level you're playing at.",
    showIf: (a) => playsOnTeam(a),
  },

  // ============ Your Game ============
  {
    id: 'shootingMakes', section: 'Your Game', type: 'numberGrid',
    question: 'Out of 10 wide open shots, how many do you make?',
    subtitle: 'Be honest. This shapes your plan.',
    numberFields: [
      { id: 'layupStrong', label: 'Layups (strong hand)', max: 10 },
      { id: 'layupWeak', label: 'Layups (weak hand)', max: 10 },
      { id: 'freeThrows', label: 'Free throws', max: 10 },
      { id: 'midRange', label: 'Mid-range', max: 10 },
      { id: 'threes', label: '3-pointers', max: 10 },
    ],
  },
  {
    id: 'dribbling', section: 'Your Game', type: 'select',
    question: 'How\'s your dribbling?',
    options: [
      { label: 'Strong with both hands' },
      { label: 'Getting there' },
      { label: 'Avoid using my weak hand' },
      { label: 'Only use my right hand' },
    ],
  },

  // ============ INTERSTITIAL 3: after shot profile ============
  {
    id: 'int_shot', section: 'Your Game', type: 'interstitial',
    interstitialIllustration: 'shot',
    interstitialTitle: 'Your shot profile is set.',
    interstitialBody: "The drills you'll see are picked to attack your weakest spots and sharpen your strongest ones.",
  },

  {
    id: 'goal', section: 'Your Game', type: 'text',
    question: 'What do you want to improve most?',
    subtitle: 'Keep it short — one sentence.',
    placeholder: 'e.g. be a better shooter off the dribble',
  },

  // ============ Schedule ============
  {
    id: 'frequency', section: 'Your Schedule', type: 'select',
    question: 'How often can you train?',
    options: [
      { label: 'Once or twice a week' }, { label: '3-4 times a week' },
      { label: '5-6 times a week' }, { label: 'Every day' },
    ],
  },
  {
    id: 'duration', section: 'Your Schedule', type: 'select',
    question: 'How long per session?',
    options: [
      { label: '20-30 minutes' }, { label: '30-45 minutes' },
      { label: '45-60 minutes' }, { label: '60-90 minutes' },
    ],
  },
  {
    id: 'access', section: 'Your Schedule', type: 'multiselect',
    question: 'Where do you usually train?',
    subtitle: 'Pick all that apply.',
    options: [
      { label: 'Full court with hoop' }, { label: 'Half court with hoop' },
      { label: 'Driveway with hoop' }, { label: 'Gym with weights' },
      { label: 'Open space (no hoop)' },
    ],
  },

  // ============ INTERSTITIAL 4: before scouting ============
  {
    id: 'int_plan', section: 'Scouting Report', type: 'interstitial',
    interstitialIllustration: 'plan',
    interstitialTitle: 'Almost done.',
    interstitialBody: "Next up: your scouting report. Coach X reads everything you told us and turns it into a skill profile.",
  },
];

function playsOnTeam(a: Record<string, any>): boolean {
  if (a.grade === 'Middle school (6-8)' || a.grade === 'High school (9-12)') {
    const hasSchool = ['Varsity', 'JV', 'Freshman team', 'Middle school team'].includes(a.schoolTeam);
    return hasSchool || a.playsAAU === 'Yes';
  }
  if (a.grade === 'College') {
    return a.collegeLevel && a.collegeLevel !== 'No college team';
  }
  if (a.grade === 'Out of school / adult') {
    return a.adultPlay === 'Competitive rec league' || a.adultPlay === 'Casual rec league';
  }
  return false;
}

function getVisibleSteps(answers: Record<string, any>): Step[] {
  return STEPS.filter(s => !s.showIf || s.showIf(answers));
}

function clearDependentAnswers(answers: Record<string, any>, changedKey: string): Record<string, any> {
  const deps = ANSWER_DEPENDENCIES[changedKey];
  if (!deps) return answers;
  const next = { ...answers };
  for (const d of deps) {
    delete next[d];
    const nested = ANSWER_DEPENDENCIES[d];
    if (nested) for (const n of nested) delete next[n];
  }
  return next;
}

/**
 * Compute skill ratings from onboarding answers.
 * Returns 0-10 for each of our 12 skills.
 * This mirrors what the backend will do for persistence, but is also shown
 * directly in the scouting report screen.
 */
function computeSkills(a: Record<string, any>): Record<string, { level: number; label: string }> {
  const skills: Record<string, number> = {
    shooting: 5, shotForm: 5, finishing: 5, ballHandling: 5, weakHand: 5,
    defense: 5, iq: 5, athleticism: 5, creativity: 5, touch: 5,
    courtVision: 5, decisionMaking: 5,
  };

  // --- Shooting makes ---
  const m = a.shootingMakes || {};
  const layupStrong = parseInt(m.layupStrong || '') || 0;
  const layupWeak = parseInt(m.layupWeak || '') || 0;
  const ft = parseInt(m.freeThrows || '') || 0;
  const midRange = parseInt(m.midRange || '') || 0;
  const threes = parseInt(m.threes || '') || 0;

  // Average shooting spots → shooting rating (weight FT/3pt/midrange equally)
  if (midRange || threes || ft) {
    const shootingAvg = (midRange + threes + ft) / 3;
    skills.shooting = Math.max(1, Math.min(10, shootingAvg));
    skills.shotForm = Math.max(1, Math.min(10, (midRange + ft) / 2));
    skills.touch = Math.max(1, Math.min(10, (ft + midRange) / 2));
  }

  // Finishing = layups average
  if (layupStrong || layupWeak) {
    skills.finishing = Math.max(1, Math.min(10, (layupStrong + layupWeak) / 2));
    skills.weakHand = Math.max(1, Math.min(10, layupWeak));
  }

  // --- Dribbling / weakHand ---
  const d = a.dribbling;
  if (d === 'Strong with both hands') { skills.ballHandling = 8; skills.weakHand = Math.max(skills.weakHand, 7); }
  else if (d === 'Getting there') { skills.ballHandling = 6; skills.weakHand = Math.max(skills.weakHand, 5); }
  else if (d === 'Avoid using my weak hand') { skills.ballHandling = 5; skills.weakHand = Math.min(skills.weakHand, 3); }
  else if (d === 'Only use my right hand') { skills.ballHandling = 4; skills.weakHand = 2; }

  // --- Role tuning ---
  const role = a.role;
  if (role === 'Primary scorer') { skills.creativity += 1; skills.decisionMaking += 0.5; }
  if (role === 'Playmaker') { skills.iq += 2; skills.courtVision += 2; skills.decisionMaking += 1.5; }
  if (role === 'Defensive stopper') { skills.defense += 2.5; skills.athleticism += 1; skills.iq += 1; }
  if (role === 'Rebounder / rim protector') { skills.finishing += 1; skills.athleticism += 1.5; skills.defense += 1.5; }
  if (role === '3-and-D specialist') { skills.shooting += 1; skills.defense += 1.5; }
  if (role === 'Two-way wing') { skills.defense += 1; skills.shooting += 0.5; skills.athleticism += 0.5; }
  if (role === 'Energy off the bench') { skills.athleticism += 1.5; skills.defense += 0.5; }
  if (role === 'Still figuring out my role') { /* no bonus */ }

  // --- Level/tier influence (higher competition = higher baseline iq/decisionMaking/defense) ---
  let tier = 5;
  if (a.aauCircuit === 'Top shoe circuit' || a.collegeLevel === 'D1') tier = 9;
  else if (a.aauCircuit === 'Mid shoe circuit' || a.aauCircuit === 'Independent circuit' || a.schoolTeam === 'Varsity' || a.collegeLevel === 'D2' || a.collegeLevel === 'D3') tier = 7;
  else if (a.aauCircuit === 'Local circuit' || a.schoolTeam === 'JV' || a.collegeLevel === 'JUCO' || a.collegeLevel === 'NAIA' || a.adultPlay === 'Competitive rec league') tier = 6;
  else if (a.schoolTeam === 'Freshman team' || a.schoolTeam === 'Middle school team' || a.collegeLevel === 'Club / intramural' || a.adultPlay === 'Casual rec league') tier = 5;
  else if (a.adultPlay === 'Pickup / open gym') tier = 5;
  else if (a.adultPlay === 'Mostly alone / driveway') tier = 4;

  // Tier bumps: higher tier = assume slightly better iq/decisionMaking/defense from playing better comp
  const tierBump = (tier - 5) * 0.4;
  skills.iq += tierBump;
  skills.decisionMaking += tierBump;
  skills.defense += tierBump * 0.5;
  skills.athleticism += tierBump * 0.5;

  // --- Starter status tuning ---
  if (a.starter === 'Yes, starter' || a.aauStarter === 'Yes, starter') {
    skills.iq += 0.5; skills.decisionMaking += 0.5;
  } else if (a.starter === 'Bench' || a.aauStarter === 'Bench') {
    skills.iq -= 0.3;
  }

  // --- Stats (only useful if on a team) ---
  const s = a.stats || {};
  const ppg = parseFloat(s.ppg) || 0;
  const apg = parseFloat(s.apg) || 0;
  const rpg = parseFloat(s.rpg) || 0;
  const minutes = parseFloat(s.minutes) || 0;

  // Compute per-30 if minutes provided
  const per30 = (stat: number) => (minutes > 0 ? (stat / minutes) * 30 : stat);
  const ppg30 = per30(ppg);
  const apg30 = per30(apg);
  const rpg30 = per30(rpg);

  if (ppg30 >= 18) skills.shooting += 1.5;
  else if (ppg30 >= 12) skills.shooting += 0.8;
  else if (ppg30 >= 6) skills.shooting += 0.3;

  if (apg30 >= 5) { skills.courtVision += 2; skills.iq += 1; skills.decisionMaking += 1; }
  else if (apg30 >= 3) { skills.courtVision += 1; skills.iq += 0.5; }

  if (rpg30 >= 7) { skills.athleticism += 1.5; skills.finishing += 0.5; }
  else if (rpg30 >= 4) { skills.athleticism += 0.8; }

  // --- Position baseline ---
  if (a.position === 'Point Guard') { skills.courtVision += 0.5; skills.ballHandling += 0.5; }
  if (a.position === 'Center') { skills.finishing += 0.3; skills.athleticism += 0.3; }

  // Clamp all to 1-10
  const result: Record<string, { level: number; label: string }> = {};
  const labels: Record<string, string> = {
    shooting: 'Shooting', shotForm: 'Shot Form', finishing: 'Finishing',
    ballHandling: 'Ball Handling', weakHand: 'Weak Hand', defense: 'Defense',
    iq: 'Basketball IQ', athleticism: 'Athleticism', creativity: 'Creativity',
    touch: 'Touch', courtVision: 'Court Vision', decisionMaking: 'Decision Making',
  };
  for (const k of Object.keys(skills)) {
    result[k] = {
      level: Math.round(Math.max(1, Math.min(10, skills[k])) * 10) / 10,
      label: labels[k] || k,
    };
  }
  return result;
}

const LOADING_STEPS = [
  'Reading your profile',
  'Scoring your skills',
  'Matching drills to your game',
  'Building your weekly plan',
  'Finishing Coach X notes',
];

// ============ INTERSTITIAL ILLUSTRATIONS (inline SVG) ============

function Illustration({ kind }: { kind: 'profile' | 'stats' | 'shot' | 'plan' }) {
  const size = 200;
  const stroke = Colors.primary;
  const fill = 'transparent';
  const bg = Colors.surface;

  if (kind === 'profile') {
    return (
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Circle cx="100" cy="100" r="90" fill={bg} />
        <Circle cx="100" cy="75" r="25" stroke={stroke} strokeWidth="3" fill={fill} />
        <Path d="M60 150 Q100 110 140 150" stroke={stroke} strokeWidth="3" fill={fill} />
        <Line x1="100" y1="135" x2="100" y2="160" stroke={stroke} strokeWidth="2" />
        <Circle cx="100" cy="160" r="4" fill={stroke} />
      </Svg>
    );
  }
  if (kind === 'stats') {
    return (
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Circle cx="100" cy="100" r="90" fill={bg} />
        <Rect x="50" y="120" width="18" height="40" fill={stroke} />
        <Rect x="80" y="90" width="18" height="70" fill={stroke} opacity="0.8" />
        <Rect x="110" y="60" width="18" height="100" fill={stroke} />
        <Rect x="140" y="100" width="18" height="60" fill={stroke} opacity="0.6" />
        <Line x1="40" y1="160" x2="170" y2="160" stroke={Colors.textMuted} strokeWidth="2" />
      </Svg>
    );
  }
  if (kind === 'shot') {
    return (
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Circle cx="100" cy="100" r="90" fill={bg} />
        {/* Hoop */}
        <Rect x="140" y="50" width="4" height="50" fill={stroke} />
        <Line x1="120" y1="70" x2="160" y2="70" stroke={stroke} strokeWidth="3" />
        <Path d="M120 70 L125 85 L155 85 L160 70" stroke={stroke} strokeWidth="2" fill={fill} />
        {/* Arcing ball */}
        <Path d="M40 150 Q85 40 145 80" stroke={stroke} strokeWidth="2" strokeDasharray="4 4" fill={fill} />
        <Circle cx="40" cy="150" r="8" fill={stroke} />
      </Svg>
    );
  }
  // plan
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Circle cx="100" cy="100" r="90" fill={bg} />
      <Rect x="55" y="50" width="90" height="110" rx="6" stroke={stroke} strokeWidth="3" fill={fill} />
      <Line x1="70" y1="75" x2="130" y2="75" stroke={stroke} strokeWidth="2" />
      <Line x1="70" y1="95" x2="120" y2="95" stroke={stroke} strokeWidth="2" />
      <Line x1="70" y1="115" x2="125" y2="115" stroke={stroke} strokeWidth="2" />
      <Line x1="70" y1="135" x2="115" y2="135" stroke={stroke} strokeWidth="2" />
      <Circle cx="62" cy="75" r="3" fill={stroke} />
      <Circle cx="62" cy="95" r="3" fill={stroke} />
      <Circle cx="62" cy="115" r="3" fill={stroke} />
      <Circle cx="62" cy="135" r="3" fill={stroke} />
    </Svg>
  );
}

// ============ MAIN COMPONENT ============

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, profile, completedDrills, currentDayIndex, loadFromStorage, setPlan, setProfile, setSkillLevels, setDescription } = usePlanStore();

  const [appState, setAppState] = useState<'loading' | 'welcome' | 'onboarding' | 'scouting' | 'auth' | 'analyzing' | 'plan'>('loading');
  const [isReady, setIsReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [textInput, setTextInput] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadFromStorage().then(() => setIsReady(true)); }, []);
  useEffect(() => { if (isReady) { if (profile && plan) setAppState('plan'); else setAppState('welcome'); } }, [isReady]);
  useEffect(() => { if (appState === 'analyzing') Animated.timing(progressAnim, { toValue: loadingProgress, duration: 800, useNativeDriver: false }).start(); }, [loadingProgress, appState]);

  const visibleSteps = getVisibleSteps(answers);
  const currentStep = visibleSteps[stepIndex];
  const progress = visibleSteps.length > 0 ? (stepIndex + 1) / visibleSteps.length : 0;

  const animTrans = (dir: 'forward' | 'back', cb: () => void) => {
    const o = dir === 'forward' ? -30 : 30, n = dir === 'forward' ? 30 : -30;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: o, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      cb(); slideAnim.setValue(n);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]).start();
    });
  };

  const goNext = () => {
    const updatedVisible = getVisibleSteps(answers);
    if (stepIndex < updatedVisible.length - 1) {
      const next = updatedVisible[stepIndex + 1];
      if (next.type === 'text') setTextInput((answers[next.id] as string) || '');
      animTrans('forward', () => setStepIndex(stepIndex + 1));
    } else {
      // Done with onboarding → scouting report
      setAppState('scouting');
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      const prev = visibleSteps[stepIndex - 1];
      if (prev.type === 'text') setTextInput((answers[prev.id] as string) || '');
      animTrans('back', () => setStepIndex(stepIndex - 1));
    } else {
      setAppState('welcome');
    }
  };

  const handleSelect = (opt: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const st = currentStep; if (!st) return;
    if (st.type === 'multiselect') {
      const c = (answers[st.id] as string[]) || [];
      setAnswers({ ...answers, [st.id]: c.includes(opt) ? c.filter(o => o !== opt) : [...c, opt] });
    } else {
      const oldValue = answers[st.id];
      let nextAnswers = { ...answers, [st.id]: opt };
      if (oldValue !== undefined && oldValue !== opt) {
        nextAnswers = clearDependentAnswers(nextAnswers, st.id);
        nextAnswers[st.id] = opt;
      }
      setAnswers(nextAnswers);
      setTimeout(() => goNext(), 300);
    }
  };

  const handleTextSubmit = () => {
    const st = currentStep; if (!st) return;
    if (!textInput.trim()) return;
    setAnswers({ ...answers, [st.id]: textInput.trim() });
    setTextInput('');
    goNext();
  };

  const handleNumberChange = (fieldId: string, value: string) => {
    const st = currentStep; if (!st) return;
    const current = (answers[st.id] as Record<string, any>) || {};
    setAnswers({ ...answers, [st.id]: { ...current, [fieldId]: value } });
  };

  const buildPayloadFromAnswers = (a: Record<string, any>) => {
    let experience = '';
    if (a.grade === 'Middle school (6-8)') experience = '1-2 years';
    else if (a.grade === 'High school (9-12)') experience = '3-5 years';
    else if (a.grade === 'College') experience = '6-10 years';
    else if (a.grade === 'Out of school / adult') experience = '10+ years';

    const leftHandMap: Record<string, string> = {
      'Strong with both hands': 'Strong - I finish with both hands',
      'Getting there': 'Getting there - I use it sometimes',
      'Avoid using my weak hand': 'Weak - I avoid it',
      'Only use my right hand': 'I only use my right hand',
    };

    const threes = parseInt(a.shootingMakes?.threes || '0');
    let threeConfidence = "I don't shoot them";
    if (threes >= 5) threeConfidence = "Very - I'm a shooter";
    else if (threes >= 3) threeConfidence = "Somewhat - I'll take open ones";
    else if (threes >= 1) threeConfidence = "Not really - I prefer mid-range";

    const ft = parseInt(a.shootingMakes?.freeThrows || '0');
    let freeThrow = 'No idea';
    if (ft >= 8) freeThrow = '80% or higher';
    else if (ft >= 6) freeThrow = '60-80%';
    else if (ft >= 4) freeThrow = '40-60%';
    else freeThrow = 'Below 40%';

    let weakness = a.goal || 'overall game';
    const makes = a.shootingMakes || {};
    const makeEntries = Object.entries(makes).map(([k, v]) => [k, parseInt(v as string) || 0]) as [string, number][];
    if (makeEntries.length > 0) {
      makeEntries.sort((x, y) => x[1] - y[1]);
      const worst = makeEntries[0];
      const worstLabels: Record<string, string> = {
        layupStrong: 'Finishing at the rim', layupWeak: 'Weak hand finishing',
        freeThrows: 'Free throw shooting', midRange: 'Mid-range shooting', threes: 'Three-point shooting',
      };
      if (worst[1] <= 3) weakness = worstLabels[worst[0]] || weakness;
    }
    if (a.dribbling === 'Avoid using my weak hand' || a.dribbling === 'Only use my right hand') {
      weakness = 'Weak hand ball handling';
    }

    // Compute skill levels to send to backend (so plan gen knows the profile)
    const computed = computeSkills(a);
    const skillLevels: Record<string, number> = {};
    for (const k of Object.keys(computed)) skillLevels[k] = computed[k].level;

    return {
      sport: a.sport, position: a.position, experience,
      goal: a.goal || 'Become a more complete player',
      weakness,
      driving: 'not specified',
      leftHand: leftHandMap[a.dribbling] || 'not specified',
      pressure: 'not specified', goToMove: 'not specified',
      threeConfidence, freeThrow,
      frequency: a.frequency, duration: a.duration, access: a.access,
      description: a.description || '',
      grade: a.grade, schoolTeam: a.schoolTeam,
      playsAAU: a.playsAAU, aauCircuit: a.aauCircuit, aauStarter: a.aauStarter,
      starter: a.starter, collegeLevel: a.collegeLevel, adultPlay: a.adultPlay,
      role: a.role, stats: a.stats,
      shootingMakes: a.shootingMakes, dribbling: a.dribbling,
      skillLevels,
    };
  };

  const generatePlanFromOnboarding = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setAppState('analyzing');
    setLoadingProgress(0);
    setCurrentLoadingStep(0);

    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      stepIdx++;
      if (stepIdx < LOADING_STEPS.length) {
        setCurrentLoadingStep(stepIdx);
        setLoadingProgress(Math.round((stepIdx / LOADING_STEPS.length) * 90));
      }
    }, 3000);

    try {
      const payload = buildPayloadFromAnswers(answers);
      const r = await fetch('https://collectiq-xi.vercel.app/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      clearInterval(stepInterval);
      setLoadingProgress(100);
      const planData = await r.json();
      await new Promise(x => setTimeout(x, 800));

      if (r.ok && planData.days) {
        setPlan(planData);
        setProfile({
          sport: payload.sport, position: payload.position, experience: payload.experience,
          goal: payload.goal, weakness: payload.weakness,
          frequency: payload.frequency, duration: payload.duration, access: payload.access,
          driving: payload.driving, leftHand: payload.leftHand, pressure: payload.pressure,
          goToMove: payload.goToMove, threeConfidence: payload.threeConfidence, freeThrow: payload.freeThrow,
        });
        if (payload.description) setDescription(payload.description);
        setSkillLevels(payload.skillLevels);
        setAppState('plan');
      } else {
        Alert.alert('Plan generation failed', 'Please try again.');
        setAppState('welcome');
      }
    } catch (e) {
      clearInterval(stepInterval);
      Alert.alert('Something went wrong', 'Please check your connection and try again.');
      setAppState('welcome');
    }
  };

  // ============ RENDER ============

  if (appState === 'loading') return <View style={[s.c, { paddingTop: insets.top }]} />;

  if (appState === 'welcome') return (
    <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 16, paddingBottom: 24, alignItems: 'center' }}>
          <Image source={require('@/assets/images/logo.png')} style={{ width: 180, height: 50 }} resizeMode="contain" />
        </View>
        <Text style={{ fontSize: 28, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center', lineHeight: 36, marginBottom: 12, marginTop: 40 }}>
          Training plans that know how you play.
        </Text>
        <Text style={{ fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 40, lineHeight: 22 }}>
          Tell us about your game. We'll build a plan around it.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 20, alignItems: 'center' }}
          onPress={() => {
            if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setStepIndex(0);
            setAppState('onboarding');
          }}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 15, fontWeight: '900', color: Colors.black, letterSpacing: 2 }}>GET STARTED</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  if (appState === 'onboarding' && currentStep) {
    const st = currentStep;

    // INTERSTITIAL rendering
    if (st.type === 'interstitial') {
      return (
        <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={s.qh}>
            <TouchableOpacity onPress={goBack} style={s.bb}><Text style={s.bt}>←</Text></TouchableOpacity>
            <View style={s.pc}><View style={s.pt}><View style={[s.pf, { width: (progress * 100) + '%' }]} /></View></View>
            <View style={{ width: 60 }} />
          </View>
          <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
            {st.interstitialIllustration && (
              <View style={{ marginBottom: 40 }}>
                <Illustration kind={st.interstitialIllustration} />
              </View>
            )}
            <Text style={{ fontSize: 28, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center', marginBottom: 16, lineHeight: 36 }}>
              {st.interstitialTitle}
            </Text>
            <Text style={{ fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
              {st.interstitialBody}
            </Text>
          </Animated.View>
          <View style={s.bn}>
            <TouchableOpacity style={s.cb} onPress={goNext} activeOpacity={0.85}>
              <Text style={s.ct}>CONTINUE</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // QUESTION rendering
    const isSel = (o: string) => {
      const a = answers[st.id];
      return Array.isArray(a) ? a.includes(o) : a === o;
    };
    const canGo = () => {
      const a = answers[st.id];
      if (st.type === 'text') return textInput.trim().length > 0;
      if (st.type === 'multiselect') return Array.isArray(a) && a.length > 0;
      if (st.type === 'statGrid') return true;
      if (st.type === 'numberGrid') {
        const grid = (a as Record<string, string>) || {};
        return st.numberFields!.every(f => grid[f.id] !== undefined && grid[f.id] !== '');
      }
      return !!a;
    };

    return (
      <KeyboardAvoidingView style={s.c} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={s.qh}>
            <TouchableOpacity onPress={goBack} style={s.bb}><Text style={s.bt}>←</Text></TouchableOpacity>
            <View style={s.pc}><View style={s.pt}><View style={[s.pf, { width: (progress * 100) + '%' }]} /></View></View>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
              <Text style={s.qs}>{st.section.toUpperCase()}</Text>
              <Text style={s.qq}>{st.question}</Text>
              {st.subtitle ? <Text style={s.qsub}>{st.subtitle}</Text> : null}

              {(st.type === 'select' || st.type === 'multiselect') && st.options?.map((o, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.opt, isSel(o.label) && s.optSel, o.disabled && s.optDisabled]}
                  onPress={() => !o.disabled && handleSelect(o.label)}
                  activeOpacity={o.disabled ? 1 : 0.7}
                  disabled={o.disabled}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optTxt, isSel(o.label) && s.optTxtSel, o.disabled && s.optTxtDisabled]}>{o.label}</Text>
                    {o.subtitle ? <Text style={[s.optSub, o.disabled && s.optTxtDisabled]}>{o.subtitle}</Text> : null}
                  </View>
                  {isSel(o.label) && <Check size={18} color={Colors.primary} />}
                </TouchableOpacity>
              ))}

              {st.type === 'text' && (
                <TextInput
                  style={s.textIn}
                  placeholder={st.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  value={textInput}
                  onChangeText={setTextInput}
                  multiline maxLength={200} autoFocus
                />
              )}

              {st.type === 'numberGrid' && st.numberFields?.map((f, i) => {
                const grid = (answers[st.id] as Record<string, string>) || {};
                return (
                  <View key={i} style={s.ngRow}>
                    <Text style={s.ngLabel}>{f.label}</Text>
                    <View style={s.ngInputWrap}>
                      <TextInput
                        style={s.ngInput}
                        keyboardType="number-pad"
                        maxLength={2}
                        value={grid[f.id] || ''}
                        onChangeText={(v) => {
                          const n = v.replace(/[^0-9]/g, '');
                          const num = parseInt(n || '0');
                          if (num > (f.max || 10)) return;
                          handleNumberChange(f.id, n);
                        }}
                        placeholder="0"
                        placeholderTextColor={Colors.textMuted}
                      />
                      <Text style={s.ngMax}>/ {f.max || 10}</Text>
                    </View>
                  </View>
                );
              })}

              {st.type === 'statGrid' && st.statFields?.map((f, i) => {
                const grid = (answers[st.id] as Record<string, string>) || {};
                return (
                  <View key={i} style={s.sgRow}>
                    <Text style={s.sgLabel}>{f.label}</Text>
                    <TextInput
                      style={s.sgInput}
                      keyboardType="decimal-pad"
                      maxLength={5}
                      value={grid[f.id] || ''}
                      onChangeText={(v) => handleNumberChange(f.id, v.replace(/[^0-9.]/g, ''))}
                      placeholder={f.placeholder || '0'}
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                );
              })}
            </Animated.View>
          </ScrollView>

          {(st.type === 'text' || st.type === 'numberGrid' || st.type === 'statGrid' || st.type === 'multiselect') && (
            <View style={s.bn}>
              <TouchableOpacity
                style={[s.cb, !canGo() && s.cbDisabled]}
                onPress={() => { if (st.type === 'text') handleTextSubmit(); else goNext(); }}
                activeOpacity={0.85}
                disabled={!canGo()}
              >
                <Text style={[s.ct, !canGo() && s.ctDisabled]}>
                  {st.type === 'statGrid' ? 'CONTINUE (SKIP OK)' : 'CONTINUE'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ============ SCOUTING REPORT ============
  if (appState === 'scouting') {
    const skills = computeSkills(answers);
    const skillEntries = Object.entries(skills).sort((a, b) => b[1].level - a[1].level);
    const strongest = skillEntries.slice(0, 3);
    const weakest = [...skillEntries].sort((a, b) => a[1].level - b[1].level).slice(0, 3);

    return (
      <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.qh}>
          <TouchableOpacity onPress={() => setAppState('onboarding')} style={s.bb}><Text style={s.bt}>←</Text></TouchableOpacity>
          <View style={s.pc}><View style={s.pt}><View style={[s.pf, { width: '100%' }]} /></View></View>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          <Text style={s.qs}>YOUR SCOUTING REPORT</Text>
          <Text style={[s.qq, { marginBottom: 8 }]}>Here's your starting profile.</Text>
          <Text style={s.qsub}>Computed from your answers. These will refine as you train.</Text>

          {/* Strengths */}
          <Text style={[s.scHeader, { marginTop: 16 }]}>STRENGTHS</Text>
          {strongest.map(([key, s2]) => (
            <View key={key} style={s.scRow}>
              <Text style={s.scLabel}>{s2.label}</Text>
              <View style={s.scBarWrap}>
                <View style={[s.scBarFill, { width: (s2.level * 10) + '%', backgroundColor: Colors.primary }]} />
              </View>
              <Text style={s.scVal}>{s2.level.toFixed(1)}</Text>
            </View>
          ))}

          {/* Needs work */}
          <Text style={[s.scHeader, { marginTop: 24 }]}>NEEDS WORK</Text>
          {weakest.map(([key, s2]) => (
            <View key={key} style={s.scRow}>
              <Text style={s.scLabel}>{s2.label}</Text>
              <View style={s.scBarWrap}>
                <View style={[s.scBarFill, { width: (s2.level * 10) + '%', backgroundColor: '#C47A6C' }]} />
              </View>
              <Text style={s.scVal}>{s2.level.toFixed(1)}</Text>
            </View>
          ))}

          {/* Full list */}
          <Text style={[s.scHeader, { marginTop: 24 }]}>FULL PROFILE</Text>
          {skillEntries.map(([key, s2]) => (
            <View key={key} style={s.scRowFull}>
              <Text style={s.scLabelSm}>{s2.label}</Text>
              <Text style={s.scValSm}>{s2.level.toFixed(1)}/10</Text>
            </View>
          ))}
        </ScrollView>

        <View style={s.bn}>
          <TouchableOpacity
            style={s.cb}
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setAppState('auth');
            }}
            activeOpacity={0.85}
          >
            <Text style={s.ct}>UNLOCK MY PLAN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (appState === 'auth') {
    return (
      <AuthScreen
        onComplete={async () => { await generatePlanFromOnboarding(); }}
        onBack={() => setAppState('scouting')}
      />
    );
  }

  if (appState === 'analyzing') {
    return (
      <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 32 }} />
        <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 16 }}>
          {LOADING_STEPS[currentLoadingStep] || 'Building your plan'}
        </Text>
        <View style={{ width: '100%', height: 4, backgroundColor: Colors.surface, borderRadius: 2, overflow: 'hidden', marginTop: 20 }}>
          <Animated.View style={{ height: 4, backgroundColor: Colors.primary, width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
        </View>
        <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 16 }}>{loadingProgress}%</Text>
      </View>
    );
  }

  if (appState === 'plan' && plan) {
    const day = plan.days?.[currentDayIndex];
    const drills = day?.drills || [];
    const donePct = drills.length > 0 ? Math.round((drills.filter((_, i) => completedDrills[currentDayIndex + '-' + i]).length / drills.length) * 100) : 0;

    return (
      <ScrollView style={[s.c, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: Colors.textPrimary, marginBottom: 4 }}>Today</Text>
          <Text style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 24 }}>{plan.weekTitle}</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginBottom: 24 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
            {plan.days.map((d, i) => {
              const isCur = i === currentDayIndex;
              const dayPct = d.drills.length > 0 ? Math.round((d.drills.filter((_, j) => completedDrills[i + '-' + j]).length / d.drills.length) * 100) : 0;
              return (
                <TouchableOpacity
                  key={i}
                  style={{
                    minWidth: 60, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: isCur ? Colors.primary : Colors.surface,
                    borderWidth: 1, borderColor: isCur ? Colors.primary : Colors.surfaceBorder,
                    alignItems: 'center',
                  }}
                  onPress={() => usePlanStore.getState().setCurrentDayIndex(i)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: isCur ? Colors.black : Colors.textMuted, letterSpacing: 1, marginBottom: 3 }}>{DAYS_SHORT[i]}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: isCur ? Colors.black : Colors.textPrimary }}>{d.day}</Text>
                  {d.isRest ? (
                    <Text style={{ fontSize: 9, color: isCur ? Colors.black : Colors.textMuted, marginTop: 2 }}>REST</Text>
                  ) : (
                    <Text style={{ fontSize: 9, color: isCur ? Colors.black : Colors.textMuted, marginTop: 2 }}>{dayPct}%</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {day?.isRest ? (
            <View style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.surfaceBorder, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 }}>Rest day</Text>
              <Text style={{ fontSize: 14, color: Colors.textSecondary, textAlign: 'center' }}>Recovery is part of the plan. See you tomorrow.</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.surfaceBorder }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: Colors.textMuted, letterSpacing: 1.5, fontWeight: '700' }}>TODAY'S FOCUS</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>{day?.duration}</Text>
              </View>
              <Text style={{ fontSize: 24, fontWeight: '900', color: Colors.textPrimary, marginBottom: 16 }}>{day?.focus}</Text>
              <View style={{ height: 4, backgroundColor: Colors.background, borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
                <View style={{ height: 4, backgroundColor: Colors.primary, width: donePct + '%' }} />
              </View>
              <TouchableOpacity
                style={{ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onPress={() => router.push('/session')}
                activeOpacity={0.85}
              >
                <Play size={18} color={Colors.black} />
                <Text style={{ fontSize: 14, fontWeight: '900', color: Colors.black, letterSpacing: 1.5 }}>START SESSION</Text>
              </TouchableOpacity>
              <View style={{ marginTop: 20 }}>
                {drills.map((d, i) => {
                  const done = completedDrills[currentDayIndex + '-' + i];
                  return (
                    <TouchableOpacity
                      key={i}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#222' }}
                      onPress={() => router.push('/drill/' + i)}
                      activeOpacity={0.7}
                    >
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: done ? Colors.primary : Colors.surfaceBorder, backgroundColor: done ? Colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {done && <Text style={{ fontSize: 9, color: Colors.black, fontWeight: '800' }}>✓</Text>}
                      </View>
                      <Text style={{ flex: 1, fontSize: 13, color: done ? Colors.textMuted : Colors.textPrimary, textDecorationLine: done ? 'line-through' : 'none' }} numberOfLines={1}>{d.name}</Text>
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>{d.time}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {plan.aiInsight && (
            <View style={{ marginTop: 20, backgroundColor: Colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.surfaceBorder }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 8 }}>COACH X INSIGHT</Text>
              <Text style={{ fontSize: 14, color: Colors.textSecondary, lineHeight: 21 }}>{plan.aiInsight}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  return <View style={[s.c, { paddingTop: insets.top }]} />;
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.background },
  qh: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  bb: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bt: { fontSize: 22, color: Colors.textSecondary },
  pc: { flex: 1, paddingHorizontal: 12 },
  pt: { height: 4, backgroundColor: Colors.surface, borderRadius: 2, overflow: 'hidden' },
  pf: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  qs: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 2, marginBottom: 12 },
  qq: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, lineHeight: 34, marginBottom: 8 },
  qsub: { fontSize: 14, color: Colors.textMuted, lineHeight: 20, marginBottom: 20 },
  opt: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 10 },
  optSel: { borderColor: Colors.primary, backgroundColor: '#1A1708' },
  optDisabled: { opacity: 0.4 },
  optTxt: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  optTxtSel: { color: Colors.primary },
  optTxtDisabled: { color: Colors.textMuted },
  optSub: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  textIn: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 16, fontSize: 16, color: Colors.textPrimary, minHeight: 100, textAlignVertical: 'top' },
  ngRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 10 },
  ngLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  ngInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ngInput: { width: 48, textAlign: 'center', fontSize: 18, fontWeight: '800', color: Colors.textPrimary, backgroundColor: Colors.background, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: Colors.surfaceBorder },
  ngMax: { fontSize: 13, color: Colors.textMuted },
  sgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 10 },
  sgLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  sgInput: { width: 80, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.textPrimary, backgroundColor: Colors.background, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: Colors.surfaceBorder },
  bn: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder },
  cb: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  cbDisabled: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder },
  ct: { fontSize: 14, fontWeight: '900', color: Colors.black, letterSpacing: 2 },
  ctDisabled: { color: Colors.textMuted },
  // Scouting report
  scHeader: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  scRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  scLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, width: 120 },
  scBarWrap: { flex: 1, height: 8, backgroundColor: Colors.surface, borderRadius: 4, overflow: 'hidden' },
  scBarFill: { height: 8, borderRadius: 4 },
  scVal: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, width: 36, textAlign: 'right' },
  scRowFull: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#222' },
  scLabelSm: { fontSize: 13, color: Colors.textSecondary },
  scValSm: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
});
