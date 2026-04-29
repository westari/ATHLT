import { getDrillById, type Drill } from '@/constants/drillLibrary';

// What Coach X returns in a plan now: just { drillId, time }
export interface PlanDrillRef {
  drillId: string;
  time: string;
  // Legacy fields — old plans before the drill library wiring may still have these
  name?: string;
  type?: string;
  detail?: string;
}

// What the UI consumes — full drill data merged with the per-session time
export interface ResolvedDrill extends Drill {
  time: string; // The duration assigned in THIS plan (may differ from drill.duration default)
}

/**
 * Resolves a plan drill reference to full drill data.
 *
 * New format: plan has { drillId: 'sh-7', time: '10 min' } → look up sh-7 in library.
 * Legacy format: plan has { name: 'Pull-up jumpers', ... } with no drillId → use legacy fields directly.
 *
 * Returns null if the drillId is invalid.
 */
export function resolvePlanDrill(planDrill: PlanDrillRef | any): ResolvedDrill | null {
  if (!planDrill) return null;

  // ===== NEW FORMAT: drillId reference =====
  if (planDrill.drillId) {
    const fullDrill = getDrillById(planDrill.drillId);
    if (!fullDrill) {
      // Drill ID didn't match anything in the library — return a safe stub
      console.warn('Unknown drillId in plan:', planDrill.drillId);
      return {
        id: planDrill.drillId,
        name: planDrill.name || 'Unknown drill',
        category: 'Unknown',
        duration: 0,
        difficulty: 'beginner',
        equipment: [],
        type: 'skill',
        summary: '',
        steps: [],
        coachingPoints: [],
        commonMistakes: [],
        time: planDrill.time || '',
      };
    }
    return {
      ...fullDrill,
      time: planDrill.time || `${fullDrill.duration} min`,
    };
  }

  // ===== LEGACY FORMAT: plan stored before drill library wiring =====
  // Old plans have { name, time, type, detail } directly. We synthesize a Drill-shaped object.
  return {
    id: 'legacy-' + (planDrill.name || 'unnamed').replace(/\s+/g, '-').toLowerCase(),
    name: planDrill.name || 'Drill',
    category: planDrill.type === 'shooting' ? 'Shooting'
      : planDrill.type === 'conditioning' ? 'Conditioning'
      : planDrill.type === 'warmup' ? 'Warmup & Cooldown'
      : 'Skill',
    duration: 0,
    difficulty: 'intermediate',
    equipment: [],
    type: planDrill.type || 'skill',
    summary: planDrill.detail || '',
    steps: [],
    coachingPoints: [],
    commonMistakes: [],
    time: planDrill.time || '',
  };
}

/**
 * Resolves an entire array of plan drills.
 * Filters out any that fail to resolve (returns null).
 */
export function resolvePlanDrills(planDrills: PlanDrillRef[] | any[]): ResolvedDrill[] {
  if (!Array.isArray(planDrills)) return [];
  return planDrills
    .map(d => resolvePlanDrill(d))
    .filter((d): d is ResolvedDrill => d !== null);
}
