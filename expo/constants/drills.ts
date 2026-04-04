export interface Drill {
  id: string;
  name: string;
  category: string;
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  type: 'warmup' | 'skill' | 'shooting' | 'conditioning';
  summary: string;
  steps: string[];
  coachingPoints: string[];
  commonMistakes: string[];
  variations?: string[];
  videoUrl?: string;
}

export interface DrillCategory {
  name: string;
  color: string;
  description: string;
  drills: Drill[];
}

const BALL_HANDLING_DRILLS: Drill[] = [
  {
    id: 'bh-1', name: 'Stationary Pound Dribbles', category: 'Ball Handling', duration: 5, difficulty: 'beginner', equipment: ['ball', 'flat surface'], type: 'skill',
    summary: 'Build hand strength and control with hard, low dribbles in a stationary position.',
    steps: ['Stand in an athletic stance — feet shoulder width, knees bent, chest up.', 'Dribble hard with your right hand at knee height for 30 seconds.', 'Switch to left hand for 30 seconds.', 'Alternate: 10 right, 10 left, getting faster each set.', 'Do 3 total rounds.'],
    coachingPoints: ['Keep your eyes up — never look at the ball.', 'Dribble hard enough to hear the ball slap the ground.', 'Keep your off hand up like you\'re protecting the ball.', 'Stay low — maintain your athletic stance.'],
    commonMistakes: ['Dribbling too high — keep it at knee level or below.', 'Standing straight up — stay in your athletic stance.', 'Watching the ball — look at a spot on the wall.'],
    variations: ['Close your eyes for 10 seconds at a time.', 'Do it while walking in place.'],
  },
  {
    id: 'bh-2', name: 'Crossover Combo Series', category: 'Ball Handling', duration: 8, difficulty: 'intermediate', equipment: ['ball', 'flat surface'], type: 'skill',
    summary: 'Chain together crossover, between-the-legs, and behind-the-back moves in sequence.',
    steps: ['Start in an athletic stance with the ball in your right hand.', 'Crossover to your left hand. Pause.', 'Between the legs from left to right. Pause.', 'Behind the back from right to left. Pause.', 'Now do all three in a continuous flow.', 'Repeat starting from the left hand.', 'Do 5 reps each direction, then speed it up for 30 seconds nonstop.'],
    coachingPoints: ['Start slow. Speed comes from clean technique.', 'Each move should change your dribble angle.', 'Keep the ball below your waist.', 'Your feet should react to each move.'],
    commonMistakes: ['Going too fast before the moves are clean.', 'Standing upright — stay low.', 'Carrying the ball during behind-the-back.'],
    variations: ['Add a jab step before each combo.', 'Do it while walking forward, then jogging.', 'Add a finishing move at the end.'],
  },
  {
    id: 'bh-3', name: 'Full Court Attack Dribbles', category: 'Ball Handling', duration: 10, difficulty: 'intermediate', equipment: ['ball', 'full court'], type: 'skill',
    summary: 'Push the ball full court with different moves at game speed.',
    steps: ['Start on the baseline.', 'Sprint dribble to half court with right hand only.', 'At half court, crossover and finish with left hand.', 'Come back: hesitation dribble at the free throw line, then explode.', 'Come back: in-and-out move at half court.', 'Come back: between-the-legs at half court, change direction.', 'Do 5 full trips with different moves.'],
    coachingPoints: ['Push the ball out in front on the sprint.', 'Real speed change before you explode.', 'Stay low when you make your move, get tall and sprint after.', 'Finish each rep at full speed.'],
    commonMistakes: ['Slowing down when tired.', 'Not pushing the ball far enough ahead.', 'Half-hearted change of direction.'],
  },
  {
    id: 'bh-4', name: 'Pressure Handling Drill', category: 'Ball Handling', duration: 8, difficulty: 'advanced', equipment: ['ball', 'cones'], type: 'skill',
    summary: 'Dribble through tight spaces with cones simulating defenders.',
    steps: ['Set up 5-6 cones in a zigzag pattern, about 5 feet apart.', 'Dribble through using a different move at each cone.', 'Stay low and tight. Ball never above your knee.', 'After the last cone, explode to the basket or pull up.', 'Go through 5 times, then move cones closer (3 feet) and do 5 more.'],
    coachingPoints: ['Each cone is a defender — treat it like one.', 'Your body should shift direction, not just the ball.', 'Keep your head up.', 'The tighter the cones, the lower you need to be.'],
    commonMistakes: ['Going around cones instead of attacking them.', 'Losing your dribble in tight spacing.', 'Not finishing with a game move after the last cone.'],
  },
  {
    id: 'bh-5', name: 'Tennis Ball Dribbling', category: 'Ball Handling', duration: 5, difficulty: 'advanced', equipment: ['basketball', 'tennis ball'], type: 'skill',
    summary: 'Dribble a basketball while catching a tennis ball to train hand-eye coordination.',
    steps: ['Hold tennis ball in left hand, basketball in right.', 'Start dribbling. Toss tennis ball up 2 feet and catch it.', 'Every catch, make a dribble move.', 'Switch hands. Repeat.', 'Do 1 minute per hand, 3 rounds.'],
    coachingPoints: ['Don\'t look at the basketball — track the tennis ball.', 'This forces you to dribble by feel.', 'Start with easy tosses, build up.', 'Stay in your athletic stance.'],
    commonMistakes: ['Looking at the basketball.', 'Standing up straight.', 'Tossing the tennis ball too high too early.'],
  },
  {
    id: 'bh-6', name: 'Spider Dribble', category: 'Ball Handling', duration: 3, difficulty: 'beginner', equipment: ['ball'], type: 'skill',
    summary: 'Rapid alternating dribbles between your legs to build hand speed.',
    steps: ['Stand with feet wide, bent over.', 'Dribble between your legs: right front, left front, right back, left back.', 'That\'s one rep. Start slow to get the pattern.', 'Speed up as much as you can.', 'Do 30 seconds on, 15 seconds rest, 4 rounds.'],
    coachingPoints: ['Keep the ball low — barely bouncing.', 'Fingers spread wide, use fingertips.', 'Rhythm matters more than speed at first.'],
    commonMistakes: ['Dribbling too high.', 'Losing the pattern — slow down and reset.'],
  },
  {
    id: 'bh-7', name: 'Two Ball Dribbling', category: 'Ball Handling', duration: 8, difficulty: 'advanced', equipment: ['2 basketballs'], type: 'skill',
    summary: 'Dribble two balls simultaneously to force both hands to work equally.',
    steps: ['Start with both balls, one in each hand.', 'Dribble both at the same time (together) for 30 seconds.', 'Dribble alternating (one up while one down) for 30 seconds.', 'Cross both balls over at the same time for 30 seconds.', 'Walk forward dribbling both balls to half court and back.', 'Do 3 rounds of the full sequence.'],
    coachingPoints: ['Start with the "together" rhythm — it\'s the easiest.', 'Your weak hand will struggle — that\'s the point.', 'Stay low and keep both balls below your waist.', 'Eyes up. This drill is useless if you\'re staring at the balls.'],
    commonMistakes: ['Letting one ball die while focusing on the other.', 'Standing straight up.', 'Only going at one speed — vary your pace.'],
  },
  {
    id: 'bh-8', name: 'Retreat Dribble', category: 'Ball Handling', duration: 5, difficulty: 'intermediate', equipment: ['ball', 'court'], type: 'skill',
    summary: 'Practice pulling back from pressure to reset the play — essential for point guards.',
    steps: ['Start at half court, dribble toward the free throw line like you\'re attacking.', 'At the free throw line, pull back hard — retreat dribble back 3-4 steps.', 'Immediately attack again with a go-to move.', 'Repeat: attack, retreat, re-attack.', 'Do 10 reps, alternating which hand you retreat with.'],
    coachingPoints: ['The retreat dribble should be explosive — snap back hard.', 'Keep the ball low and protected during the retreat.', 'As soon as you retreat, read the defense and attack.', 'This is not running backward — it\'s a quick, controlled pullback.'],
    commonMistakes: ['Retreating too slowly — a real defender would steal it.', 'Turning your back to the defense during the retreat.', 'Not attacking after the retreat — the retreat creates space, use it.'],
  },
  {
    id: 'bh-9', name: 'Dribble Tag', category: 'Ball Handling', duration: 10, difficulty: 'beginner', equipment: ['ball', 'half court', 'partner'], type: 'skill',
    summary: 'Fun competitive drill — dribble while trying to knock your partner\'s ball away.',
    steps: ['Both players start with a ball in a half court area.', 'Both dribble with one hand. With the other hand, try to knock the opponent\'s ball away.', 'If your ball gets knocked away, that\'s a point for them.', 'Stay in the half court boundary. Out of bounds = a point against you.', 'Play to 5 points, then switch dribbling hands.'],
    coachingPoints: ['Keep your body between your ball and the opponent.', 'Use your off arm to shield — just like in a game.', 'Stay low — the lower you are, the harder it is to knock your ball away.', 'This builds real game awareness while dribbling.'],
    commonMistakes: ['Standing up straight — you\'re an easy target.', 'Watching the opponent instead of feeling the ball.', 'Leaving the court boundaries — play within the space.'],
  },
  {
    id: 'bh-10', name: 'Cone Weave Dribbling', category: 'Ball Handling', duration: 8, difficulty: 'beginner', equipment: ['ball', 'cones'], type: 'skill',
    summary: 'Weave through cones in a straight line to build control at speed.',
    steps: ['Set up 8-10 cones in a straight line, 4 feet apart.', 'Dribble through weaving right and left around each cone.', 'Use only your right hand going through once.', 'Use only your left hand going back.', 'Then go through using crossovers at each cone.', 'Then between-the-legs at each cone.', 'Do each variation 3 times, increasing speed.'],
    coachingPoints: ['Stay tight to the cones — don\'t drift wide.', 'Push the ball out in front, not to the side.', 'Keep your head up. Pretend the cones are defenders.', 'Speed comes after control. Be smooth first.'],
    commonMistakes: ['Drifting too far from the cones.', 'Using the same move at every cone — vary your moves.', 'Going too fast and losing control.'],
  },
  {
    id: 'bh-11', name: 'Kill Dribble Into Move', category: 'Ball Handling', duration: 6, difficulty: 'intermediate', equipment: ['ball'], type: 'skill',
    summary: 'Practice stopping your dribble hard and immediately making a play — pass, shoot, or drive.',
    steps: ['Dribble at half speed toward the free throw line.', 'At the line, kill your dribble — stop it dead with both hands.', 'Immediately go into a triple threat position.', 'From triple threat: jab and shoot, jab and drive, or jab and pass.', 'Do 5 reps of each option (15 total).', 'Repeat from the wing and the top of the key.'],
    coachingPoints: ['The kill should be sudden — no gradual slowdown.', 'Chin the ball in triple threat — protect it.', 'Make your jab step convincing every time.', 'In a game, you only get one chance after killing your dribble.'],
    commonMistakes: ['Picking up the ball too early — wait until you\'re in a scoring position.', 'Weak jab step that doesn\'t threaten.', 'Standing up after killing the dribble — stay in a power position.'],
  },
];

