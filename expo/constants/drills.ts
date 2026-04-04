export interface Drill {
  id: string;
  name: string;
  category: string;
  duration: number; // minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  type: 'warmup' | 'skill' | 'shooting' | 'conditioning';
  summary: string;
  steps: string[];
  coachingPoints: string[];
  commonMistakes: string[];
  variations?: string[];
}

export interface DrillCategory {
  name: string;
  color: string;
  description: string;
  drills: Drill[];
}

const BALL_HANDLING_DRILLS: Drill[] = [
  {
    id: 'bh-1',
    name: 'Stationary Pound Dribbles',
    category: 'Ball Handling',
    duration: 5,
    difficulty: 'beginner',
    equipment: ['ball', 'flat surface'],
    type: 'skill',
    summary: 'Build hand strength and control with hard, low dribbles in a stationary position.',
    steps: [
      'Stand in an athletic stance — feet shoulder width, knees bent, chest up.',
      'Dribble hard with your right hand at knee height for 30 seconds. Pound it into the ground.',
      'Switch to left hand for 30 seconds.',
      'Alternate: 10 right, 10 left, getting faster each set.',
      'Do 3 total rounds.',
    ],
    coachingPoints: [
      'Keep your eyes up the entire time — never look at the ball.',
      'Dribble hard enough to hear the ball slap the ground.',
      'Keep your off hand up like you\'re protecting the ball from a defender.',
      'Stay low — your head should never go above where it would be in a game stance.',
    ],
    commonMistakes: [
      'Dribbling too high — keep it at knee level or below.',
      'Standing straight up — stay in your athletic stance.',
      'Watching the ball — force yourself to look at a spot on the wall.',
    ],
    variations: [
      'Add a chair or cone in front of you and dribble around it.',
      'Close your eyes for 10 seconds at a time to build feel.',
      'Do it while walking in place to add coordination.',
    ],
  },
  {
    id: 'bh-2',
    name: 'Crossover Combo Series',
    category: 'Ball Handling',
    duration: 8,
    difficulty: 'intermediate',
    equipment: ['ball', 'flat surface'],
    type: 'skill',
    summary: 'Chain together crossover, between-the-legs, and behind-the-back moves in sequence.',
    steps: [
      'Start in an athletic stance with the ball in your right hand.',
      'Crossover to your left hand. Pause. Feel the ball.',
      'Between the legs from left to right. Pause.',
      'Behind the back from right to left. Pause.',
      'Now do all three in a continuous flow — crossover, between legs, behind back.',
      'Repeat starting from the left hand.',
      'Do 5 reps each direction, then speed it up for 30 seconds nonstop.',
    ],
    coachingPoints: [
      'Start slow. Speed comes from clean technique, not rushing.',
      'Each move should change your dribble angle — don\'t just move the ball side to side.',
      'Keep the ball below your waist on every move.',
      'Your feet should react to each move — don\'t be a statue.',
    ],
    commonMistakes: [
      'Going too fast before the moves are clean.',
      'Standing upright — stay low through the entire combo.',
      'Carrying the ball during behind-the-back — keep it a clean dribble.',
    ],
    variations: [
      'Add a jab step before each combo to simulate attacking.',
      'Do it while walking forward, then jogging.',
      'Add a finishing move at the end — pull-up jumper or drive to the rim.',
    ],
  },
  {
    id: 'bh-3',
    name: 'Full Court Attack Dribbles',
    category: 'Ball Handling',
    duration: 10,
    difficulty: 'intermediate',
    equipment: ['ball', 'full court'],
    type: 'skill',
    summary: 'Push the ball full court with different moves at game speed.',
    steps: [
      'Start on the baseline with the ball.',
      'Sprint dribble to half court using your right hand only. Go as fast as you can while keeping control.',
      'At half court, do a crossover and finish to the other baseline with your left hand.',
      'Come back: hesitation dribble at the free throw line, then explode past it.',
      'Come back: in-and-out move at half court, then sprint to finish.',
      'Come back: between-the-legs at half court, change direction, finish.',
      'Do 5 full trips — each one with a different move at the change point.',
    ],
    coachingPoints: [
      'Push the ball out in front of you on the sprint — don\'t dribble at your side.',
      'Your change-of-pace move should be a real speed change — slow down before you explode.',
      'Stay low when you make your move, then get tall and sprint after.',
      'Finish each rep at full speed, even when tired.',
    ],
    commonMistakes: [
      'Slowing down when tired — the whole point is game speed.',
      'Not pushing the ball far enough ahead on the sprint.',
      'Half-hearted change of direction — sell it like there\'s a defender.',
    ],
  },
  {
    id: 'bh-4',
    name: 'Pressure Handling Drill',
    category: 'Ball Handling',
    duration: 8,
    difficulty: 'advanced',
    equipment: ['ball', 'cones or chairs'],
    type: 'skill',
    summary: 'Dribble through tight spaces with cones simulating defenders, building comfort under pressure.',
    steps: [
      'Set up 5-6 cones in a zigzag pattern, about 5 feet apart.',
      'Dribble through the cones using a different move at each one — crossover, between legs, behind back, hesitation.',
      'Stay low and tight. The ball should never go above your knee.',
      'After the last cone, explode to the basket or pull up for a jumper.',
      'Go through 5 times, then reset the cones closer together (3 feet apart) and do 5 more.',
    ],
    coachingPoints: [
      'Each cone is a defender — treat it like one. Change speed before and after each cone.',
      'Your body should shift direction, not just the ball.',
      'Keep your head up — in a game you need to see the floor.',
      'The tighter the cones, the lower you need to be.',
    ],
    commonMistakes: [
      'Going around the cones instead of attacking them.',
      'Losing your dribble in the tight spacing — slow down if needed.',
      'Not finishing with a game move after the last cone.',
    ],
  },
  {
    id: 'bh-5',
    name: 'Tennis Ball Dribbling',
    category: 'Ball Handling',
    duration: 5,
    difficulty: 'advanced',
    equipment: ['basketball', 'tennis ball'],
    type: 'skill',
    summary: 'Dribble a basketball while catching and tossing a tennis ball to train hand-eye coordination.',
    steps: [
      'Hold a tennis ball in your left hand, basketball in your right.',
      'Start dribbling the basketball. Toss the tennis ball up about 2 feet and catch it.',
      'Every time you catch the tennis ball, make a dribble move — crossover, between legs.',
      'Switch the basketball to your left hand, tennis ball to your right. Repeat.',
      'Do 1 minute per hand, 3 rounds.',
    ],
    coachingPoints: [
      'Don\'t look at the basketball — your eyes should track the tennis ball.',
      'This forces you to dribble by feel, which is how you dribble in a game.',
      'Start with easy tosses. Build up to higher and wider tosses.',
      'Stay in your athletic stance the whole time.',
    ],
    commonMistakes: [
      'Looking down at the basketball instead of the tennis ball.',
      'Standing up straight — stay low.',
      'Tossing the tennis ball too high too early — start small.',
    ],
  },
  {
    id: 'bh-6',
    name: 'Spider Dribble',
    category: 'Ball Handling',
    duration: 3,
    difficulty: 'beginner',
    equipment: ['ball'],
    type: 'skill',
    summary: 'Rapid alternating dribbles in a stationary position to build hand speed and coordination.',
    steps: [
      'Stand with feet wide, bent over at the waist.',
      'Dribble the ball between your legs: right hand in front, left hand in front, right hand behind, left hand behind.',
      'That\'s one rep. The pattern is: front-right, front-left, back-right, back-left.',
      'Start slow to get the pattern. Then speed up as much as you can.',
      'Do 30 seconds on, 15 seconds rest, for 4 rounds.',
    ],
    coachingPoints: [
      'Keep the ball low — barely bouncing off the ground.',
      'Fingers spread wide. Use your fingertips, not your palms.',
      'The rhythm matters more than speed at first.',
    ],
    commonMistakes: [
      'Dribbling too high between your legs.',
      'Losing the back-to-front pattern — slow down and reset.',
    ],
  },
];

