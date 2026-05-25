# ATHLT Drill Video Curation
**Status: PENDING REVIEW — do not add to code until each video is verified**

Two types of entries:
- **IN CODE** — `youtubeId` already exists in `drillLibrary.ts`. Watch and confirm it's a good match.
- **SUGGEST** — research-based suggestion. Watch, verify it's long-form (no `/shorts/`), then add to code if approved.
- **SEARCH** — no URL confirmed; search query provided. Find, watch, approve before using.
- **GROUP** — multiple drills share one good video.
- **SKIP** — partner/group-required drill; no suitable solo tutorial. Leave `videoUrl` empty.

To add an approved video to the code, set `videoUrl: 'https://www.youtube.com/watch?v=XXXX'` on the drill in `drillLibrary.ts`. The existing Ball Handling drills use `youtubeId:` (not `videoUrl:`) — once you've verified them, those are already wired; no code change needed unless you want to replace one.

---

## Ball Handling — 21 drills (all IN CODE, need verification)

| ID | Name | Current youtubeId | Watch |
|----|------|-------------------|-------|
| bh-1 | Pound Dribbles | `-5T2enH2D2c` | [watch](https://www.youtube.com/watch?v=-5T2enH2D2c) |
| bh-3 | In & Out Dribble | `TkILzg8OEU4` | [watch](https://www.youtube.com/watch?v=TkILzg8OEU4) |
| bh-4 | Crossover Dribble | `e4XvisoxHo0` | [watch](https://www.youtube.com/watch?v=e4XvisoxHo0) |
| bh-5 | Between the Legs Dribble | `bAgzuO4W4DQ` | [watch](https://www.youtube.com/watch?v=bAgzuO4W4DQ) |
| bh-6 | Behind the Back Dribble | `ZQ6E4MG4qkU` | [watch](https://www.youtube.com/watch?v=ZQ6E4MG4qkU) |
| bh-7 | Figure 8 Dribble | `5vIkgcSlYNI` | [watch](https://www.youtube.com/watch?v=5vIkgcSlYNI) |
| bh-8 | Spider Dribble | `LWS0c_Lw4lU` | [watch](https://www.youtube.com/watch?v=LWS0c_Lw4lU) |
| bh-9 | Two Ball Pound Dribble | `H-Sux-HgTXg` | [watch](https://www.youtube.com/watch?v=H-Sux-HgTXg) |
| bh-10 | Two Ball Alternating Dribble | `BlH4UiGR4OQ` | [watch](https://www.youtube.com/watch?v=BlH4UiGR4OQ) |
| bh-11 | Two Ball Crossover | `FFklfeUzd8w` | [watch](https://www.youtube.com/watch?v=FFklfeUzd8w) |
| bh-12 | Cone Zig-Zag Dribble | `cg3m4h9zslM` | [watch](https://www.youtube.com/watch?v=cg3m4h9zslM) |
| bh-13 | Retreat Dribble | `GV8tuux5R9Q` | [watch](https://www.youtube.com/watch?v=GV8tuux5R9Q) |
| bh-14 | Hesitation Dribble | `TxyQaGXPJ3U` | [watch](https://www.youtube.com/watch?v=TxyQaGXPJ3U) |
| bh-16 | Stationary Combo Dribbles | `QMc3lhw3mEg` | [watch](https://www.youtube.com/watch?v=QMc3lhw3mEg) |
| bh-17 | Tennis Ball Dribble | `qj8OYS53pH8` | [watch](https://www.youtube.com/watch?v=qj8OYS53pH8) |
| bh-18 | Full Court Speed Dribble | `MJ4sCMcN59k` | [watch](https://www.youtube.com/watch?v=MJ4sCMcN59k) |
| bh-22 | Dribble Knockout | `7ocW502029g` | [watch](https://www.youtube.com/watch?v=7ocW502029g) |
| bh-23 | Tight Space Dribbling | `bJjkDyoq1cA` | [watch](https://www.youtube.com/watch?v=bJjkDyoq1cA) |
| bh-24 | Two Ball High-Low Dribble | `8U_ABpecGYs` | [watch](https://www.youtube.com/watch?v=8U_ABpecGYs) |
| bh-28 | Counter Move Drill | `w3Jig6fmz3I` | [watch](https://www.youtube.com/watch?v=w3Jig6fmz3I) |
| bh-30 | Weak Hand Combo Series | `fbcvh8U9lfA` | [watch](https://www.youtube.com/watch?v=fbcvh8U9lfA) |

---

## Shooting — 28 drills

### sh-1: Form Shooting
- **Status:** IN CODE (`2xDgvuV3mtE`)
- **Watch:** [watch](https://www.youtube.com/watch?v=2xDgvuV3mtE)
- **Why:** Basic form shooting from close range. Verify it isolates 1-hand form correctly.

### sh-2: One Hand Form Shooting
- **Status:** SEARCH
- **Search:** YouTube → "one hand shooting drill guide hand off" → ShotMechanics or Shot Science
- **Why:** Guide-hand-behind-back drill is specific; need a video that keeps guide hand fully off, not just passive.

### sh-3: BEEF Shooting Drill
- **Status:** SEARCH
- **Search:** YouTube → "BEEF shooting basketball drill" → Jr. NBA or Breakthrough Basketball
- **Why:** Many coaches cover BEEF but most are basic. Find one that isolates each element separately (5 shots balance / 5 eyes / etc.).

### sh-4: Around the World
- **Status:** SUGGEST
- **Video:** [Around the World Basketball Drill](https://www.youtube.com/watch?v=rz3wMiJqQa4)
- **Channel:** ILoveBasketballTV
- **Length:** ~4 min
- **Why:** Classic game format covered well on this channel; long-form, no Shorts.

### sh-5: Spot Shooting
- **Status:** SEARCH
- **Search:** YouTube → "spot shooting basketball drill track makes" → Pro Training Basketball
- **Why:** Need a video that emphasizes tracking percentages by spot, not just shooting from spots.

### sh-6: Catch and Shoot
- **Status:** SEARCH
- **Search:** YouTube → "catch and shoot basketball one motion drill" → ShotMechanics
- **Why:** Need emphasis on hands/feet set BEFORE catch — most videos just show the drill without the key coaching point.

### sh-7: Off the Dribble Pull Up
- **Status:** SEARCH
- **Search:** YouTube → "jab step pull up basketball drill" → ILoveBasketballTV or Pro Training Basketball
- **Why:** Needs to show the 1-dribble jab + pull up specifically, not a full dribble-drive workout.

### sh-8: 5 Spot Shooting
- **Status:** SEARCH
- **Search:** YouTube → "5 spot shooting basketball make 10 each spot" → Pro Training Basketball
- **Why:** Many channels cover this; find one that has the player tracking makes and moving on after 10.

### sh-9: Mikan Shooting Drill
- **Status:** GROUP with fn-1 (same drill — Mikan)
- **See fn-1 below** — use the same video for both sh-9 and fn-1.

### sh-10: Elbow Shooting
- **Status:** SEARCH
- **Search:** YouTube → "elbow shooting basketball mid range drill" → Breakthrough Basketball
- **Why:** Need a video focused specifically on the elbows, using backboard off the angle.

### sh-11: Corner Shooting
- **Status:** SEARCH
- **Search:** YouTube → "corner three point shooting basketball drill" → ShotMechanics or By Any Means Basketball
- **Why:** Corner 3 is shortest 3 — need a video that explains the geometry and footwork, not just "shoot from the corner."

### sh-12: Wing Shooting
- **Status:** SEARCH
- **Search:** YouTube → "wing shooting basketball feet angle drill" → ILoveBasketballTV
- **Why:** Foot angle toward basket at the wing is the key coaching point; most videos skip it.

### sh-13: Free Throw Routine
- **Status:** SEARCH
- **Search:** YouTube → "free throw routine build basketball pressure" → Breakthrough Basketball
- **Why:** Need a video focused on building a consistent pre-shot routine, not just "how to shoot free throws."

### sh-14: Chair Curl Shooting
- **Status:** SEARCH
- **Search:** YouTube → "chair curl shooting off screen basketball drill" → ILoveBasketballTV
- **Why:** Chair-as-screen drill. Needs to show both curl and fade options (read the defense).

### sh-15: Fadeaway Shooting
- **Status:** SEARCH
- **Search:** YouTube → "fadeaway mid range basketball shooting drill" → Pro Training Basketball
- **Why:** Find one with the specific coaching point: upper body stays upright, fade only with lower body.

### sh-16: Step Back Shooting
- **Status:** SEARCH
- **Search:** YouTube → "step back shooting basketball footwork drill" → Pro Training Basketball or ILoveBasketballTV
- **Why:** Two-foot landing, shoulders square — these are the key coaching points most skip.

### sh-17: Pump Fake One Dribble Shot
- **Status:** SEARCH
- **Search:** YouTube → "pump fake one dribble pull up basketball" → ILoveBasketballTV
- **Why:** Must show convincing fake + attacking defender's hip + 1 dribble only.

### sh-18: Transition Pull Up
- **Status:** SEARCH
- **Search:** YouTube → "transition pull up jumper basketball drill" → Pro Training Basketball
- **Why:** Full court drill that specifically stops and shoots in transition (not just fast break layups).

### sh-19: Relocation Shooting
- **Status:** SEARCH
- **Search:** YouTube → "relocation shooting basketball pass and move drill" → Breakthrough Basketball
- **Why:** Pass-and-move into catch-and-shoot. Most shooting videos are static — need movement.

### sh-20: Partner Pass Shooting
- **Status:** SKIP (needs partner — acceptable without video; drill is self-explanatory)

### sh-21: Closeout Shooting
- **Status:** SKIP (needs partner — self-explanatory from description)

### sh-22: Quick Release Shooting
- **Status:** SUGGEST
- **Video:** [How to Develop a Faster Shooting Release](https://www.youtube.com/watch?v=fF5BVLM_YDM)
- **Channel:** ShotMechanics
- **Length:** ~8 min
- **Why:** ShotMechanics is the go-to channel for release mechanics. Verify it covers the catch-high → no dip concept.

### sh-23: Shooting Off Screens
- **Status:** SEARCH
- **Search:** YouTube → "shooting off screens basketball curl fade down screen" → ILoveBasketballTV
- **Why:** Need both curl and fade options covered, with the "rub the screen" coaching point.

### sh-24: 3 Point Spot Shooting
- **Status:** SEARCH
- **Search:** YouTube → "3 point spot shooting 50 shots track percentage" → Pro Training Basketball
- **Why:** Needs to be a structured tracking drill, not just "practice your threes."

### sh-25: 100 Makes Shooting Drill
- **Status:** SEARCH
- **Search:** YouTube → "100 makes shooting drill basketball" → ILoveBasketballTV or Pro Training Basketball
- **Why:** Fairly common drill name — should find a good match directly.

### sh-26: Elbow Alignment Drill
- **Status:** SEARCH
- **Search:** YouTube → "elbow alignment wall shooting basketball fix flare" → ShotMechanics
- **Why:** Wall shooting drill is very specific — ShotMechanics may have it directly.

### sh-27: Guide Hand Removal Drill
- **Status:** SEARCH
- **Search:** YouTube → "guide hand basketball shooting drill fix" → ShotMechanics or Shot Science
- **Why:** Guide hand pushing is the most common shot problem; ShotMechanics has a dedicated video on this.

### sh-28: Dip Fix Drill
- **Status:** SEARCH
- **Search:** YouTube → "shooting dip basketball fix quick release" → ShotMechanics
- **Why:** The "no dip" concept is specific to shooting mechanics — ShotMechanics is the right channel.

---

## Finishing — 27 drills

### fn-1: Mikan Drill
- **Status:** SUGGEST
- **Video:** [The Mikan Layup Shooting Drill](https://www.youtube.com/watch?v=3QgqZx4ZlOw)
- **Channel:** Championship Productions / Coach Troy
- **Length:** ~5 min
- **Why:** Classic drill covered well. Verify it shows the ball-stays-high and 30-makes-or-restart format.
- **Note:** Also use for sh-9 (same drill).

### fn-2: Reverse Mikan Drill
- **Status:** SEARCH
- **Search:** YouTube → "reverse Mikan drill basketball" → ILoveBasketballTV
- **Why:** Less common than standard Mikan. Find a video that clearly shows the reverse angle off the glass.

### fn-3: Power Layups
- **Status:** SEARCH
- **Search:** YouTube → "power layup basketball drill two feet contact" → Pro Training Basketball
- **Why:** Two-foot jump, initiating contact — most layup videos don't cover the power finish specifically.

### fn-4: Weak Hand Layups
- **Status:** SEARCH
- **Search:** YouTube → "weak hand layup basketball drill all angles" → ILoveBasketballTV
- **Why:** Dedicated weak hand finishing from every angle. Should cover all court positions, not just one layup.

### fn-5: Euro Step Finish
- **Status:** SEARCH
- **Search:** YouTube → "euro step basketball tutorial finish" → ILoveBasketballTV or By Any Means Basketball
- **Why:** Need a clean breakdown of step 1 (sell direction) + step 2 (counter) + finish opposite hand.

### fn-6: Spin Move Finish
- **Status:** SEARCH
- **Search:** YouTube → "spin move basketball finish lane tutorial" → ILoveBasketballTV
- **Why:** Tight spin, ball on hip during rotation — need a video that shows both sides.

### fn-7: Floater Drill
- **Status:** SEARCH
- **Search:** YouTube → "floater basketball one foot touch shot drill" → ILoveBasketballTV or Coach Dribbles
- **Why:** One-foot push shot with high arc — many videos confuse floater and runner. Find one that's clear.

### fn-8: Runner Finish
- **Status:** SEARCH
- **Search:** YouTube → "runner finish basketball one hand speed" → Pro Training Basketball
- **Why:** Similar to floater but at full speed — look for a video that keeps the player moving fast through the shot.

### fn-9: Contact Layups
- **Status:** SKIP (requires partner with pad — contact drill without a partner isn't replicable)

### fn-10: Cone Layups
- **Status:** SEARCH
- **Search:** YouTube → "cone drive finish basketball layup drill different moves" → ILoveBasketballTV
- **Why:** Needs a variety of finishes off cone placement, not just straight-line layup drills.

### fn-11: Baseline Reverse Layups
- **Status:** SEARCH
- **Search:** YouTube → "baseline reverse layup basketball rim shield drill" → ILoveBasketballTV
- **Why:** Drive baseline, go under, finish on other side using rim as shield. Less common drill — may need to search with alternate terms.

### fn-12: Inside Hand Finish
- **Status:** SEARCH
- **Search:** YouTube → "inside hand finish basketball layup angle drill" → Pro Training Basketball
- **Why:** Finishing with the hand closest to basket — look for a video that explains why (keeps ball away from help).

### fn-13: Outside Hand Finish
- **Status:** SEARCH
- **Search:** YouTube → "outside hand finish basketball over defender drill"
- **Why:** Reaching over a defender — this is basically a floater from a specific angle. May overlap with fn-7.

### fn-14: Pro Hop Finish
- **Status:** SEARCH
- **Search:** YouTube → "pro hop basketball finish pivot foot drill" → ILoveBasketballTV
- **Why:** Two-foot hop stop in lane — needs to clarify it's legal (not a travel) and explain the pivot options.

### fn-15: Hop Step Finish
- **Status:** SEARCH
- **Search:** YouTube → "hop step finish basketball avoid shot blocker" → ILoveBasketballTV
- **Why:** Similar to euro step but lateral hop — search may return euro step videos; verify it's a distinct lateral move.

### fn-16: Two Foot Finish
- **Status:** SEARCH
- **Search:** YouTube → "two foot layup power finish basketball drill" → Pro Training Basketball
- **Why:** Jump off both feet — needs to contrast with one-foot finish so player understands when to use each.

### fn-17: One Foot Finish
- **Status:** SEARCH
- **Search:** YouTube → "one foot layup drill extension basketball" → ILoveBasketballTV
- **Why:** Basic layup form — opposite foot / opposite hand + knee drive. Good for beginners; verify it's clear on the footwork rule.

### fn-18: Up and Under Finish
- **Status:** SEARCH
- **Search:** YouTube → "up and under move basketball post drill" → Breakthrough Basketball
- **Why:** Pump fake + step through. Common post move — should be well-covered.

### fn-19: Putback Finishes
- **Status:** SEARCH
- **Search:** YouTube → "putback offensive rebound finish basketball drill" → Pro Training Basketball
- **Why:** Toss off glass, catch high, go right back up — no dribble. Needs the "chin the ball" coaching point.

### fn-20: Transition Layups
- **Status:** SEARCH
- **Search:** YouTube → "transition layup drill full court variety finishes basketball" → Pro Training Basketball
- **Why:** Full court at full speed with different finishes each trip. Should show euro step, floater, power on different reps.

### fn-21: Chair Finish Drill
- **Status:** SEARCH
- **Search:** YouTube → "chair big man lane finish basketball drill" → Breakthrough Basketball or Championship Productions
- **Why:** Chair as shot blocker in the lane. Need a video that uses multiple finishes (floater over, euro around, reverse past).

### fn-22: Defender Pad Finishes
- **Status:** SKIP (requires partner with blocking pad)

### fn-23: High Glass Finish
- **Status:** SEARCH
- **Search:** YouTube → "high glass backboard layup basketball finish small player" → ILoveBasketballTV
- **Why:** Aiming for top of square — less common tip. Verify the video shows aiming HIGH (not standard backboard spot).

### fn-24: Drop Step Finish
- **Status:** SEARCH
- **Search:** YouTube → "drop step basketball post move finish" → Breakthrough Basketball or Championship Productions
- **Why:** Classic post move — well-covered on basketball coaching channels. Needs baseline vs middle options.

### fn-25: Post Move Finish
- **Status:** SEARCH
- **Search:** YouTube → "complete post move package basketball drop step hook fadeaway" → Breakthrough Basketball
- **Why:** Full post package in one video — find one that covers at least 3 of the 4 moves (drop step, up-under, hook, fadeaway).

### fn-26: Weak Hand Finishing Series
- **Status:** SEARCH
- **Search:** YouTube → "weak hand finishing basketball workout all angles" → ILoveBasketballTV
- **Why:** Dedicated weak hand finishing from every angle. Similar to fn-4 but finishing-focused not just layups.

### fn-27: Mid-Range Touch Drill
- **Status:** SEARCH
- **Search:** YouTube → "mid range bank shot elbow basketball drill touch" → Pro Training Basketball or Breakthrough Basketball
- **Why:** Elbow bank shot with soft touch — very specific coaching point. The top-corner-of-square aim is key.

---

## Defense — 25 drills

### df-1: Defensive Slide Drill
- **Status:** SUGGEST
- **Video:** [Danny Manning Defensive Slide Drill](https://www.youtube.com/watch?v=Ny-_VnE513o)
- **Channel:** Championship Productions
- **Length:** ~4 min
- **Why:** Authoritative coaching source, covers stance and slide mechanics well.

### df-2: Closeout Drill
- **Status:** SEARCH
- **Search:** YouTube → "closeout drill basketball chop feet hand up" → Breakthrough Basketball
- **Why:** Sprint 80% + chop 20% + hand up without jumping — these three points separate a good closeout video from a bad one.

### df-3: Shell Drill
- **Status:** SKIP (requires 4 partners — team drill, no solo application)

### df-4: Mirror Drill
- **Status:** SKIP (requires partner)

### df-5: Zig-Zag Defensive Slides
- **Status:** SEARCH
- **Search:** YouTube → "zig zag defensive slides basketball full court" → Breakthrough Basketball
- **Why:** Defensive slides in a zigzag down the court — drop step direction changes, not crossing feet. Common drill; should find easily.

### df-6: Charge Drill
- **Status:** SKIP (requires partner — contact drill)

### df-7: Box Out Drill
- **Status:** SEARCH
- **Search:** YouTube → "box out drill basketball rebound position partner" → Breakthrough Basketball
- **Why:** Contact first → hold 2 seconds → then get the ball. Need a video that shows the sequence correctly (not just "stand in front").

### df-8: Rebound and Outlet Drill
- **Status:** SKIP (requires partner to shoot and receive outlet)

### df-9: 1 on 1 Full Court Defense
- **Status:** SKIP (requires partner)

### df-10: Deny the Wing Drill
- **Status:** SEARCH
- **Search:** YouTube → "deny the wing basketball defense drill one pass away" → Breakthrough Basketball
- **Why:** Hand in lane + see ball and man + backdoor recovery. Needs both the deny and the backdoor response.

### df-11: Help Side Defense Drill
- **Status:** SEARCH
- **Search:** YouTube → "help side defense drill basketball rotation" → Breakthrough Basketball
- **Why:** Drop to help position then recover — needs to show the correct body angle on recovery.

### df-12: Defensive Stance Holds
- **Status:** SEARCH
- **Search:** YouTube → "defensive stance hold basketball leg strength endurance" → any reputable basketball coaching channel
- **Why:** Static hold drill — simple concept, any clean demo works.

### df-13: Reaction Closeouts
- **Status:** SKIP (requires partner to call numbers)

### df-14: Ball Pressure Drill
- **Status:** SKIP (requires partner with ball)

### df-15: Trap Drill
- **Status:** SKIP (requires 2 partners)

### df-16: Recover Drill
- **Status:** SEARCH
- **Search:** YouTube → "defensive recovery basketball get beat recover angle" → Breakthrough Basketball
- **Why:** Sprint at angle to cut off driver (not chase from behind) — this is the key concept most videos miss.

### df-17: Defensive Shuffle Sprint Drill
- **Status:** SEARCH
- **Search:** YouTube → "defensive shuffle sprint transition drill basketball" → Breakthrough Basketball
- **Why:** Shuffle → sprint alternating. Tests transition between defensive movements. Should find a reasonable match.

### df-18: Loose Ball Dive Drill
- **Status:** SEARCH
- **Search:** YouTube → "dive loose ball basketball hustle drill" → any coaching channel
- **Why:** Slide on stomach, chin up, secure with both hands — not diving on knees. Simple demo needed.

### df-19: Contest Without Fouling Drill
- **Status:** SKIP (requires partner to shoot at)

### df-20: Foot Fire Drill
- **Status:** SEARCH
- **Search:** YouTube → "foot fire defensive basketball rapid feet drops" → any conditioning or basketball channel
- **Why:** Quick tiny steps in defensive stance + floor drops. Simple drill, any clean demo works.

### df-21: Lane Line Slides
- **Status:** SEARCH
- **Search:** YouTube → "lane line defensive slides basketball drill" → Breakthrough Basketball
- **Why:** Block to block defensive slides — simple, should find easily.

### df-22: Backpedal Sprint Drill
- **Status:** SEARCH
- **Search:** YouTube → "backpedal sprint hip turn basketball defense transition" → Breakthrough Basketball
- **Why:** Fast hip turn is the key coaching point — verify the video actually shows the quick pivot, not just backpedal jogging.

### df-23: Defensive Mirror Slides
- **Status:** SKIP (requires partner)

### df-24: Tip Drill
- **Status:** SEARCH
- **Search:** YouTube → "backboard tip drill basketball rebounding timing" → ILoveBasketballTV
- **Why:** Tip ball off glass repeatedly, both hands. Timing drill. Should find a decent match.

### df-25: Rebound War Drill
- **Status:** SKIP (requires partner — competitive rebounding battle)

---

## Speed & Agility — 25 drills

### sa-1: Ladder Quick Feet
- **Status:** SEARCH
- **Search:** YouTube → "agility ladder quick feet basketball one foot each square" → Pro Training Basketball
- **Why:** One foot per square, eyes up, arms pumping — find a video that emphasizes accuracy + speed, not just going through the motions.

### sa-2: Ladder In and Outs
- **Status:** SEARCH
- **Search:** YouTube → "agility ladder in and out lateral basketball" → Jordan Lawley or Pro Training Basketball
- **Why:** In-in-out lateral pattern — should be well-covered on any agility training channel.

### sa-3: Ladder Icky Shuffle
- **Status:** SUGGEST
- **Video:** [Basketball T Drill / Agility](https://www.youtube.com/watch?v=wUUHzZU1vf4)
- **Channel:** Unknown from agent data
- **Length:** ~3 min
- **Why:** Agent-confirmed URL. Verify this is actually the Icky Shuffle specifically (in-in-out pattern).

### sa-4: Cone Shuttle Drill
- **Status:** SEARCH
- **Search:** YouTube → "cone shuttle drill basketball deceleration change direction" → Pro Training Basketball
- **Why:** Plant-and-cut turns, not wide arcs. Find a video that emphasizes the deceleration phase.

### sa-5: 5-10-5 Shuttle Run
- **Status:** SEARCH
- **Search:** YouTube → "5-10-5 shuttle run basketball change of direction" → any basketball or football training channel
- **Why:** NFL combine standard — well-documented. Many channels cover it. Find one with proper basketball stance.

### sa-6: Suicide Runs
- **Status:** SEARCH
- **Search:** YouTube → "suicide runs basketball conditioning drill" → Pro Training Basketball
- **Why:** Classic drill — any clean demo works. Verify it shows touching each line.

### sa-7: Cone Zig-Zag Sprint
- **Status:** SEARCH
- **Search:** YouTube → "cone zig zag sprint basketball change direction drill" → Pro Training Basketball
- **Why:** Sharp cuts (not rounded), plant outside foot. Should find easily.

### sa-8: Defensive Slide Sprints
- **Status:** SEARCH
- **Search:** YouTube → "defensive slide sprint alternating basketball drill" → Breakthrough Basketball
- **Why:** Slide → sprint → slide transition. Overlap with df-17 — same drill essentially. Could share a video.

### sa-9: Backpedal Sprint Drill
- **Status:** GROUP with df-22 — same movement pattern
- **See df-22** — use the same video for both.

### sa-10: Lateral Cone Hops
- **Status:** SEARCH
- **Search:** YouTube → "lateral cone hops basketball explosive side to side" → Pro Training Basketball
- **Why:** Quick ground contact, balls of feet — find a video that shows minimal air time (not big jumps).

### sa-11: Single Leg Bounds
- **Status:** SEARCH
- **Search:** YouTube → "single leg bounds basketball plyometric" → any basketball strength channel
- **Why:** Stick the landing 1 second — this is the key differentiator. Find one that emphasizes controlled landing.

### sa-12: Broad Jumps
- **Status:** SEARCH
- **Search:** YouTube → "standing broad jump basketball explosive power" → any strength training channel
- **Why:** Triple extension + arm swing + soft landing. Simple to demo — any clean version works.

### sa-13: Sprint and Backpedal
- **Status:** GROUP with sa-9 / df-22 — same pattern
- **See df-22.**

### sa-14: Reaction Sprint Drill
- **Status:** SKIP (requires partner to clap/call signals)

### sa-15: T Drill
- **Status:** SEARCH
- **Search:** YouTube → "T drill basketball agility sprint shuffle backpedal" → Pro Training Basketball
- **Why:** Classic agility test — very well-covered. Find one with proper cone measurements (5 yards).

### sa-16: Box Drill
- **Status:** SEARCH
- **Search:** YouTube → "box drill basketball sprint shuffle backpedal agility" → Pro Training Basketball
- **Why:** All four movement planes in one drill. Should find a clean demo easily.

### sa-17: Line Hops
- **Status:** SEARCH
- **Search:** YouTube → "line hops basketball two feet side to side front back" → any basketball conditioning channel
- **Why:** Quick hops over a line, multiple patterns. Simple drill — any clear demo works.

### sa-18: Carioca Drill
- **Status:** SEARCH
- **Search:** YouTube → "carioca drill basketball lateral hip mobility" → any basketball or track channel
- **Why:** Grapevine crossover step — front and behind pattern. Covered by most sports conditioning channels.

### sa-19: Sprint Turn Sprint
- **Status:** SEARCH
- **Search:** YouTube → "sprint 180 turn sprint basketball deceleration drill" → Pro Training Basketball
- **Why:** Sharp plant-and-go turn (not wide loop). Deceleration in 2-3 steps is the key coaching point.

### sa-20: Resistance Band Sprints
- **Status:** SKIP (requires partner to hold band)

### sa-21: Partner Reaction Drill
- **Status:** SKIP (requires partner for visual signals)

### sa-22: Quick Drop Step Drill
- **Status:** SEARCH
- **Search:** YouTube → "drop step defensive slide basketball hip pivot" → Breakthrough Basketball
- **Why:** Swing foot wide to open hips — not crossing feet. Should overlap with defensive slide content.

### sa-23: Shuffle Sprint Shuffle
- **Status:** GROUP with sa-8 / df-17 — same pattern
- **See df-17.**

### sa-24: Jump Stop Sprint Drill
- **Status:** SEARCH
- **Search:** YouTube → "jump stop sprint basketball two feet balanced explosive" → Pro Training Basketball
- **Why:** Two-foot landing + instant sprint. Stop-and-go specific to basketball. Verify it shows simultaneous landing.

### sa-25: Acceleration Sprints
- **Status:** SEARCH
- **Search:** YouTube → "acceleration sprint first step basketball explosive" → Pro Training Basketball or Jordan Lawley
- **Why:** First 3 steps at 100% — find one with low body angle at the start (sprint mechanics).

---

## Warmup & Cooldown — 25 drills

**Note:** For most warmup/cooldown drills, one comprehensive warmup video covers multiple exercises. Grouping is noted below.

### GROUP A: wu-7 through wu-15, wu-19 (Dynamic Warmup)
- **Drills:** Hamstring Stretch, Quad Stretch, Calf Stretch, Groin Stretch, Ankle Mobility, Dynamic Toe Touch, Side Lunges, Jump Rope Warmup, Light Form Shooting Warmup, Static Stretch Cooldown
- **Status:** SUGGEST
- **Video:** [Dynamic Warmup and Stretches for Basketball Players](https://www.youtube.com/watch?v=wX9RmYxL2W8)
- **Length:** ~8 min
- **Why:** Agent-confirmed URL. Covers most dynamic stretches. Verify it includes the specific moves for the grouped drills. Some drills (wu-14 jump rope, wu-15 form shooting) are better as standalone — review if this grouping works.

### wu-1: High Knees
- **Status:** GROUP with wu-2 (butt kicks) — any basic dynamic warmup video covers both

### wu-2: Butt Kicks
- **Status:** GROUP with wu-1

### wu-3: Walking Lunges
- **Status:** SEARCH
- **Search:** YouTube → "walking lunges basketball warmup with torso twist" → any basketball warmup channel
- **Why:** The torso twist variation is the key addition. Find one that includes it.

### wu-4: Leg Swings
- **Status:** GROUP with wu-6 (Hip Openers) — both hip mobility
- **Search:** YouTube → "leg swings hip openers basketball mobility warmup"

### wu-5: Arm Circles
- **Status:** SEARCH
- **Search:** YouTube → "arm circles shoulder warmup basketball" → any basic warmup channel
- **Why:** Simple — any clean demo works.

### wu-6: Hip Openers
- **Status:** GROUP with wu-4

### wu-16: Jog and Backpedal
- **Status:** SEARCH
- **Search:** YouTube → "jog backpedal warmup basketball light" → any basketball training channel
- **Why:** Simple warmup drill — any demo that shows easy pace (not sprint) is fine.

### wu-17: Defensive Slides Warmup
- **Status:** SEARCH
- **Search:** YouTube → "defensive slides warmup basketball 50 percent light form"
- **Why:** Key distinction: this is NOT conditioning — 50% intensity, form only. Find a video that frames it as warmup prep.

### wu-18: Foam Rolling
- **Status:** SUGGEST
- **Video:** [How to Use a Foam Roller for Basketball](https://www.youtube.com/watch?v=aBOQHEKmcFk)
- **Channel:** Pro Training Basketball (or similar)
- **Length:** ~6 min
- **Why:** Quads, hamstrings, IT band, calves, back — verify it covers all 5 areas from the drill steps. Generic foam rolling videos work here.

### wu-20: Deep Breathing Cooldown
- **Status:** SEARCH
- **Search:** YouTube → "4-4-6 breathing cooldown athlete recovery basketball" → any sports recovery channel
- **Why:** Box breathing / 4-count in, 4-hold, 6-out pattern. Used by elite athletes post-game. Simple demo.

### wu-21: Mobility Flow
- **Status:** SEARCH
- **Search:** YouTube → "mobility flow basketball plank updog downdog standing sequence" → any mobility channel
- **Why:** Reach → fold → plank → up-dog → down-dog → standing flow. Yoga-adjacent — should find easily.

### wu-22: Frankenstein Walk
- **Status:** GROUP with wu-12 (Dynamic Toe Touch) — same hamstring warmup pattern

### wu-23: Heel Walk
- **Status:** GROUP with wu-24 (Toe Walk)
- **Search:** YouTube → "heel walk toe walk basketball shin ankle warmup"
- **Why:** Both in one demo is ideal — few channels cover these specifically but any athletic training channel should have it.

### wu-24: Toe Walk
- **Status:** GROUP with wu-23

### wu-25: Light Layup Warmup
- **Status:** SEARCH
- **Search:** YouTube → "light layup warmup basketball easy form warmup routine"
- **Why:** This is really just a warmup layup line — any "warmup routine" video that includes layup lines works.

---

## Conditioning — 25 drills

### cd-1: Suicides
- **Status:** SEARCH
- **Search:** YouTube → "suicide runs basketball conditioning touch lines" → Pro Training Basketball
- **Why:** Touch each line, sharp turns — classic drill. Any clean demo works.

### cd-2: 17s
- **Status:** SEARCH
- **Search:** YouTube → "17s basketball conditioning drill sideline to sideline" → Pro Training Basketball or college basketball conditioning channel
- **Why:** 17 reps sideline to sideline, under 60s for guards — well-documented college standard. Should find easily.

### cd-3: Full Court Layups Conditioning
- **Status:** SEARCH
- **Search:** YouTube → "full court layup conditioning drill basketball 2 minute" → Pro Training Basketball
- **Why:** Sprint full court + make layup + sprint back — needs to emphasize MAKING the shot, not just running.

### cd-4: Lane Line Sprints
- **Status:** SEARCH
- **Search:** YouTube → "lane line sprints basketball conditioning block to block" → any basketball channel
- **Why:** 15 quick trips block to block — explosive short sprints. Simple drill.

### cd-5: Baseline Touches
- **Status:** SEARCH
- **Search:** YouTube → "baseline touches conditioning basketball half court sprint" → any conditioning channel
- **Why:** Half court to each baseline. Simple sprint conditioning.

### cd-6: Continuous Fast Break Drill
- **Status:** SEARCH
- **Search:** YouTube → "continuous fast break drill basketball 2 minutes nonstop" → Pro Training Basketball
- **Why:** Non-stop full court for 2 minutes — needs to show the ball-in-hand to outlet to full court sequence.

### cd-7: 3 Minute Shooting Conditioning
- **Status:** SEARCH
- **Search:** YouTube → "3 minute shooting game basketball sprint to spots" → ILoveBasketballTV
- **Why:** Sprint to spot, catch, shoot, sprint to next — conditioning + shooting combined. Track makes.

### cd-8: Rebound and Putback Drill
- **Status:** GROUP with fn-19 (Putback Finishes) — same concept
- **See fn-19** — or use a dedicated conditioning version:
- **Search:** YouTube → "rebound putback conditioning drill basketball 1 minute"

### cd-9: Sprint Free Throw Drill
- **Status:** SEARCH
- **Search:** YouTube → "sprint free throw drill basketball conditioning pressure" → Pro Training Basketball
- **Why:** Sprint full court + shoot 2 free throws + sprint again. Should find easily — common drill.

### cd-10: Closeout Conditioning Drill
- **Status:** SEARCH
- **Search:** YouTube → "closeout conditioning basketball 4 cones sprint back" → Breakthrough Basketball
- **Why:** 4-cone closeout circuit, sprint back to rim each time. Defensive conditioning drill.

### cd-11: Defensive Slide Conditioning
- **Status:** SEARCH
- **Search:** YouTube → "defensive slide conditioning basketball sideline sprint" → Breakthrough Basketball or Pro Training Basketball
- **Why:** Slides to sprints without rest. Find one that shows the no-standing-up rule under fatigue.

### cd-12: Jump Rope Conditioning
- **Status:** SEARCH
- **Search:** YouTube → "jump rope conditioning basketball interval fast alternating" → Pro Training Basketball
- **Why:** 30s fast / 15s rest intervals with different foot patterns. Generic jump rope conditioning videos work here.

### cd-13: Hill Sprints
- **Status:** SEARCH
- **Search:** YouTube → "hill sprints basketball conditioning explosive" → any performance training channel
- **Why:** Drive knees high, lean forward, walk back for recovery. Basic sprint mechanics on an incline.

### cd-14: Bleacher Runs
- **Status:** SEARCH
- **Search:** YouTube → "bleacher runs stadium stairs basketball conditioning" → any basketball or general conditioning channel
- **Why:** Every step then every other step — needs to show the alternating approach for both power and conditioning benefit.

### cd-15: Medicine Ball Slams
- **Status:** SEARCH
- **Search:** YouTube → "medicine ball slam basketball conditioning full body" → any strength/conditioning channel
- **Why:** Full body extension overhead + explosive slam + squat pickup. Standard gym drill — well-covered.

### cd-16: Burpee Sprints
- **Status:** SEARCH
- **Search:** YouTube → "burpee sprint basketball conditioning drill" → Pro Training Basketball
- **Why:** 3 burpees + sprint to next line, repeat. Full burpee (chest down) required. Brutal conditioning drill.

### cd-17: Shuttle Runs
- **Status:** SEARCH
- **Search:** YouTube → "shuttle run conditioning basketball 25 feet sprint" → Pro Training Basketball
- **Why:** 25 feet back and forth, 10 reps. Basic interval conditioning — any clear demo works.

### cd-18: Sprint Jog Intervals
- **Status:** SEARCH
- **Search:** YouTube → "sprint jog intervals basketball court conditioning" → Pro Training Basketball
- **Why:** Sprint half, jog half — no walking on the jog. Simulates real game energy demands.

### cd-19: Full Court Dribble Sprints
- **Status:** SEARCH
- **Search:** YouTube → "full court dribble sprint conditioning basketball handles" → ILoveBasketballTV or Pro Training Basketball
- **Why:** Full speed + different ball handling moves at each line. Both conditioning and skill combined.

### cd-20: Reaction Sprint Conditioning
- **Status:** SKIP (requires partner to call directions)

### cd-21: Cone Touch Conditioning
- **Status:** SEARCH
- **Search:** YouTube → "cone touch conditioning basketball random 5 cones sprint" → Pro Training Basketball
- **Why:** Random cone pattern, sharp cuts to each. Should find easily.

### cd-22: Push Up Sprints
- **Status:** GROUP (cd-22, cd-23, cd-24)
- **Status:** SUGGEST
- **Video:** [Full Basketball Conditioning Workout](https://www.youtube.com/watch?v=QckEJVgP1JM)
- **Channel:** Unknown from agent data
- **Length:** ~12 min
- **Why:** Agent-confirmed URL covering all three: Push Up Sprints, Plank, Wall Sit. Verify it shows all three drills.

### cd-23: Plank Conditioning
- **Status:** GROUP with cd-22 — see above

### cd-24: Wall Sit Conditioning
- **Status:** GROUP with cd-22 — see above

### cd-25: Continuous Mikan Drill
- **Status:** GROUP with fn-1 (Mikan Drill) — same drill, conditioning rep count
- **See fn-1.**

---

## Basketball IQ — 28 drills

### iq-1: Read and React Drill
- **Status:** SEARCH
- **Search:** YouTube → "read and react basketball drill cones defense decision" → Breakthrough Basketball or BBallBreakdown
- **Why:** Cones as defenders + 3 options (shoot/drive/pass). Find one that explicitly shows reading defensive position before deciding.

### iq-2: Advantage Disadvantage Drill
- **Status:** SUGGEST
- **Video:** [Pick & Roll Decision Making](https://www.youtube.com/watch?v=tbcDD8bUZ-E)
- **Channel:** Unknown from agent data
- **Length:** ~5 min
- **Why:** Agent-confirmed URL. Verify it actually covers the 3v2/advantage-disadvantage concept and not just pick-and-roll.

### iq-3: Pick and Roll Read Drill
- **Status:** SEARCH
- **Search:** YouTube → "pick and roll reads basketball over under hedge drop" → BBallBreakdown or Coach Nick
- **Why:** Four reads (over/under/hedge/drop) is the key — find a video that walks through all four coverage options.

### iq-4: Drive and Kick Drill
- **Status:** SEARCH
- **Search:** YouTube → "drive and kick basketball drill 3 players" → Breakthrough Basketball
- **Why:** Drive to draw help → kick to corner shooter. Needs the head-up-while-driving coaching point.

### iq-5: Help Defense Rotation Drill
- **Status:** SKIP (requires 4 partners)

### iq-6: Transition Decision Drill
- **Status:** SEARCH
- **Search:** YouTube → "transition offense decision 3v2 2v1 basketball drill" → Breakthrough Basketball
- **Why:** Read the numbers — find a video that explicitly teaches different decisions for each situation.

### iq-7: Shot Selection Drill
- **Status:** SEARCH
- **Search:** YouTube → "shot selection basketball good vs bad shot decision" → Breakthrough Basketball or BBallBreakdown
- **Why:** Key point: what makes a shot GOOD (open, in rhythm, in range, in your spot). Find one that uses real game examples.

### iq-8: Clock Management Drill
- **Status:** SEARCH
- **Search:** YouTube → "clock management basketball end of game situations drill" → Breakthrough Basketball
- **Why:** Down 2 vs down 3, final possession decisions. Scenario-based — find a video that walks through specific situations.

### iq-9: Situational Scrimmage
- **Status:** SKIP (requires partners)

### iq-10: 3 on 2 Continuous
- **Status:** SKIP (requires 4+ partners)

### iq-11: 4 on 3 Advantage Drill
- **Status:** SKIP (requires 6+ partners)

### iq-12: No Dribble Scrimmage
- **Status:** SKIP (requires partners)

### iq-13: One Dribble Scrimmage
- **Status:** SKIP (requires partners)

### iq-14: Spacing Drill
- **Status:** SEARCH
- **Search:** YouTube → "basketball spacing drill 5 spots 12 15 feet apart" → Breakthrough Basketball or BBallBreakdown
- **Why:** 12-15 feet between every player — find a video that makes spacing tangible, not just abstract.

### iq-15: Backdoor Cut Drill
- **Status:** SEARCH
- **Search:** YouTube → "backdoor cut drill basketball wing setup timing" → Breakthrough Basketball
- **Why:** Setup (walk toward ball) + explosive cut + bounce pass timing. Find one that shows both the setup AND the cut together.

### iq-16: Give and Go Drill
- **Status:** SEARCH
- **Search:** YouTube → "give and go drill basketball pass and cut immediately" → Breakthrough Basketball
- **Why:** Pass and immediately cut hard — "pass and stand" is the most common mistake. Find a video that emphasizes the immediate cut.

### iq-17: Closeout Decision Drill
- **Status:** SKIP (requires partner to close out at varying speeds)

### iq-18: Extra Pass Drill
- **Status:** SKIP (requires 2 partners)

### iq-19: Skip Pass Drill
- **Status:** SKIP (requires 2 partners)

### iq-20: Offensive Rebound Decision Drill
- **Status:** SKIP (requires partner to shoot)

### iq-21: End of Game Situations
- **Status:** SUGGEST
- **Video:** [How To Watch Game Film Like A Pro](https://www.youtube.com/watch?v=2TV0HaKbqfY)
- **Channel:** Unknown from agent data
- **Length:** ~8 min
- **Note:** Agent originally found this for iq-25 (Film Study Session), not iq-21. For iq-21 (end-of-game situations specifically):
- **Better search:** YouTube → "end of game basketball situations down 1 down 3 clock management" → Breakthrough Basketball
- **Why:** The Film Study video may be more appropriate for iq-25. Verify which drill this URL actually fits.

### iq-22: Press Break Drill
- **Status:** SEARCH
- **Search:** YouTube → "press break basketball inbound middle of floor" → Breakthrough Basketball
- **Why:** Use the middle, don't panic, pass over the press — needs a video that covers the geometry and decision tree.

### iq-23: Zone Offense Drill
- **Status:** SEARCH
- **Search:** YouTube → "zone offense basketball 2-3 zone attack gaps high post" → Breakthrough Basketball
- **Why:** Ball movement + attack the gaps (high post, short corner) — find one that shows the specific vulnerabilities of a 2-3 zone.

### iq-24: Defensive Communication Drill
- **Status:** SKIP (requires 5+ partners)

### iq-25: Film Study Session
- **Status:** SUGGEST
- **Video:** [How To Watch Game Film Like A Pro](https://www.youtube.com/watch?v=2TV0HaKbqfY)
- **Channel:** Unknown from agent data
- **Length:** ~8 min
- **Why:** Agent-confirmed URL. Teaching how to watch film with purpose — 3 takeaways per session.

### iq-26: Head Up Dribble Drill
- **Status:** SEARCH
- **Search:** YouTube → "head up dribble basketball partner hand signals vision" → ILoveBasketballTV
- **Why:** Partner holds up fingers, player calls them out while dribbling. Need a video that specifically uses the partner signal format (not just "eyes up" coaching).

### iq-27: Scan and Pass Drill
- **Status:** SKIP (requires 3 partners)

### iq-28: Peripheral Vision Drill
- **Status:** SKIP (requires 2 partners for the visual setup)

---

## Summary

| Category | Total | IN CODE | SUGGEST | SEARCH | SKIP/GROUP |
|----------|-------|---------|---------|--------|------------|
| Ball Handling | 21 | 21 | 0 | 0 | 0 |
| Shooting | 28 | 1 | 2 | 22 | 3 |
| Finishing | 27 | 0 | 1 | 20 | 6 |
| Defense | 25 | 0 | 1 | 12 | 12 |
| Speed & Agility | 25 | 0 | 1 | 15 | 9 |
| Warmup & Cooldown | 25 | 0 | 2 | 14 | 9 |
| Conditioning | 25 | 0 | 3 | 18 | 4 |
| Basketball IQ | 28 | 0 | 3 | 10 | 15 |
| **Total** | **204** | **22** | **13** | **111** | **58** |

**Quick action items:**
1. Verify all 22 IN CODE videos (Ball Handling + sh-1) — they were added without review
2. Watch the 13 SUGGEST videos — agent-confirmed or channel-confident picks
3. For 111 SEARCH entries: search YouTube using the query provided, pick a long-form video (no `/shorts/`), add the ID to drillLibrary.ts after watching
4. 58 SKIP/GROUP entries need no individual video — either partner-required or covered by a group video
