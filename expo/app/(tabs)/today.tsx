import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Image,
  Animated, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Play, Flame, Clock, Dumbbell, Target, Zap, Wind, Activity, Check, X, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import AuthScreen from '@/components/AuthScreen';
import { usePlanStore } from '@/store/planStore';

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Branched onboarding flow.
 * Each step has a showIf predicate. The progress bar is based on visible steps only.
 * When a parent answer changes (like grade), descendant answers are cleared to prevent stale branches.
 */

interface Step {
  id: string;
  section: string;
  question: string;
  subtitle?: string;
  type: 'select' | 'multiselect' | 'text' | 'numberGrid' | 'statGrid';
  options?: { label: string; value?: string; subtitle?: string; disabled?: boolean }[];
  placeholder?: string;
  numberFields?: { id: string; label: string; max?: number }[];
  statFields?: { id: string; label: string; placeholder?: string }[];
  showIf?: (answers: Record<string, any>) => boolean;
}

// Map of which answer IDs become invalid when a given answer changes.
// Used to clear stale branch answers on navigation back and forth.
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
    id: 'sport', section: 'About You', question: 'What sport do you play?',
    subtitle: "We'll tailor everything to your game.",
    type: 'select',
    options: [
      { label: 'Basketball' },
      { label: 'Soccer', subtitle: 'Coming soon', disabled: true },
      { label: 'Baseball', subtitle: 'Coming soon', disabled: true },
      { label: 'Football', subtitle: 'Coming soon', disabled: true },
    ],
  },
  {
    id: 'position', section: 'About You', question: 'What position do you play?',
    subtitle: 'This shapes your skill priorities.',
    type: 'select',
    options: [
      { label: 'Point Guard' }, { label: 'Shooting Guard' }, { label: 'Small Forward' },
      { label: 'Power Forward' }, { label: 'Center' },
    ],
  },
  {
    id: 'description', section: 'About You', question: 'Describe yourself.',
    subtitle: "Height, jersey color, hair, anything so Coach X knows who you are.",
    type: 'text',
    placeholder: 'e.g. 5\'10", red jersey #5, curly hair',
  },

  // ============ Where You Play ============
  {
    id: 'grade', section: 'Where You Play', question: 'What grade are you in?',
    type: 'select',
    options: [
      { label: 'Middle school (6-8)' },
      { label: 'High school (9-12)' },
      { label: 'College' },
      { label: 'Out of school / adult' },
    ],
  },

  // ---- Middle school or high school branch ----
  {
    id: 'schoolTeam', section: 'Where You Play', question: 'Do you play on a school team?',
    type: 'select',
    options: [
      { label: 'Varsity' }, { label: 'JV' }, { label: 'Freshman team' },
      { label: 'Middle school team' }, { label: 'No school team' },
    ],
    showIf: (a) => a.grade === 'Middle school (6-8)' || a.grade === 'High school (9-12)',
  },
  {
    id: 'playsAAU', section: 'Where You Play', question: 'Do you play AAU or club ball?',
    type: 'select',
    options: [{ label: 'Yes' }, { label: 'No' }],
    showIf: (a) => a.grade === 'Middle school (6-8)' || a.grade === 'High school (9-12)',
  },
  {
    id: 'aauCircuit', section: 'Where You Play', question: 'What circuit?',
    subtitle: 'This helps us know your level of competition.',
    type: 'select',
    options: [
      { label: 'Top shoe circuit', subtitle: 'Nike EYBL, Under Armour UAA, Adidas 3SSB' },
      { label: 'Mid shoe circuit', subtitle: 'Puma Pro 16, New Balance, other shoe' },
      { label: 'Independent circuit', subtitle: 'Made Hoops, AGame Hoops, other national' },
      { label: 'Local circuit', subtitle: 'Regional/state tournaments only' },
    ],
    showIf: (a) => a.playsAAU === 'Yes',
  },
  {
    id: 'aauStarter', section: 'Where You Play', question: 'Are you a starter on your AAU team?',
    type: 'select',
    options: [
      { label: 'Yes, starter' }, { label: '6th man' },
      { label: 'Rotation player' }, { label: 'Bench' },
    ],
    showIf: (a) => a.playsAAU === 'Yes',
  },

  // ---- College branch ----
  {
    id: 'collegeLevel', section: 'Where You Play', question: 'What level do you play at?',
    type: 'select',
    options: [
      { label: 'D1' }, { label: 'D2' }, { label: 'D3' }, { label: 'JUCO' },
      { label: 'NAIA' }, { label: 'Club / intramural' }, { label: 'No college team' },
    ],
    showIf: (a) => a.grade === 'College',
  },

  // ---- UNIFIED starter question (fires for school team OR college team, but NOT AAU users who already answered aauStarter) ----
  {
    id: 'starter', section: 'Where You Play', question: 'Are you a starter on the team?',
    type: 'select',
    options: [
      { label: 'Yes, starter' }, { label: '6th man' },
      { label: 'Rotation player' }, { label: 'Bench' },
    ],
    showIf: (a) => {
      // Skip if AAU already answered — avoids double-ask
      if (a.playsAAU === 'Yes') return false;

      // School team user (MS or HS) without AAU
      const isSchoolTeamPlayer = ['Varsity', 'JV', 'Freshman team', 'Middle school team'].includes(a.schoolTeam);
      if (isSchoolTeamPlayer) return true;

      // College team user (any level except "No college team")
      if (a.grade === 'College' && a.collegeLevel && a.collegeLevel !== 'No college team') return true;

      return false;
    },
  },

  // ---- Adult branch ----
  {
    id: 'adultPlay', section: 'Where You Play', question: 'Where do you play?',
    type: 'select',
    options: [
      { label: 'Competitive rec league' }, { label: 'Casual rec league' },
      { label: 'Pickup / open gym' }, { label: 'Mostly alone / driveway' },
    ],
    showIf: (a) => a.grade === 'Out of school / adult',
  },

  // ============ Role on team (only if on a team) ============
  {
    id: 'role', section: 'Your Role', question: "What's your role on the team?",
    subtitle: 'So Coach X knows what kind of player you are.',
    type: 'select',
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

  // ============ Stats (only if on team) ============
  {
    id: 'stats', section: 'Your Stats', question: 'Estimate your stats per game.',
    subtitle: "It's fine if you don't know exactly. Leave blank if you don't track.",
    type: 'statGrid',
    statFields: [
      { id: 'minutes', label: 'Minutes per game', placeholder: '0' },
      { id: 'ppg', label: 'Points per game', placeholder: '0' },
      { id: 'apg', label: 'Assists per game', placeholder: '0' },
      { id: 'rpg', label: 'Rebounds per game', placeholder: '0' },
    ],
    showIf: (a) => playsOnTeam(a),
  },

  // ============ Your Game ============
  {
    id: 'shootingMakes', section: 'Your Game',
    question: 'Out of 10 wide open shots, how many do you make?',
    subtitle: 'Be honest. This shapes your plan.',
    type: 'numberGrid',
    numberFields: [
      { id: 'layupStrong', label: 'Layups (strong hand)', max: 10 },
      { id: 'layupWeak', label: 'Layups (weak hand)', max: 10 },
      { id: 'freeThrows', label: 'Free throws', max: 10 },
      { id: 'midRange', label: 'Mid-range', max: 10 },
      { id: 'threes', label: '3-pointers', max: 10 },
    ],
  },
  {
    id: 'dribbling', section: 'Your Game', question: 'How\'s your dribbling?',
    type: 'select',
    options: [
      { label: 'Strong with both hands' },
      { label: 'Getting there' },
      { label: 'Avoid using my weak hand' },
      { label: 'Only use my right hand' },
    ],
  },
  {
    id: 'goal', section: 'Your Game', question: 'What do you want to improve most?',
    subtitle: 'Keep it short — one sentence.',
    type: 'text',
    placeholder: 'e.g. be a better shooter off the dribble',
  },

  // ============ Schedule ============
  {
    id: 'frequency', section: 'Your Schedule', question: 'How often can you train?',
    type: 'select',
    options: [
      { label: 'Once or twice a week' }, { label: '3-4 times a week' },
      { label: '5-6 times a week' }, { label: 'Every day' },
    ],
  },
  {
    id: 'duration', section: 'Your Schedule', question: 'How long per session?',
    type: 'select',
    options: [
      { label: '20-30 minutes' }, { label: '30-45 minutes' },
      { label: '45-60 minutes' }, { label: '60-90 minutes' },
    ],
  },
  {
    id: 'access', section: 'Your Schedule', question: 'Where do you usually train?',
    subtitle: 'Pick all that apply.',
    type: 'multiselect',
    options: [
      { label: 'Full court with hoop' }, { label: 'Half court with hoop' },
      { label: 'Driveway with hoop' }, { label: 'Gym with weights' },
      { label: 'Open space (no hoop)' },
    ],
  },
];