const SHOOTING_DRILLS: Drill[] = [
  {
    id: 'sh-1',
    name: 'Form Shooting',
    category: 'Shooting',
    duration: 5,
    difficulty: 'beginner',
    equipment: ['ball', 'hoop'],
    type: 'shooting',
    summary: 'Perfect your shooting mechanics from close range before moving out.',
    steps: [
      'Stand 3-4 feet from the basket, directly in front.',
      'Shoot with one hand only (your shooting hand). Guide hand stays off the ball.',
      'Focus on: elbow under the ball, wrist snap, follow through held high.',
      'Make 10 in a row before moving back to 5 feet.',
      'Make 10 from 5 feet, then move to 8 feet.',
      'If you miss two in a row, move closer.',
    ],
    coachingPoints: [
      'Your elbow should be directly under the ball, forming an L shape.',
      'Snap your wrist like you\'re reaching into a cookie jar on a high shelf.',
      'Hold your follow through until the ball hits the rim — every single time.',
      'The ball should have backspin. If it doesn\'t, your wrist isn\'t snapping.',
    ],
    commonMistakes: [
      'Elbow flaring out to the side — tuck it in.',
      'Releasing the ball flat with no arc — aim to get the ball above the rim.',
      'Rushing through reps — this drill is about quality, not speed.',
      'Using two hands — the guide hand should just sit there, not push.',
    ],
    variations: [
      'Close your eyes on the release to build muscle memory.',
      'Use a smaller ball (tennis ball or mini basketball) to challenge your touch.',
    ],
  },
  {
    id: 'sh-2',
    name: '5-Spot Shooting',
    category: 'Shooting',
    duration: 12,
    difficulty: 'intermediate',
    equipment: ['ball', 'hoop'],
    type: 'shooting',
    summary: 'Catch-and-shoot from five spots around the arc to build range and consistency.',
    steps: [
      'Set up at 5 spots: right corner, right wing, top of key, left wing, left corner.',
      'Start at the right corner. Make 10 shots before moving to the next spot.',
      'At each spot: catch the ball with your feet set, knees bent, and shoot in rhythm.',
      'Track your makes out of total attempts at each spot.',
      'After completing all 5 spots, identify your worst spot and shoot 20 more from there.',
    ],
    coachingPoints: [
      'Feet should be set BEFORE you catch the ball — don\'t catch and then adjust.',
      'Knees provide your power. Bend them on every shot.',
      'Same release point, same follow through, every single time.',
      'On misses, diagnose: short = more legs, left/right = check your elbow alignment.',
    ],
    commonMistakes: [
      'Fading away or leaning — jump straight up, land where you took off.',
      'Not bending your knees enough — most missed shots are short because of lazy legs.',
      'Changing your form between spots — your shot should be the same everywhere.',
    ],
    variations: [
      'Add a time limit: 10 makes in 60 seconds per spot.',
      'Shoot off one dribble instead of catch-and-shoot.',
      'Have someone pass to you to simulate real game catches.',
    ],
  },
  {
    id: 'sh-3',
    name: 'Off-Dribble Pull-Ups',
    category: 'Shooting',
    duration: 10,
    difficulty: 'intermediate',
    equipment: ['ball', 'hoop'],
    type: 'shooting',
    summary: 'Practice the mid-range pull-up jumper — the most reliable shot in basketball.',
    steps: [
      'Start at the wing, triple threat position.',
      'Jab step right, take one hard dribble to your left, pull up for a mid-range jumper.',
      'Do 10 reps going left.',
      'Switch: jab left, one dribble right, pull up. 10 reps.',
      'Move to the top of the key and repeat both directions.',
      'Move to the elbow area and repeat.',
    ],
    coachingPoints: [
      'The pull-up is all about the stop. Plant your feet hard and get balanced before you shoot.',
      'One dribble, not two or three. One hard dribble and pull up.',
      'Your last dribble should be hard and slightly in front of you so you can gather cleanly.',
      'Jump straight up — don\'t drift sideways or backward.',
    ],
    commonMistakes: [
      'Drifting on the shot — plant your feet.',
      'Taking too many dribbles — this is a one-dribble drill.',
      'Not selling the jab step — make it look like you\'re driving.',
    ],
  },
  {
    id: 'sh-4',
    name: 'Free Throws Under Fatigue',
    category: 'Shooting',
    duration: 5,
    difficulty: 'beginner',
    equipment: ['ball', 'hoop'],
    type: 'shooting',
    summary: 'Practice free throws when you\'re tired — just like in a real game.',
    steps: [
      'Sprint from baseline to baseline as fast as you can.',
      'Immediately step to the free throw line.',
      'Take 3 deep breaths. Go through your routine.',
      'Shoot 2 free throws.',
      'Sprint again. Shoot 2 more.',
      'Repeat 5 times for 10 total free throws. Track your makes.',
    ],
    coachingPoints: [
      'Your free throw routine is sacred — do it the exact same way every time.',
      'The deep breaths are the key. Slow your heart rate before you shoot.',
      'Don\'t change your form because you\'re tired. Same mechanics, always.',
      'Goal: 7/10 or better while fatigued.',
    ],
    commonMistakes: [
      'Rushing the free throw — take your time, even in a drill.',
      'Shortening your shot because your legs are tired — bend deeper.',
      'Skipping your routine because you\'re winded — that\'s the whole point.',
    ],
  },
  {
    id: 'sh-5',
    name: 'Catch & Shoot Off Screens',
    category: 'Shooting',
    duration: 10,
    difficulty: 'advanced',
    equipment: ['ball', 'hoop', 'cone or chair'],
    type: 'shooting',
    summary: 'Simulate coming off a screen, catching, and shooting with a quick release.',
    steps: [
      'Place a cone or chair at the elbow to simulate a screen.',
      'Start on the block. Sprint and curl tight around the screen.',
      'Catch an imaginary pass (or have a partner pass) and shoot immediately.',
      'Your feet should be set as you come around the screen — not after.',
      'Do 15 reps curling right, 15 curling left.',
      'Then do 15 fading away from the screen each direction.',
    ],
    coachingPoints: [
      'Rub shoulders with the screen — set it up like a real game.',
      'Your hands should be ready and target should be shown before the catch.',
      'Quick release — catch, one-two step, shoot. No extra dribbles.',
      'Read the screen: curl if the defender goes over, fade if they go under.',
    ],
    commonMistakes: [
      'Running too wide around the screen — stay tight.',
      'Catching with feet not set — get your feet ready early.',
      'Slow release — the whole point of a screen is to create a quick shot.',
    ],
  },
];

