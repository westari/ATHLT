import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Image,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Play, Flame, Clock, Dumbbell, Target, Zap, Wind, Activity, Upload, Film, Check, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import AuthScreen from '@/components/AuthScreen';
import { usePlanStore } from '@/store/planStore';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface OnboardingStep {
  type: 'question' | 'info';
  id?: string; question?: string; subtitle?: string;
  selectType?: 'select' | 'multiselect'; section?: string;
  options?: { label: string; subtitle?: string; disabled?: boolean }[];
  infoTitle?: string; infoBody?: string; infoImage?: any;
}

const INFO_IMAGES = {
  dribble: require('@/assets/images/coach-x-dribble.png'),
  pointing: require('@/assets/images/coach-x-pointing.png'),
  clipboard: require('@/assets/images/coach-x-clipboard.png'),
};

const ONBOARDING_STEPS: OnboardingStep[] = [
  { type:'question',id:'sport',section:'About You',question:'What sport do you play?',subtitle:"We'll tailor everything to your game.",selectType:'select',
    options:[{label:'Basketball'},{label:'Soccer',subtitle:'Coming soon',disabled:true},{label:'Baseball',subtitle:'Coming soon',disabled:true},{label:'Football',subtitle:'Coming soon',disabled:true}] },
  { type:'question',id:'position',section:'About You',question:'What position do you play?',subtitle:'This shapes your skill priorities.',selectType:'select',
    options:[{label:'Point Guard'},{label:'Shooting Guard'},{label:'Small Forward'},{label:'Power Forward'},{label:'Center'}] },
  { type:'question',id:'experience',section:'About You',question:'How long have you been playing?',subtitle:'So we match the right intensity.',selectType:'select',
    options:[{label:'Less than a year'},{label:'1-2 years'},{label:'3-5 years'},{label:'6-10 years'},{label:'10+ years'}] },
  { type:'info',infoImage:INFO_IMAGES.dribble,infoTitle:"Now let's see what you're made of.",infoBody:"The best players don't just practice what they're good at. They attack their weaknesses head on." },
  { type:'question',id:'goal',section:'Your Goals',question:'What do you want to improve most?',selectType:'select',
    options:[{label:'Become a better scorer'},{label:'Improve my defense'},{label:'Get faster and more athletic'},{label:'Become a more complete player'},{label:'Get recruited / play at the next level'}] },
  { type:'question',id:'weakness',section:'Your Goals',question:'What part of your game needs the most work?',selectType:'select',
    options:[{label:'Shooting'},{label:'Ball handling'},{label:'Defense'},{label:'Finishing at the rim'},{label:'Speed & agility'},{label:'Basketball IQ'}] },
  { type:'info',infoImage:INFO_IMAGES.pointing,infoTitle:"Most players avoid what's hard. Not you.",infoBody:"Your plan will be different. We're going to push you exactly where it matters most." },
  { type:'question',id:'driving',section:'How You Play',question:'When you drive to the basket, what usually happens?',selectType:'select',
    options:[{label:'I usually score'},{label:'I get blocked or altered'},{label:'I pass it out'},{label:'I lose the ball'},{label:"I don't really drive"}] },
  { type:'question',id:'leftHand',section:'How You Play',question:"How's your left hand?",selectType:'select',
    options:[{label:'Strong - I finish with both hands'},{label:'Getting there - I use it sometimes'},{label:'Weak - I avoid it'},{label:'I only use my right hand'}] },
  { type:'question',id:'pressure',section:'How You Play',question:"What happens when you're guarded tight?",selectType:'select',
    options:[{label:'I can still create my shot'},{label:'I struggle but fight through'},{label:'I usually pass it away'},{label:'I turn it over'}] },
  { type:'question',id:'goToMove',section:'How You Play',question:"What's your go-to move?",selectType:'select',
    options:[{label:'Pull-up jumper'},{label:'Drive right'},{label:'Drive left'},{label:'Three pointer'},{label:'Post up'},{label:"I don't have one yet"}] },
  { type:'question',id:'threeConfidence',section:'How You Play',question:'How confident are you shooting threes?',selectType:'select',
    options:[{label:"Very - I'm a shooter"},{label:"Somewhat - I'll take open ones"},{label:'Not really - I prefer mid-range'},{label:"I don't shoot them"}] },
  { type:'question',id:'freeThrow',section:'How You Play',question:"What's your free throw percentage?",selectType:'select',
    options:[{label:'80% or higher'},{label:'60-80%'},{label:'40-60%'},{label:'Below 40%'},{label:'No idea'}] },
  { type:'info',infoImage:INFO_IMAGES.clipboard,infoTitle:'Your plan is about to be built around your game.',infoBody:'Most apps give everyone the same plan. We just learned how you actually play - that changes everything.' },
  { type:'question',id:'frequency',section:'Your Schedule',question:'How often can you train?',selectType:'select',
    options:[{label:'Once or twice a week'},{label:'3-4 times a week'},{label:'5-6 times a week'},{label:'Every day'}] },
  { type:'question',id:'duration',section:'Your Schedule',question:'How long do you want each session?',selectType:'select',
    options:[{label:'20-30 minutes'},{label:'30-45 minutes'},{label:'45-60 minutes'},{label:'60-90 minutes'}] },
  { type:'question',id:'access',section:'Your Schedule',question:'Where do you usually train?',subtitle:'Pick all that apply.',selectType:'multiselect',
    options:[{label:'Full court with hoop'},{label:'Half court with hoop'},{label:'Driveway with hoop'},{label:'Gym with weights'},{label:'Open space (no hoop)'}] },
];

