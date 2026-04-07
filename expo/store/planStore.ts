import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveProfileToCloud,
  savePlanToCloud,
  saveCompletedDrillToCloud,
  loadAllUserDataFromCloud,
} from '@/lib/supabaseSync';

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
  setDescription: (desc: string) => void;
  setSkillLevels: (skills: Record<string, number>) => void;
  setIsGenerating: (val: boolean) => void;
  setCurrentDayIndex: (i: number) => void;
  toggleDrill: (dayIndex: number, drillIndex: number) => void;
  completeSession: (session: CompletedSession) => void;
  loadFromStorage: () => Promise<void>;
  loadFromCloud: () => Promise<{ hasCloudData: boolean }>;
  clearAll: () => void;
}

const STORAGE_KEY = 'athlt_plan_store';

const saveToStorage = async (state: Partial<PlanStore>) => {
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
};

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
    set({ plan });
    saveToStorage(get());
    // Fire-and-forget cloud sync
    savePlanToCloud(plan).catch(e => console.error('Plan cloud sync failed:', e));
  },

  setProfile: (profile) => {
    set({ profile });
    saveToStorage(get());
    // Fire-and-forget cloud sync (includes current skillLevels and description)
    saveProfileToCloud(profile, get().skillLevels, get().description).catch(e => console.error('Profile cloud sync failed:', e));
  },

  setDescription: (desc) => {
    set({ description: desc });
    saveToStorage(get());
    // If a profile exists, re-sync it with the new description
    const p = get().profile;
    if (p) {
      saveProfileToCloud(p, get().skillLevels, desc).catch(e => console.error('Profile cloud sync failed:', e));
    }
  },

  setSkillLevels: (skills) => {
    set({ skillLevels: skills });
    saveToStorage(get());
    // If a profile exists, re-sync it with the new skill levels
    const p = get().profile;
    if (p) {
      saveProfileToCloud(p, skills, get().description).catch(e => console.error('Profile cloud sync failed:', e));
    }
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
    const newValue = !current[key];
    const updated = { ...current, [key]: newValue };
    set({ completedDrills: updated });
    saveToStorage(get());
    // Fire-and-forget cloud sync
    saveCompletedDrillToCloud(dayIndex, drillIndex, newValue).catch(e => console.error('Drill cloud sync failed:', e));
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

  loadFromCloud: async () => {
    try {
      const result = await loadAllUserDataFromCloud();
      if (result.hasCloudData) {
        set({
          profile: result.profile,
          plan: result.plan,
          skillLevels: result.skillLevels,
          description: result.description || '',
          completedDrills: result.completedDrills,
        });
        // Also save to local storage so app loads instantly next time
        saveToStorage(get());
        console.log('loadFromCloud: loaded user data from Supabase');
        return { hasCloudData: true };
      }
      console.log('loadFromCloud: no cloud data for this user');
      return { hasCloudData: false };
    } catch (e) {
      console.error('loadFromCloud error:', e);
      return { hasCloudData: false };
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
    AsyncStorage.removeItem(STORAGE_KEY);
  },
}));