const FINISHING_DRILLS: Drill[] = [
  {
    id: 'fn-1',
    name: 'Mikan Drill',
    category: 'Finishing',
    duration: 5,
    difficulty: 'beginner',
    equipment: ['ball', 'hoop'],
    type: 'skill',
    summary: 'Build finishing touch around the rim with continuous layups from both sides.',
    steps: [
      'Start on the right side of the basket, close to the rim.',
      'Make a right hand layup off the backboard.',
      'Catch it out of the net, take one step to the left side.',
      'Make a left hand layup off the backboard.',
      'Continue alternating without letting the ball touch the ground.',
      'Do 30 consecutive makes (15 each side) without a miss. If you miss, restart.',
    ],
    coachingPoints: [
      'Keep the ball high — don\'t bring it down to your waist between layups.',
      'Use the backboard on every single attempt.',
      'Focus on soft touch — the ball should kiss the glass.',
      'Stay on your toes and be light on your feet.',
    ],
    commonMistakes: [
      'Bringing the ball too low between makes — keep it above your shoulders.',
      'Using the same hand on both sides — right hand on right side, left on left.',
      'Going too fast and losing control — smooth is fast.',
    ],
    variations: [
      'Reverse Mikan: use reverse layups from each side.',
      'Power Mikan: jump off two feet and finish with power.',
      'Extended Mikan: start from 3-4 feet away instead of right at the rim.',
    ],
  },
  {
    id: 'fn-2',
    name: 'Euro Step Finishing',
    category: 'Finishing',
    duration: 8,
    difficulty: 'intermediate',
    equipment: ['ball', 'hoop'],
    type: 'skill',
    summary: 'Master the euro step to finish around shot blockers.',
    steps: [
      'Start at the three point line on the right wing.',
      'Drive to the basket with 2-3 dribbles.',
      'Pick up the ball and take a long step to the right (step 1).',
      'Then step hard to the left (step 2) and finish with your left hand.',
      'Do 10 reps from the right side.',
      'Repeat from the left side — step left first, then right, finish right hand.',
      'Do 10 reps from the left side.',
    ],
    coachingPoints: [
      'The first step is the selling step — make the defender think you\'re going that way.',
      'The second step should be quick and explosive in the opposite direction.',
      'Keep the ball protected — tuck it on your hip during the move.',
      'Finish with the hand opposite to the direction you\'re going.',
    ],
    commonMistakes: [
      'Both steps going in the same direction — the second step must change direction.',
      'Traveling — pick up the ball cleanly before the first step.',
      'Finishing with the wrong hand — euro step right means finish left.',
    ],
  },
  {
    id: 'fn-3',
    name: 'Floater Package',
    category: 'Finishing',
    duration: 8,
    difficulty: 'intermediate',
    equipment: ['ball', 'hoop'],
    type: 'skill',
    summary: 'Develop a soft floater in the lane to score over taller defenders.',
    steps: [
      'Start at the free throw line with the ball.',
      'Take one dribble toward the basket and shoot a floater from 6-8 feet.',
      'The ball should come off your fingertips with a high arc — aim to get it over an imaginary 7-footer.',
      'Do 10 from the right side, 10 from the left side.',
      'Move to the top of the key and drive in for floaters from different angles.',
      'Do 10 more from random angles.',
    ],
    coachingPoints: [
      'The floater is a push shot, not a jump shot. Push it up off one foot.',
      'High arc is everything — the ball needs to go over the defender, not through them.',
      'Soft touch — use your fingertips, not your palm.',
      'One foot takeoff — right foot if going right, left foot if going left.',
    ],
    commonMistakes: [
      'Shooting it too hard — this is a touch shot, not a power move.',
      'Flat arc — if a tall player could block it, your arc isn\'t high enough.',
      'Two foot takeoff — the floater should be off one foot for speed.',
    ],
  },
  {
    id: 'fn-4',
    name: 'Left Hand Layup Series',
    category: 'Finishing',
    duration: 10,
    difficulty: 'beginner',
    equipment: ['ball', 'hoop'],
    type: 'skill',
    summary: 'Dedicated left hand finishing from multiple angles to eliminate your weak hand.',
    steps: [
      'Start on the left block. Make 10 left hand layups using the backboard.',
      'Move to the left wing. Drive left and make 10 left hand layups.',
      'Drive from the top of key going left — 10 left hand layups.',
      'Drive baseline from the left side — 10 reverse left hand layups.',
      'Finish with 10 left hand finger rolls from the lane.',
    ],
    coachingPoints: [
      'Jump off your right foot when finishing with your left hand.',
      'Use the backboard — aim for the top corner of the square.',
      'Keep the ball in your left hand the entire time — don\'t switch to your right.',
      'Start slow and focus on making every shot. Speed up as you improve.',
    ],
    commonMistakes: [
      'Jumping off the wrong foot — right foot up, left hand finish.',
      'Avoiding the backboard — use it, especially on the sides.',
      'Switching to your right hand when it gets hard — fight through it.',
    ],
  },
];