const SHOOTING_DRILLS: Drill[] = [
  {
    id: 'sh-1', name: 'Form Shooting', category: 'Shooting', duration: 5, difficulty: 'beginner', equipment: ['ball', 'hoop'], type: 'shooting',
    summary: 'Perfect your shooting mechanics from close range.',
    steps: ['Stand 3-4 feet from the basket.', 'Shoot with one hand only. Guide hand stays off.', 'Focus on: elbow under ball, wrist snap, follow through.', 'Make 10 in a row before moving back to 5 feet.', 'Make 10 from 5 feet, then 8 feet.', 'If you miss two in a row, move closer.'],
    coachingPoints: ['Elbow directly under the ball, forming an L.', 'Snap your wrist like reaching into a cookie jar on a high shelf.', 'Hold your follow through until the ball hits the rim.', 'Ball should have backspin — if not, your wrist isn\'t snapping.'],
    commonMistakes: ['Elbow flaring out.', 'Flat release with no arc.', 'Rushing through reps.', 'Using two hands — guide hand should just sit there.'],
    variations: ['Close your eyes on the release.', 'Use a smaller ball to challenge your touch.'],
  },
  {
    id: 'sh-2', name: '5-Spot Shooting', category: 'Shooting', duration: 12, difficulty: 'intermediate', equipment: ['ball', 'hoop'], type: 'shooting',
    summary: 'Catch-and-shoot from five spots around the arc.',
    steps: ['Set up at 5 spots: right corner, right wing, top of key, left wing, left corner.', 'Make 10 shots before moving to the next spot.', 'At each spot: feet set, knees bent, shoot in rhythm.', 'Track your makes out of total attempts.', 'After all 5 spots, shoot 20 more from your worst spot.'],
    coachingPoints: ['Feet should be set BEFORE you catch the ball.', 'Knees provide your power. Bend them on every shot.', 'Same release point, same follow through, every time.', 'Short = more legs, left/right = check elbow alignment.'],
    commonMistakes: ['Fading away — jump straight up.', 'Not bending knees enough.', 'Changing form between spots.'],
    variations: ['Add a time limit: 10 makes in 60 seconds per spot.', 'Shoot off one dribble instead of catch-and-shoot.'],
  },
  {
    id: 'sh-3', name: 'Off-Dribble Pull-Ups', category: 'Shooting', duration: 10, difficulty: 'intermediate', equipment: ['ball', 'hoop'], type: 'shooting',
    summary: 'Practice the mid-range pull-up jumper off one dribble.',
    steps: ['Start at the wing, triple threat.', 'Jab right, one hard dribble left, pull up.', 'Do 10 reps going left.', 'Switch: jab left, one dribble right, pull up. 10 reps.', 'Move to the top of the key and repeat.', 'Move to the elbow and repeat.'],
    coachingPoints: ['Plant your feet hard and get balanced before shooting.', 'One dribble only. One hard dribble and pull up.', 'Last dribble should be hard and slightly in front.', 'Jump straight up — don\'t drift.'],
    commonMistakes: ['Drifting on the shot.', 'Taking too many dribbles.', 'Not selling the jab step.'],
  },
  {
    id: 'sh-4', name: 'Free Throws Under Fatigue', category: 'Shooting', duration: 5, difficulty: 'beginner', equipment: ['ball', 'hoop'], type: 'shooting',
    summary: 'Practice free throws when tired — just like in a real game.',
    steps: ['Sprint baseline to baseline.', 'Step to the free throw line.', 'Take 3 deep breaths. Go through your routine.', 'Shoot 2 free throws.', 'Sprint again. Shoot 2 more.', 'Repeat 5 times for 10 total. Track your makes.'],
    coachingPoints: ['Your routine is sacred — do it the same way every time.', 'Deep breaths are the key. Slow your heart rate.', 'Don\'t change form because you\'re tired.', 'Goal: 7/10 or better while fatigued.'],
    commonMistakes: ['Rushing the free throw.', 'Shortening your shot because legs are tired.', 'Skipping your routine.'],
  },
  {
    id: 'sh-5', name: 'Catch & Shoot Off Screens', category: 'Shooting', duration: 10, difficulty: 'advanced', equipment: ['ball', 'hoop', 'cone'], type: 'shooting',
    summary: 'Simulate coming off a screen, catching, and shooting with a quick release.',
    steps: ['Place a cone at the elbow to simulate a screen.', 'Start on the block. Sprint and curl around the screen.', 'Catch and shoot immediately.', 'Feet should be set as you come around — not after.', '15 reps curling right, 15 curling left.', '15 fading away from screen each direction.'],
    coachingPoints: ['Rub shoulders with the screen.', 'Hands ready and target shown before the catch.', 'Quick release — catch, one-two step, shoot.', 'Read: curl if defender goes over, fade if they go under.'],
    commonMistakes: ['Running too wide around the screen.', 'Catching with feet not set.', 'Slow release.'],
  },
  {
    id: 'sh-6', name: 'Shot Fake Into One Dribble', category: 'Shooting', duration: 8, difficulty: 'intermediate', equipment: ['ball', 'hoop'], type: 'shooting',
    summary: 'Use a shot fake to get the defender in the air, then attack for one dribble and score.',
    steps: ['Start on the wing in triple threat.', 'Show a convincing shot fake — ball above your forehead, eyes on the rim.', 'When the defender jumps, take one hard dribble past them.', 'Finish with a pull-up jumper or layup depending on distance.', 'Do 10 from each wing and 10 from the top of the key.'],
    coachingPoints: ['The shot fake has to be real — if you wouldn\'t believe it, the defender won\'t either.', 'Eyes on the rim during the fake — that sells it.', 'After the fake, attack the defender\'s hip. Go past them, not into them.', 'One dribble only — don\'t give them time to recover.'],
    commonMistakes: ['Lazy shot fake — ball stays at your chest. Get it up.', 'Picking up the ball during the fake — keep your dribble alive until you need it.', 'Two or three dribbles after the fake — one is enough.'],
  },
  {
    id: 'sh-7', name: 'Three Point Contest', category: 'Shooting', duration: 8, difficulty: 'intermediate', equipment: ['ball', 'hoop'], type: 'shooting',
    summary: 'Replicate the NBA three-point contest format to build range and pressure shooting.',
    steps: ['Set up at 5 racks: both corners, both wings, top of key.', 'Shoot 5 balls from each spot. That\'s 25 total shots.', 'Score 1 point per make. Track your score.', 'Rest 1 minute. Do it again and try to beat your score.', 'Do 3 total rounds.'],
    coachingPoints: ['Move quickly between spots — simulate the real contest.', 'Don\'t overthink — catch it, set your feet, let it fly.', 'Your arc should be high on threes. Aim for the back of the rim.', 'Track your scores over weeks to see improvement.'],
    commonMistakes: ['Rushing so much you lose your form.', 'Flat shots from three — get more arc.', 'Not tracking your scores — data shows improvement.'],
  },
  {
    id: 'sh-8', name: 'Elbow Shooting', category: 'Shooting', duration: 6, difficulty: 'beginner', equipment: ['ball', 'hoop'], type: 'shooting',
    summary: 'The elbow is the most efficient shot in basketball. Build money from the mid-range.',
    steps: ['Start at the right elbow (where the free throw line meets the lane).', 'Shoot 15 mid-range jumpers from the right elbow.', 'Move to the left elbow. Shoot 15 more.', 'Alternate elbows: 2 from right, 2 from left, for 20 more total.', 'Track your percentage from each side.'],
    coachingPoints: ['The elbow is a high percentage shot — own it.', 'Square your feet to the basket from the elbow.', 'This should be the most consistent shot in your game.', 'Use the backboard from the elbows — it\'s your friend.'],
    commonMistakes: ['Fading away from mid-range — jump straight up.', 'Not squaring up — your feet should point at the basket.'],
  },
  {
    id: 'sh-9', name: 'Step-Back Jumper', category: 'Shooting', duration: 8, difficulty: 'advanced', equipment: ['ball', 'hoop'], type: 'shooting',
    summary: 'Create separation with a step-back and shoot from mid-range or three.',
    steps: ['Start at the top of the key with the ball.', 'Take two dribbles toward the basket.', 'Plant your lead foot hard and step back behind the three point line.', 'Catch your balance and shoot.', 'Do 10 reps stepping back to the right.', '10 reps stepping back to the left.', 'Then 10 reps straight back.'],
    coachingPoints: ['The step-back is about creating space — make it a real backward hop.', 'Land on both feet at the same time for balance.', 'Your shoulders should be square to the basket when you land.', 'Don\'t rush the shot — the step-back already created your space.'],
    commonMistakes: ['Not stepping back far enough — you need real separation.', 'Landing off-balance and fading sideways.', 'Traveling — the gather has to be clean.'],
  },
  {
    id: 'sh-10', name: 'Transition Threes', category: 'Shooting', duration: 8, difficulty: 'intermediate', equipment: ['ball', 'hoop', 'full court'], type: 'shooting',
    summary: 'Simulate catching and shooting in transition — spotting up while your team pushes the ball.',
    steps: ['Start at the opposite baseline.', 'Sprint to the right corner on the other end.', 'Catch an imaginary pass, set your feet, and shoot a three.', 'Sprint back, then sprint to the left corner. Shoot.', 'Sprint back, then sprint to the right wing. Shoot.', 'Continue to left wing, then top of key.', 'That\'s 5 shots. Do 4 rounds (20 shots total). Track makes.'],
    coachingPoints: ['Transition threes are about getting your feet set FAST.', 'Call for the ball as you\'re running — hands ready before you stop.', 'Your last two steps should set your feet in shooting position.', 'No wasted motion — catch and shoot in one rhythm.'],
    commonMistakes: ['Jogging to the spot — sprint like it\'s a real fast break.', 'Catching the ball and then getting your feet set — too slow.', 'Shooting while still moving — stop completely first.'],
  },
];

