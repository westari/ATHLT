import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PlanDrill {
  name: string;
  time: string;
  type: 'warmup' | 'skill' | 'shooting' | 'conditioning';
  detail: string;
  primarySkill?: string;
  drillId?: string;
  duration?: number;
  sets?: number;
  reps?: number;
}
export interface PlanDay {
  day: string;
  date: string;
  focus: string;
  duration: string;
  isRest?: boolean;
  drills: PlanDrill[];
}
export interface TrainingPlan {
  weekTitle: string;
  aiInsight: string;
  coachSummary?: any;
  days: PlanDay[];
}
export interface PlayerProfile {
  name?: string;
  sport: string;
  position: string;
  experience: string;
  goal: string;
  weakness: string;
  driving?: string;
  leftHand?: string;
  pressure?: string;
  goToMove?: string;
  threeConfidence?: string;
  freeThrow?: string;
  frequency: string;
  duration: string;
  access: string | string[];
}
export interface CompletedSession {
  date: string;
  focus: string;
  duration: string;
  drillsCompleted: number;
  drillsTotal: number;
}

interface PlanStore {
  plan: TrainingPlan | null;
  profile: PlayerProfile | null;
  description: string;
  completedDrills: Record<string, boolean>;
  completedSessions: CompletedSession[];
  currentStreak: number;
  totalSessions: number;
  currentDayIndex: number;
  isGenerating: boolean;
  skillLevels: Record<string, number>;
  onboardingComplete: boolean;
  setPlan: (plan: TrainingPlan) => void;
  setProfile: (profile: PlayerProfile) => void;
  setDescription: (description: string) => void;
  setSkillLevels: (skills: Record<string, number>) => void;
  setIsGenerating: (val: boolean) => void;
  setCurrentDayIndex: (i: number) => void;
  setOnboardingComplete: (val: boolean) => void;
  toggleDrill: (dayIndex: number, drillIndex: number) => void;
  markDrillComplete: (dayIndex: number, drillIndex: number) => void;
  completeSession: (session: CompletedSession) => void;
  loadFromStorage: () => Promise<void>;
  clearAll: () => void;
}

const STORAGE_KEY = 'athlt_plan_store';

let saveTimer: any = null;
const saveToStorage = (state: Partial<PlanStore>) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const data = {
        plan: state.plan,
        profile: state.profile,
        description: state.description,
        completedDrills: state.completedDrills,
        completedSessions: state.completedSessions,
        currentStreak: state.currentStreak,
        totalSessions: state.totalSessions,
        currentDayIndex: state.currentDayIndex,
        skillLevels: state.skillLevels,
        onboardingComplete: state.onboardingComplete,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to storage:', e);
    }
  }, 500);
};

function computeStreak(sessions: CompletedSession[]): number {
  if (sessions.length === 0) return 0;

  const uniqueDays = Array.from(
    new Set(sessions.map(s => new Date(s.date).toDateString()))
  ).sort();

  let streak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  const lastSessionDay = new Date(uniqueDays[uniqueDays.length - 1]);
  lastSessionDay.setHours(0, 0, 0, 0);
  const daysSinceLast = Math.round(
    (checkDate.getTime() - lastSessionDay.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLast > 1) return 0;

  for (let i = uniqueDays.length - 1; i >= 0; i--) {
    const sessionDay = new Date(uniqueDays[i]);
    sessionDay.setHours(0, 0, 0, 0);
    const dayDiff = Math.round(
      (checkDate.getTime() - sessionDay.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (dayDiff === 0 || dayDiff === 1) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  plan: null,
  profile: null,
  description: '',
  completedDrills: {},
  completedSessions: [],
  currentStreak: 0,
  totalSessions: 0,
  currentDayIndex: 0,
  isGenerating: false,
  skillLevels: {},
  onboardingComplete: false,

  setPlan: (plan) => {
    // BUG FIX #6: clear completedDrills when plan changes — old keys belong to old plan
    set({ plan, currentDayIndex: 0, completedDrills: {} });
    saveToStorage(get());
  },
  setProfile: (profile) => {
    set({ profile });
    saveToStorage(get());
  },
  setDescription: (description) => {
    set({ description });
    saveToStorage(get());
  },
  setSkillLevels: (skills) => {
    set({ skillLevels: skills });
    saveToStorage(get());
  },
  setIsGenerating: (val) => {
    set({ isGenerating: val });
  },
  setCurrentDayIndex: (i) => {
    // BUG FIX #5: clamp to valid plan range so we never go out of bounds
    const planLen = get().plan?.days?.length ?? 0;
    const clamped = planLen > 0 ? Math.max(0, Math.min(i, planLen - 1)) : 0;
    set({ currentDayIndex: clamped });
    saveToStorage(get());
  },
  setOnboardingComplete: (val) => {
    set({ onboardingComplete: val });
    saveToStorage(get());
  },
  toggleDrill: (dayIndex, drillIndex) => {
    const key = `${dayIndex}-${drillIndex}`;
    const current = get().completedDrills;
    const updated = { ...current, [key]: !current[key] };
    set({ completedDrills: updated });
    saveToStorage(get());
  },
  markDrillComplete: (dayIndex, drillIndex) => {
    const key = `${dayIndex}-${drillIndex}`;
    const current = get().completedDrills;
    if (current[key]) return;
    const updated = { ...current, [key]: true };
    set({ completedDrills: updated });
    saveToStorage(get());
  },
  completeSession: (session) => {
    const sessions = [...get().completedSessions, session];
    const newStreak = computeStreak(sessions);
    // BUG FIX #2: derive totalSessions from array length — prevents drift
    set({
      completedSessions: sessions,
      totalSessions: sessions.length,
      currentStreak: newStreak,
    });
    saveToStorage(get());
  },
  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const planDaysLen = data.plan?.days?.length ?? 0;

        // BUG FIX #5: clamp stored currentDayIndex against actual plan length on load
        const storedIdx = data.currentDayIndex ?? 0;
        const clampedIdx = planDaysLen > 0
          ? Math.max(0, Math.min(storedIdx, planDaysLen - 1))
          : 0;

        const storedSessions: CompletedSession[] = data.completedSessions || [];

        set({
          plan:              data.plan || null,
          profile:           data.profile || null,
          description:       data.description || '',
          completedDrills:   data.completedDrills || {},
          completedSessions: storedSessions,
          currentStreak:     data.currentStreak || 0,
          // BUG FIX #2: sync totalSessions to actual array length on load
          totalSessions:     storedSessions.length,
          currentDayIndex:   clampedIdx,
          skillLevels:       data.skillLevels || {},
          onboardingComplete: data.onboardingComplete || false,
        });
      }
    } catch (e) {
      console.error('Failed to load from storage:', e);
    }
  },
  clearAll: () => {
    set({
      plan: null,
      profile: null,
      description: '',
      completedDrills: {},
      completedSessions: [],
      currentStreak: 0,
      totalSessions: 0,
      currentDayIndex: 0,
      skillLevels: {},
      onboardingComplete: false,
    });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));
