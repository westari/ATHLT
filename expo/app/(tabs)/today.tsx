import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import type { PlanDay } from '@/store/planStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TYPE_COLORS: Record<string, string> = {
  warmup: '#8B9A6B', skill: Colors.primary, shooting: '#B08D57', conditioning: '#C47A6C',
};
const TYPE_LABELS: Record<string, string> = {
  warmup: 'WARMUP', skill: 'SKILL WORK', shooting: 'SHOOTING', conditioning: 'CONDITIONING',
};

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
  { type:'question',id:'sport',section:'About You',question:'What sport do you play?',subtitle:'We\'ll tailor everything to your game.',selectType:'select',
    options:[{label:'Basketball'},{label:'Soccer',subtitle:'Coming soon',disabled:true},{label:'Baseball',subtitle:'Coming soon',disabled:true},{label:'Football',subtitle:'Coming soon',disabled:true}] },
  { type:'question',id:'position',section:'About You',question:'What position do you play?',subtitle:'This shapes your skill priorities.',selectType:'select',
    options:[{label:'Point Guard'},{label:'Shooting Guard'},{label:'Small Forward'},{label:'Power Forward'},{label:'Center'}] },
  { type:'question',id:'experience',section:'About You',question:'How long have you been playing?',subtitle:'So we match the right intensity.',selectType:'select',
    options:[{label:'Less than a year',subtitle:'Just getting started'},{label:'1-2 years',subtitle:'Learning the fundamentals'},{label:'3-5 years',subtitle:'Most school team players'},{label:'6-10 years',subtitle:'Most varsity / travel players'},{label:'10+ years',subtitle:'College level and beyond'}] },
  { type:'info',infoImage:INFO_IMAGES.dribble,infoTitle:'Now let\'s see what you\'re made of.',infoBody:'The best players don\'t just practice what they\'re good at. They attack their weaknesses head on.' },
  { type:'question',id:'goal',section:'Your Goals',question:'What do you want to improve most?',subtitle:'Pick the one that matters most right now.',selectType:'select',
    options:[{label:'Become a better scorer'},{label:'Improve my defense'},{label:'Get faster and more athletic'},{label:'Become a more complete player'},{label:'Get recruited / play at the next level'}] },
  { type:'question',id:'weakness',section:'Your Goals',question:'What part of your game needs the most work?',subtitle:'We\'ll focus most of your plan here.',selectType:'select',
    options:[{label:'Shooting'},{label:'Ball handling'},{label:'Defense'},{label:'Finishing at the rim'},{label:'Speed & agility'},{label:'Basketball IQ'}] },
  { type:'info',infoImage:INFO_IMAGES.pointing,infoTitle:'Most players avoid what\'s hard. Not you.',infoBody:'Your plan will be different. We\'re going to push you exactly where it matters most.' },
  { type:'question',id:'driving',section:'How You Play',question:'When you drive to the basket, what usually happens?',subtitle:'Be honest.',selectType:'select',
    options:[{label:'I usually score'},{label:'I get blocked or altered'},{label:'I pass it out'},{label:'I lose the ball'},{label:'I don\'t really drive'}] },
  { type:'question',id:'leftHand',section:'How You Play',question:'How\'s your left hand?',subtitle:'Your weak hand tells us a lot.',selectType:'select',
    options:[{label:'Strong — I finish with both hands'},{label:'Getting there — I use it sometimes'},{label:'Weak — I avoid it'},{label:'I only use my right hand'}] },
  { type:'question',id:'pressure',section:'How You Play',question:'What happens when you\'re guarded tight?',selectType:'select',
    options:[{label:'I can still create my shot'},{label:'I struggle but fight through'},{label:'I usually pass it away'},{label:'I turn it over'}] },
  { type:'question',id:'goToMove',section:'How You Play',question:'What\'s your go-to move?',subtitle:'We\'ll help you build on it.',selectType:'select',
    options:[{label:'Pull-up jumper'},{label:'Drive right'},{label:'Drive left'},{label:'Three pointer'},{label:'Post up'},{label:'I don\'t have one yet'}] },
  { type:'question',id:'threeConfidence',section:'How You Play',question:'How confident are you shooting threes?',selectType:'select',
    options:[{label:'Very — I\'m a shooter'},{label:'Somewhat — I\'ll take open ones'},{label:'Not really — I prefer mid-range'},{label:'I don\'t shoot them'}] },
  { type:'question',id:'freeThrow',section:'How You Play',question:'What\'s your free throw percentage?',subtitle:'Best guess is fine.',selectType:'select',
    options:[{label:'80% or higher'},{label:'60-80%'},{label:'40-60%'},{label:'Below 40%'},{label:'No idea'}] },
  { type:'info',infoImage:INFO_IMAGES.clipboard,infoTitle:'Your plan is about to be built around your game.',infoBody:'Most apps give everyone the same plan. We just learned how you actually play — that changes everything.' },
  { type:'question',id:'frequency',section:'Your Schedule',question:'How often can you train?',subtitle:'Outside of team practice.',selectType:'select',
    options:[{label:'Once or twice a week'},{label:'3-4 times a week'},{label:'5-6 times a week'},{label:'Every day'}] },
  { type:'question',id:'duration',section:'Your Schedule',question:'How long do you want each session?',subtitle:'You can change this before every session.',selectType:'select',
    options:[{label:'20-30 minutes',subtitle:'Quick and focused'},{label:'30-45 minutes',subtitle:'Solid session'},{label:'45-60 minutes',subtitle:'Full workout'},{label:'60-90 minutes',subtitle:'Intensive training'}] },
  { type:'question',id:'access',section:'Your Schedule',question:'Where do you usually train?',subtitle:'Pick all that apply.',selectType:'multiselect',
    options:[{label:'Full court with hoop'},{label:'Half court with hoop'},{label:'Driveway with hoop'},{label:'Gym with weights'},{label:'Open space (no hoop)'}] },
];