const FINISHING_DRILLS: Drill[] = [
  {
    id: 'fn-1', name: 'Mikan Drill', category: 'Finishing', duration: 5, difficulty: 'beginner', equipment: ['ball', 'hoop'], type: 'skill',
    summary: 'Continuous layups from both sides to build touch around the rim.',
    steps: ['Start on the right side, close to the rim.', 'Right hand layup off the backboard.', 'Catch it, one step to the left side.', 'Left hand layup off the backboard.', 'Continue alternating without the ball touching the ground.', 'Do 30 consecutive makes. If you miss, restart.'],
    coachingPoints: ['Keep the ball high — don\'t bring it to your waist.', 'Use the backboard on every attempt.', 'Soft touch — the ball should kiss the glass.', 'Stay on your toes.'],
    commonMistakes: ['Bringing the ball too low between makes.', 'Using the same hand on both sides.', 'Going too fast and losing control.'],
    variations: ['Reverse Mikan: reverse layups.', 'Power Mikan: two feet, power finish.', 'Extended Mikan: start 3-4 feet away.'],
  },
  {
    id: 'fn-2', name: 'Euro Step Finishing', category: 'Finishing', duration: 8, difficulty: 'intermediate', equipment: ['ball', 'hoop'], type: 'skill',
    summary: 'Master the euro step to finish around shot blockers.',
    steps: ['Start at the three point line on the right wing.', 'Drive with 2-3 dribbles.', 'Pick up the ball, long step right (step 1).', 'Step hard left (step 2), finish with left hand.', '10 reps from the right side.', 'Repeat from the left side. 10 reps.'],
    coachingPoints: ['First step sells the direction. Second step is the counter.', 'Quick and explosive second step.', 'Keep ball protected — tuck it on your hip.', 'Finish with the hand opposite your direction.'],
    commonMistakes: ['Both steps going the same direction.', 'Traveling — pick up cleanly before step 1.', 'Finishing with the wrong hand.'],
  },
  {
    id: 'fn-3', name: 'Floater Package', category: 'Finishing', duration: 8, difficulty: 'intermediate', equipment: ['ball', 'hoop'], type: 'skill',
    summary: 'Develop a soft floater to score over taller defenders.',
    steps: ['Start at the free throw line.', 'One dribble toward the basket, shoot a floater from 6-8 feet.', 'Push it up with a high arc — over an imaginary 7-footer.', '10 from the right side, 10 from the left.', 'Drive in from the top of key for floaters from different angles.', '10 more from random angles.'],
    coachingPoints: ['Push shot, not a jump shot. Off one foot.', 'High arc is everything.', 'Use fingertips, not your palm.', 'Right foot takeoff going right, left foot going left.'],
    commonMistakes: ['Shooting too hard — this is a touch shot.', 'Flat arc.', 'Two foot takeoff — should be off one foot.'],
  },
  {
    id: 'fn-4', name: 'Left Hand Layup Series', category: 'Finishing', duration: 10, difficulty: 'beginner', equipment: ['ball', 'hoop'], type: 'skill',
    summary: 'Dedicated left hand finishing from multiple angles.',
    steps: ['Left block: 10 left hand layups.', 'Left wing: drive left, 10 left hand layups.', 'Top of key going left: 10 left hand layups.', 'Left baseline: 10 reverse left hand layups.', 'Finish with 10 left hand finger rolls.'],
    coachingPoints: ['Jump off your right foot for left hand finishes.', 'Use the backboard.', 'Keep ball in left hand the entire time.', 'Start slow. Speed up as you improve.'],
    commonMistakes: ['Wrong foot — right foot up, left hand finish.', 'Avoiding the backboard.', 'Switching to right hand when it gets hard.'],
  },
  {
    id: 'fn-5', name: 'Power Layups', category: 'Finishing', duration: 8, difficulty: 'beginner', equipment: ['ball', 'hoop'], type: 'skill',
    summary: 'Finish strong through contact with two-foot power layups.',
    steps: ['Start at the right block with the ball.', 'Take one dribble, jump off both feet, and finish strong with two hands.', 'Slam the ball off the backboard — you want power, not finesse.', 'Do 10 from the right side, 10 from the left.', 'Then drive from the wing and finish with power at the rim.', '10 drives from each side.'],
    coachingPoints: ['Two feet, two hands. That\'s the power move.', 'Jump INTO the defender — initiate the contact.', 'Keep the ball high. Chin it. Don\'t bring it down low.', 'Land balanced so you can get the and-one free throw.'],
    commonMistakes: ['Finishing softly — this drill is about POWER.', 'Bringing the ball down where it can be stripped.', 'Jumping off one foot — plant both feet.'],
  },
  {
    id: 'fn-6', name: 'Reverse Layups', category: 'Finishing', duration: 8, difficulty: 'intermediate', equipment: ['ball', 'hoop'], type: 'skill',
    summary: 'Finish on the opposite side of the rim using the basket as a shield.',
    steps: ['Start on the right baseline.', 'Drive along the baseline and go under the basket.', 'Finish with your left hand on the other side of the rim.', 'Use the backboard from the reverse angle.', '10 reps from the right side.', '10 reps from the left side (finish right hand).', 'Then drive from the wing, go baseline, and reverse finish.'],
    coachingPoints: ['Use the rim as a shield — the defender can\'t block you from the other side.', 'Extend the ball away from the defender.', 'Soft touch off the backboard — aim for the top corner of the square from the other side.', 'This is a high-IQ finish — use it when the defender cuts off your direct path.'],
    commonMistakes: ['Going too far under the basket — finish while you can still see the backboard.', 'Using the wrong hand — right side approach = left hand finish.', 'No backboard — always use the glass on reverses.'],
  },
  {
    id: 'fn-7', name: 'Spin Move Finish', category: 'Finishing', duration: 8, difficulty: 'advanced', equipment: ['ball', 'hoop'], type: 'skill',
    summary: 'Use a spin move in the lane to create space and finish at the rim.',
    steps: ['Start at the free throw line with the ball.', 'Dribble toward the basket with your right hand.', 'Plant your left foot and spin back to your left (reverse pivot).', 'After the spin, finish with your left hand.', '10 reps spinning left.', 'Then start with left hand dribble, spin right, finish right.', '10 reps spinning right.'],
    coachingPoints: ['The spin has to be tight — stay on a small circle, don\'t drift.', 'Keep the ball on your hip during the spin — protect it.', 'The spin should end with you facing the basket, ready to finish.', 'Speed up the spin as you get comfortable.'],
    commonMistakes: ['Drifting away from the basket during the spin.', 'Exposing the ball — keep it tight to your body.', 'Traveling — the spin has to be a clean pivot.'],
  },
  {
    id: 'fn-8', name: 'Contact Finishing', category: 'Finishing', duration: 8, difficulty: 'advanced', equipment: ['ball', 'hoop', 'pad or partner'], type: 'skill',
    summary: 'Practice finishing through physical contact at the rim.',
    steps: ['If you have a partner, they stand in the lane with a pad.', 'Drive to the basket and finish through the contact.', 'If no partner, hold a weighted ball or wear a light backpack.', 'Drive and finish 10 times from the right side.', 'Drive and finish 10 times from the left side.', 'Focus on absorbing contact and still making the shot.'],
    coachingPoints: ['Initiate the contact — don\'t shy away from it.', 'Keep your eyes on the rim through the contact.', 'Strong core — don\'t let the contact move your upper body.', 'Finish with touch, even through contact. Don\'t throw the ball at the rim.'],
    commonMistakes: ['Avoiding contact — lean into it.', 'Losing focus on the rim when you get hit.', 'Over-powering the finish — you still need touch.'],
  },
];

