# Top 20 Drills to Add Videos For (Priority Order)

These are the drills Coach X assigns most often. Filling in YouTube IDs for these covers about 70-80% of what users see in their plans.

## Goal: Find a clean YouTube Short for each (or a normal video if no Short exists). Paste the video ID into the corresponding drill in `expo/constants/drillLibrary.ts`.

---

## TIER 1 — STAPLES (must-have, in almost every plan)

These show up in nearly every player's plan regardless of skill level.

1. **`bh-1` Pound Dribbles** — Foundation drill. Search: "pound dribble drill basketball shorts"
2. **`bh-4` Crossover Dribble** — Most fundamental change of direction. Search: "crossover dribble drill basketball shorts"
3. **`sh-1` Form Shooting** — In every shooter's plan. Search: "form shooting drill basketball shorts"
4. **`fn-1` Mikan Drill** — The classic finishing drill. Search: "mikan drill basketball shorts"
5. **`fn-4` Weak Hand Layups** — Weak hand is in everyone's bottom 3. Search: "weak hand layup drill"
6. **`bh-20` Weak Hand Only Dribble** — Weak hand fix. Search: "weak hand only dribbling drill"
7. **`wu-1` High Knees** — Universal warmup. Search: "high knees warmup basketball shorts"
8. **`sh-13` Free Throw Routine** — Every player needs this. Search: "free throw routine basketball trainer"

---

## TIER 2 — VERY COMMON (every other plan)

9. **`bh-5` Between the Legs Dribble** — Essential ball handling
10. **`bh-14` Hesitation Dribble** — Most effective offensive move
11. **`sh-6` Catch and Shoot** — Most game-realistic shot
12. **`sh-7` Off the Dribble Pull Up** — Mid-range scoring
13. **`fn-3` Power Layups** — Strong finishing
14. **`fn-5` Euro Step Finish** — Modern finishing move
15. **`df-1` Defensive Slide Drill** — Foundation defense
16. **`df-2` Closeout Drill** — Most common defensive action

---

## TIER 3 — REGULAR APPEARANCES

17. **`sh-12` Wing Shooting** — 3PT practice
18. **`sh-26` Elbow Alignment Drill** — Fix shooting form
19. **`bh-9` Two Ball Pound Dribble** — Builds weak hand
20. **`cd-1` Suicides** — Classic conditioning

---

## How to add a video to a drill

1. Find the drill in `expo/constants/drillLibrary.ts`
2. Add `videoUrl: 'YOUTUBE_VIDEO_ID',` to the drill object
3. Example:
```typescript
{ id:'bh-1', name:'Pound Dribbles', ..., videoUrl: 'b3KH4Zgt8dc' }
```

The drill detail screen will automatically pick up the video and play it inline.

## How to find the YouTube ID

For a Short URL like `https://www.youtube.com/shorts/b3KH4Zgt8dc`, the ID is `b3KH4Zgt8dc` (everything after `/shorts/`).

For a regular video URL like `https://www.youtube.com/watch?v=xaOeh5CEc68`, the ID is `xaOeh5CEc68` (everything after `v=`).

## Recommended channels to browse (good Shorts content)

- **By Any Means Basketball** — clean drill demos
- **ILoveBasketballTV** — drill-focused
- **Get Handles Basketball** — ball handling specialist
- **ShotMechanics** (Coach Collin Castellaw) — shooting form
- **Pro Training Basketball** (Tony Watson II) — wide range
- **Tyler Relph** — elite NBA trainer
- **Dre Baldwin / DreAllDay** — older but reliable, lots of variety