const ASSESSMENT_CLIPS = [
  { id:'one_on_one', clipType:'1on1', title:'One-on-One', instruction:'Film one possession of you playing 1-on-1', detail:'Half court is fine. Show me how you create and finish.' },
  { id:'threes', clipType:'threes', title:'Open Threes', instruction:'Film 2 open three pointers', detail:'No defender. I want to see your form.' },
  { id:'dribble', clipType:'dribble', title:'Dribble Combo', instruction:'Film some basic dribble combos', detail:'Crossover, between the legs, behind the back.' },
  { id:'game', clipType:'game', title:'Game Footage', instruction:'Film footage from a real game', detail:"No game footage? Film yourself finishing once with each hand instead." },
];

const LOADING_STEPS = ['Analyzing your player profile','Selecting drills for your position','Focusing on your weakness areas','Building daily sessions','Optimizing your schedule','Finalizing your training plan'];

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, profile, completedDrills, currentDayIndex, currentStreak, totalSessions, loadFromStorage, setPlan, setProfile, setSkillLevels } = usePlanStore();

  const [appState, setAppState] = useState<'loading'|'welcome'|'onboarding'|'auth'|'assessment'|'generating'|'plan'>('loading');
  const [isReady, setIsReady] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string|string[]>>({});
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Assessment state
  const [assessClipIndex, setAssessClipIndex] = useState(0);
  const [assessResults, setAssessResults] = useState<any[]>([]);
  const [assessUploading, setAssessUploading] = useState(false);
  const [assessError, setAssessError] = useState('');
  const [assessShowResults, setAssessShowResults] = useState(false);
  const [assessSkills, setAssessSkills] = useState<Record<string, number>>({});

  useEffect(() => { loadFromStorage().then(() => setIsReady(true)); }, []);
  useEffect(() => { if (isReady) { if (profile && plan) setAppState('plan'); else setAppState('welcome'); } }, [isReady, profile, plan]);
  useEffect(() => { if (appState === 'generating') Animated.timing(progressAnim, { toValue: loadingProgress, duration: 800, useNativeDriver: false }).start(); }, [loadingProgress, appState]);

  const animTrans = (dir: 'forward'|'back', cb: () => void) => {
    const o = dir === 'forward' ? -30 : 30, n = dir === 'forward' ? 30 : -30;
    Animated.parallel([Animated.timing(fadeAnim,{toValue:0,duration:150,useNativeDriver:true}),Animated.timing(slideAnim,{toValue:o,duration:150,useNativeDriver:true})]).start(() => {
      cb(); slideAnim.setValue(n);
      Animated.parallel([Animated.timing(fadeAnim,{toValue:1,duration:200,useNativeDriver:true}),Animated.spring(slideAnim,{toValue:0,friction:8,tension:60,useNativeDriver:true})]).start();
    });
  };

  const handleSelect = (opt: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const st = ONBOARDING_STEPS[quizStep]; if (!st.id) return;
    if (st.selectType === 'multiselect') {
      const c = (answers[st.id] as string[])||[];
      setAnswers({...answers,[st.id]:c.includes(opt)?c.filter(o=>o!==opt):[...c,opt]});
    } else {
      setAnswers({...answers,[st.id]:opt});
      setTimeout(() => goNext(), 300);
    }
  };

  const goNext = () => { if (quizStep < ONBOARDING_STEPS.length-1) animTrans('forward',()=>setQuizStep(quizStep+1)); else setAppState('auth'); };
  const goBack = () => { if (quizStep > 0) animTrans('back',()=>setQuizStep(quizStep-1)); else setAppState('welcome'); };

  // Assessment - upload and assess clip
  const assessUpload = async (uri: string) => {
    setAssessUploading(true);
    setAssessError('');
    try {
      const fileName = 'assess_' + ASSESSMENT_CLIPS[assessClipIndex].id + '_' + Date.now() + '.mp4';
      const formData = new FormData();
      formData.append('file', { uri: uri, type: 'video/mp4', name: fileName } as any);
      const supabaseUrl = 'https://tvtojlwdpipntkktguck.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2dG9qbHdkcGlwbnRra3RndWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODMxNDYsImV4cCI6MjA5MTA1OTE0Nn0.9GiDMwjhdZNotoJT_mFlxvxgns0I0pgjVNmM1oyPqFY';
      const uploadRes = await fetch(supabaseUrl + '/storage/v1/object/films/' + fileName, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + supabaseKey, 'apikey': supabaseKey },
        body: formData,
      });
      if (!uploadRes.ok) { setAssessError('Upload failed. Try a shorter clip.'); setAssessUploading(false); return; }
      const videoUrl = supabaseUrl + '/storage/v1/object/public/films/' + fileName;
      const response = await fetch('https://collectiq-xi.vercel.app/api/assess-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: videoUrl, clipType: ASSESSMENT_CLIPS[assessClipIndex].clipType, profile: answers }),
      });
      const data = await response.json();
      if (response.ok && data) {
        const newResults = [...assessResults, data];
        setAssessResults(newResults);
        if (assessClipIndex < ASSESSMENT_CLIPS.length - 1) {
          setAssessClipIndex(assessClipIndex + 1);
        } else {
          // Calculate final skills
          const skillTotals: Record<string, { sum: number; count: number }> = {};
          newResults.forEach(function(a) {
            Object.keys(a).forEach(function(key) {
              if (typeof a[key] === 'number' && key !== 'clipType') {
                if (!skillTotals[key]) skillTotals[key] = { sum: 0, count: 0 };
                skillTotals[key].sum += a[key];
                skillTotals[key].count += 1;
              }
            });
          });
          const finals: Record<string, number> = {};
          Object.keys(skillTotals).forEach(function(skill) { finals[skill] = Math.round(skillTotals[skill].sum / skillTotals[skill].count); });
          setAssessSkills(finals);
          setAssessShowResults(true);
        }
      } else {
        setAssessError(data.error || 'Failed to analyze clip. Try a shorter one.');
      }
    } catch (e) {
      setAssessError('Something went wrong. Try again.');
    }
    setAssessUploading(false);
  };

  const assessPickVideo = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('Permission needed', 'We need camera roll access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: true, videoMaxDuration: 30, quality: 0.3 });
    if (result.canceled || !result.assets[0]?.uri) return;
    await assessUpload(result.assets[0].uri);
  };

  const assessRecord = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('Permission needed', 'We need camera access.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 30, quality: 0.3 });
    if (result.canceled || !result.assets[0]?.uri) return;
    await assessUpload(result.assets[0].uri);
  };

  const assessSkip = () => {
    Alert.alert('Skip Assessment?', "Without seeing you play, your plan will be more generic.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Skip Anyway', style: 'destructive', onPress: () => handleGen({}) },
    ]);
  };

  const assessFinish = async () => {
    setSkillLevels(assessSkills);
    await handleGen(assessSkills);
  };

  const handleGen = async (skillLevels: Record<string, number>) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setAppState('generating');
    setLoadingProgress(0);
    setCurrentLoadingStep(0);
    let si = 0;
    const iv = setInterval(() => {
      si++;
      if (si <= LOADING_STEPS.length) { setCurrentLoadingStep(si); setLoadingProgress(Math.round((si/LOADING_STEPS.length)*95)); }
    }, 2000);
    try {
      const r = await fetch('https://collectiq-xi.vercel.app/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...answers, skillLevels: skillLevels }),
      });
      clearInterval(iv);
      setLoadingProgress(100);
      setCurrentLoadingStep(LOADING_STEPS.length);
      const res = await r.json();
      await new Promise(x => setTimeout(x, 1000));
      if (r.ok && res.days) {
        setPlan(res);
        setProfile({
          sport: answers.sport as string, position: answers.position as string,
          experience: answers.experience as string, goal: answers.goal as string,
          weakness: answers.weakness as string, frequency: answers.frequency as string,
          duration: answers.duration as string, access: answers.access,
          driving: answers.driving as string, leftHand: answers.leftHand as string,
          pressure: answers.pressure as string, goToMove: answers.goToMove as string,
          threeConfidence: answers.threeConfidence as string, freeThrow: answers.freeThrow as string,
        });
        setAppState('plan');
      } else { setAppState('welcome'); }
    } catch (e) { clearInterval(iv); setAppState('welcome'); }
  };

  // ============ RENDER STATES ============

  if (appState === 'loading') return <View style={[s.c, { paddingTop: insets.top }]} />;

  // WELCOME
  if (appState === 'welcome') return (
    <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 16, paddingBottom: 24, alignItems: 'center' }}>
          <Image source={require('@/assets/images/logo.png')} style={{ width: 180, height: 50 }} resizeMode="contain" />
        </View>
        <Text style={{ fontSize: 28, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center', lineHeight: 36, marginBottom: 12, marginTop: 40 }}>Training plans that know how you play.</Text>
        <Text style={{ fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 40, lineHeight: 22 }}>Coach X watches you play, scores your skills, and builds a plan around your game.</Text>
        <TouchableOpacity style={{ backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 20, alignItems: 'center' }} onPress={() => { if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setAppState('onboarding'); }} activeOpacity={0.85}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: Colors.black, letterSpacing: 2 }}>GET STARTED</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ONBOARDING
  if (appState === 'onboarding') {
    const st = ONBOARDING_STEPS[quizStep];
    const tq = ONBOARDING_STEPS.filter(x => x.type === 'question').length;
    const cq = ONBOARDING_STEPS.slice(0, quizStep + 1).filter(x => x.type === 'question').length;
    const pr = (quizStep + 1) / ONBOARDING_STEPS.length;
    const isSel = (o: string) => { if (!st.id) return false; const a = answers[st.id]; return Array.isArray(a) ? a.includes(o) : a === o; };
    const canGo = () => { if (!st.id) return true; const a = answers[st.id]; if (!a) return false; if (Array.isArray(a) && a.length === 0) return false; return true; };

    if (st.type === 'info') return (
      <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.qh}>
          <TouchableOpacity onPress={goBack} style={s.bb}><Text style={s.bt}>←</Text></TouchableOpacity>
          <View style={s.pc}><View style={s.pt}><View style={[s.pf, { width: (pr * 100) + '%' }]} /></View></View>
          <View style={{ width: 60 }} />
        </View>
        <Animated.View style={[s.is, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
          {st.infoImage && <Image source={st.infoImage} style={s.ii} resizeMode="contain" />}
          <Text style={s.it}>{st.infoTitle}</Text>
          <Text style={s.ib}>{st.infoBody}</Text>
        </Animated.View>
        <View style={s.bn}>
          <TouchableOpacity style={s.cb} onPress={goNext} activeOpacity={0.85}><Text style={s.ct}>CONTINUE</Text></TouchableOpacity>
        </View>
      </View>
    );

    return (
      <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.qh}>
          <TouchableOpacity onPress={goBack} style={s.bb}><Text style={s.bt}>←</Text></TouchableOpacity>
          <View style={s.pc}><View style={s.pt}><View style={[s.pf, { width: (pr * 100) + '%' }]} /></View></View>
          <Text style={s.st}>{cq}/{tq}</Text>
        </View>
        {st.section && <Animated.Text style={[s.sl, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>{st.section}</Animated.Text>}
        <ScrollView contentContainerStyle={s.qc} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
            <Text style={s.q}>{st.question}</Text>
            {st.subtitle && <Text style={s.qs}>{st.subtitle}</Text>}
            <View style={{ gap: 10 }}>
              {st.options?.map((o, i) => {
                const sel = isSel(o.label);
                const d = o.disabled;
                return (
                  <TouchableOpacity key={i} style={[s.oc, sel && s.os, d && s.od]} onPress={() => !d && handleSelect(o.label)} activeOpacity={d ? 1 : 0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.ol, sel && s.ols, d && { color: Colors.textMuted }]}>{o.label}</Text>
                      {o.subtitle && <Text style={[s.osu, d && { fontStyle: 'italic' }]}>{o.subtitle}</Text>}
                    </View>
                    <View style={[st.selectType === 'multiselect' ? s.ck : s.rd, sel && (st.selectType === 'multiselect' ? s.cks : s.rds)]}>
                      {sel && <View style={st.selectType === 'multiselect' ? s.cki : s.rdi} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>
        {st.selectType === 'multiselect' && (
          <View style={s.bn}>
            <TouchableOpacity style={[s.cb, !canGo() && s.cd]} onPress={goNext} activeOpacity={0.85} disabled={!canGo()}>
              <Text style={[s.ct, !canGo() && { color: Colors.textMuted }]}>{quizStep === ONBOARDING_STEPS.length - 1 ? 'CONTINUE' : 'NEXT'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // AUTH
  if (appState === 'auth') {
    return <AuthScreen onComplete={(isGuest) => setAppState('assessment')} onBack={() => setAppState('onboarding')} />;
  }

  // ASSESSMENT
  if (appState === 'assessment') {
    const SKILL_LABELS: Record<string, string> = {
      ballHandling: 'Ball Handling', shooting: 'Shooting', shotForm: 'Shot Form',
      finishing: 'Finishing', defense: 'Defense', iq: 'Basketball IQ',
      athleticism: 'Athleticism', weakHand: 'Weak Hand', creativity: 'Creativity',
      touch: 'Touch', courtVision: 'Court Vision', decisionMaking: 'Decision Making',
    };

    if (assessShowResults) {
      const skillEntries = Object.entries(assessSkills).sort((a, b) => b[1] - a[1]);
      const avgLevel = skillEntries.reduce((sum, e) => sum + e[1], 0) / skillEntries.length;
      return (
        <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 24 }}>
              <Image source={require('@/assets/images/coach-x.png')} style={{ width: 120, height: 120, marginBottom: 16 }} resizeMode="contain" />
              <Text style={{ fontSize: 26, fontWeight: '900', color: Colors.primary, marginBottom: 6 }}>Here's What I Saw</Text>
              <Text style={{ fontSize: 14, color: Colors.textSecondary }}>Your skill levels based on the film</Text>
            </View>
            <View style={{ backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 2, borderColor: Colors.primary, padding: 24, alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 8 }}>OVERALL LEVEL</Text>
              <Text style={{ fontSize: 56, fontWeight: '900', color: Colors.primary }}>{avgLevel.toFixed(1)}<Text style={{ fontSize: 24, color: Colors.textMuted, fontWeight: '700' }}>/10</Text></Text>
            </View>
            <View style={{ gap: 10, marginBottom: 24 }}>
              {skillEntries.map((entry) => {
                const skillKey = entry[0];
                const level = entry[1];
                const label = SKILL_LABELS[skillKey] || skillKey;
                const color = level >= 7 ? '#8B9A6B' : level >= 5 ? Colors.primary : level >= 3 ? '#B08D57' : '#C47A6C';
                return (
                  <View key={skillKey} style={{ backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 14 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 }}>{label}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ flex: 1, height: 8, backgroundColor: '#1A1A1A', borderRadius: 4, overflow: 'hidden' }}>
                        <View style={{ height: 8, borderRadius: 4, width: (level * 10) + '%', backgroundColor: color }} />
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '900', minWidth: 24, textAlign: 'right', color: color }}>{level}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16 }} onPress={assessFinish} activeOpacity={0.85}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: Colors.black, letterSpacing: 0.8 }}>BUILD MY PLAN</Text>
              <ChevronRight size={18} color={Colors.black} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    const currentClip = ASSESSMENT_CLIPS[assessClipIndex];
    const progress = (assessClipIndex / ASSESSMENT_CLIPS.length) * 100;

    return (
      <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 }}>
          <View style={{ height: 4, backgroundColor: Colors.surface, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ height: 4, backgroundColor: Colors.primary, borderRadius: 2, width: progress + '%' }} />
          </View>
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 8, fontWeight: '600' }}>Clip {assessClipIndex + 1} of {ASSESSMENT_CLIPS.length}</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 16 }}>
            <Image source={require('@/assets/images/coach-x-small.png')} style={{ width: 32, height: 32, borderRadius: 16 }} resizeMode="cover" />
            <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>Coach X</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '900', color: Colors.textPrimary, marginBottom: 8 }}>{currentClip.title}</Text>
          <Text style={{ fontSize: 17, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8, lineHeight: 24 }}>{currentClip.instruction}</Text>
          <Text style={{ fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24 }}>{currentClip.detail}</Text>

          {assessResults.length > 0 && (
            <View style={{ gap: 8, marginBottom: 24 }}>
              {assessResults.map((_, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0F1A0F', borderRadius: 10, borderWidth: 1, borderColor: '#1A2D1A', padding: 12 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#8B9A6B', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={14} color={Colors.black} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#8B9A6B' }}>{ASSESSMENT_CLIPS[i].title}</Text>
                </View>
              ))}
            </View>
          )}

          {assessError ? <Text style={{ fontSize: 13, color: '#C47A6C', backgroundColor: '#2A1515', borderRadius: 10, padding: 12, marginBottom: 16 }}>{assessError}</Text> : null}

          {assessUploading ? (
            <View style={{ backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 32, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginTop: 16, marginBottom: 4 }}>Coach X is watching...</Text>
              <Text style={{ fontSize: 13, color: Colors.textMuted }}>This takes about a minute</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <TouchableOpacity style={{ backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 20, alignItems: 'center' }} onPress={assessPickVideo} activeOpacity={0.85}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#1A1708', borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Upload size={22} color={Colors.primary} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 }}>Upload from Camera Roll</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>Pick a clip you already have</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 20, alignItems: 'center' }} onPress={assessRecord} activeOpacity={0.85}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#1A1708', borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Film size={22} color={Colors.primary} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 }}>Record New Clip</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>Film it right now</Text>
              </TouchableOpacity>
            </View>
          )}

          {!assessUploading && assessClipIndex === 0 && (
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 20, padding: 12 }} onPress={assessSkip} activeOpacity={0.7}>
              <Text style={{ fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline' }}>Skip assessment</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  // GENERATING
  if (appState === 'generating') {
    const pw = progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
    return (
      <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.ls}>
          <Text style={s.lp}>{loadingProgress}%</Text>
          <Text style={s.lt}>We're building your plan</Text>
          <View style={s.lbt}><Animated.View style={[s.lbf, { width: pw }]} /></View>
          <Text style={s.lsu}>{currentLoadingStep < LOADING_STEPS.length ? LOADING_STEPS[currentLoadingStep] + '...' : 'Your plan is ready!'}</Text>
        </View>
      </View>
    );
  }

  // PLAN VIEW (compact today)
  if (!plan || !profile) return <View style={[s.c, { paddingTop: insets.top }]}><Text style={{ color: Colors.textMuted, textAlign: 'center', marginTop: 100 }}>Complete onboarding to start training.</Text></View>;

  const todayDay = plan.days[currentDayIndex];
  const todayDrills = todayDay?.drills || [];
  const totalMinutes = todayDrills.reduce((sum, d) => sum + (d.duration || 5), 0);
  const doneCount = todayDrills.filter((_, i) => completedDrills[currentDayIndex + '-' + i]).length;
  const firstName = (profile as any).name ? (profile as any).name.split(' ')[0] : 'Player';

  const handleStart = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/session');
  };

  const getDrillIcon = (type: string) => {
    switch (type) {
      case 'warmup': return Wind;
      case 'shooting': return Target;
      case 'skill': return Dumbbell;
      case 'conditioning': return Activity;
      default: return Zap;
    }
  };

  const getDrillColor = (type: string) => {
    switch (type) {
      case 'warmup': return '#8B9A6B';
      case 'shooting': return '#B08D57';
      case 'skill': return Colors.primary;
      case 'conditioning': return '#C47A6C';
      default: return Colors.textMuted;
    }
  };

  return (
    <View style={[s.c, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.textPrimary }}>Hey {firstName}</Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1A1210', borderRadius: 12, borderWidth: 1, borderColor: '#3A2018', paddingHorizontal: 10, paddingVertical: 6 }}>
            <Flame size={14} color="#C47A6C" />
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#C47A6C' }}>{currentStreak}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 }}>
          {plan.days.map((d, i) => {
            const isToday = i === currentDayIndex;
            const dayDrills = d.drills || [];
            const dayDone = dayDrills.filter((_, di) => completedDrills[i + '-' + di]).length;
            const isComplete = dayDrills.length > 0 && dayDone === dayDrills.length;
            return (
              <View key={i} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isToday ? Colors.primary : Colors.textMuted, letterSpacing: 0.5 }}>{DAYS_SHORT[i]}</Text>
                <View style={[
                  { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
                  isToday && { borderColor: Colors.primary, borderWidth: 2 },
                  isComplete && { backgroundColor: '#8B9A6B', borderColor: '#8B9A6B' },
                  d.isRest && { borderColor: '#2A2A2A', borderStyle: 'dashed' as any },
                ]}>
                  {isComplete && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.black }} />}
                </View>
              </View>
            );
          })}
        </View>

        {todayDay?.isRest ? (
          <View style={{ backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 20, alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.primary, letterSpacing: 1.5, marginBottom: 6 }}>REST DAY</Text>
            <Text style={{ fontSize: 13, color: Colors.textSecondary, textAlign: 'center' }}>Recovery is part of the work. Get some sleep.</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 16, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 4 }}>TODAY'S FOCUS</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.textPrimary }}>{todayDay?.focus || 'Training'}</Text>
              </View>
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} color={Colors.textMuted} />
                  <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '600' }}>{totalMinutes}m</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Dumbbell size={12} color={Colors.textMuted} />
                  <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '600' }}>{todayDrills.length}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13 }} onPress={handleStart} activeOpacity={0.85}>
              <Play size={16} color={Colors.black} fill={Colors.black} />
              <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.black, letterSpacing: 0.5 }}>{doneCount > 0 ? 'CONTINUE SESSION' : 'START SESSION'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!todayDay?.isRest && (
          <View style={{ gap: 8 }}>
            {todayDrills.map((drill, i) => {
              const done = completedDrills[currentDayIndex + '-' + i];
              const Icon = getDrillIcon(drill.type);
              const color = getDrillColor(drill.type);
              return (
                <View key={i} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: 12, paddingVertical: 10 }, done && { opacity: 0.5 }]}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, backgroundColor: color + '20', borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={14} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 }, done && { textDecorationLine: 'line-through' }]} numberOfLines={1}>{drill.name}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>{drill.time || ((drill.duration || 5) + 'min')}</Text>
                  </View>
                  {done && <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#8B9A6B', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '900', color: Colors.black }}>✓</Text></View>}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.background },
  qh: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 14 },
  bb: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  bt: { fontSize: 22, color: Colors.textSecondary },
  pc: { flex: 1 }, pt: { height: 4, backgroundColor: Colors.surface, borderRadius: 2, overflow: 'hidden' },
  pf: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  st: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', minWidth: 36, textAlign: 'right' },
  sl: { fontSize: 12, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1.5, paddingHorizontal: 24, marginBottom: 4 },
  qc: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  q: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, lineHeight: 34, marginBottom: 8 },
  qs: { fontSize: 15, color: Colors.textSecondary, marginBottom: 28, lineHeight: 21 },
  oc: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.surfaceBorder, paddingVertical: 18, paddingHorizontal: 20 },
  os: { borderColor: Colors.primary, backgroundColor: '#1A1708' }, od: { opacity: 0.4 },
  ol: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary }, ols: { color: Colors.primary },
  osu: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  rd: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.surfaceBorder, alignItems: 'center', justifyContent: 'center' },
  rds: { borderColor: Colors.primary }, rdi: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  ck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.surfaceBorder, alignItems: 'center', justifyContent: 'center' },
  cks: { borderColor: Colors.primary, backgroundColor: Colors.primary }, cki: { width: 12, height: 12, borderRadius: 2, backgroundColor: Colors.black },
  bn: { paddingHorizontal: 24, paddingBottom: 16 },
  cb: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  cd: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder },
  ct: { fontSize: 15, fontWeight: '800', color: Colors.black, letterSpacing: 2 },
  is: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 36 },
  ii: { width: 280, height: 280, marginBottom: 32 },
  it: { fontSize: 24, fontWeight: '800', color: Colors.primary, textAlign: 'center', lineHeight: 32, marginBottom: 16 },
  ib: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  ls: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  lp: { fontSize: 52, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  lt: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 24 },
  lbt: { width: '100%', height: 8, backgroundColor: Colors.surface, borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  lbf: { height: 8, backgroundColor: Colors.primary, borderRadius: 4 },
  lsu: { fontSize: 14, color: Colors.textSecondary },
});