const DEFENSE_DRILLS: Drill[] = [
  {
    id: 'df-1', name: 'Defensive Slide Ladder', category: 'Defense', duration: 8, difficulty: 'beginner', equipment: ['court'], type: 'skill',
    summary: 'Build lateral quickness and stance endurance with continuous slides.',
    steps: ['Start on the baseline in defensive stance.', 'Slide to the free throw line and back.', 'Slide to half court and back.', 'Slide to the far free throw line and back.', 'Slide full court and back.', '3 reps, 30 seconds rest between.'],
    coachingPoints: ['Stay LOW. Thighs should burn.', 'Never cross your feet.', 'Hands active — wide like mirroring a ball handler.', 'Head stays level.'],
    commonMistakes: ['Standing up when tired.', 'Crossing your feet.', 'Hands at your sides.'],
  },
  {
    id: 'df-2', name: 'Closeout Drill', category: 'Defense', duration: 8, difficulty: 'intermediate', equipment: ['cones'], type: 'skill',
    summary: 'Sprint, chop, and contest — proper closeout technique on shooters.',
    steps: ['Place 4 cones on the three point line.', 'Start at the rim (help side).', 'Sprint to cone, chop feet near the end.', 'Get hand up to contest. Don\'t jump.', 'Slide back to rim. Sprint to next cone.', 'All 4 cones = 1 rep. Do 5 reps.'],
    coachingPoints: ['Sprint 80%, chop 20%.', 'The chop stops you from flying past the shooter.', 'Hand up but don\'t jump — pump fake will kill you.', 'Angle your body to force toward help.'],
    commonMistakes: ['Running full speed and flying past.', 'Not getting a hand up.', 'Jumping on the closeout.'],
  },
  {
    id: 'df-3', name: 'Help and Recover', category: 'Defense', duration: 8, difficulty: 'advanced', equipment: ['cones'], type: 'skill',
    summary: 'Rotate to help side and recover back to your man.',
    steps: ['Place cone at wing (your man) and cone at rim (help).', 'Start guarding the wing cone.', 'On cue, sprint to help cone at rim.', 'Touch it, sprint back to wing cone.', 'Get back in defensive stance.', '10 reps each side.'],
    coachingPoints: ['See ball, see man — head on a swivel.', 'Don\'t turn your back to the ball.', 'Recover at an angle.', 'Get LOW when you arrive back.'],
    commonMistakes: ['Jogging back instead of sprinting.', 'Turning your back to the ball.', 'Standing up when you recover.'],
  },
  {
    id: 'df-4', name: 'Mirror Drill', category: 'Defense', duration: 6, difficulty: 'intermediate', equipment: ['partner'], type: 'skill',
    summary: 'Guard a partner one-on-one without the ball to build reaction time.',
    steps: ['Face your partner at the free throw line.', 'They move laterally, forward, and backward randomly.', 'You mirror every move — stay in front of them.', 'Stay in defensive stance the entire time.', '30 seconds on, 15 seconds off. 6 rounds.', 'Switch roles halfway through.'],
    coachingPoints: ['Watch their hips, not their feet or eyes. Hips don\'t lie.', 'React, don\'t guess. Wait for them to move first.', 'Short choppy steps — don\'t take big lunging steps.', 'Stay balanced — weight on the balls of your feet.'],
    commonMistakes: ['Watching the feet — they can fake with their feet, not their hips.', 'Getting caught flat-footed.', 'Standing up during the drill.'],
  },
  {
    id: 'df-5', name: 'Deny Drill', category: 'Defense', duration: 8, difficulty: 'intermediate', equipment: ['cone', 'court'], type: 'skill',
    summary: 'Practice denying the pass to your man on the wing — one pass away defense.',
    steps: ['Place a cone at the wing (offensive player position).', 'Place a cone at the top of key (imaginary passer).', 'Stand in deny position — one hand in the passing lane, eyes seeing both cones.', 'The offensive player (cone) "cuts" — slide with them keeping deny position.', 'React to backdoor cut — drop step and sprint to recover.', 'Do 10 reps of wing denial, 10 reps of backdoor recovery.'],
    coachingPoints: ['One hand in the passing lane, one foot in the paint.', 'See ball AND man — don\'t turn your back to either.', 'When they go backdoor, open up and RUN — don\'t slide backward.', 'Active hands — deflections win games.'],
    commonMistakes: ['Turning your back to the ball to watch your man.', 'Flat-footed when the backdoor cut happens.', 'Letting your arm drop out of the passing lane.'],
  },
  {
    id: 'df-6', name: 'Zig-Zag Slides', category: 'Defense', duration: 5, difficulty: 'beginner', equipment: ['court'], type: 'skill',
    summary: 'Slide in a zigzag pattern up the court to simulate guarding a ball handler.',
    steps: ['Start on the baseline, left sideline.', 'Slide diagonally toward the middle of the court at a 45-degree angle.', 'After 4-5 slides, drop step and change direction.', 'Slide diagonally back toward the sideline.', 'Continue zigzagging to the other baseline.', 'Do 3 full court trips.'],
    coachingPoints: ['Stay in a low stance the ENTIRE time.', 'The drop step is the key move — don\'t cross your feet.', 'Keep your chest facing the direction you\'re sliding.', 'Go faster each trip.'],
    commonMistakes: ['Crossing feet during direction changes.', 'Standing up between direction changes.', 'Not going fast enough — push yourself.'],
  },
];