const DEFENSE_DRILLS: Drill[] = [
  {
    id: 'df-1',
    name: 'Defensive Slide Ladder',
    category: 'Defense',
    duration: 8,
    difficulty: 'beginner',
    equipment: ['flat surface'],
    type: 'skill',
    summary: 'Build lateral quickness and defensive stance endurance with continuous slides.',
    steps: [
      'Start on the baseline in a low defensive stance.',
      'Slide from the baseline to the free throw line. Stay low.',
      'Slide back to the baseline.',
      'Slide to half court. Slide back.',
      'Slide to the far free throw line. Slide back.',
      'Slide the full court length. Slide back.',
      'That\'s one rep. Do 3 reps with 30 seconds rest between.',
    ],
    coachingPoints: [
      'Stay LOW. Your thighs should burn — that means you\'re doing it right.',
      'Never cross your feet. Push off your back foot, step with your lead foot.',
      'Hands active — keep them wide like you\'re mirroring a ball handler.',
      'Head stays level — don\'t bob up and down.',
    ],
    commonMistakes: [
      'Standing up when tired — fight to stay low.',
      'Crossing your feet — slide, don\'t run.',
      'Hands at your sides — keep them active and wide.',
    ],
  },
  {
    id: 'df-2',
    name: 'Closeout Drill',
    category: 'Defense',
    duration: 8,
    difficulty: 'intermediate',
    equipment: ['cones or chairs'],
    type: 'skill',
    summary: 'Practice closing out on shooters with proper technique — sprint, chop, contest.',
    steps: [
      'Place 4 cones on the three point line at different spots.',
      'Start at the rim (help side position).',
      'Sprint to the first cone. As you get close, chop your feet (short quick steps).',
      'Get your hand up high to contest the shot. Don\'t jump.',
      'Slide back to the rim. Sprint to the next cone.',
      'Repeat for all 4 cones. That\'s one rep. Do 5 reps.',
    ],
    coachingPoints: [
      'Sprint 80% of the way, then chop your feet for the last 20%.',
      'The chop is everything — it stops you from flying by the shooter.',
      'Get your hand up but don\'t jump — a pump fake will kill you if you jump.',
      'Angle your body to force the offensive player toward help.',
    ],
    commonMistakes: [
      'Running full speed all the way and flying past the cone.',
      'Not getting a hand up — you have to contest the shot.',
      'Jumping on the closeout — stay grounded.',
    ],
  },
  {
    id: 'df-3',
    name: 'Help and Recover',
    category: 'Defense',
    duration: 8,
    difficulty: 'advanced',
    equipment: ['cones'],
    type: 'skill',
    summary: 'Practice rotating to help side and recovering back to your man.',
    steps: [
      'Place a cone at the wing (your man) and a cone at the rim (help position).',
      'Start guarding the wing cone.',
      'On a verbal cue (or count to 3), sprint to the help cone at the rim.',
      'Touch the cone, then sprint back to your wing cone.',
      'Get back in defensive stance when you arrive.',
      'Do 10 reps. Then switch to the other side.',
    ],
    coachingPoints: [
      'See ball, see man — even while sprinting, keep your head on a swivel.',
      'Don\'t turn your back to the ball when recovering.',
      'Recover at an angle — don\'t run in a straight line back.',
      'Get LOW when you arrive back at your man.',
    ],
    commonMistakes: [
      'Jogging back instead of sprinting — this has to be at game speed.',
      'Turning your back to the ball — always see the court.',
      'Standing up when you recover — get back in stance immediately.',
    ],
  },
];

