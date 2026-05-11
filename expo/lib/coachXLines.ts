// expo/lib/coachXLines.ts
// Hand-curated Coach X lines. No AI generation — these are the brand voice.
// Each line has a hand-tuned fontSize so it always fills the speech bubble.

export type CoachXCategory = 'default' | 'missed' | 'strong';

export type CoachXLine = {
  id: string;        // stable id for tracking last-shown
  text: string;
  category: CoachXCategory;
  fontSize: number;  // hand-tuned to fill the bubble cleanly
};

export const COACH_X_LINES: CoachXLine[] = [
  // ===== DEFAULT (12) — used ~70% of the time =====
  { id: 'd01', text: 'Get to work.',                                  category: 'default', fontSize: 36 },
  { id: 'd02', text: 'Reps over hype.',                               category: 'default', fontSize: 34 },
  { id: 'd03', text: 'Boring is what builds it.',                     category: 'default', fontSize: 28 },
  { id: 'd04', text: "Nobody's coming to save you. Train.",           category: 'default', fontSize: 22 },
  { id: 'd05', text: 'Skill is just bored people repeating things.',  category: 'default', fontSize: 19 },
  { id: 'd06', text: 'Quiet work, loud results.',                     category: 'default', fontSize: 28 },
  { id: 'd07', text: "You don't rise. You fall to your training.",    category: 'default', fontSize: 20 },
  { id: 'd08', text: "Today's the only one that counts right now.",   category: 'default', fontSize: 20 },
  { id: 'd09', text: 'Be a problem nobody wants to guard.',           category: 'default', fontSize: 22 },
  { id: 'd10', text: "Trainer's not the one shooting in the game.",   category: 'default', fontSize: 21 },
  { id: 'd11', text: 'Game speed is built in the gym.',               category: 'default', fontSize: 24 },
  { id: 'd12', text: "Make it look easy. It won't be.",               category: 'default', fontSize: 24 },

  // ===== MISSED SESSION (7) — triggered when user skipped yesterday =====
  { id: 'm01', text: "You took yesterday off. Don't take two.",       category: 'missed',  fontSize: 21 },
  { id: 'm02', text: "Yesterday's a closed file. Open today.",        category: 'missed',  fontSize: 22 },
  { id: 'm03', text: "Missed days happen. Missed weeks don't.",       category: 'missed',  fontSize: 22 },
  { id: 'm04', text: "Pick it back up. That's it.",                   category: 'missed',  fontSize: 28 },
  { id: 'm05', text: 'Back in. Move on.',                             category: 'missed',  fontSize: 32 },
  { id: 'm06', text: "One day off is fine. Don't make it a habit.",   category: 'missed',  fontSize: 20 },
  { id: 'm07', text: 'Get back to it before you fall in love with not doing it.', category: 'missed', fontSize: 16 },

  // ===== STRONG WEEK (6) — triggered when 4+ sessions last week =====
  { id: 's01', text: "Four sessions last week. Don't get satisfied.", category: 'strong',  fontSize: 20 },
  { id: 's02', text: 'Good week. Now make it normal.',                category: 'strong',  fontSize: 23 },
  { id: 's03', text: "You showed up. That's the floor, not the ceiling.", category: 'strong', fontSize: 18 },
  { id: 's04', text: 'This is the work nobody sees.',                 category: 'strong',  fontSize: 25 },
  { id: 's05', text: "Keep stacking. The gap's getting bigger.",      category: 'strong',  fontSize: 21 },
  { id: 's06', text: "You're building. Don't let off.",               category: 'strong',  fontSize: 26 },
];

// Convenience lookups
export const LINES_BY_CATEGORY: Record<CoachXCategory, CoachXLine[]> = {
  default: COACH_X_LINES.filter(l => l.category === 'default'),
  missed:  COACH_X_LINES.filter(l => l.category === 'missed'),
  strong:  COACH_X_LINES.filter(l => l.category === 'strong'),
};
