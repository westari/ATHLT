import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Image,
  Animated, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Play, Flame, Clock, Dumbbell, Target, Zap, Wind, Activity, Upload, Check, X, ChevronRight } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import AuthScreen from '@/components/AuthScreen';
import { usePlanStore } from '@/store/planStore';

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface OnboardingStep {
  type: 'question' | 'info' | 'text' | 'age' | 'height' | 'weight';
  id?: string; question?: string; subtitle?: string; placeholder?: string;
  selectType?: 'select' | 'multiselect'; section?: string;
  options?: { label: string; subtitle?: string; disabled?: boolean }[];
  infoTitle?: string; infoBody?: string; infoImage?: any;
}

const INFO_IMAGES = {
  dribble: require('@/assets/images/coach-x-small.png'),
  pointing: require('@/assets/images/coach-x-small.png'),
  clipboard: require('@/assets/images/coach-x-small.png'),
};

const AGE_OPTIONS = ['13 or under', '14', '15', '16', '17', '18+'];

// Heights from 4'8" to 7'0"
const HEIGHT_OPTIONS = (() => {
  const arr: string[] = [];
  for (let ft = 4; ft <= 7; ft++) {
    const maxIn = ft === 7 ? 0 : 11;
    const minIn = ft === 4 ? 8 : 0;
    for (let inch = minIn; inch <= maxIn; inch++) {
      arr.push(ft + "'" + inch + '"');
    }
  }
  return arr;
})();

// Weights from 70 to 280 lbs in 5 lb increments
const WEIGHT_OPTIONS = (() => {
  const arr: string[] = [];
  for (let w = 70; w <= 280; w += 5) arr.push(w + ' lbs');
  return arr;
})();

const ONBOARDING_STEPS: OnboardingStep[] = [
  { type:'question',id:'sport',section:'About You',question:'What sport do you play?',subtitle:"We'll tailor everything to your game.",selectType:'select',
    options:[{label:'Basketball'},{label:'Soccer',subtitle:'Coming soon',disabled:true},{label:'Baseball',subtitle:'Coming soon',disabled:true},{label:'Football',subtitle:'Coming soon',disabled:true}] },
  { type:'question',id:'position',section:'About You',question:'What position do you play?',subtitle:'This shapes your skill priorities.',selectType:'select',
    options:[{label:'Point Guard'},{label:'Shooting Guard'},{label:'Small Forward'},{label:'Power Forward'},{label:'Center'}] },
  { type:'question',id:'experience',section:'About You',question:'How long have you been playing?',subtitle:'So we match the right intensity.',selectType:'select',
    options:[{label:'Less than a year'},{label:'1-2 years'},{label:'3-5 years'},{label:'6-10 years'},{label:'10+ years'}] },
  { type:'age',id:'age',section:'About You',question:'How old are you?',subtitle:'Helps me pick the right intensity for you.' },
  { type:'height',id:'height',section:'About You',question:'How tall are you?',subtitle:'Affects which finishing and defense moves fit your game.' },
  { type:'weight',id:'weight',section:'About You',question:'How much do you weigh?',subtitle:'Helps me dial in conditioning and contact drills.' },
  { type:'text',id:'description',section:'About You',question:'Describe yourself.',subtitle:"So Coach X knows who you are when watching your film. Jersey color, hair, anything.",placeholder:'e.g. red jersey #5, curly hair' },
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
  { id:'one_on_one', clipType:'1on1', title:'One-on-One', instruction:'A possession of you playing 1-on-1', detail:'Half court is fine.' },
  { id:'threes', clipType:'threes', title:'Open Threes', instruction:'2 open three pointers', detail:'No defender. Show me your form.' },
  { id:'dribble', clipType:'dribble', title:'Dribble Combo', instruction:'Basic dribble combo moves', detail:'Crossover, between the legs, behind the back.' },
  { id:'game', clipType:'game', title:'Game Footage', instruction:'Footage from a real game', detail:"No game footage? Film yourself finishing with each hand instead." },
];

const LOADING_STEPS = [
  'Watching your one-on-one',
  'Analyzing your shooting form',
  'Reviewing your handle',
  'Studying your game',
  'Scoring your skills',
  'Building your plan',
];