const SPEED_AGILITY_DRILLS: Drill[] = [
  {
    id: 'sa-1',
    name: 'Suicide Sprints',
    category: 'Speed & Agility',
    duration: 5,
    difficulty: 'beginner',
    equipment: ['court'],
    type: 'conditioning',
    summary: 'Classic basketball conditioning drill — sprint to each line and back.',
    steps: [
      'Start on the baseline.',
      'Sprint to the free throw line and back.',
      'Sprint to half court and back.',
      'Sprint to the far free throw line and back.',
      'Sprint to the far baseline and back.',
      'That\'s one suicide. Rest 30 seconds. Do 4 total.',
    ],
    coachingPoints: [
      'Touch each line with your hand — don\'t cheat.',
      'Decelerate and change direction as fast as possible.',
      'Stay low when you change direction — don\'t stand up.',
      'Push yourself on the last two — that\'s where conditioning is built.',
    ],
    commonMistakes: [
      'Not touching the lines — discipline matters.',
      'Slowing down on the way back — full speed both ways.',
      'Rounding the turns — plant and change direction sharply.',
    ],
  },
  {
    id: 'sa-2',
    name: 'Cone Agility Drill',
    category: 'Speed & Agility',
    duration: 8,
    difficulty: 'intermediate',
    equipment: ['cones'],
    type: 'conditioning',
    summary: 'Quick direction changes through cones to build agility and body control.',
    steps: [
      'Set up 5 cones in a T shape — one at start, one 10 feet ahead, three across the top.',
      'Sprint from the start cone to the middle cone.',
      'Shuffle left to the left cone. Touch it.',
      'Shuffle all the way right to the right cone. Touch it.',
      'Shuffle back to the middle cone.',
      'Backpedal to the start.',
      'Do 5 reps. Try to beat your time each rep.',
    ],
    coachingPoints: [
      'Stay low through every direction change.',
      'Don\'t cross your feet when shuffling — proper slide technique.',
      'Push off the outside foot when changing direction.',
      'Head and eyes stay up — don\'t look at the cones.',
    ],
    commonMistakes: [
      'Standing up between direction changes.',
      'Crossing feet instead of shuffling.',
      'Rounding corners instead of sharp cuts.',
    ],
  },
];