const SPEED_AGILITY_DRILLS: Drill[] = [
  {
    id: 'sa-1', name: 'Suicide Sprints', category: 'Speed & Agility', duration: 5, difficulty: 'beginner', equipment: ['court'], type: 'conditioning',
    summary: 'Classic basketball conditioning — sprint to each line and back.',
    steps: ['Start on the baseline.', 'Sprint to the free throw line and back.', 'Sprint to half court and back.', 'Sprint to the far free throw line and back.', 'Sprint to the far baseline and back.', 'Rest 30 seconds. Do 4 total.'],
    coachingPoints: ['Touch each line with your hand.', 'Decelerate and change direction as fast as possible.', 'Stay low when changing direction.', 'Push yourself on the last two.'],
    commonMistakes: ['Not touching lines.', 'Slowing down on the way back.', 'Rounding the turns.'],
  },
  {
    id: 'sa-2', name: 'Cone Agility T-Drill', category: 'Speed & Agility', duration: 8, difficulty: 'intermediate', equipment: ['cones'], type: 'conditioning',
    summary: 'Quick direction changes in a T pattern for agility and body control.',
    steps: ['Set up cones in a T shape.', 'Sprint from start to middle cone.', 'Shuffle left to left cone. Touch it.', 'Shuffle all the way right to right cone.', 'Shuffle back to middle.', 'Backpedal to start.', '5 reps, try to beat your time.'],
    coachingPoints: ['Stay low through every direction change.', 'Don\'t cross feet when shuffling.', 'Push off outside foot.', 'Head and eyes stay up.'],
    commonMistakes: ['Standing up between changes.', 'Crossing feet.', 'Rounding corners.'],
  },
  {
    id: 'sa-3', name: 'Lateral Bounds', category: 'Speed & Agility', duration: 5, difficulty: 'intermediate', equipment: ['flat surface'], type: 'conditioning',
    summary: 'Explosive side-to-side jumps to build lateral power for defense and driving.',
    steps: ['Stand on your right foot.', 'Jump laterally to your left, landing on your left foot.', 'Stick the landing — hold for 1 second.', 'Jump back to the right foot.', 'Continue for 30 seconds.', 'Rest 15 seconds. 5 rounds.'],
    coachingPoints: ['Jump for distance, not height.', 'Land softly on the ball of your foot.', 'Stick each landing — no wobbling.', 'Use your arms to generate power.'],
    commonMistakes: ['Landing on your heel — always ball of the foot.', 'Not sticking the landing.', 'Jumping too high instead of laterally.'],
  },
  {
    id: 'sa-4', name: 'Box Jump Series', category: 'Speed & Agility', duration: 8, difficulty: 'intermediate', equipment: ['box or bench'], type: 'conditioning',
    summary: 'Build explosive vertical power for rebounds, blocks, and finishing at the rim.',
    steps: ['Find a sturdy box, bench, or ledge about knee height.', 'Stand facing it, feet shoulder width.', 'Bend your knees, swing your arms, and jump onto the box.', 'Land softly with both feet on top.', 'Step back down (don\'t jump down).', 'Do 10 reps. Rest 30 seconds. 3 sets.'],
    coachingPoints: ['Use your arms — swing them hard to generate power.', 'Land softly with bent knees on top.', 'Step down, don\'t jump down — protect your joints.', 'Full triple extension: ankles, knees, hips all extend at the same time.'],
    commonMistakes: ['Not using arms — you lose 20% of your power.', 'Landing with straight legs — bend your knees.', 'Jumping back down — always step down.'],
  },
  {
    id: 'sa-5', name: 'Sprint-Backpedal Intervals', category: 'Speed & Agility', duration: 6, difficulty: 'beginner', equipment: ['court'], type: 'conditioning',
    summary: 'Alternate sprinting forward and backpedaling to build transition speed.',
    steps: ['Start on the baseline.', 'Sprint to the free throw line.', 'Backpedal to the baseline.', 'Sprint to half court.', 'Backpedal to the baseline.', 'Sprint to the far free throw line.', 'Backpedal to the baseline.', 'Sprint the full court.', 'Rest 45 seconds. Do 3 reps.'],
    coachingPoints: ['Transition from sprint to backpedal should be instant — no pausing.', 'Stay low when you change direction.', 'Backpedal on the balls of your feet, not your heels.', 'This simulates transition defense — sprinting forward on offense, backpedaling to get back on D.'],
    commonMistakes: ['Pausing between sprint and backpedal.', 'Backpedaling on your heels — you\'ll fall.', 'Slowing down as the distances get longer.'],
  },
];