// Helper: does the user play on an organized team?
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

// Clear dependent answers when a parent answer changes.
// Returns a new answers object with stale branch data removed.
function clearDependentAnswers(answers: Record<string, any>, changedKey: string): Record<string, any> {
  const deps = ANSWER_DEPENDENCIES[changedKey];
  if (!deps) return answers;
  const next = { ...answers };
  for (const d of deps) {
    delete next[d];
    // Recursively clear their dependents too
    const nested = ANSWER_DEPENDENCIES[d];
    if (nested) {
      for (const n of nested) delete next[n];
    }
  }
  return next;
}

const LOADING_STEPS = [
  'Reading your profile',
  'Scoring your skills',
  'Matching drills to your game',
  'Building your weekly plan',
  'Finishing Coach X notes',
];

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, profile, completedDrills, currentDayIndex, currentStreak, loadFromStorage, setPlan, setProfile, setSkillLevels, setDescription } = usePlanStore();

  const [appState, setAppState] = useState<'loading' | 'welcome' | 'onboarding' | 'auth' | 'analyzing' | 'plan'>('loading');
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
      // Single-select: update answer AND clear any dependents (in case they came back and changed)
      const oldValue = answers[st.id];
      let nextAnswers = { ...answers, [st.id]: opt };
      if (oldValue !== undefined && oldValue !== opt) {
        nextAnswers = clearDependentAnswers(nextAnswers, st.id);
        nextAnswers[st.id] = opt; // re-set after clearing
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
        layupStrong: 'Finishing at the rim',
        layupWeak: 'Weak hand finishing',
        freeThrows: 'Free throw shooting',
        midRange: 'Mid-range shooting',
        threes: 'Three-point shooting',
      };
      if (worst[1] <= 3) weakness = worstLabels[worst[0]] || weakness;
    }
    if (a.dribbling === 'Avoid using my weak hand' || a.dribbling === 'Only use my right hand') {
      weakness = 'Weak hand ball handling';
    }

    return {
      sport: a.sport,
      position: a.position,
      experience,
      goal: a.goal || 'Become a more complete player',
      weakness,
      driving: 'not specified',
      leftHand: leftHandMap[a.dribbling] || 'not specified',
      pressure: 'not specified',
      goToMove: 'not specified',
      threeConfidence,
      freeThrow,
      frequency: a.frequency,
      duration: a.duration,
      access: a.access,
      description: a.description || '',

      // NEW FIELDS
      grade: a.grade,
      schoolTeam: a.schoolTeam,
      playsAAU: a.playsAAU,
      aauCircuit: a.aauCircuit,
      aauStarter: a.aauStarter,
      starter: a.starter, // unified — could be school or college
      collegeLevel: a.collegeLevel,
      adultPlay: a.adultPlay,
      role: a.role,
      stats: a.stats,
      shootingMakes: a.shootingMakes,
      dribbling: a.dribbling,
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
          sport: payload.sport,
          position: payload.position,
          experience: payload.experience,
          goal: payload.goal,
          weakness: payload.weakness,
          frequency: payload.frequency,
          duration: payload.duration,
          access: payload.access,
          driving: payload.driving,
          leftHand: payload.leftHand,
          pressure: payload.pressure,
          goToMove: payload.goToMove,
          threeConfidence: payload.threeConfidence,
          freeThrow: payload.freeThrow,
        });
        if (payload.description) setDescription(payload.description);
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

  // ============ RENDER STATES ============

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
                  style={[
                    s.opt,
                    isSel(o.label) && s.optSel,
                    o.disabled && s.optDisabled,
                  ]}
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
                <View>
                  <TextInput
                    style={s.textIn}
                    placeholder={st.placeholder}
                    placeholderTextColor={Colors.textMuted}
                    value={textInput}
                    onChangeText={setTextInput}
                    multiline
                    maxLength={200}
                    autoFocus
                  />
                </View>
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
                      onChangeText={(v) => {
                        const cleaned = v.replace(/[^0-9.]/g, '');
                        handleNumberChange(f.id, cleaned);
                      }}
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
                onPress={() => {
                  if (st.type === 'text') handleTextSubmit();
                  else goNext();
                }}
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

  if (appState === 'auth') {
    return (
      <AuthScreen
        onComplete={async (isGuest) => {
          await generatePlanFromOnboarding();
        }}
        onBack={() => setAppState('onboarding')}
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
});
