import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
  Image, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  Upload, Play, Plus, Bookmark, MessageCircle,
  TrendingUp, AlertCircle, ChevronRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import CoachXPill from '@/components/CoachXPill';
import { supabase } from '@/constants/supabase';
import { usePlanStore } from '@/store/planStore';
import { getDrillById } from '@/constants/drillLibrary';

const COACH_X_PORTRAIT = require('@/assets/images/coach-x-small.png');
const BACKEND_URL = 'https://collectiq-xi.vercel.app';
const SUPABASE_URL = 'https://tvtojlwdpipntkktguck.supabase.co';

type AppState = 'idle' | 'uploading' | 'analyzing' | 'result';

interface FilmAnalysis {
  id: string;
  videoUrl: string;
  date: string;
  overallGrade: string;
  openingLine: string;
  summary: string;
  strengths: { skill: string; detail: string }[];
  weaknesses: { skill: string; detail: string }[];
  drillRecommendations: { drillId: string; reason: string }[];
  coachNote: string;
}

export default function FilmTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, plan, setPlan, currentDayIndex } = usePlanStore();

  const [state, setState] = useState<AppState>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [pastFilms, setPastFilms] = useState<FilmAnalysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<FilmAnalysis | null>(null);
  const [savedDrills, setSavedDrills] = useState<Set<string>>(new Set());

  useEffect(() => { loadPastFilms(); }, []);

  const loadPastFilms = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('film_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) {
        setPastFilms(data.map((f: any) => ({
          id: f.id,
          videoUrl: f.video_url,
          date: f.created_at,
          overallGrade: f.overall_grade,
          openingLine: f.opening_line || '',
          summary: f.summary || '',
          strengths: f.strengths || [],
          weaknesses: f.weaknesses || [],
          drillRecommendations: f.drill_recommendations || [],
          coachNote: f.coach_note || '',
        })));
      }
    } catch (e) {
      console.error('Load films error:', e);
    }
  };

  const saveAnalysis = async (videoUrl: string, analysis: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('film_analyses').insert({
        user_id: user.id,
        video_url: videoUrl,
        overall_grade: analysis.overallGrade,
        opening_line: analysis.openingLine,
        summary: analysis.summary,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        drill_recommendations: analysis.drillRecommendations,
        coach_note: analysis.coachNote,
      });
      loadPastFilms();
    } catch (e) {
      console.error('Save analysis error:', e);
    }
  };

  const handleUploadFilm = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 60,
      quality: 0.7,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;
    const asset = result.assets[0];

    setState('uploading');
    setProgress(0);
    setProgressLabel('Uploading your film...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const fileName = user.id + '_' + Date.now() + '.mp4';

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: fileName,
        type: 'video/mp4',
      } as any);

      setProgress(0.2);

      const session = (await supabase.auth.getSession()).data.session;
      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/films/${fileName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error('Supabase upload failed:', errText);
        throw new Error('Upload failed');
      }

      setProgress(0.4);
      setProgressLabel('Coach X is watching your film...');
      setState('analyzing');

      const { data: urlData } = supabase.storage.from('films').getPublicUrl(fileName);
      const videoUrl = urlData.publicUrl;

      setProgress(0.6);

      const analyzeRes = await fetch(`${BACKEND_URL}/api/analyze-film`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          profile: {
            position: profile?.position,
            weakness: profile?.weakness,
            description: profile?.description,
          },
        }),
      });

      setProgress(0.9);

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        throw new Error(err.error || 'Analysis failed');
      }

      const analysis = await analyzeRes.json();
      setProgress(1);
      await saveAnalysis(videoUrl, analysis);

      setCurrentAnalysis({
        id: 'current',
        videoUrl,
        date: new Date().toISOString(),
        ...analysis,
      });
      setState('result');
    } catch (e: any) {
      console.error('Film analysis error:', e);
      Alert.alert('Upload failed', e.message || 'Try a shorter clip.');
      setState('idle');
    }
  };

  const handleAddDrillToToday = (drillId: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!plan) return;
    const drill = getDrillById(drillId);
    if (!drill) return;
    const day = plan.days[currentDayIndex];
    const newDrills = [...(day.drills || []), { drillId, time: `${drill.duration} min` }];
    const updatedDays = plan.days.map((d, i) =>
      i === currentDayIndex ? { ...d, drills: newDrills } : d
    );
    setPlan({ ...plan, days: updatedDays });
    Alert.alert('Added', `${drill.name} added to today's workout.`);
  };

  const handleSaveDrill = (drillId: string) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setSavedDrills(prev => {
      const next = new Set(prev);
      if (next.has(drillId)) next.delete(drillId);
      else next.add(drillId);
      return next;
    });
  };

  const handleAskCoach = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Coming soon', 'Ask Coach X about this film — coming in next update.');
  };

  // ===== LOADING SCREEN =====
  if (state === 'uploading' || state === 'analyzing') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <CoachXPill />
        <View style={styles.loadingWrap}>
          <Image source={COACH_X_PORTRAIT} style={styles.loadingPortrait} resizeMode="contain" />
          <Text style={styles.loadingTitle}>
            {state === 'uploading' ? 'Uploading film' : 'Coach X is watching'}
          </Text>
          <Text style={styles.loadingSubtitle}>{progressLabel}</Text>

          <View style={styles.progressBarOuter}>
            <View style={[styles.progressBarInner, { width: `${progress * 100}%` }]} />
          </View>

          <View style={styles.loadingSteps}>
            <View style={styles.loadingStep}>
              <View style={[styles.stepDot, progress >= 0.2 && styles.stepDotDone]} />
              <Text style={[styles.stepLabel, progress >= 0.2 && styles.stepLabelDone]}>
                Uploading clip
              </Text>
            </View>
            <View style={styles.loadingStep}>
              <View style={[styles.stepDot, progress >= 0.6 && styles.stepDotDone]} />
              <Text style={[styles.stepLabel, progress >= 0.6 && styles.stepLabelDone]}>
                Coach X reviewing
              </Text>
            </View>
            <View style={styles.loadingStep}>
              <View style={[styles.stepDot, progress >= 0.9 && styles.stepDotDone]} />
              <Text style={[styles.stepLabel, progress >= 0.9 && styles.stepLabelDone]}>
                Building breakdown
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ===== RESULT SCREEN =====
  if (state === 'result' && currentAnalysis) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <CoachXPill />
        <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>

          <View style={styles.resultHeader}>
            <View style={styles.resultHeaderRow}>
              <Image source={COACH_X_PORTRAIT} style={styles.resultPortrait} resizeMode="contain" />
              <View style={styles.gradeBadge}>
                <Text style={styles.gradeBadgeText}>{currentAnalysis.overallGrade}</Text>
              </View>
            </View>
            {currentAnalysis.openingLine ? (
              <Text style={styles.openingLine}>{currentAnalysis.openingLine}</Text>
            ) : null}
            {currentAnalysis.summary ? (
              <Text style={styles.summaryText}>{currentAnalysis.summary}</Text>
            ) : null}
          </View>

          {currentAnalysis.strengths.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <TrendingUp size={14} color="#8B9A6B" />
                <Text style={[styles.sectionTitle, { color: '#8B9A6B' }]}>WHAT YOU'RE DOING WELL</Text>
              </View>
              {currentAnalysis.strengths.map((s, i) => (
                <View key={i} style={styles.itemCard}>
                  <Text style={styles.itemSkill}>{s.skill}</Text>
                  <Text style={styles.itemDetail}>{s.detail}</Text>
                </View>
              ))}
            </View>
          )}

          {currentAnalysis.weaknesses.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AlertCircle size={14} color="#C47A6C" />
                <Text style={[styles.sectionTitle, { color: '#C47A6C' }]}>WHAT TO WORK ON</Text>
              </View>
              {currentAnalysis.weaknesses.map((w, i) => (
                <View key={i} style={styles.itemCard}>
                  <Text style={styles.itemSkill}>{w.skill}</Text>
                  <Text style={styles.itemDetail}>{w.detail}</Text>
                </View>
              ))}
            </View>
          )}

          {currentAnalysis.drillRecommendations.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>DRILLS COACH X RECOMMENDS</Text>
              </View>
              {currentAnalysis.drillRecommendations.map((rec, i) => {
                const drill = getDrillById(rec.drillId);
                if (!drill) return null;
                const isSaved = savedDrills.has(rec.drillId);
                return (
                  <View key={i} style={styles.drillRecCard}>
                    <View style={styles.drillRecMain}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.drillRecName}>{drill.name}</Text>
                        <Text style={styles.drillRecMeta}>
                          {drill.category} · {drill.duration}min · {drill.difficulty}
                        </Text>
                        <Text style={styles.drillRecReason}>"{rec.reason}"</Text>
                      </View>
                    </View>
                    <View style={styles.drillRecActions}>
                      <TouchableOpacity
                        style={styles.drillActionBtn}
                        onPress={() => handleAddDrillToToday(rec.drillId)}
                        activeOpacity={0.7}
                      >
                        <Plus size={14} color={Colors.primary} />
                        <Text style={styles.drillActionBtnText}>Add to today</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.drillActionBtn, isSaved && styles.drillActionBtnSaved]}
                        onPress={() => handleSaveDrill(rec.drillId)}
                        activeOpacity={0.7}
                      >
                        <Bookmark
                          size={14}
                          color={isSaved ? Colors.white : Colors.textPrimary}
                          fill={isSaved ? Colors.primary : 'transparent'}
                        />
                        <Text style={[styles.drillActionBtnText, isSaved && { color: Colors.white }]}>
                          {isSaved ? 'Saved' : 'Save'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {currentAnalysis.coachNote ? (
            <View style={styles.coachNote}>
              <Text style={styles.coachNoteLabel}>COACH X SAYS</Text>
              <Text style={styles.coachNoteText}>"{currentAnalysis.coachNote}"</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.askBtn} onPress={handleAskCoach} activeOpacity={0.85}>
            <MessageCircle size={16} color={Colors.white} />
            <Text style={styles.askBtnText}>Ask Coach X about this film</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => { setState('idle'); setCurrentAnalysis(null); }}
            activeOpacity={0.7}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ===== IDLE SCREEN =====
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <CoachXPill />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>

        <View style={styles.idleHeader}>
          <Image source={COACH_X_PORTRAIT} style={styles.idleHeaderPortrait} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.idleHeaderLabel}>FILM ROOM</Text>
            <Text style={styles.idleHeaderText}>Upload film. I'll break it down.</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.uploadCard} onPress={handleUploadFilm} activeOpacity={0.85}>
          <Upload size={20} color={Colors.white} />
          <Text style={styles.uploadCardText}>Upload film</Text>
        </TouchableOpacity>
        <Text style={styles.uploadHint}>Up to 60 seconds. Game footage works best.</Text>

        {pastFilms.length === 0 ? (
          <View style={styles.emptyState}>
            <Play size={32} color={Colors.textMuted} />
            <Text style={styles.emptyStateTitle}>No films yet</Text>
            <Text style={styles.emptyStateText}>
              Upload a clip and Coach X will break down your game.
            </Text>
          </View>
        ) : (
          <View style={styles.pastFilmsSection}>
            <Text style={styles.pastFilmsTitle}>YOUR FILM</Text>
            {pastFilms.map(f => (
              <TouchableOpacity
                key={f.id}
                style={styles.pastFilmCard}
                onPress={() => { setCurrentAnalysis(f); setState('result'); }}
                activeOpacity={0.7}
              >
                <View style={styles.pastFilmGrade}>
                  <Text style={styles.pastFilmGradeText}>{f.overallGrade}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pastFilmDate}>
                    {new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Text style={styles.pastFilmSummary} numberOfLines={2}>
                    {f.openingLine || f.summary || 'Tap to see breakdown'}
                  </Text>
                </View>
                <ChevronRight size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  idleHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20,
  },
  idleHeaderPortrait: { width: 56, height: 56 },
  idleHeaderLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.primary,
    letterSpacing: 1.5, marginBottom: 4,
  },
  idleHeaderText: {
    fontSize: 20, fontWeight: '700', color: Colors.textPrimary,
    letterSpacing: -0.5, lineHeight: 26,
  },

  uploadCard: {
    backgroundColor: '#1A1A1A', marginHorizontal: 20,
    borderRadius: 100, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  uploadCardText: {
    fontSize: 15, fontWeight: '600', color: Colors.white, letterSpacing: 0.2,
  },
  uploadHint: {
    fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 10, marginBottom: 24,
  },

  emptyState: {
    marginHorizontal: 20, paddingVertical: 32, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  emptyStateTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.textPrimary,
    marginTop: 12, marginBottom: 4, letterSpacing: -0.3,
  },
  emptyStateText: {
    fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18,
  },

  pastFilmsSection: { paddingHorizontal: 20 },
  pastFilmsTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 12, marginTop: 8,
  },
  pastFilmCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderRadius: 14, padding: 14, marginBottom: 8,
  },
  pastFilmGrade: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FBF5E2', borderWidth: 1.5, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  pastFilmGradeText: {
    fontSize: 16, fontWeight: '800', color: Colors.primary, letterSpacing: -0.3,
  },
  pastFilmDate: {
    fontSize: 11, color: Colors.textMuted, marginBottom: 3, fontWeight: '600', letterSpacing: 0.5,
  },
  pastFilmSummary: {
    fontSize: 13, color: Colors.textPrimary, lineHeight: 18,
  },

  loadingWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingPortrait: { width: 100, height: 100, marginBottom: 16 },
  loadingTitle: {
    fontSize: 22, fontWeight: '700', color: Colors.textPrimary,
    letterSpacing: -0.5, marginBottom: 6,
  },
  loadingSubtitle: {
    fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 24,
  },
  progressBarOuter: {
    width: '100%', height: 6, backgroundColor: Colors.surfaceBorder,
    borderRadius: 3, overflow: 'hidden', marginBottom: 32,
  },
  progressBarInner: {
    height: '100%', backgroundColor: Colors.primary, borderRadius: 3,
  },
  loadingSteps: { width: '100%', gap: 12 },
  loadingStep: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.surfaceBorder,
  },
  stepDotDone: { backgroundColor: Colors.primary },
  stepLabel: {
    fontSize: 14, color: Colors.textMuted, letterSpacing: -0.2,
  },
  stepLabelDone: { color: Colors.textPrimary, fontWeight: '600' },

  resultHeader: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  resultHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultPortrait: { width: 56, height: 56 },
  gradeBadge: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FBF5E2', borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  gradeBadgeText: {
    fontSize: 22, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5,
  },
  openingLine: {
    fontSize: 18, fontWeight: '700', color: Colors.textPrimary,
    letterSpacing: -0.4, lineHeight: 24, marginBottom: 8,
  },
  summaryText: {
    fontSize: 14, color: Colors.textSecondary, lineHeight: 20,
  },

  section: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
  },

  itemCard: { paddingVertical: 10 },
  itemSkill: {
    fontSize: 14, fontWeight: '600', color: Colors.textPrimary,
    letterSpacing: -0.2, marginBottom: 4,
  },
  itemDetail: {
    fontSize: 13, color: Colors.textSecondary, lineHeight: 19,
  },

  drillRecCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    marginBottom: 10, overflow: 'hidden',
  },
  drillRecMain: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, paddingBottom: 4,
  },
  drillRecName: {
    fontSize: 15, fontWeight: '700', color: Colors.textPrimary,
    letterSpacing: -0.3, marginBottom: 3,
  },
  drillRecMeta: {
    fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize', marginBottom: 6,
  },
  drillRecReason: {
    fontSize: 13, color: Colors.primary, fontStyle: 'italic', lineHeight: 18,
  },
  drillRecActions: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10,
  },
  drillActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, paddingHorizontal: 10,
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderRadius: 100,
  },
  drillActionBtnSaved: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  drillActionBtnText: {
    fontSize: 12, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.1,
  },

  coachNote: {
    backgroundColor: '#FBF5E2',
    borderWidth: 1, borderColor: Colors.primary,
    borderRadius: 14,
    marginHorizontal: 20, marginTop: 20, padding: 16,
  },
  coachNoteLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.primary,
    letterSpacing: 1.5, marginBottom: 6,
  },
  coachNoteText: {
    fontSize: 14, color: Colors.textPrimary, lineHeight: 20,
    fontStyle: 'italic',
  },

  askBtn: {
    backgroundColor: '#1A1A1A', marginHorizontal: 20, marginTop: 20,
    borderRadius: 100, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  askBtnText: {
    fontSize: 14, fontWeight: '600', color: Colors.white, letterSpacing: 0.1,
  },

  doneBtn: {
    marginHorizontal: 20, marginTop: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 14, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.1,
  },
});