const WARMUP_DRILLS: Drill[] = [
  {
    id: 'wu-1', name: 'Dynamic Warmup', category: 'Warmup & Cooldown', duration: 5, difficulty: 'beginner', equipment: ['court'], type: 'warmup',
    summary: 'Full body warmup to prevent injury and prepare for basketball.',
    steps: ['Light jog around the court for 1 minute.', 'High knees baseline to half court.', 'Butt kicks half court to baseline.', 'Carioca both directions.', 'Walking lunges with a twist.', 'Arm circles — 15 forward, 15 backward.', 'Leg swings — 10 each leg, front-to-back and side-to-side.'],
    coachingPoints: ['Don\'t skip this — cold muscles get injured.', 'Build intensity gradually.', 'Full range of motion on every movement.', 'You should have a light sweat by the end.'],
    commonMistakes: ['Rushing through it.', 'Static stretching before playing — save that for after.', 'Skipping it because you feel fine.'],
  },
  {
    id: 'wu-2', name: 'Ball Handling Warmup', category: 'Warmup & Cooldown', duration: 3, difficulty: 'beginner', equipment: ['ball'], type: 'warmup',
    summary: 'Get your hands ready with light ball handling before the real work begins.',
    steps: ['Ball wraps around your waist — 10 each direction.', 'Ball wraps around your head — 10 each direction.', 'Ball wraps around each leg individually — 10 each.', 'Figure-8 through your legs — 15 each direction.', 'Light pound dribbles — 20 each hand.'],
    coachingPoints: ['This is a warmup, not a workout. Go at a comfortable pace.', 'Focus on getting a feel for the ball.', 'Keep your eyes up even during warmup.'],
    commonMistakes: ['Going too hard — save your energy for the real drills.', 'Skipping this and going straight to intense dribbling.'],
  },
  {
    id: 'wu-3', name: 'Shooting Warmup', category: 'Warmup & Cooldown', duration: 5, difficulty: 'beginner', equipment: ['ball', 'hoop'], type: 'warmup',
    summary: 'Gradually build into your shooting with close-range form work.',
    steps: ['10 form shots from 3 feet — one hand only.', '10 shots from 5 feet — full shooting form.', '10 shots from 8 feet.', '10 shots from the free throw line.', '5 shots from each elbow.', 'Only move out when you\'re making 7/10 from each distance.'],
    coachingPoints: ['This builds your feel for the day. Some days you\'re on, some days you need to adjust.', 'Perfect form on every shot — even though it\'s a warmup.', 'If your shot feels off, stay close and fix your form before moving out.'],
    commonMistakes: ['Skipping straight to threes — you\'re not warmed up.', 'Rushing through it — take your time feeling the ball.'],
  },
];