const LOADING_STEPS = ['Analyzing your player profile','Selecting drills for your position','Focusing on your weakness areas','Building daily sessions','Optimizing your schedule','Finalizing your training plan'];

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, profile, completedDrills, toggleDrill, currentStreak, totalSessions, loadFromStorage, setPlan, setProfile } = usePlanStore();
  const [appState, setAppState] = useState<'loading'|'welcome'|'onboarding'|'generating'|'coach'|'plan'>('loading');
  const [isReady, setIsReady] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string|string[]>>({});
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [expandedDrill, setExpandedDrill] = useState<number|null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  useEffect(() => { loadFromStorage().then(() => setIsReady(true)); }, []);
  useEffect(() => { if (isReady) { if (profile && plan) setAppState('plan'); else setAppState('welcome'); } }, [isReady, profile, plan]);
  useEffect(() => { if (plan?.days) { const t = DAYS_OF_WEEK[new Date().getDay()]; const i = plan.days.findIndex(d => d.day.toLowerCase().startsWith(t.toLowerCase().slice(0,3))); if (i >= 0) setSelectedDayIndex(i); } }, [plan]);
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
    if (st.selectType === 'multiselect') { const c = (answers[st.id] as string[])||[]; setAnswers({...answers,[st.id]:c.includes(opt)?c.filter(o=>o!==opt):[...c,opt]}); }
    else { setAnswers({...answers,[st.id]:opt}); setTimeout(() => goNext(), 300); }
  };
  const goNext = () => { if (quizStep < ONBOARDING_STEPS.length-1) animTrans('forward',()=>setQuizStep(quizStep+1)); else handleGen(); };
  const goBack = () => { if (quizStep > 0) animTrans('back',()=>setQuizStep(quizStep-1)); else setAppState('welcome'); };
  const handleGen = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setAppState('generating'); setLoadingProgress(0); setCurrentLoadingStep(0);
    let si = 0; const iv = setInterval(() => { si++; if (si <= LOADING_STEPS.length) { setCurrentLoadingStep(si); setLoadingProgress(Math.round((si/LOADING_STEPS.length)*95)); } }, 2000);
    try {
      const r = await fetch('https://collectiq-xi.vercel.app/api/generate-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(answers)});
      clearInterval(iv); setLoadingProgress(100); setCurrentLoadingStep(LOADING_STEPS.length);
      const res = await r.json(); await new Promise(x=>setTimeout(x,1000));
      if (r.ok && res.days) { setPlan(res); setProfile({sport:answers.sport as string,position:answers.position as string,experience:answers.experience as string,goal:answers.goal as string,weakness:answers.weakness as string,frequency:answers.frequency as string,duration:answers.duration as string,access:answers.access,driving:answers.driving as string,leftHand:answers.leftHand as string,pressure:answers.pressure as string,goToMove:answers.goToMove as string,threeConfidence:answers.threeConfidence as string,freeThrow:answers.freeThrow as string}); setAppState(res.coachSummary?'coach':'plan'); }
      else setAppState('plan');
    } catch(e) { clearInterval(iv); setAppState('plan'); }
  };
  const isDone = (i: number) => completedDrills[`${selectedDayIndex}-${i}`]||false;

  if (appState === 'loading') return <View style={[z.c,{paddingTop:insets.top}]} />;

  if (appState === 'welcome') return (
    <View style={[z.c,{paddingTop:insets.top,paddingBottom:insets.bottom}]}>
      <ScrollView contentContainerStyle={{flexGrow:1,paddingHorizontal:20}} showsVerticalScrollIndicator={false}>
        <View style={{paddingTop:16,paddingBottom:24,alignItems:'center'}}><Image source={require('@/assets/images/logo.png')} style={{width:180,height:50}} resizeMode="contain" /></View>
        <View style={{backgroundColor:'#141414',borderRadius:20,borderWidth:1,borderColor:Colors.surfaceBorder,padding:20,marginBottom:28}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:20}}>
            <View><Text style={{fontSize:13,color:Colors.textMuted,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>TODAY'S SESSION</Text><Text style={{fontSize:22,fontWeight:'800',color:Colors.textPrimary}}>Left Hand Focus</Text></View>
            <View style={{backgroundColor:Colors.primary,borderRadius:8,paddingHorizontal:12,paddingVertical:6}}><Text style={{fontSize:12,fontWeight:'800',color:Colors.black}}>45 MIN</Text></View>
          </View>
          {[{name:'Dynamic warmup + ball handling',meta:'5 min',done:true},{name:'Left hand finishing package',meta:'20 min',active:true},{name:'Catch & shoot from weak spots',meta:'15 min'},{name:'Game-speed suicides',meta:'5 min',last:true}].map((d,i)=>(
            <View key={i} style={{flexDirection:'row',alignItems:'center',paddingVertical:14,borderBottomWidth:d.last?0:1,borderBottomColor:'#1E1E1E',gap:12}}>
              <View style={{width:10,height:10,borderRadius:5,borderWidth:1.5,borderColor:d.active?Colors.primary:Colors.textMuted,backgroundColor:d.active?Colors.primary:'transparent'}} />
              <View style={{flex:1}}><Text style={{fontSize:14,fontWeight:'600',color:d.active?Colors.textPrimary:Colors.textSecondary,marginBottom:2}}>{d.name}</Text><Text style={{fontSize:12,color:Colors.textMuted}}>{d.meta}</Text></View>
              {d.done&&<Text style={{fontSize:14,color:Colors.accent}}>✓</Text>}{d.active&&<Text style={{fontSize:16,color:Colors.primary,fontWeight:'700'}}>→</Text>}
            </View>))}
        </View>
        <Text style={{fontSize:26,fontWeight:'800',color:Colors.textPrimary,textAlign:'center',lineHeight:34,marginBottom:24}}>Training plans that know{'\n'}how you play.</Text>
        <TouchableOpacity style={{backgroundColor:Colors.primary,borderRadius:16,paddingVertical:20,alignItems:'center',width:'100%'}} onPress={()=>{if(Platform.OS!=='web')void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);setAppState('onboarding');}} activeOpacity={0.85}><Text style={{fontSize:15,fontWeight:'900',color:Colors.black,letterSpacing:2}}>GET STARTED</Text></TouchableOpacity>
        <TouchableOpacity style={{marginTop:18,paddingVertical:8}} activeOpacity={0.7}><Text style={{fontSize:13,color:Colors.textMuted,textAlign:'center'}}>Already have an account? <Text style={{color:Colors.primary,fontWeight:'600'}}>Sign in</Text></Text></TouchableOpacity>
      </ScrollView>
    </View>
  );

  if (appState === 'onboarding') {
    const st = ONBOARDING_STEPS[quizStep];
    const tq = ONBOARDING_STEPS.filter(x=>x.type==='question').length;
    const cq = ONBOARDING_STEPS.slice(0,quizStep+1).filter(x=>x.type==='question').length;
    const pr = (quizStep+1)/ONBOARDING_STEPS.length;
    const isSel = (o:string) => { if(!st.id)return false; const a=answers[st.id]; return Array.isArray(a)?a.includes(o):a===o; };
    const canGo = () => { if(!st.id)return true; const a=answers[st.id]; if(!a)return false; if(Array.isArray(a)&&a.length===0)return false; return true; };

    if (st.type === 'info') return (
      <View style={[z.c,{paddingTop:insets.top,paddingBottom:insets.bottom}]}>
        <View style={z.qh}><TouchableOpacity onPress={goBack} style={z.bb}><Text style={z.bt}>←</Text></TouchableOpacity><View style={z.pc}><View style={z.pt}><View style={[z.pf,{width:`${pr*100}%`}]} /></View></View><View style={{width:60}} /></View>
        <Animated.View style={[z.is,{opacity:fadeAnim,transform:[{translateX:slideAnim}]}]}>
          {st.infoImage && <Image source={st.infoImage} style={z.ii} resizeMode="contain" />}
          <Text style={z.it}>{st.infoTitle}</Text>
          <Text style={z.ib}>{st.infoBody}</Text>
        </Animated.View>
        <View style={z.bn}><TouchableOpacity style={z.cb} onPress={goNext} activeOpacity={0.85}><Text style={z.ct}>CONTINUE</Text></TouchableOpacity></View>
      </View>
    );

    return (
      <View style={[z.c,{paddingTop:insets.top,paddingBottom:insets.bottom}]}>
        <View style={z.qh}><TouchableOpacity onPress={goBack} style={z.bb}><Text style={z.bt}>←</Text></TouchableOpacity><View style={z.pc}><View style={z.pt}><View style={[z.pf,{width:`${pr*100}%`}]} /></View></View><Text style={z.st}>{cq}/{tq}</Text></View>
        {st.section&&<Animated.Text style={[z.sl,{opacity:fadeAnim,transform:[{translateX:slideAnim}]}]}>{st.section}</Animated.Text>}
        <ScrollView contentContainerStyle={z.qc} showsVerticalScrollIndicator={false}>
          <Animated.View style={{opacity:fadeAnim,transform:[{translateX:slideAnim}]}}>
            <Text style={z.q}>{st.question}</Text>
            {st.subtitle&&<Text style={z.qs}>{st.subtitle}</Text>}
            <View style={{gap:10}}>
              {st.options?.map((o,i)=>{const s=isSel(o.label);const d=o.disabled;return(
                <TouchableOpacity key={i} style={[z.oc,s&&z.os,d&&z.od]} onPress={()=>!d&&handleSelect(o.label)} activeOpacity={d?1:0.7}>
                  <View style={{flex:1}}><Text style={[z.ol,s&&z.ols,d&&{color:Colors.textMuted}]}>{o.label}</Text>{o.subtitle&&<Text style={[z.osu,d&&{fontStyle:'italic'}]}>{o.subtitle}</Text>}</View>
                  <View style={[st.selectType==='multiselect'?z.ck:z.rd,s&&(st.selectType==='multiselect'?z.cks:z.rds)]}>{s&&<View style={st.selectType==='multiselect'?z.cki:z.rdi} />}</View>
                </TouchableOpacity>);})}
            </View>
          </Animated.View>
        </ScrollView>
        {st.selectType==='multiselect'&&<View style={z.bn}><TouchableOpacity style={[z.cb,!canGo()&&z.cd]} onPress={goNext} activeOpacity={0.85} disabled={!canGo()}><Text style={[z.ct,!canGo()&&{color:Colors.textMuted}]}>{quizStep===ONBOARDING_STEPS.length-1?'BUILD MY PLAN':'NEXT'}</Text></TouchableOpacity></View>}
      </View>
    );
  }

  if (appState === 'generating') {
    const pw = progressAnim.interpolate({inputRange:[0,100],outputRange:['0%','100%']});
    return (
      <View style={[z.c,{paddingTop:insets.top,paddingBottom:insets.bottom}]}>
        <View style={z.ls}><Text style={z.lp}>{loadingProgress}%</Text><Text style={z.lt}>We're building your plan</Text>
          <View style={z.lbt}><Animated.View style={[z.lbf,{width:pw}]} /></View>
          <Text style={z.lsu}>{currentLoadingStep<LOADING_STEPS.length?`${LOADING_STEPS[currentLoadingStep]}...`:'Your plan is ready!'}</Text>
          <View style={z.lc}><Text style={z.lct}>Your personalized plan includes</Text>
            {LOADING_STEPS.map((s,i)=>{const d=i<currentLoadingStep;return(<View key={i} style={z.lci}><View style={[z.lcc,d&&z.lcd]}>{d&&<Text style={z.lcm}>✓</Text>}</View><Text style={[z.lcx,d&&z.lcxd]}>{s}</Text></View>);})}
          </View>
        </View>
      </View>
    );
  }

  if (appState === 'coach') {
    const cs = (plan as any)?.coachSummary; const td = plan?.days?.filter(d=>!d.isRest)||[];
    return (
      <View style={[z.c,{paddingTop:insets.top,paddingBottom:insets.bottom}]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:24,paddingTop:20,paddingBottom:100}}>
          <View style={{alignItems:'center',marginBottom:28}}>
            <Image source={require('@/assets/images/coach-x.png')} style={{width:120,height:120,borderRadius:60}} resizeMode="cover" />
            <Text style={{fontSize:11,fontWeight:'700',color:Colors.primary,letterSpacing:2,marginTop:12}}>COACH X</Text>
          </View>
          <Text style={{fontSize:24,fontWeight:'800',color:Colors.primary,textAlign:'center',lineHeight:32,marginBottom:28}}>{cs?.greeting||'Your plan is ready.'}</Text>
          {cs?.assessment&&<View style={z.cc}><Text style={z.cct}>WHAT I SEE</Text><Text style={z.ccb}>{cs.assessment}</Text></View>}
          {cs?.planOverview&&<View style={z.cc}><Text style={z.cct}>THIS WEEK'S PLAN</Text><Text style={z.ccb}>{cs.planOverview}</Text>
            <View style={{marginTop:18}}>{td.slice(0,5).map((d,i)=>(<View key={i} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10,borderTopWidth:1,borderTopColor:'#222'}}><View style={{width:8,height:8,borderRadius:4,backgroundColor:Colors.primary}} /><View style={{flex:1}}><Text style={{fontSize:12,color:Colors.textMuted}}>{d.day}</Text><Text style={{fontSize:15,fontWeight:'600',color:Colors.textPrimary}}>{d.focus}</Text></View><Text style={{fontSize:12,color:Colors.textMuted}}>{d.duration}</Text></View>))}</View>
          </View>}
          {cs?.motivation&&<View style={{backgroundColor:'#141210',borderRadius:14,borderWidth:1,borderColor:'#2A2518',padding:20,alignItems:'center'}}><Text style={{fontSize:16,fontWeight:'600',color:Colors.primary,textAlign:'center',lineHeight:24,fontStyle:'italic'}}>{cs.motivation}</Text></View>}
        </ScrollView>
        <View style={{position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:24,paddingBottom:34,paddingTop:16,backgroundColor:Colors.background}}>
          <TouchableOpacity style={z.cb} onPress={()=>setAppState('plan')} activeOpacity={0.85}><Text style={z.ct}>LET'S GO</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasPlan = plan&&plan.days&&plan.days.length>0;
  const currentDay = hasPlan?plan.days[selectedDayIndex]:null;
  const session = currentDay&&!currentDay.isRest?currentDay:null;
  const FB = [{name:'Dynamic warmup',time:'5 min',type:'warmup' as const,detail:'Light jog, high knees'},{name:'Combo dribbles',time:'8 min',type:'skill' as const,detail:'Crossover, between legs'},{name:'Attack dribbles',time:'10 min',type:'skill' as const,detail:'Full court speed dribble'},{name:'Free throws',time:'7 min',type:'shooting' as const,detail:'3 sets of 10'},{name:'Lane slides',time:'5 min',type:'conditioning' as const,detail:'Defensive slides'}];
  const drills = session?.drills||FB;
  const cc = drills.filter((_,i)=>isDone(i)).length;
  const td = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});

  return (
    <View style={[z.c,{paddingTop:insets.top}]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:20}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingTop:16,paddingBottom:16}}>
          <View><Text style={{fontSize:13,color:Colors.textMuted,marginBottom:4}}>{td}</Text><Text style={{fontSize:22,fontWeight:'800',color:Colors.textPrimary}}>{hasPlan?plan.weekTitle:'Today\'s Session'}</Text></View>
          {currentStreak>0&&<View style={{backgroundColor:Colors.surface,borderRadius:20,paddingHorizontal:14,paddingVertical:8,borderWidth:1,borderColor:Colors.surfaceBorder}}><Text style={{fontSize:12,fontWeight:'700',color:Colors.textSecondary}}>{currentStreak} day streak</Text></View>}
        </View>
        {hasPlan&&plan.aiInsight&&<View style={{flexDirection:'row',alignItems:'flex-start',gap:10,backgroundColor:Colors.surface,borderRadius:14,borderWidth:1,borderColor:Colors.surfaceBorder,padding:16,marginBottom:16}}><View style={{width:8,height:8,borderRadius:4,backgroundColor:Colors.primary,marginTop:4}} /><Text style={{fontSize:13,color:Colors.primary,lineHeight:19,flex:1,fontWeight:'500'}}>{plan.aiInsight}</Text></View>}
        {hasPlan&&<View style={{flexDirection:'row',justifyContent:'space-between',backgroundColor:Colors.surface,borderRadius:14,borderWidth:1,borderColor:Colors.surfaceBorder,padding:12,marginBottom:16}}>
          {plan.days.map((day,i)=>{const sel=i===selectedDayIndex;const dd=day.drills||[];const dc=dd.filter((_,di)=>completedDrills[`${i}-${di}`]).length;const ad=dd.length>0&&dc===dd.length;return(
            <TouchableOpacity key={i} style={[{alignItems:'center',gap:6,paddingHorizontal:4,paddingVertical:4,borderRadius:8},sel&&{backgroundColor:'#1A1708'}]} onPress={()=>{if(Platform.OS!=='web')void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);setSelectedDayIndex(i);setExpandedDrill(null);}} activeOpacity={0.7}>
              <Text style={{fontSize:11,fontWeight:'600',color:sel?Colors.primary:Colors.textMuted}}>{day.day}</Text>
              <View style={[{width:26,height:26,borderRadius:13,borderWidth:1.5,borderColor:Colors.surfaceBorder,alignItems:'center',justifyContent:'center'},ad&&{borderColor:Colors.accent,backgroundColor:Colors.accent},sel&&!ad&&{borderColor:Colors.primary,borderWidth:2},day.isRest&&{borderStyle:'dashed' as any}]}>
                {ad&&<Text style={{fontSize:11,color:Colors.black,fontWeight:'800'}}>✓</Text>}{sel&&!ad&&!day.isRest&&<View style={{width:7,height:7,borderRadius:4,backgroundColor:Colors.primary}} />}
              </View>
            </TouchableOpacity>);})}
        </View>}
        {currentDay?.isRest&&<View style={{backgroundColor:Colors.surface,borderRadius:16,borderWidth:1,borderColor:Colors.surfaceBorder,padding:28,alignItems:'center',marginBottom:16}}><Text style={{fontSize:20,fontWeight:'800',color:Colors.textPrimary,marginBottom:8}}>Recovery Day</Text><Text style={{fontSize:14,color:Colors.textSecondary,textAlign:'center',lineHeight:21}}>Your body builds muscle during rest. Stretch, hydrate, sleep well.</Text></View>}
        {!currentDay?.isRest&&<View style={{backgroundColor:Colors.surface,borderRadius:18,borderWidth:1,borderColor:Colors.surfaceBorder,padding:20,marginBottom:16}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
            <View><Text style={{fontSize:22,fontWeight:'800',color:Colors.textPrimary,marginBottom:4}}>{session?.focus||'Ball Handling'}</Text><Text style={{fontSize:13,color:Colors.textSecondary}}>{session?.duration||'45 min'} · {drills.length} drills{cc>0&&` · ${cc}/${drills.length} done`}</Text></View>
            <View style={{backgroundColor:Colors.primary,borderRadius:8,paddingHorizontal:12,paddingVertical:6}}><Text style={{fontSize:12,fontWeight:'800',color:Colors.black}}>{session?.duration||'45 min'}</Text></View>
          </View>
          <View style={{height:4,backgroundColor:'#252525',borderRadius:2,marginBottom:14,overflow:'hidden'}}><View style={{height:4,backgroundColor:Colors.accent,borderRadius:2,width:`${(cc/Math.max(drills.length,1))*100}%`}} /></View>
          {drills.map((drill,index)=>{const dn=isDone(index);const ex=expandedDrill===index;const tc=TYPE_COLORS[drill.type]||Colors.textMuted;const tl=TYPE_LABELS[drill.type]||'';return(
            <TouchableOpacity key={index} style={[{flexDirection:'row',alignItems:'flex-start',paddingVertical:14,borderTopWidth:1,borderTopColor:'#222',gap:12},dn&&{opacity:0.4}]} onPress={()=>{if(Platform.OS!=='web')void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);setExpandedDrill(ex?null:index);}} activeOpacity={0.7}>
              <TouchableOpacity style={[{width:26,height:26,borderRadius:13,borderWidth:2,borderColor:Colors.surfaceBorder,alignItems:'center',justifyContent:'center',marginTop:2},dn&&{borderColor:tc,backgroundColor:tc}]} onPress={()=>{if(Platform.OS!=='web')void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);toggleDrill(selectedDayIndex,index);}} activeOpacity={0.7}>{dn&&<Text style={{fontSize:13,color:Colors.black,fontWeight:'800'}}>✓</Text>}</TouchableOpacity>
              <View style={{flex:1}}><Text style={[{fontSize:15,fontWeight:'600',color:Colors.textPrimary,marginBottom:5},dn&&{textDecorationLine:'line-through',color:Colors.textMuted}]}>{drill.name}</Text>
                <View style={{flexDirection:'row',alignItems:'center',gap:8}}><View style={{borderRadius:5,paddingHorizontal:7,paddingVertical:2,backgroundColor:tc+'20'}}><Text style={{fontSize:9,fontWeight:'800',letterSpacing:0.5,color:tc}}>{tl}</Text></View><Text style={{fontSize:12,color:Colors.textMuted}}>{drill.time}</Text></View>
                {ex&&drill.detail&&<Text style={{fontSize:13,color:Colors.textSecondary,lineHeight:19,marginTop:10}}>{drill.detail}</Text>}
              </View>
              <Text style={{fontSize:18,color:Colors.textMuted,marginTop:4}}>{ex?'−':'+'}</Text>
            </TouchableOpacity>);})}
          <TouchableOpacity style={{backgroundColor:Colors.primary,borderRadius:12,paddingVertical:18,alignItems:'center',marginTop:16}} activeOpacity={0.85} onPress={()=>router.push({pathname:'/session',params:{dayIndex:selectedDayIndex.toString()}} as any)}><Text style={{fontSize:14,fontWeight:'900',color:Colors.black,letterSpacing:2}}>{cc>0&&cc<drills.length?'CONTINUE SESSION':cc===drills.length?'SESSION COMPLETE':'START SESSION'}</Text></TouchableOpacity>
        </View>}
        <View style={{flexDirection:'row',gap:10,marginBottom:12}}>{[{v:totalSessions,l:'Total\nsessions'},{v:currentStreak,l:'Day\nstreak'},{v:'W1',l:'Current\nweek',a:true}].map((x,i)=>(<View key={i} style={{flex:1,backgroundColor:Colors.surface,borderRadius:14,borderWidth:1,borderColor:Colors.surfaceBorder,padding:16,alignItems:'center'}}><Text style={{fontSize:20,fontWeight:'800',color:x.a?Colors.accent:Colors.textPrimary,marginBottom:6}}>{x.v}</Text><Text style={{fontSize:10,color:Colors.textMuted,textAlign:'center',lineHeight:14}}>{x.l}</Text></View>))}</View>
        <View style={{height:30}} />
      </ScrollView>
    </View>
  );
}

