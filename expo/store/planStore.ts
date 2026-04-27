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
  setPlan: (plan: TrainingPlan) => void;
  setProfile: (profile: PlayerProfile) => void;
  setDescription: (description: string) => void;
  setSkillLevels: (skills: Record<string, number>) => void;
  setIsGenerating: (val: boolean) => void;
  setCurrentDayIndex: (i: number) => void;
  toggleDrill: (dayIndex: number, drillIndex: number) => void;
  markDrillComplete: (dayIndex: number, drillIndex: number) => void;
  completeSession: (session: CompletedSession) => void;
  loadFromStorage: () => Promise<void>;
  clearAll: () => void;
}

const STORAGE_KEY = 'athlt_plan_store';

// Debounced save — prevents spamming AsyncStorage on rapid changes
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
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to storage:', e);
    }
  }, 500);
};

/**
 * Compute streak from session dates.
 * Streak = consecutive calendar days with at least one completed session,
 * counting back from today.
 */
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

  // If last session was 2+ days ago, streak is 0
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

  setPlan: (plan) => {
    // Reset day index on new plan
    set({ plan, currentDayIndex: 0 });
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
    set({ currentDayIndex: i });
    saveToStorage(get());
  },
  toggleDrill: (dayIndex, drillIndex) => {
    const key = `${dayIndex}-${drillIndex}`;
    const current = get().completedDrills;
    const updated = { ...current, [key]: !current[key] };
    set({ completedDrills: updated });
    saveToStorage(get());
  },
  // Explicit completion — never un-marks. Use inside session flow.
  markDrillComplete: (dayIndex, drillIndex) => {
    const key = `${dayIndex}-${drillIndex}`;
    const current = get().completedDrills;
    if (current[key]) return; // already complete, no-op
    const updated = { ...current, [key]: true };
    set({ completedDrills: updated });
    saveToStorage(get());
  },
  completeSession: (session) => {
    const sessions = [...get().completedSessions, session];
    const newStreak = computeStreak(sessions);
    set({
      completedSessions: sessions,
      totalSessions: get().totalSessions + 1,
      currentStreak: newStreak,
    });
    saveToStorage(get());
  },
  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          plan: data.plan || null,
          profile: data.profile || null,
          description: data.description || '',
          completedDrills: data.completedDrills || {},
          completedSessions: data.completedSessions || [],
          currentStreak: data.currentStreak || 0,
          totalSessions: data.totalSessions || 0,
          currentDayIndex: data.currentDayIndex || 0,
          skillLevels: data.skillLevels || {},
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
    });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));
