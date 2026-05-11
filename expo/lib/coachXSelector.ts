// expo/lib/coachXSelector.ts
// Picks the right Coach X line based on user state.
// - Looks at recent activity to pick a CATEGORY
// - Within category, picks a line not shown in last 14 days
// - Persists last-shown timestamps via AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  COACH_X_LINES,
  LINES_BY_CATEGORY,
  CoachXLine,
  CoachXCategory,
} from './coachXLines';

const STORAGE_KEY = 'coachx_line_history_v1';
const COOLDOWN_DAYS = 14;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type History = Record<string, number>; // lineId -> lastShownTimestamp(ms)

// ===== Public API =====

export type SessionStateInput = {
  /** True if yesterday's workout was a non-rest day and was not completed. */
  skippedYesterday: boolean;
  /** Number of sessions fully completed in the last 7 days. */
  sessionsLast7Days: number;
};

/**
 * Pick the Coach X line to show today. Idempotent within the same day —
 * calling twice on the same day returns the same line.
 */
export async function pickCoachXLineForToday(
  state: SessionStateInput
): Promise<CoachXLine> {
  const category = pickCategory(state);
  const history = await loadHistory();

  // Today's bucket key (date-stamped so it's stable within a day)
  const todayKey = todayDateKey();
  const todayPickKey = `today:${todayKey}:${category}`;
  if (history[todayPickKey]) {
    // Already picked today — return that exact line
    const lineId = String(history[todayPickKey]);
    const found = COACH_X_LINES.find(l => l.id === lineId);
    if (found) return found;
  }

  const pool = LINES_BY_CATEGORY[category];
  const line = pickFromPool(pool, history);

  // Record both: line lastShown, and today's pick
  history[line.id] = Date.now();
  // We store the line id as the "value" under the today key by stuffing into history map
  // Using a separate field-style key
  (history as any)[todayPickKey] = line.id;

  await saveHistory(history);
  return line;
}

/**
 * Force a re-pick (e.g. user pulled to refresh). Ignores today's cached pick.
 */
export async function forcePickCoachXLine(
  state: SessionStateInput
): Promise<CoachXLine> {
  const category = pickCategory(state);
  const history = await loadHistory();
  const pool = LINES_BY_CATEGORY[category];
  const line = pickFromPool(pool, history);

  history[line.id] = Date.now();
  const todayKey = todayDateKey();
  (history as any)[`today:${todayKey}:${category}`] = line.id;
  await saveHistory(history);
  return line;
}

// ===== Internals =====

function pickCategory(state: SessionStateInput): CoachXCategory {
  if (state.skippedYesterday) return 'missed';
  if (state.sessionsLast7Days >= 4) return 'strong';
  return 'default';
}

function pickFromPool(pool: CoachXLine[], history: History): CoachXLine {
  if (pool.length === 0) return COACH_X_LINES[0];

  const now = Date.now();
  const cooldownMs = COOLDOWN_DAYS * ONE_DAY_MS;

  // Prefer lines NOT shown in cooldown window
  const fresh = pool.filter(line => {
    const last = history[line.id];
    if (!last) return true;
    return now - last > cooldownMs;
  });

  const usable = fresh.length > 0 ? fresh : pool;

  // Among usable, weighted random — older "lastShown" gets higher weight
  // (lines never shown have weight 1)
  const weights = usable.map(line => {
    const last = history[line.id];
    if (!last) return 1.0;
    const daysSince = (now - last) / ONE_DAY_MS;
    return Math.min(1.0, daysSince / COOLDOWN_DAYS);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < usable.length; i++) {
    r -= weights[i];
    if (r <= 0) return usable[i];
  }
  return usable[usable.length - 1];
}

function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

async function loadHistory(): Promise<History> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return {};
  } catch {
    return {};
  }
}

async function saveHistory(history: History): Promise<void> {
  try {
    // Compact: drop entries older than 30 days to keep storage small
    const cutoff = Date.now() - 30 * ONE_DAY_MS;
    const cleaned: History = {};
    for (const [k, v] of Object.entries(history)) {
      if (typeof v === 'number') {
        if (v > cutoff) cleaned[k] = v;
      } else {
        // keep "today:..." pick markers as-is
        cleaned[k] = v as any;
      }
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Storage errors are non-fatal — Coach X just won't remember rotation
  }
}