const CONDITIONING_DRILLS: Drill[] = [
  {
    id: 'cd-1', name: 'Full Court Sprints', category: 'Conditioning', duration: 5, difficulty: 'beginner', equipment: ['court'], type: 'conditioning',
    summary: 'Build speed and endurance with straight line sprints.',
    steps: ['Start on the baseline.', 'Sprint full court.', 'Rest 15 seconds.', 'Sprint back.', '8 total sprints, 15 seconds rest between.'],
    coachingPoints: ['Each sprint at 100% effort.', 'Pump your arms — arms drive your legs.', 'Stay on balls of your feet.', 'If your last sprint is much slower than your first, you need more conditioning.'],
    commonMistakes: ['Pacing yourself.', 'Too much rest.'],
  },
  {
    id: 'cd-2', name: 'Core Circuit', category: 'Conditioning', duration: 5, difficulty: 'beginner', equipment: ['flat surface'], type: 'conditioning',
    summary: 'Build core strength for shooting stability and finishing through contact.',
    steps: ['Plank — 30 seconds.', 'Russian twists — 30 seconds.', 'Leg raises — 30 seconds.', 'Rest 15 seconds.', '3 total rounds.'],
    coachingPoints: ['Core strength helps with every part of your game.', 'Keep core tight. Don\'t let your back arch.', 'Breathe steadily.', 'Quality reps over speed.'],
    commonMistakes: ['Hips sagging during plank.', 'Using momentum on Russian twists.', 'Arching back on leg raises.'],
  },
  {
    id: 'cd-3', name: 'Lane Slides', category: 'Conditioning', duration: 5, difficulty: 'beginner', equipment: ['court'], type: 'conditioning',
    summary: 'Defensive slides across the lane for conditioning and lateral endurance.',
    steps: ['Start at the left block in defensive stance.', 'Slide across the lane to the right block.', 'Slide back.', 'That\'s one rep. Do 15 reps as fast as you can.', 'Rest 30 seconds. Do 3 sets.'],
    coachingPoints: ['Stay in your defensive stance — no standing up.', 'Don\'t cross your feet — push off and slide.', 'Touch the block with your hand each time.', 'This builds the leg strength for real game defense.'],
    commonMistakes: ['Standing up between slides.', 'Crossing your feet.', 'Not touching the blocks — full range of motion.'],
  },
  {
    id: 'cd-4', name: '17s', category: 'Conditioning', duration: 5, difficulty: 'advanced', equipment: ['court'], type: 'conditioning',
    summary: 'Classic basketball conditioning test — sprint sideline to sideline 17 times.',
    steps: ['Start on one sideline.', 'Sprint to the other sideline and back. That\'s 2.', 'Keep going until you\'ve crossed the court 17 times.', 'You should finish in under 1 minute.', 'Rest 2 minutes. Do 3 sets.'],
    coachingPoints: ['This is the standard college basketball conditioning test.', 'Touch each sideline with your foot — don\'t cheat.', 'The goal is under 60 seconds for guards, under 65 for big men.', 'If you can pass this, you can play a full game without getting tired.'],
    commonMistakes: ['Not touching the lines — discipline.', 'Starting too fast and dying at the end — pace yourself slightly.', 'Quitting — this is a mental toughness test as much as physical.'],
  },
];