const WARMUP_DRILLS: Drill[] = [
  {
    id: 'wu-1',
    name: 'Dynamic Warmup',
    category: 'Warmup & Cooldown',
    duration: 5,
    difficulty: 'beginner',
    equipment: ['court'],
    type: 'warmup',
    summary: 'A full body warmup to prevent injury and prepare your body for basketball.',
    steps: [
      'Light jog around the court for 1 minute.',
      'High knees from baseline to half court.',
      'Butt kicks from half court to the other baseline.',
      'Carioca (grapevine) both directions.',
      'Walking lunges with a twist from baseline to free throw line.',
      'Arm circles — 15 forward, 15 backward.',
      'Leg swings — 10 each leg, front to back and side to side.',
    ],
    coachingPoints: [
      'Don\'t skip this — cold muscles get injured. Every time.',
      'Build intensity gradually. Start slow, end fast.',
      'Focus on full range of motion on every movement.',
      'You should have a light sweat by the end.',
    ],
    commonMistakes: [
      'Rushing through it — take the full 5 minutes.',
      'Static stretching before playing — save that for after.',
      'Skipping it entirely because you feel fine — you\'re not fine, warm up.',
    ],
  },
];

const CONDITIONING_DRILLS: Drill[] = [
  {
    id: 'cd-1',
    name: 'Full Court Sprints',
    category: 'Conditioning',
    duration: 5,
    difficulty: 'beginner',
    equipment: ['court'],
    type: 'conditioning',
    summary: 'Straight line conditioning to build speed and endurance.',
    steps: [
      'Start on the baseline.',
      'Sprint full court to the other baseline.',
      'Rest for 15 seconds.',
      'Sprint back.',
      'Do 8 total sprints. Rest 15 seconds between each.',
    ],
    coachingPoints: [
      'Each sprint should be at 100% effort.',
      'Pump your arms — arms drive your legs.',
      'Stay on the balls of your feet.',
      'If your last sprint is much slower than your first, you need more conditioning.',
    ],
    commonMistakes: [
      'Pacing yourself — go all out every time.',
      'Too much rest — 15 seconds keeps your heart rate up.',
    ],
  },
  {
    id: 'cd-2',
    name: 'Core Circuit',
    category: 'Conditioning',
    duration: 5,
    difficulty: 'beginner',
    equipment: ['flat surface'],
    type: 'conditioning',
    summary: 'Build core strength for balance, shooting stability, and finishing through contact.',
    steps: [
      'Plank — hold for 30 seconds. Keep your body straight as a board.',
      'Russian twists — 30 seconds. Sit on the floor, lean back, twist side to side.',
      'Leg raises — 30 seconds. Lie flat, raise legs to 90 degrees and lower slowly.',
      'Rest 15 seconds.',
      'Repeat for 3 total rounds.',
    ],
    coachingPoints: [
      'Core strength is basketball strength — it helps with every part of your game.',
      'Keep your core tight during each exercise. Don\'t let your back arch.',
      'Breathe steadily — don\'t hold your breath.',
      'Quality reps over speed. Slow and controlled wins.',
    ],
    commonMistakes: [
      'Letting your hips sag during plank — squeeze your glutes.',
      'Using momentum instead of core strength on Russian twists.',
      'Arching your back on leg raises — press your lower back into the floor.',
    ],
  },
];