const z = StyleSheet.create({
  c:{flex:1,backgroundColor:Colors.background},
  qh:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingVertical:16,gap:14},
  bb:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  bt:{fontSize:22,color:Colors.textSecondary},
  pc:{flex:1},pt:{height:4,backgroundColor:Colors.surface,borderRadius:2,overflow:'hidden'},
  pf:{height:4,backgroundColor:Colors.primary,borderRadius:2},
  st:{fontSize:13,color:Colors.textMuted,fontWeight:'600',minWidth:36,textAlign:'right'},
  sl:{fontSize:12,fontWeight:'700',color:Colors.primary,textTransform:'uppercase',letterSpacing:1.5,paddingHorizontal:24,marginBottom:4},
  qc:{paddingHorizontal:24,paddingTop:12,paddingBottom:40},
  q:{fontSize:26,fontWeight:'800',color:Colors.textPrimary,lineHeight:34,marginBottom:8},
  qs:{fontSize:15,color:Colors.textSecondary,marginBottom:28,lineHeight:21},
  oc:{flexDirection:'row',alignItems:'center',backgroundColor:Colors.surface,borderRadius:14,borderWidth:1.5,borderColor:Colors.surfaceBorder,paddingVertical:18,paddingHorizontal:20},
  os:{borderColor:Colors.primary,backgroundColor:'#1A1708'},od:{opacity:0.4},
  ol:{fontSize:16,fontWeight:'600',color:Colors.textPrimary},ols:{color:Colors.primary},
  osu:{fontSize:13,color:Colors.textMuted,marginTop:2},
  rd:{width:22,height:22,borderRadius:11,borderWidth:2,borderColor:Colors.surfaceBorder,alignItems:'center',justifyContent:'center'},
  rds:{borderColor:Colors.primary},rdi:{width:10,height:10,borderRadius:5,backgroundColor:Colors.primary},
  ck:{width:22,height:22,borderRadius:6,borderWidth:2,borderColor:Colors.surfaceBorder,alignItems:'center',justifyContent:'center'},
  cks:{borderColor:Colors.primary,backgroundColor:Colors.primary},cki:{width:12,height:12,borderRadius:2,backgroundColor:Colors.black},
  bn:{paddingHorizontal:24,paddingBottom:16},
  cb:{backgroundColor:Colors.primary,borderRadius:14,paddingVertical:18,alignItems:'center'},
  cd:{backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.surfaceBorder},
  ct:{fontSize:15,fontWeight:'800',color:Colors.black,letterSpacing:2},
  is:{flex:1,justifyContent:'center',alignItems:'center',paddingHorizontal:36},
  ii:{width:400,height:400,marginBottom:32},
  it:{fontSize:24,fontWeight:'800',color:Colors.primary,textAlign:'center',lineHeight:32,marginBottom:16},
  ib:{fontSize:16,color:Colors.textSecondary,textAlign:'center',lineHeight:24},
  ls:{flex:1,justifyContent:'center',alignItems:'center',paddingHorizontal:32},
  lp:{fontSize:52,fontWeight:'800',color:Colors.textPrimary,marginBottom:8},
  lt:{fontSize:20,fontWeight:'700',color:Colors.textPrimary,marginBottom:24},
  lbt:{width:'100%',height:8,backgroundColor:Colors.surface,borderRadius:4,overflow:'hidden',marginBottom:16},
  lbf:{height:8,backgroundColor:Colors.primary,borderRadius:4},
  lsu:{fontSize:14,color:Colors.textSecondary,marginBottom:36},
  lc:{width:'100%',backgroundColor:Colors.surface,borderRadius:16,borderWidth:1,borderColor:Colors.surfaceBorder,padding:20},
  lct:{fontSize:14,fontWeight:'700',color:Colors.textPrimary,marginBottom:16},
  lci:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:14},
  lcc:{width:24,height:24,borderRadius:12,borderWidth:2,borderColor:Colors.surfaceBorder,alignItems:'center',justifyContent:'center'},
  lcd:{borderColor:Colors.primary,backgroundColor:Colors.primary},
  lcm:{fontSize:12,color:Colors.black,fontWeight:'800'},
  lcx:{fontSize:14,color:Colors.textMuted},lcxd:{color:Colors.textPrimary},
  cc:{backgroundColor:Colors.surface,borderRadius:16,borderWidth:1,borderColor:Colors.surfaceBorder,padding:20,marginBottom:16},
  cct:{fontSize:11,fontWeight:'700',color:Colors.textMuted,letterSpacing:1.5,marginBottom:12},
  ccb:{fontSize:15,color:Colors.textSecondary,lineHeight:23},
});
