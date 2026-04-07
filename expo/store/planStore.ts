import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PlanDrill {
  name: string;
  time: string;
  type: 'warmup' | 'skill' | 'shooting' | 'conditioning';
  detail: string;
  duration?: number;
  sets?: number;
  reps?: number;
  drillId?: string;
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
  completedDrills: Record<string, boolean>;
  completedSessions: CompletedSession[];
  currentStreak: number;
  totalSessions: number;
  currentDayIndex: number;
  isGenerating: boolean;
  skillLevels: Record<string, number>;
  setPlan: (plan: TrainingPlan) => void;
  setProfile: (profile: PlayerProfile) => void;
  setSkillLevels: (skills: Record<string, number>) => void;
  setIsGenerating: (val: boolean) => void;
  setCurrentDayIndex: (i: number) => void;
  toggleDrill: (dayIndex: number, drillIndex: number) => void;
  completeSession: (session: CompletedSession) => void;
  loadFromStorage: () => Promise<void>;
  clearAll: () => void;
}

const STORAGE_KEY = 'athlt_plan_store';

const saveToStorage = async (state: Partial<PlanStore>) => {
  try {
    const data = {
      plan: state.plan,
      profile: state.profile,
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
};

export const usePlanStore = create<PlanStore>((set, get) => ({
  plan: null,
  profile: null,
  completedDrills: {},
  completedSessions: [],
  currentStreak: 0,
  totalSessions: 0,
  currentDayIndex: 0,
  isGenerating: false,
  skillLevels: {},

  setPlan: (plan) => {
    set({ plan });
    saveToStorage(get());
  },
  setProfile: (profile) => {
    set({ profile });
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
  completeSession: (session) => {
    const sessions = [...get().completedSessions, session];
    set({
      completedSessions: sessions,
      totalSessions: get().totalSessions + 1,
      currentStreak: get().currentStreak + 1,
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
      completedDrills: {},
      completedSessions: [],
      currentStreak: 0,
      totalSessions: 0,
      currentDayIndex: 0,
      skillLevels: {},
    });
    AsyncStorage.removeItem(STORAGE_KEY);
  },
}));