const BASKETBALL_IQ_DRILLS: Drill[] = [
  {
    id: 'iq-1',
    name: 'Pick & Roll Reads',
    category: 'Basketball IQ',
    duration: 10,
    difficulty: 'advanced',
    equipment: ['ball', 'hoop', 'cones'],
    type: 'skill',
    summary: 'Walk through pick and roll decision-making — when to shoot, drive, pass, or lob.',
    steps: [
      'Set a cone at the top of the key (screener) and stand with the ball on the wing.',
      'Dribble toward the screen. Read the imaginary defense:',
      'If the defender goes OVER the screen: pull up for a jumper.',
      'If the defender goes UNDER: drive hard to the basket.',
      'If the big HEDGES: split the hedge and attack the basket.',
      'If the big DROPS: pull up in the mid-range pocket.',
      'Walk through each read 5 times, then do all 4 randomly for 10 reps.',
    ],
    coachingPoints: [
      'The pick and roll is about READING, not just running a play.',
      'Set up your defender before using the screen — don\'t just run into it.',
      'Eyes up — see the whole floor, not just the screen.',
      'Every option should look the same until the last moment.',
    ],
    commonMistakes: [
      'Deciding what to do before reading the defense — let the defense tell you what\'s open.',
      'Dribbling too fast into the screen — slow down so you can read.',
      'Ignoring the screener\'s roll — in a real game, the lob or pocket pass is often the best option.',
    ],
  },
];

