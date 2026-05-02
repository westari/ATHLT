import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Image,
  Animated, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Play, Check, GraduationCap, Users, Award, Trophy, Target, BarChart3,
  MapPin, Calendar, Clock, Dumbbell, User as UserIcon, Zap, Brain,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import AuthScreen from '@/components/AuthScreen';
import CoachXPill from '@/components/CoachXPill';
import CoachXClimax from '@/components/CoachXClimax';
import TodayHome from '@/components/TodayHome';
import { usePlanStore } from '@/store/planStore';
import { supabase } from '@/constants/supabase';

const FONT_HEAVY = Platform.OS === 'ios' ? 'System' : 'sans-serif';

const IMG_WHERE_YOU_PLAY = require('@/assets/images/where-you-play.png');
const IMG_STATS_LOCKED = require('@/assets/images/stats-locked.png');
const IMG_SHOT_MAPPED = require('@/assets/images/shot-mapped.png');
const IMG_SCOUTING_READY = require('@/assets/images/scouting-ready.png');

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const SECTION_ICONS: Record<string, any> = {
  'About You': UserIcon,
  'Where You Play': MapPin,
  'Your Role': Users,
  'Your Stats': BarChart3,
  'Your Game': Target,
  'Your Schedule': Calendar,
  'Scouting Report': Award,
};

interface OptionDef {
  label: string;
  subtitle?: string;
  disabled?: boolean;
  icon?: any;
}

interface Step {
  id: string;
  section: string;
  type: 'select' | 'multiselect' | 'text' | 'numberGrid' | 'statGrid' | 'interstitial';
  question?: string;
  subtitle?: string;
  options?: OptionDef[];
  placeholder?: string;
  numberFields?: { id: string; label: string; max?: number }[];
  statFields?: { id: string; label: string; placeholder?: string }[];
  showIf?: (answers: Record<string, any>) => boolean;
  dynamicOptions?: (answers: Record<string, any>) => OptionDef[];
  interstitialTitle?: string;
  interstitialBody?: string;
  interstitialImage?: any;
}

const ANSWER_DEPENDENCIES: Record<string, string[]> = {
  grade: ['schoolTeam', 'playsAAU', 'aauCircuit', 'aauStarter', 'starter', 'collegeLevel', 'adultPlay', 'role', 'stats'],
  playsAAU: ['aauCircuit', 'aauStarter'],
  schoolTeam: ['starter'],
  collegeLevel: ['starter'],
  adultPlay: ['role', 'stats'],
};