const BASKETBALL_IQ_DRILLS: Drill[] = [
  {
    id: 'iq-1', name: 'Pick & Roll Reads', category: 'Basketball IQ', duration: 10, difficulty: 'advanced', equipment: ['ball', 'hoop', 'cones'], type: 'skill',
    summary: 'Walk through pick and roll decisions — shoot, drive, pass, or lob.',
    steps: ['Set a cone at the top of key (screener).', 'Dribble toward the screen. Read the defense:', 'Defender goes OVER: pull up jumper.', 'Defender goes UNDER: drive hard.', 'Big HEDGES: split and attack.', 'Big DROPS: pull up in mid-range.', 'Walk through each read 5 times, then 10 reps randomly.'],
    coachingPoints: ['READING, not just running a play.', 'Set up your defender before using the screen.', 'Eyes up — see the whole floor.', 'Every option should look the same until the last moment.'],
    commonMistakes: ['Deciding before reading the defense.', 'Dribbling too fast into the screen.', 'Ignoring the screener\'s roll.'],
  },
  {
    id: 'iq-2', name: 'Triple Threat Decision Making', category: 'Basketball IQ', duration: 8, difficulty: 'intermediate', equipment: ['ball', 'hoop'], type: 'skill',
    summary: 'Read the defense from triple threat and make the right decision every time.',
    steps: ['Start on the wing in triple threat position.', 'Read the imaginary defender:', 'Defender plays off you: SHOOT.', 'Defender closes out hard: DRIVE past them.', 'Defender takes away your drive: PASS (to imaginary teammate).', 'Do 5 reps of each read from the wing.', 'Move to the top of the key and repeat.', 'Move to the corner and repeat.'],
    coachingPoints: ['Triple threat means you can shoot, drive, or pass from one position.', 'Be a threat to do all three — if you can\'t shoot, they\'ll sag off.', 'Read the defender\'s feet. If their weight is forward, drive. If they\'re back, shoot.', 'Make your decision in under 2 seconds — don\'t hold the ball.'],
    commonMistakes: ['Catching the ball and standing straight up — get into triple threat immediately.', 'Always doing the same thing — the defense will adjust.', 'Holding the ball too long — make a quick read and go.'],
  },
  {
    id: 'iq-3', name: 'Spacing Walk-Through', category: 'Basketball IQ', duration: 10, difficulty: 'intermediate', equipment: ['ball', 'court'], type: 'skill',
    summary: 'Understand where to be on the court when you don\'t have the ball.',
    steps: ['Walk through 5 offensive positions: two corners, two wings, top of key.', 'Practice "filling" — when the ball moves to the wing, rotate to fill empty spots.', 'Rule: stay 12-15 feet apart from every teammate.', 'When a teammate drives, "drift" to an open spot where they can kick it out.', 'Practice relocating after a pass: pass and move, never pass and stand.', 'Do this walk-through for 10 minutes, visualizing teammates.'],
    coachingPoints: ['Spacing is the single most important concept in basketball.', 'If you\'re standing next to a teammate, one of you is wrong.', 'When the ball moves, you move. Every pass should trigger a cut or relocation.', 'Be in a spot where you can catch and shoot in rhythm.'],
    commonMistakes: ['Standing still after passing — always cut or relocate.', 'Drifting toward the ball — space away from it.', 'Being in the same area as a teammate — spread the floor.'],
  },
  {
    id: 'iq-4', name: 'Fast Break Decision Drill', category: 'Basketball IQ', duration: 8, difficulty: 'intermediate', equipment: ['ball', 'hoop'], type: 'skill',
    summary: 'Practice reading the fast break and making the right play at full speed.',
    steps: ['Start at the opposite baseline with the ball.', 'Push the ball up the court at full speed.', 'At half court, read the imaginary defense:', '3 on 2 advantage: drive and kick if they help, finish if they don\'t.', '2 on 1 advantage: attack the defender\'s hip, pass or finish based on their choice.', '1 on 1: slow down, set up your move, don\'t force it.', 'Do 5 reps of each situation.'],
    coachingPoints: ['In transition, speed is your weapon — push the ball.', 'Read the numbers: 3v2, 2v1, or 1v1 determines your decision.', 'Don\'t pass up a layup for a three — take the easy bucket.', 'If the defense is set, slow down and run offense.'],
    commonMistakes: ['Forcing a bad play because you\'re running fast.', 'Stopping at the three point line instead of attacking the rim.', 'Not looking for teammates in transition — it\'s not a solo fast break.'],
  },
];

export const DRILL_CATEGORIES: DrillCategory[] = [
  { name: 'Ball Handling', color: '#C4A46C', description: 'Crossovers, combos, pressure handling', drills: BALL_HANDLING_DRILLS },
  { name: 'Shooting', color: '#B08D57', description: 'Catch & shoot, off dribble, free throws', drills: SHOOTING_DRILLS },
  { name: 'Finishing', color: '#C4A46C', description: 'Layups, floaters, euro steps, post moves', drills: FINISHING_DRILLS },
  { name: 'Defense', color: '#C47A6C', description: 'Slides, closeouts, help & recover', drills: DEFENSE_DRILLS },
  { name: 'Speed & Agility', color: '#8B9A6B', description: 'Sprints, ladder, cone drills, plyos', drills: SPEED_AGILITY_DRILLS },
  { name: 'Warmup & Cooldown', color: '#8B9A6B', description: 'Dynamic stretches, mobility, form shots', drills: WARMUP_DRILLS },
  { name: 'Conditioning', color: '#C47A6C', description: 'Suicides, sprints, game-speed finishers', drills: CONDITIONING_DRILLS },
  { name: 'Basketball IQ', color: '#C4A46C', description: 'Read & react, pick & roll reads, spacing', drills: BASKETBALL_IQ_DRILLS },
];

export const ALL_DRILLS: Drill[] = DRILL_CATEGORIES.flatMap(cat => cat.drills);

export function getDrillById(id: string): Drill | undefined {
  return ALL_DRILLS.find(d => d.id === id);
}

export function getDrillsByCategory(categoryName: string): Drill[] {
  const cat = DRILL_CATEGORIES.find(c => c.name === categoryName);
  return cat ? cat.drills : [];
}