const FOCUS_OPTIONS = [
  { id: 'Ball handling', label: 'Ball Handling' },
  { id: 'Shooting', label: 'Shooting' },
  { id: 'Defense', label: 'Defense' },
  { id: 'Finishing at the rim', label: 'Finishing' },
  { id: 'Speed & agility', label: 'Speed & Agility' },
  { id: 'Basketball IQ', label: 'Basketball IQ' },
];

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, profile, completedDrills, currentDayIndex, currentStreak, loadFromStorage, setPlan, setProfile, setSkillLevels } = usePlanStore();

  const [appState, setAppState] = useState<'loading'|'welcome'|'onboarding'|'auth'|'readback'|'focuspick'|'assessment'|'analyzing'|'results'|'plan'>('loading');
  const [isReady, setIsReady] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string|string[]>>({});
  const [textInput, setTextInput] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Readback / focus pick
  const [readbackText, setReadbackText] = useState('');
  const [readbackFocus, setReadbackFocus] = useState('');
  const [readbackLoading, setReadbackLoading] = useState(false);
  const [chosenFocus, setChosenFocus] = useState('');

  // Assessment
  const [clipUrls, setClipUrls] = useState<Record<string, string>>({});
  const [uploadingClipId, setUploadingClipId] = useState<string | null>(null);
  const [assessError, setAssessError] = useState('');

  // Results
  const [resultsSkills, setResultsSkills] = useState<Record<string, number>>({});
  const [resultsCoachNote, setResultsCoachNote] = useState('');

  useEffect(() => { loadFromStorage().then(() => setIsReady(true)); }, []);
  useEffect(() => { if (isReady) { if (profile && plan) setAppState('plan'); else setAppState('welcome'); } }, [isReady, profile, plan]);
  useEffect(() => { if (appState === 'analyzing') Animated.timing(progressAnim, { toValue: loadingProgress, duration: 800, useNativeDriver: false }).start(); }, [loadingProgress, appState]);

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

  const handleTextSubmit = () => {
    const st = ONBOARDING_STEPS[quizStep];
    if (!st.id || !textInput.trim()) return;
    setAnswers({...answers, [st.id]: textInput.trim()});
    setTextInput('');
    goNext();
  };

  const handlePickerChange = (id: string, value: string) => {
    setAnswers({ ...answers, [id]: value });
  };

  const goNext = () => {
    if (quizStep < ONBOARDING_STEPS.length-1) {
      const next = ONBOARDING_STEPS[quizStep+1];
      if (next.type === 'text' && next.id) setTextInput((answers[next.id] as string) || '');
      animTrans('forward',()=>setQuizStep(quizStep+1));
    } else {
      // Last question done - go to readback
      startReadback();
    }
  };
  const goBack = () => {
    if (quizStep > 0) {
      const prev = ONBOARDING_STEPS[quizStep-1];
      if (prev.type === 'text' && prev.id) setTextInput((answers[prev.id] as string) || '');
      animTrans('back',()=>setQuizStep(quizStep-1));
    } else {
      setAppState('welcome');
    }
  };

  // ============ READBACK FLOW ============
  const startReadback = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAppState('readback');
    setReadbackLoading(true);
    setReadbackText('');
    setReadbackFocus('');
    try {
      const r = await fetch('https://collectiq-xi.vercel.app/api/readback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });
      const data = await r.json();
      if (r.ok && data.readback) {
        setReadbackText(data.readback);
        setReadbackFocus(data.suggestedFocus || (answers.weakness as string) || '');
      } else {
        // Fallback if backend fails
        setReadbackText(buildFallbackReadback());
        setReadbackFocus((answers.weakness as string) || 'Ball handling');
      }
    } catch (e) {
      setReadbackText(buildFallbackReadback());
      setReadbackFocus((answers.weakness as string) || 'Ball handling');
    }
    setReadbackLoading(false);
  };

  const buildFallbackReadback = () => {
    const age = answers.age || '';
    const pos = answers.position || '';
    const exp = answers.experience || '';
    const weak = answers.weakness || '';
    return 'Alright. ' + age + ' year old ' + pos + ', ' + exp + ' playing. You told me your weakness is ' + (weak as string).toLowerCase() + '. Sound right?';
  };

  const handleReadbackYes = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChosenFocus(readbackFocus);
    setAppState('focuspick');
  };

  const handleReadbackNo = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Skip readback agreement, let them pick the focus themselves
    setChosenFocus('');
    setAppState('focuspick');
  };

  const handleFocusConfirm = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Update weakness in answers to match chosen focus, then go to auth
    const updatedAnswers = { ...answers, weakness: chosenFocus };
    setAnswers(updatedAnswers);
    setAppState('auth');
  };

  // ============ ASSESSMENT ============

  const uploadClip = async (clipId: string, uri: string) => {
    setUploadingClipId(clipId);
    setAssessError('');
    try {
      const fileName = 'assess_' + clipId + '_' + Date.now() + '.mp4';
      const formData = new FormData();
      formData.append('file', { uri: uri, type: 'video/mp4', name: fileName } as any);
      const supabaseUrl = 'https://tvtojlwdpipntkktguck.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2dG9qbHdkcGlwbnRra3RndWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODMxNDYsImV4cCI6MjA5MTA1OTE0Nn0.9GiDMwjhdZNotoJT_mFlxvxgns0I0pgjVNmM1oyPqFY';
      const uploadRes = await fetch(supabaseUrl + '/storage/v1/object/films/' + fileName, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + supabaseKey, 'apikey': supabaseKey },
        body: formData,
      });
      if (!uploadRes.ok) {
        setAssessError('Upload failed. Try a shorter clip.');
        setUploadingClipId(null);
        return;
      }
      const videoUrl = supabaseUrl + '/storage/v1/object/public/films/' + fileName;
      setClipUrls(prev => ({ ...prev, [clipId]: videoUrl }));
    } catch (e) {
      setAssessError('Something went wrong. Try again.');
    }
    setUploadingClipId(null);
  };

  const pickClip = async (clipId: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('Permission needed', 'We need camera roll access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: true, videoMaxDuration: 30, quality: 0.3 });
    if (result.canceled || !result.assets[0]?.uri) return;
    await uploadClip(clipId, result.assets[0].uri);
  };

  const removeClip = (clipId: string) => {
    setClipUrls(prev => {
      const newUrls = { ...prev };
      delete newUrls[clipId];
      return newUrls;
    });
  };

  const buildProfileFromAnswers = () => ({
    sport: answers.sport as string, position: answers.position as string,
    experience: answers.experience as string, goal: answers.goal as string,
    weakness: answers.weakness as string, frequency: answers.frequency as string,
    duration: answers.duration as string, access: answers.access,
    driving: answers.driving as string, leftHand: answers.leftHand as string,
    pressure: answers.pressure as string, goToMove: answers.goToMove as string,
    threeConfidence: answers.threeConfidence as string, freeThrow: answers.freeThrow as string,
    age: answers.age as string, height: answers.height as string, weight: answers.weight as string,
  });

  const analyzeAllAndGenerate = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setAppState('analyzing');
    setLoadingProgress(0);
    setCurrentLoadingStep(0);

    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      stepIndex++;
      if (stepIndex < LOADING_STEPS.length) {
        setCurrentLoadingStep(stepIndex);
        setLoadingProgress(Math.round((stepIndex / LOADING_STEPS.length) * 90));
      }
    }, 8000);

    try {
      const playerDescription = answers.description as string || '';
      const analyzePromises = ASSESSMENT_CLIPS.map(clip => {
        if (!clipUrls[clip.id]) return Promise.resolve(null);
        return fetch('https://collectiq-xi.vercel.app/api/assess-clip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: clipUrls[clip.id],
            clipType: clip.clipType,
            playerDescription: playerDescription,
          }),
        }).then(r => r.json()).catch(() => null);
      });

      const results = await Promise.all(analyzePromises);

      const skillTotals: Record<string, { sum: number; count: number }> = {};
      results.forEach((a: any) => {
        if (!a) return;
        Object.keys(a).forEach((key) => {
          if (typeof a[key] === 'number' && key !== 'clipType') {
            if (!skillTotals[key]) skillTotals[key] = { sum: 0, count: 0 };
            skillTotals[key].sum += a[key];
            skillTotals[key].count += 1;
          }
        });
      });

      const finalSkills: Record<string, number> = {};
      Object.keys(skillTotals).forEach((skill) => {
        finalSkills[skill] = Math.round(skillTotals[skill].sum / skillTotals[skill].count);
      });

      setSkillLevels(finalSkills);
      setResultsSkills(finalSkills);

      setCurrentLoadingStep(LOADING_STEPS.length - 1);
      setLoadingProgress(95);

      const r = await fetch('https://collectiq-xi.vercel.app/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...answers, skillLevels: finalSkills }),
      });

      clearInterval(stepInterval);
      setLoadingProgress(100);
      const planData = await r.json();
      await new Promise(x => setTimeout(x, 800));

      if (r.ok && planData.days) {
        setPlan(planData);
        setProfile(buildProfileFromAnswers() as any);
        setResultsCoachNote(planData.coachSummary?.assessment || '');
        setAppState('results');
      } else {
        setAppState('welcome');
      }
    } catch (e) {
      clearInterval(stepInterval);
      setAppState('welcome');
    }
  };

  const skipAssessment = async () => {
    Alert.alert('Skip Assessment?', "Without seeing you play, your plan will be more generic.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Skip', style: 'destructive', onPress: async () => {
        setAppState('analyzing');
        const r = await fetch('https://collectiq-xi.vercel.app/api/generate-plan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(answers),
        });
        const planData = await r.json();
        if (r.ok && planData.days) {
          setPlan(planData);
          setProfile(buildProfileFromAnswers() as any);
          setAppState('plan');
        } else { setAppState('welcome'); }
      }},
    ]);
  };

  // ============ RENDER STATES ============

  if (appState === 'loading') return <View style={[s.c, { paddingTop: insets.top }]} />;

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

  if (appState === 'onboarding') {
    const st = ONBOARDING_STEPS[quizStep];
    const tq = ONBOARDING_STEPS.filter(x => x.type === 'question' || x.type === 'text' || x.type === 'age' || x.type === 'height' || x.type === 'weight').length;
    const cq = ONBOARDING_STEPS.slice(0, quizStep + 1).filter(x => x.type === 'question' || x.type === 'text' || x.type === 'age' || x.type === 'height' || x.type === 'weight').length;
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

    if (st.type === 'text') return (
      <KeyboardAvoidingView style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.qh}>
          <TouchableOpacity onPress={goBack} style={s.bb}><Text style={s.bt}>←</Text></TouchableOpacity>
          <View style={s.pc}><View style={s.pt}><View style={[s.pf, { width: (pr * 100) + '%' }]} /></View></View>
          <Text style={s.st}>{cq}/{tq}</Text>
        </View>
        {st.section && <Text style={s.sl}>{st.section}</Text>}
        <ScrollView contentContainerStyle={s.qc} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.q}>{st.question}</Text>
          {st.subtitle && <Text style={s.qs}>{st.subtitle}</Text>}
          <TextInput
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: textInput ? Colors.primary : Colors.surfaceBorder,
              padding: 18,
              fontSize: 16,
              color: Colors.textPrimary,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
            value={textInput}
            onChangeText={setTextInput}
            placeholder={st.placeholder}
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={200}
            autoFocus
          />
          <Text style={{ fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: 8 }}>{textInput.length}/200</Text>
        </ScrollView>
        <View style={s.bn}>
          <TouchableOpacity
            style={[s.cb, !textInput.trim() && s.cd]}
            onPress={handleTextSubmit}
            activeOpacity={0.85}
            disabled={!textInput.trim()}
          >
            <Text style={[s.ct, !textInput.trim() && { color: Colors.textMuted }]}>CONTINUE</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );

    // PICKER WHEEL screens (age / height / weight)
    if (st.type === 'age' || st.type === 'height' || st.type === 'weight') {
      const opts = st.type === 'age' ? AGE_OPTIONS : st.type === 'height' ? HEIGHT_OPTIONS : WEIGHT_OPTIONS;
      const defaultIdx = st.type === 'age' ? 1 : st.type === 'height' ? HEIGHT_OPTIONS.indexOf("5'8\"") : WEIGHT_OPTIONS.indexOf('140 lbs');
      const currentVal = (st.id && answers[st.id] as string) || opts[defaultIdx >= 0 ? defaultIdx : 0];

      return (
        <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={s.qh}>
            <TouchableOpacity onPress={goBack} style={s.bb}><Text style={s.bt}>←</Text></TouchableOpacity>
            <View style={s.pc}><View style={s.pt}><View style={[s.pf, { width: (pr * 100) + '%' }]} /></View></View>
            <Text style={s.st}>{cq}/{tq}</Text>
          </View>
          {st.section && <Text style={s.sl}>{st.section}</Text>}
          <View style={s.qc}>
            <Text style={s.q}>{st.question}</Text>
            {st.subtitle && <Text style={s.qs}>{st.subtitle}</Text>}
            <View style={{ backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder, marginTop: 12, overflow: 'hidden' }}>
              <Picker
                selectedValue={currentVal}
                onValueChange={(v) => st.id && handlePickerChange(st.id, v as string)}
                style={Platform.OS === 'ios' ? { height: 220 } : { color: Colors.textPrimary, height: 220, backgroundColor: Colors.surface }}
                itemStyle={{ color: Colors.textPrimary, fontSize: 22, fontWeight: '700' }}
                dropdownIconColor={Colors.primary}
              >
                {opts.map(o => <Picker.Item key={o} label={o} value={o} color={Platform.OS === 'android' ? '#000' : Colors.textPrimary} />)}
              </Picker>
            </View>
          </View>
          <View style={s.bn}>
            <TouchableOpacity
              style={[s.cb, !canGo() && s.cd]}
              onPress={() => {
                // If no value chosen yet, set default
                if (st.id && !answers[st.id]) {
                  setAnswers({ ...answers, [st.id]: currentVal });
                  setTimeout(() => goNext(), 50);
                } else {
                  goNext();
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={s.ct}>CONTINUE</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

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

  // READBACK SCREEN
  if (appState === 'readback') {
    return (
      <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Image source={require('@/assets/images/coach-x-small.png')} style={{ width: 44, height: 44, borderRadius: 22 }} resizeMode="cover" />
            <View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.primary }}>Coach X</Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>{readbackLoading ? 'Reading you...' : 'Sizing you up'}</Text>
            </View>
          </View>

          {readbackLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 16 }}>Coach X is taking it all in...</Text>
            </View>
          ) : (
            <>
              {/* Speech bubble */}
              <View style={{ backgroundColor: '#1F1A0A', borderRadius: 18, borderWidth: 1.5, borderColor: Colors.primary, padding: 22, marginBottom: 24 }}>
                <Text style={{ fontSize: 17, color: Colors.textPrimary, lineHeight: 26 }}>{readbackText}</Text>
              </View>

              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 12, textAlign: 'center' }}>DID I READ YOU RIGHT?</Text>

              <TouchableOpacity
                style={{ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginBottom: 10 }}
                onPress={handleReadbackYes}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 15, fontWeight: '900', color: Colors.black, letterSpacing: 1.5 }}>YES, THAT'S ME</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: Colors.surface, borderRadius: 14, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: Colors.surfaceBorder }}
                onPress={handleReadbackNo}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 }}>NOT QUITE</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // FOCUS PICK SCREEN
  if (appState === 'focuspick') {
    return (
      <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Image source={require('@/assets/images/coach-x-small.png')} style={{ width: 44, height: 44, borderRadius: 22 }} resizeMode="cover" />
            <View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.primary }}>Coach X</Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>Picking your focus</Text>
            </View>
          </View>

          <View style={{ backgroundColor: '#1F1A0A', borderRadius: 18, borderWidth: 1.5, borderColor: Colors.primary, padding: 22, marginBottom: 24 }}>
            <Text style={{ fontSize: 17, color: Colors.textPrimary, lineHeight: 26 }}>
              {chosenFocus
                ? "Alright. I'm thinking we start with " + chosenFocus.toLowerCase() + ". Lock that down and the rest of your game opens up. Sound good?"
                : "Alright, you tell me. What do you want to start with?"}
            </Text>
          </View>

          <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 12 }}>{chosenFocus ? 'OR PICK SOMETHING ELSE' : 'PICK YOUR STARTING FOCUS'}</Text>

          <View style={{ gap: 10, marginBottom: 20 }}>
            {FOCUS_OPTIONS.map(opt => {
              const sel = chosenFocus === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.oc, sel && s.os]}
                  onPress={() => {
                    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setChosenFocus(opt.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.ol, sel && s.ols]}>{opt.label}</Text>
                  </View>
                  <View style={[s.rd, sel && s.rds]}>
                    {sel && <View style={s.rdi} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <View style={s.bn}>
          <TouchableOpacity
            style={[s.cb, !chosenFocus && s.cd]}
            onPress={handleFocusConfirm}
            activeOpacity={0.85}
            disabled={!chosenFocus}
          >
            <Text style={[s.ct, !chosenFocus && { color: Colors.textMuted }]}>LET'S GO</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (appState === 'auth') {
    return <AuthScreen onComplete={() => setAppState('assessment')} onBack={() => setAppState('focuspick')} />;
  }

  // ASSESSMENT
  if (appState === 'assessment') {
    const uploadedCount = Object.keys(clipUrls).length;
    const allUploaded = uploadedCount === ASSESSMENT_CLIPS.length;

    return (
      <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 16 }}>
            <Image source={require('@/assets/images/coach-x-small.png')} style={{ width: 36, height: 36, borderRadius: 18 }} resizeMode="cover" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.primary }}>Coach X</Text>
          </View>

          <Text style={{ fontSize: 26, fontWeight: '900', color: Colors.textPrimary, marginBottom: 8, lineHeight: 32 }}>Show me your game</Text>
          <Text style={{ fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24 }}>Upload 4 short clips so I can score your skills and build a plan around how you actually play.</Text>

          {assessError ? <Text style={{ fontSize: 13, color: '#C47A6C', backgroundColor: '#2A1515', borderRadius: 10, padding: 12, marginBottom: 16 }}>{assessError}</Text> : null}

          <View style={{ gap: 10, marginBottom: 20 }}>
            {ASSESSMENT_CLIPS.map((clip) => {
              const uploaded = !!clipUrls[clip.id];
              const uploading = uploadingClipId === clip.id;
              return (
                <TouchableOpacity
                  key={clip.id}
                  style={{
                    backgroundColor: uploaded ? '#0F1A0F' : Colors.surface,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: uploaded ? '#1A2D1A' : Colors.surfaceBorder,
                    padding: 16,
                  }}
                  onPress={() => !uploading && pickClip(clip.id)}
                  activeOpacity={0.7}
                  disabled={uploading}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    {uploaded ? (
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#8B9A6B', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={20} color={Colors.black} />
                      </View>
                    ) : uploading ? (
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceBorder, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                      </View>
                    ) : (
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceBorder, alignItems: 'center', justifyContent: 'center' }}>
                        <Upload size={18} color={Colors.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 }}>{clip.title}</Text>
                      <Text style={{ fontSize: 12, color: Colors.textMuted, lineHeight: 16 }}>{clip.instruction}</Text>
                      {clip.detail && <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2, fontStyle: 'italic' }}>{clip.detail}</Text>}
                    </View>
                    {uploaded && (
                      <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeClip(clip.id); }} style={{ padding: 6 }}>
                        <X size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: 16 }}>{uploadedCount}/{ASSESSMENT_CLIPS.length} clips uploaded</Text>

          <TouchableOpacity
            style={{ backgroundColor: allUploaded ? Colors.primary : Colors.surface, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: allUploaded ? Colors.primary : Colors.surfaceBorder }}
            onPress={analyzeAllAndGenerate}
            activeOpacity={0.85}
            disabled={!allUploaded}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: allUploaded ? Colors.black : Colors.textMuted, letterSpacing: 1 }}>{allUploaded ? 'ANALYZE & BUILD MY PLAN' : 'UPLOAD ALL 4 CLIPS'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={skipAssessment} style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline' }}>Skip assessment</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ANALYZING
  if (appState === 'analyzing') {
    return (
      <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.ls}>
          <Text style={s.lp}>{loadingProgress}%</Text>
          <Text style={s.lt}>{LOADING_STEPS[currentLoadingStep]}</Text>
          <View style={s.lbt}>
            <Animated.View style={[s.lbf, { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
          </View>
          <Text style={s.lsu}>Coach X is studying your game...</Text>
          <View style={s.lc}>
            <Text style={s.lct}>What's happening</Text>
            {LOADING_STEPS.map((step, i) => {
              const done = i < currentLoadingStep;
              const active = i === currentLoadingStep;
              return (
                <View key={i} style={s.lci}>
                  <View style={[s.lcc, (done || active) && s.lcd]}>
                    {done && <Text style={s.lcm}>✓</Text>}
                  </View>
                  <Text style={[s.lcx, (done || active) && s.lcxd]}>{step}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  // RESULTS
  if (appState === 'results') {
    const SKILL_LABELS: Record<string, string> = {
      ballHandling: 'Ball Handling', shooting: 'Shooting', shotForm: 'Shot Form',
      finishing: 'Finishing', defense: 'Defense', iq: 'Basketball IQ',
      athleticism: 'Athleticism', weakHand: 'Weak Hand', creativity: 'Creativity',
      touch: 'Touch', courtVision: 'Court Vision', decisionMaking: 'Decision Making',
    };
    const skillEntries = Object.entries(resultsSkills).sort((a, b) => b[1] - a[1]);
    const avgLevel = skillEntries.length > 0 ? skillEntries.reduce((sum, e) => sum + e[1], 0) / skillEntries.length : 0;

    return (
      <View style={[s.c, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 20 }}>
            <Image source={require('@/assets/images/coach-x-small.png')} style={{ width: 44, height: 44, borderRadius: 22 }} resizeMode="cover" />
            <View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.primary }}>Coach X</Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>Just finished watching you</Text>
            </View>
          </View>

          {resultsCoachNote && (
            <View style={{ backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 18, marginBottom: 16 }}>
              <Text style={{ fontSize: 15, color: Colors.textPrimary, lineHeight: 22 }}>{resultsCoachNote}</Text>
            </View>
          )}

          <View style={{ backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 2, borderColor: Colors.primary, padding: 22, alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 8 }}>YOUR OVERALL RATING</Text>
            <Text style={{ fontSize: 52, fontWeight: '900', color: Colors.primary, lineHeight: 58 }}>{avgLevel.toFixed(1)}<Text style={{ fontSize: 22, color: Colors.textMuted, fontWeight: '700' }}>/10</Text></Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 4 }}>This will go up as you train</Text>
          </View>

          <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 }}>SKILL BREAKDOWN</Text>
          <View style={{ gap: 8, marginBottom: 20 }}>
            {skillEntries.map((entry) => {
              const skillKey = entry[0];
              const level = entry[1];
              const label = SKILL_LABELS[skillKey] || skillKey;
              const color = level >= 7 ? '#8B9A6B' : level >= 5 ? Colors.primary : level >= 3 ? '#B08D57' : '#C47A6C';
              return (
                <View key={skillKey} style={{ backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textPrimary }}>{label}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: color }}>{level}/10</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: '#1A1A1A', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ height: 6, borderRadius: 3, width: (level * 10) + '%', backgroundColor: color }} />
                  </View>
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 18 }}
            onPress={() => setAppState('plan')}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: Colors.black, letterSpacing: 1 }}>SEE MY PLAN</Text>
            <ChevronRight size={18} color={Colors.black} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // PLAN VIEW
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
                <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.textPrimary }} numberOfLines={2}>{todayDay?.focus || 'Training'}</Text>
              </View>
              <View style={{ gap: 4, marginLeft: 12 }}>
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
  ls: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingTop: 20 },
  lp: { fontSize: 48, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  lt: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 18 },
  lbt: { width: '100%', height: 6, backgroundColor: Colors.surface, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  lbf: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
  lsu: { fontSize: 13, color: Colors.textSecondary, marginBottom: 24 },
  lc: { width: '100%', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 18 },
  lct: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  lci: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  lcc: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.surfaceBorder, alignItems: 'center', justifyContent: 'center' },
  lcd: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  lcm: { fontSize: 11, color: Colors.black, fontWeight: '800' },
  lcx: { fontSize: 12, color: Colors.textMuted, flex: 1 },
  lcxd: { color: Colors.textPrimary },
});