const STEPS: Step[] = [
  { id: 'sport', section: 'About You', type: 'select', question: 'What sport do you play?', subtitle: "We'll tailor everything to your game.", options: [{ label: 'Basketball' }, { label: 'Soccer', subtitle: 'Coming soon', disabled: true }, { label: 'Baseball', subtitle: 'Coming soon', disabled: true }, { label: 'Football', subtitle: 'Coming soon', disabled: true }] },
  { id: 'position', section: 'About You', type: 'select', question: 'What position do you play?', subtitle: 'This shapes your skill priorities.', options: [{ label: 'Point Guard' }, { label: 'Shooting Guard' }, { label: 'Small Forward' }, { label: 'Power Forward' }, { label: 'Center' }] },
  { id: 'description', section: 'About You', type: 'text', question: 'Describe yourself.', subtitle: "Height, jersey color, hair, anything so Coach X knows who you are.", placeholder: 'e.g. 5\'10", red jersey #5, curly hair' },
  { id: 'grade', section: 'Where You Play', type: 'select', question: 'What grade are you in?', options: [{ label: 'Middle school (6-8)' }, { label: 'High school (9-12)' }, { label: 'College' }, { label: 'Out of school / adult' }] },
  { id: 'schoolTeam', section: 'Where You Play', type: 'select', question: 'Do you play on a school team?', dynamicOptions: (a) => { if (a.grade === 'Middle school (6-8)') { return [{ label: 'Middle school team' }, { label: 'No school team' }]; } return [{ label: 'Varsity' }, { label: 'JV' }, { label: 'Freshman team' }, { label: 'No school team' }]; }, showIf: (a) => a.grade === 'Middle school (6-8)' || a.grade === 'High school (9-12)' },
  { id: 'playsAAU', section: 'Where You Play', type: 'select', question: 'Do you play AAU or club ball?', options: [{ label: 'Yes' }, { label: 'No' }], showIf: (a) => a.grade === 'Middle school (6-8)' || a.grade === 'High school (9-12)' },
  { id: 'aauCircuit', section: 'Where You Play', type: 'select', question: 'What circuit?', subtitle: 'This helps us know your level of competition.', options: [{ label: 'Top shoe circuit', subtitle: 'Nike EYBL, Under Armour UAA, Adidas 3SSB' }, { label: 'Mid shoe circuit', subtitle: 'Puma Pro 16, New Balance, other shoe' }, { label: 'Independent circuit', subtitle: 'Made Hoops, AGame Hoops, other national' }, { label: 'Local circuit', subtitle: 'Regional/state tournaments only' }], showIf: (a) => a.playsAAU === 'Yes' },
  { id: 'aauStarter', section: 'Where You Play', type: 'select', question: 'Are you a starter on your AAU team?', options: [{ label: 'Yes, starter' }, { label: '6th man' }, { label: 'Rotation player' }, { label: 'Bench' }], showIf: (a) => a.playsAAU === 'Yes' },
  { id: 'collegeLevel', section: 'Where You Play', type: 'select', question: 'What level do you play at?', options: [{ label: 'D1' }, { label: 'D2' }, { label: 'D3' }, { label: 'JUCO' }, { label: 'NAIA' }, { label: 'Club / intramural' }, { label: 'No college team' }], showIf: (a) => a.grade === 'College' },
  { id: 'starter', section: 'Where You Play', type: 'select', question: 'Are you a starter on the team?', options: [{ label: 'Yes, starter' }, { label: '6th man' }, { label: 'Rotation player' }, { label: 'Bench' }], showIf: (a) => { if (a.playsAAU === 'Yes') return false; const isSchoolTeamPlayer = ['Varsity', 'JV', 'Freshman team', 'Middle school team'].includes(a.schoolTeam); if (isSchoolTeamPlayer) return true; if (a.grade === 'College' && a.collegeLevel && a.collegeLevel !== 'No college team') return true; return false; } },
  { id: 'adultPlay', section: 'Where You Play', type: 'select', question: 'Where do you play?', options: [{ label: 'Competitive rec league' }, { label: 'Casual rec league' }, { label: 'Pickup / open gym' }, { label: 'Mostly alone / driveway' }], showIf: (a) => a.grade === 'Out of school / adult' },
  { id: 'int_where', section: 'Where You Play', type: 'interstitial', interstitialImage: IMG_WHERE_YOU_PLAY, interstitialTitle: "Every level reads stats differently. We'll weigh yours against the competition you actually face." },
  { id: 'role', section: 'Your Role', type: 'select', question: "What's your role on the team?", subtitle: 'So Coach X knows what kind of player you are.', options: [{ label: 'Primary scorer', subtitle: 'Plays are run for you' }, { label: 'Secondary scorer', subtitle: "You score but aren't the first option" }, { label: 'Playmaker', subtitle: 'Pass-first, set others up' }, { label: 'Two-way wing', subtitle: 'Score + defend' }, { label: 'Defensive stopper', subtitle: 'Guard the best player' }, { label: 'Rebounder / rim protector', subtitle: 'Big-man role' }, { label: '3-and-D specialist', subtitle: 'Shoot + defend' }, { label: 'Energy off the bench', subtitle: 'Spark plug' }, { label: 'Still figuring out my role' }], showIf: (a) => playsOnTeam(a) },
  { id: 'stats', section: 'Your Stats', type: 'statGrid', question: 'Estimate your stats per game.', subtitle: "It's fine if you don't know exactly. Leave blank if you don't track.", statFields: [{ id: 'minutes', label: 'Minutes per game', placeholder: '0' }, { id: 'ppg', label: 'Points per game', placeholder: '0' }, { id: 'apg', label: 'Assists per game', placeholder: '0' }, { id: 'rpg', label: 'Rebounds per game', placeholder: '0' }], showIf: (a) => playsOnTeam(a) },
  { id: 'int_stats', section: 'Your Stats', type: 'interstitial', interstitialImage: IMG_STATS_LOCKED, interstitialTitle: "Raw numbers don't tell the whole story. Your role and level change what good looks like.", showIf: (a) => playsOnTeam(a) },
  { id: 'shootingMakes', section: 'Your Game', type: 'numberGrid', question: 'Out of 10 wide open shots, how many do you make?', subtitle: 'Be honest. This shapes your plan.', numberFields: [{ id: 'layupStrong', label: 'Layups (strong hand)', max: 10 }, { id: 'layupWeak', label: 'Layups (weak hand)', max: 10 }, { id: 'freeThrows', label: 'Free throws', max: 10 }, { id: 'midRange', label: 'Mid-range', max: 10 }, { id: 'threes', label: '3-pointers', max: 10 }] },
  { id: 'dribbling', section: 'Your Game', type: 'select', question: 'How\'s your dribbling?', options: [{ label: 'Strong with both hands' }, { label: 'Getting there' }, { label: 'Avoid using my weak hand' }, { label: 'Only use my right hand' }] },
  { id: 'int_shot', section: 'Your Game', type: 'interstitial', interstitialImage: IMG_SHOT_MAPPED, interstitialTitle: "We know exactly what falls for you and what doesn't. Every drill gets chosen with that in mind." },
  { id: 'goal', section: 'Your Game', type: 'text', question: 'What do you want to improve most?', subtitle: 'Keep it short — one sentence.', placeholder: 'e.g. be a better shooter off the dribble' },
  { id: 'frequency', section: 'Your Schedule', type: 'select', question: 'How often can you train?', options: [{ label: 'Once or twice a week' }, { label: '3-4 times a week' }, { label: '5-6 times a week' }, { label: 'Every day' }] },
  { id: 'duration', section: 'Your Schedule', type: 'select', question: 'How long per session?', options: [{ label: '20-30 minutes' }, { label: '30-45 minutes' }, { label: '45-60 minutes' }, { label: '60-90 minutes' }] },
  { id: 'access', section: 'Your Schedule', type: 'multiselect', question: 'Where do you usually train?', subtitle: 'Pick all that apply.', options: [{ label: 'Full court with hoop' }, { label: 'Half court with hoop' }, { label: 'Driveway with hoop' }, { label: 'Gym with weights' }, { label: 'Open space (no hoop)' }] },
  { id: 'int_plan', section: 'Scouting Report', type: 'interstitial', interstitialImage: IMG_SCOUTING_READY, interstitialTitle: "Coach X is ready to build the plan that actually fits how you play." },
];