export const DRILL_CATEGORIES: DrillCategory[] = [
  {
    name: 'Ball Handling',
    color: '#C4A46C',
    description: 'Crossovers, combos, pressure handling',
    drills: BALL_HANDLING_DRILLS,
  },
  {
    name: 'Shooting',
    color: '#B08D57',
    description: 'Catch & shoot, off dribble, free throws',
    drills: SHOOTING_DRILLS,
  },
  {
    name: 'Finishing',
    color: '#C4A46C',
    description: 'Layups, floaters, euro steps, post moves',
    drills: FINISHING_DRILLS,
  },
  {
    name: 'Defense',
    color: '#C47A6C',
    description: 'Slides, closeouts, help & recover',
    drills: DEFENSE_DRILLS,
  },
  {
    name: 'Speed & Agility',
    color: '#8B9A6B',
    description: 'Sprints, ladder, cone drills, plyos',
    drills: SPEED_AGILITY_DRILLS,
  },
  {
    name: 'Warmup & Cooldown',
    color: '#8B9A6B',
    description: 'Dynamic stretches, mobility, form shots',
    drills: WARMUP_DRILLS,
  },
  {
    name: 'Conditioning',
    color: '#C47A6C',
    description: 'Suicides, sprints, game-speed finishers',
    drills: CONDITIONING_DRILLS,
  },
  {
    name: 'Basketball IQ',
    color: '#C4A46C',
    description: 'Read & react, pick & roll reads, spacing',
    drills: BASKETBALL_IQ_DRILLS,
  },
];

export const ALL_DRILLS: Drill[] = DRILL_CATEGORIES.flatMap(cat => cat.drills);

export function getDrillById(id: string): Drill | undefined {
  return ALL_DRILLS.find(d => d.id === id);
}

export function getDrillsByCategory(categoryName: string): Drill[] {
  const cat = DRILL_CATEGORIES.find(c => c.name === categoryName);
  return cat ? cat.drills : [];
}
