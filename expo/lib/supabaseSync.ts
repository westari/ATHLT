import { supabase } from '@/constants/supabase';
import type { TrainingPlan, PlayerProfile } from '@/store/planStore';

// ============================================================
// PROFILE SYNC
// ============================================================

export async function saveProfileToCloud(profile: PlayerProfile, skillLevels: Record<string, number>, description?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('saveProfileToCloud: no user signed in, skipping');
    return { error: 'not_signed_in' };
  }

  const row = {
    id: user.id,
    name: profile.name || null,
    sport: profile.sport,
    position: profile.position,
    experience: profile.experience,
    goal: profile.goal,
    weakness: profile.weakness,
    driving: profile.driving || null,
    left_hand: profile.leftHand || null,
    pressure: profile.pressure || null,
    go_to_move: profile.goToMove || null,
    three_confidence: profile.threeConfidence || null,
    free_throw: profile.freeThrow || null,
    frequency: profile.frequency,
    duration: profile.duration,
    access: Array.isArray(profile.access) ? profile.access : [profile.access],
    skill_levels: skillLevels || {},
    description: description || null,
  };

  const { error } = await supabase.from('profiles').upsert(row);
  if (error) {
    console.error('saveProfileToCloud error:', error);
    return { error: error.message };
  }
  console.log('saveProfileToCloud: success');
  return { error: null };
}

export async function loadProfileFromCloud(): Promise<{ profile: PlayerProfile | null; skillLevels: Record<string, number>; description: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { profile: null, skillLevels: {}, description: null, error: 'not_signed_in' };
  }

  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) {
    console.error('loadProfileFromCloud error:', error);
    return { profile: null, skillLevels: {}, description: null, error: error.message };
  }
  if (!data) {
    return { profile: null, skillLevels: {}, description: null, error: null };
  }

  const profile: PlayerProfile = {
    name: data.name || undefined,
    sport: data.sport || 'basketball',
    position: data.position || '',
    experience: data.experience || '',
    goal: data.goal || '',
    weakness: data.weakness || '',
    driving: data.driving || undefined,
    leftHand: data.left_hand || undefined,
    pressure: data.pressure || undefined,
    goToMove: data.go_to_move || undefined,
    threeConfidence: data.three_confidence || undefined,
    freeThrow: data.free_throw || undefined,
    frequency: data.frequency || '',
    duration: data.duration || '',
    access: data.access || [],
  };

  return {
    profile,
    skillLevels: data.skill_levels || {},
    description: data.description || null,
    error: null,
  };
}

// ============================================================
// PLAN SYNC
// ============================================================
// IMPORTANT: Writes to BOTH 'plans' and 'weekly_plans' tables to support
// legacy code paths. Reads from 'plans' first, falls back to 'weekly_plans'.

export async function savePlanToCloud(plan: TrainingPlan) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('savePlanToCloud: no user signed in, skipping');
    return { error: 'not_signed_in' };
  }

  const planRow = {
    user_id: user.id,
    week_title: plan.weekTitle,
    ai_insight: plan.aiInsight,
    coach_summary: (plan as any).coachSummary || {},
    days: plan.days,
  };

  // Mark all existing plans as inactive (both tables)
  await supabase.from('plans').update({ is_active: false }).eq('user_id', user.id);
  await supabase.from('weekly_plans').update({ is_active: false, is_current: false }).eq('user_id', user.id);

  // Insert into 'plans' table
  const { error: plansError } = await supabase.from('plans').insert({
    ...planRow,
    is_active: true,
  });

  if (plansError) {
    console.error('savePlanToCloud plans error:', plansError);
  } else {
    console.log('savePlanToCloud plans: success');
  }

  // Insert into 'weekly_plans' table (legacy)
  const { error: weeklyError } = await supabase.from('weekly_plans').insert({
    ...planRow,
    is_active: true,
    is_current: true,
  });

  if (weeklyError) {
    console.error('savePlanToCloud weekly_plans error:', weeklyError);
  } else {
    console.log('savePlanToCloud weekly_plans: success');
  }

  // Return error only if BOTH failed
  if (plansError && weeklyError) {
    return { error: plansError.message };
  }
  return { error: null };
}

export async function loadPlanFromCloud(): Promise<{ plan: TrainingPlan | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { plan: null, error: 'not_signed_in' };
  }

  // Try 'plans' table first
  const { data: plansData } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (plansData) {
    const plan: TrainingPlan = {
      weekTitle: plansData.week_title || '',
      aiInsight: plansData.ai_insight || '',
      days: plansData.days || [],
    };
    (plan as any).coachSummary = plansData.coach_summary || {};
    console.log('loadPlanFromCloud: loaded from plans table');
    return { plan, error: null };
  }

  // Fallback: try 'weekly_plans' table
  const { data: weeklyData } = await supabase
    .from('weekly_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (weeklyData) {
    const plan: TrainingPlan = {
      weekTitle: weeklyData.week_title || '',
      aiInsight: weeklyData.ai_insight || '',
      days: weeklyData.days || [],
    };
    (plan as any).coachSummary = weeklyData.coach_summary || {};
    console.log('loadPlanFromCloud: loaded from weekly_plans table (fallback)');
    return { plan, error: null };
  }

  console.log('loadPlanFromCloud: no plan found in either table');
  return { plan: null, error: null };
}

// ============================================================
// COMPLETED DRILLS SYNC
// ============================================================

export async function saveCompletedDrillToCloud(dayIndex: number, drillIndex: number, completed: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'not_signed_in' };

  if (completed) {
    const { error } = await supabase.from('completed_drills').upsert({
      user_id: user.id,
      day_index: dayIndex,
      drill_index: drillIndex,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,day_index,drill_index' });
    if (error) {
      console.error('saveCompletedDrillToCloud insert error:', error);
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from('completed_drills').delete().eq('user_id', user.id).eq('day_index', dayIndex).eq('drill_index', drillIndex);
    if (error) {
      console.error('saveCompletedDrillToCloud delete error:', error);
      return { error: error.message };
    }
  }
  return { error: null };
}

export async function loadCompletedDrillsFromCloud(): Promise<{ completedDrills: Record<string, boolean>; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { completedDrills: {}, error: 'not_signed_in' };

  const { data, error } = await supabase.from('completed_drills').select('day_index, drill_index').eq('user_id', user.id);
  if (error) {
    console.error('loadCompletedDrillsFromCloud error:', error);
    return { completedDrills: {}, error: error.message };
  }

  const map: Record<string, boolean> = {};
  (data || []).forEach((row: any) => {
    map[`${row.day_index}-${row.drill_index}`] = true;
  });
  return { completedDrills: map, error: null };
}

// ============================================================
// FULL LOAD ON SIGN-IN
// ============================================================

export async function loadAllUserDataFromCloud() {
  const [profileResult, planResult, drillsResult] = await Promise.all([
    loadProfileFromCloud(),
    loadPlanFromCloud(),
    loadCompletedDrillsFromCloud(),
  ]);

  return {
    profile: profileResult.profile,
    skillLevels: profileResult.skillLevels,
    description: profileResult.description,
    plan: planResult.plan,
    completedDrills: drillsResult.completedDrills,
    hasCloudData: !!(profileResult.profile || planResult.plan),
  };
}

// ============================================================
// SIGN OUT
// ============================================================

export async function signOutAndClear() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('signOut error:', error);
    return { error: error.message };
  }
  return { error: null };
}