function playsOnTeam(a: Record<string, any>): boolean {
  if (a.grade === 'Middle school (6-8)' || a.grade === 'High school (9-12)') {
    const hasSchool = ['Varsity', 'JV', 'Freshman team', 'Middle school team'].includes(a.schoolTeam);
    return hasSchool || a.playsAAU === 'Yes';
  }
  if (a.grade === 'College') return a.collegeLevel && a.collegeLevel !== 'No college team';
  if (a.grade === 'Out of school / adult') return a.adultPlay === 'Competitive rec league' || a.adultPlay === 'Casual rec league';
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

function computeSkills(a: Record<string, any>): Record<string, { level: number; label: string }> {
  const skills: Record<string, number> = {
    shooting: 5, shotForm: 5, finishing: 5, ballHandling: 5, weakHand: 5,
    defense: 5, iq: 5, athleticism: 5, creativity: 5, touch: 5,
    courtVision: 5, decisionMaking: 5,
  };
  const m = a.shootingMakes || {};
  const layupStrong = parseInt(m.layupStrong || '') || 0;
  const layupWeak = parseInt(m.layupWeak || '') || 0;
  const ft = parseInt(m.freeThrows || '') || 0;
  const midRange = parseInt(m.midRange || '') || 0;
  const threes = parseInt(m.threes || '') || 0;

  let tier = 5;
  if (a.aauCircuit === 'Top shoe circuit' || a.collegeLevel === 'D1') tier = 9;
  else if (a.aauCircuit === 'Mid shoe circuit' || a.aauCircuit === 'Independent circuit' || a.schoolTeam === 'Varsity' || a.collegeLevel === 'D2' || a.collegeLevel === 'D3') tier = 7;
  else if (a.aauCircuit === 'Local circuit' || a.schoolTeam === 'JV' || a.collegeLevel === 'JUCO' || a.collegeLevel === 'NAIA' || a.adultPlay === 'Competitive rec league') tier = 6;
  else if (a.schoolTeam === 'Freshman team' || a.schoolTeam === 'Middle school team' || a.collegeLevel === 'Club / intramural' || a.adultPlay === 'Casual rec league') tier = 5;
  else if (a.adultPlay === 'Pickup / open gym') tier = 5;
  else if (a.adultPlay === 'Mostly alone / driveway') tier = 4;

  const tierCap = Math.min(10, 5 + (tier - 4) * 0.8);

  if (midRange || threes || ft) {
    const shootingAvg = (midRange + threes + ft) / 3;
    skills.shooting = Math.max(1, Math.min(tierCap, shootingAvg * 0.9 + 1));
    skills.shotForm = Math.max(1, Math.min(tierCap, (midRange + ft) / 2 * 0.9 + 1));
    skills.touch = Math.max(1, Math.min(tierCap, (ft + midRange) / 2 * 0.9 + 1));
  }

  if (layupStrong || layupWeak) {
    const layupAvg = (layupStrong + layupWeak) / 2;
    const finishingBase = 3 + (layupAvg * 0.3) + (tier - 4) * 0.3;
    skills.finishing = Math.max(1, Math.min(tierCap, finishingBase));
    skills.weakHand = Math.max(1, Math.min(tierCap, layupWeak * 0.8 + 1));
  }

  const d = a.dribbling;
  if (d === 'Strong with both hands') { skills.ballHandling = Math.min(tierCap, 7); skills.weakHand = Math.max(skills.weakHand, Math.min(tierCap, 6)); }
  else if (d === 'Getting there') { skills.ballHandling = 5; skills.weakHand = Math.max(skills.weakHand, 4); }
  else if (d === 'Avoid using my weak hand') { skills.ballHandling = 4; skills.weakHand = Math.min(skills.weakHand, 3); }
  else if (d === 'Only use my right hand') { skills.ballHandling = 3; skills.weakHand = 2; }

  const role = a.role;
  if (role === 'Primary scorer') { skills.creativity += 1; skills.decisionMaking += 0.5; }
  if (role === 'Playmaker') { skills.iq += 2; skills.courtVision += 2; skills.decisionMaking += 1.5; }
  if (role === 'Defensive stopper') { skills.defense += 2.5; skills.athleticism += 1; skills.iq += 1; }
  if (role === 'Rebounder / rim protector') { skills.finishing += 0.5; skills.athleticism += 1.5; skills.defense += 1.5; }
  if (role === '3-and-D specialist') { skills.shooting += 0.5; skills.defense += 1.5; }
  if (role === 'Two-way wing') { skills.defense += 1; skills.shooting += 0.3; skills.athleticism += 0.5; }
  if (role === 'Energy off the bench') { skills.athleticism += 1.5; skills.defense += 0.5; }

  const tierBump = (tier - 5) * 0.4;
  skills.iq += tierBump;
  skills.decisionMaking += tierBump;
  skills.defense += tierBump * 0.5;
  skills.athleticism += tierBump * 0.5;

  if (a.starter === 'Yes, starter' || a.aauStarter === 'Yes, starter') { skills.iq += 0.5; skills.decisionMaking += 0.5; }
  else if (a.starter === 'Bench' || a.aauStarter === 'Bench') { skills.iq -= 0.3; }

  const s = a.stats || {};
  const ppg = parseFloat(s.ppg) || 0;
  const apg = parseFloat(s.apg) || 0;
  const rpg = parseFloat(s.rpg) || 0;
  const minutes = parseFloat(s.minutes) || 0;
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

  if (a.position === 'Point Guard') { skills.courtVision += 0.5; skills.ballHandling += 0.5; }
  if (a.position === 'Center') { skills.finishing += 0.3; skills.athleticism += 0.3; }

  const result: Record<string, { level: number; label: string }> = {};
  const labels: Record<string, string> = {
    shooting: 'Shooting', shotForm: 'Shot Form', finishing: 'Finishing',
    ballHandling: 'Ball Handling', weakHand: 'Weak Hand', defense: 'Defense',
    iq: 'Basketball IQ', athleticism: 'Athleticism', creativity: 'Creativity',
    touch: 'Touch', courtVision: 'Court Vision', decisionMaking: 'Decision Making',
  };
  for (const k of Object.keys(skills)) {
    result[k] = {
      level: Math.round(Math.max(1, Math.min(tierCap, skills[k])) * 10) / 10,
      label: labels[k] || k,
    };
  }
  return result;
}

const LOADING_STEPS = [
  'Reading your answers',
  'Analyzing your shot profile',
  'Finding drills for your weaknesses',
  'Building your 7-day plan',
  "Writing Coach X's notes",
];

function AnimatedOption({ index, children, style, onPress, activeOpacity, disabled }: { index: number; children: React.ReactNode; style: any; onPress: () => void; activeOpacity?: number; disabled?: boolean; }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity style={style} onPress={onPress} activeOpacity={activeOpacity} disabled={disabled}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, profile, completedDrills, currentDayIndex, loadFromStorage, setPlan, setProfile, setSkillLevels, setDescription } = usePlanStore();

  const [appState, setAppState] = useState<'loading' | 'welcome' | 'onboarding' | 'scouting' | 'auth' | 'signin' | 'analyzing' | 'climax' | 'plan'>('loading');
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

  useEffect(() => {
    if (isReady && appState === 'plan' && (!plan || !profile)) {
      setAppState('welcome');
      setStepIndex(0);
      setAnswers({});
      setTextInput('');
    }
  }, [plan, profile, appState, isReady]);

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
      setAppState('auth');
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

  // ===== DEBUG: instantly jump to the climax screen with fake data =====
  // Remove this whole function before launch
  const debugJumpToClimax = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    usePlanStore.getState().setPlan({
      weekTitle: 'Week 1: Test Plan',
      aiInsight: 'Fake insight for testing.',
      coachSummary: {
        greeting: "Alright, I just finished going through everything you told me. Took a hard look at your game — your strengths, your weaknesses, where you fit in. Here's what I came back with.",
        assessment: "You're a guard with a tight handle on your strong hand but your weak hand is leaving points on the table. Your shooting form is solid, you just need more reps under pressure. Defense is your sleeper strength — most guys your age don't take it serious. You do.",
        planOverview: "We're hammering weak hand for the next 4 weeks. Every session has at least one left-hand drill, sometimes two. Shooting stays in the rotation but we're taking your form work to the next level — pull-ups off the bounce, contested reps. By week 4 you'll feel different.",
        motivation: "Look, the work is the work. Show up. Don't skip the boring drills. The reps you don't want to do are the reps that change your game. I'll be watching. Let's get it.",
      },
      days: [
        { day: 'Mon', date: '', focus: 'Test', duration: '30 min', isRest: false, drills: [] },
        { day: 'Tue', date: '', focus: 'Rest', duration: '---', isRest: true, drills: [] },
        { day: 'Wed', date: '', focus: 'Test', duration: '30 min', isRest: false, drills: [] },
        { day: 'Thu', date: '', focus: 'Rest', duration: '---', isRest: true, drills: [] },
        { day: 'Fri', date: '', focus: 'Test', duration: '30 min', isRest: false, drills: [] },
        { day: 'Sat', date: '', focus: 'Rest', duration: '---', isRest: true, drills: [] },
        { day: 'Sun', date: '', focus: 'Rest', duration: '---', isRest: true, drills: [] },
      ],
    } as any);
    usePlanStore.getState().setProfile({
      sport: 'Basketball',
      position: 'Point Guard',
      experience: '3-5 years',
      goal: 'Become a better all-around scorer',
      weakness: 'Weak hand finishing',
      frequency: '3-4 times a week',
      duration: '30-45 minutes',
      access: ['Half court with hoop'],
      driving: 'not specified',
      leftHand: 'Weak - I avoid it',
      pressure: 'not specified',
      goToMove: 'not specified',
      threeConfidence: 'Somewhat',
      freeThrow: '60-80%',
    } as any);
    setAppState('climax');
  };
  // ===== END DEBUG =====

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
    if (a.dribbling === 'Avoid using my weak hand' || a.dribbling === 'Only use my right hand') weakness = 'Weak hand ball handling';

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

        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            const user = userData.user;
            await supabase.from('weekly_plans').update({ is_current: false }).eq('user_id', user.id);
            await supabase.from('weekly_plans').insert({
              user_id: user.id,
              plan_data: planData,
              week_title: planData.weekTitle || 'Week 1',
              is_current: true,
            });
            await supabase.from('user_onboarding').upsert({
              user_id: user.id,
              answers: { ...payload, description: payload.description || '' },
              completed_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
          }
        } catch (saveErr) {
          console.error('Supabase sync failed:', saveErr);
        }

        setAppState('climax');
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

  if (appState === 'loading') return <View style={[s.c, { paddingTop: insets.top }]} />;

  if (appState === 'welcome') return (
    <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={{ position: 'absolute', width: 300, height: 300, opacity: 0, top: -500, left: -500 }} pointerEvents="none">
        <Image source={IMG_WHERE_YOU_PLAY} style={{ width: 300, height: 300, position: 'absolute' }} resizeMode="contain" fadeDuration={0} />
        <Image source={IMG_STATS_LOCKED} style={{ width: 300, height: 300, position: 'absolute' }} resizeMode="contain" fadeDuration={0} />
        <Image source={IMG_SHOT_MAPPED} style={{ width: 300, height: 300, position: 'absolute' }} resizeMode="contain" fadeDuration={0} />
        <Image source={IMG_SCOUTING_READY} style={{ width: 300, height: 300, position: 'absolute' }} resizeMode="contain" fadeDuration={0} />
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 16, paddingBottom: 24, alignItems: 'center' }}>
          <Image source={require('@/assets/images/logo.png')} style={{ width: 180, height: 50 }} resizeMode="contain" />
        </View>
        <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', lineHeight: 34, marginBottom: 12, marginTop: 40, letterSpacing: -0.8 }}>
          Training built for your game.
        </Text>
        <Text style={{ fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 40, lineHeight: 22 }}>
          Answer a few questions. Get a plan that matches your level, role, and goals — not generic drills.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#1A1A1A', borderRadius: 100, paddingVertical: 18, alignItems: 'center' }}
          onPress={() => {
            if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setStepIndex(0);
            setAppState('onboarding');
          }}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.white, letterSpacing: 0.2 }}>Build my plan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ paddingVertical: 16, alignItems: 'center', marginTop: 8, flexDirection: 'row', justifyContent: 'center' }}
          onPress={() => {
            if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAppState('signin');
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 15, color: Colors.textSecondary, letterSpacing: -0.2 }}>Already have an account? </Text>
          <Text style={{ fontSize: 15, color: Colors.textPrimary, fontWeight: '600', letterSpacing: -0.2 }}>Sign in</Text>
        </TouchableOpacity>

        {/* ===== DEBUG: test climax screen instantly. Remove before launch. ===== */}
        <TouchableOpacity
          style={{
            marginTop: 32,
            paddingVertical: 14,
            paddingHorizontal: 16,
            backgroundColor: '#FBF5E2',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: Colors.primary,
            alignItems: 'center',
          }}
          onPress={debugJumpToClimax}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '700', letterSpacing: 0.5 }}>
            🔧 TEST CLIMAX SCREEN
          </Text>
        </TouchableOpacity>
        {/* ===== END DEBUG ===== */}
      </ScrollView>
    </View>
  );

  if (appState === 'onboarding' && currentStep) {
    const st = currentStep;
    const SectionIcon = SECTION_ICONS[st.section] || UserIcon;
    const opts = st.dynamicOptions ? st.dynamicOptions(answers) : (st.options || []);

    if (st.type === 'interstitial') {
      return (
        <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={s.qh}>
            <TouchableOpacity onPress={goBack} style={s.bb}><Text style={s.bt}>←</Text></TouchableOpacity>
            <View style={s.pc}><View style={s.pt}><View style={[s.pf, { width: (progress * 100) + '%' }]} /></View></View>
            <View style={{ width: 60 }} />
          </View>
          <Animated.View style={{ flex: 1, paddingHorizontal: 28, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              {st.interstitialImage && (
                <View style={{ width: 300, height: 300, marginBottom: 40, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderRadius: 150, overflow: 'hidden' }}>
                  <Image source={st.interstitialImage} style={{ width: 300, height: 300 }} resizeMode="contain" fadeDuration={0} />
                </View>
              )}
              <Text style={{ fontSize: 22, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center', lineHeight: 30, letterSpacing: -0.5 }}>
                {st.interstitialTitle}
              </Text>
            </View>
          </Animated.View>
          <View style={s.bn}>
            <TouchableOpacity style={s.cb} onPress={goNext} activeOpacity={0.85}>
              <Text style={s.ct}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

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
              <View style={s.sectionRow}>
                <View style={s.sectionIconWrap}>
                  <SectionIcon size={14} color={Colors.primary} />
                </View>
                <Text style={s.qs}>{st.section.toUpperCase()}</Text>
              </View>
              <Text style={s.qq}>{st.question}</Text>
              {st.subtitle ? <Text style={s.qsub}>{st.subtitle}</Text> : null}

              {(st.type === 'select' || st.type === 'multiselect') && opts.map((o, i) => (
                <AnimatedOption
                  key={`${st.id}-${i}-${o.label}`}
                  index={i}
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
                </AnimatedOption>
              ))}

              {st.type === 'text' && (
                <TextInput style={s.textIn} placeholder={st.placeholder} placeholderTextColor={Colors.textMuted} value={textInput} onChangeText={setTextInput} multiline maxLength={200} autoFocus />
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
                    <TextInput style={s.sgInput} keyboardType="decimal-pad" maxLength={5} value={grid[f.id] || ''} onChangeText={(v) => handleNumberChange(f.id, v.replace(/[^0-9.]/g, ''))} placeholder={f.placeholder || '0'} placeholderTextColor={Colors.textMuted} />
                  </View>
                );
              })}
            </Animated.View>
          </ScrollView>

          {(st.type === 'text' || st.type === 'numberGrid' || st.type === 'statGrid' || st.type === 'multiselect') && (
            <View style={s.bn}>
              <TouchableOpacity style={[s.cb, !canGo() && s.cbDisabled]} onPress={() => { if (st.type === 'text') handleTextSubmit(); else goNext(); }} activeOpacity={0.85} disabled={!canGo()}>
                <Text style={[s.ct, !canGo() && s.ctDisabled]}>{st.type === 'statGrid' ? 'CONTINUE (SKIP OK)' : 'CONTINUE'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (appState === 'auth') {
    return <AuthScreen onComplete={async () => { await generatePlanFromOnboarding(); }} onBack={() => setAppState('onboarding')} />;
  }

  if (appState === 'signin') {
    return (
      <AuthScreen
        mode="signin"
        onComplete={async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setAppState('welcome'); return; }
            const { data: planRow } = await supabase.from('weekly_plans').select('plan_data, week_title').eq('user_id', user.id).eq('is_current', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
            const { data: onboardingRow } = await supabase.from('user_onboarding').select('answers').eq('user_id', user.id).maybeSingle();
            if (planRow?.plan_data) usePlanStore.getState().setPlan(planRow.plan_data);
            if (onboardingRow?.answers) {
              const a = onboardingRow.answers;
              const prof = { sport: a.sport || 'Basketball', position: a.position || 'Player', experience: a.experience || '', goal: a.goal || '', weakness: a.weakness || '', frequency: a.frequency || '', duration: a.duration || '', access: a.access || '' };
              usePlanStore.getState().setProfile(prof as any);
            }
            if (planRow?.plan_data) setAppState('plan'); else setAppState('welcome');
          } catch (e) { console.error('Sign-in load failed:', e); setAppState('welcome'); }
        }}
        onBack={() => setAppState('welcome')}
      />
    );
  }

  if (appState === 'analyzing') {
    return (
      <View style={[s.c, { paddingTop: insets.top + 40, paddingBottom: insets.bottom, paddingHorizontal: 28 }]}>
        <View style={{ marginBottom: 48 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textMuted, letterSpacing: 1.2 }}>BUILDING PLAN</Text>
            <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5 }}>{loadingProgress}%</Text>
          </View>
          <View style={{ width: '100%', height: 6, backgroundColor: Colors.surfaceBorder, borderRadius: 3, overflow: 'hidden' }}>
            <Animated.View style={{ height: 6, backgroundColor: '#1A1A1A', borderRadius: 3, width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
          </View>
        </View>
        <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8, letterSpacing: -0.8 }}>Coach X is working</Text>
        <Text style={{ fontSize: 15, color: Colors.textSecondary, marginBottom: 36, letterSpacing: -0.2, lineHeight: 22 }}>Analyzing your answers and building a plan around your game.</Text>
        <View>
          {LOADING_STEPS.map((step, i) => {
            const isDone = i < currentLoadingStep;
            const isCurrent = i === currentLoadingStep;
            const isPending = i > currentLoadingStep;
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, opacity: isPending ? 0.35 : 1 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isDone ? '#1A1A1A' : 'transparent', borderWidth: isDone ? 0 : 1.5, borderColor: isCurrent ? '#1A1A1A' : Colors.surfaceBorder, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  {isDone && <Text style={{ color: Colors.white, fontSize: 13, fontWeight: '700' }}>✓</Text>}
                  {isCurrent && <ActivityIndicator size="small" color="#1A1A1A" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: isCurrent ? '600' : '500', color: isDone ? Colors.textPrimary : isCurrent ? Colors.textPrimary : Colors.textMuted, letterSpacing: -0.2 }}>{step}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (appState === 'climax' && plan?.coachSummary) {
    return (
      <CoachXClimax
        coachSummary={plan.coachSummary}
        onComplete={() => setAppState('plan')}
      />
    );
  }

  if (appState === 'plan' && plan) {
    return (
      <View style={[s.c, { paddingTop: insets.top }]}>
        <CoachXPill />
        <TodayHome />
      </View>
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
  pt: { height: 4, backgroundColor: Colors.surfaceBorder, borderRadius: 2, overflow: 'hidden' },
  pf: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionIconWrap: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FBF5E2', borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  qs: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 1.5 },
  qq: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, lineHeight: 32, marginBottom: 8, letterSpacing: -0.8 },
  qsub: { fontSize: 14, color: Colors.textMuted, lineHeight: 20, marginBottom: 20, letterSpacing: -0.1 },
  opt: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 10 },
  optSel: { borderColor: Colors.primary, backgroundColor: '#FBF5E2' },
  optDisabled: { opacity: 0.4 },
  optTxt: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.2 },
  optTxtSel: { color: Colors.primary },
  optTxtDisabled: { color: Colors.textMuted },
  optSub: { fontSize: 12, color: Colors.textMuted, marginTop: 4, letterSpacing: -0.1 },
  textIn: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 16, fontSize: 16, color: Colors.textPrimary, minHeight: 100, textAlignVertical: 'top', letterSpacing: -0.2 },
  ngRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 10 },
  ngLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, flex: 1, letterSpacing: -0.2 },
  ngInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ngInput: { width: 48, textAlign: 'center', fontSize: 18, fontWeight: '700', color: Colors.textPrimary, backgroundColor: Colors.background, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: Colors.surfaceBorder, letterSpacing: -0.3 },
  ngMax: { fontSize: 13, color: Colors.textMuted },
  sgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 10 },
  sgLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, flex: 1, letterSpacing: -0.2 },
  sgInput: { width: 80, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.textPrimary, backgroundColor: Colors.background, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: Colors.surfaceBorder, letterSpacing: -0.3 },
  bn: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder },
  cb: { backgroundColor: '#1A1A1A', borderRadius: 100, paddingVertical: 18, alignItems: 'center' },
  cbDisabled: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder },
  ct: { fontSize: 16, fontWeight: '600', color: Colors.white, letterSpacing: 0.2 },
  ctDisabled: { color: Colors.textMuted },
});
