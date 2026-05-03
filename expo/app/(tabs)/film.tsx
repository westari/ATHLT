import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
  Image, Alert, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import {
  Upload, Play, Pause, Plus, Bookmark, MessageCircle,
  TrendingUp, AlertCircle, ChevronRight, ChevronLeft,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import CoachXPill from '@/components/CoachXPill';
import { supabase } from '@/constants/supabase';
import { usePlanStore } from '@/store/planStore';
import { getDrillById } from '@/constants/drillLibrary';

const COACH_X_PORTRAIT = require('@/assets/images/coach-x-small.png');
const BACKEND_URL = 'https://collectiq-xi.vercel.app';
const SUPABASE_URL = 'https://tvtojlwdpipntkktguck.supabase.co';
const SCREEN_WIDTH = Dimensions.get('window').width;

type AppState = 'idle' | 'uploading' | 'analyzing' | 'result';

interface Moment {
  type: 'strength' | 'weakness';
  timestamp: number;
  label: string;
  detail: string;
}

interface FilmAnalysis {
  id: string;
  videoUrl: string;
  date: string;
  overallGrade: string;
  openingLine: string;
  summary: string;
  moments: Moment[];
  drillRecommendations: { drillId: string; reason: string }[];
  coachNote: string;
}

// Small thumbnail component that shows the first frame of a video
function PastFilmThumbnail({ videoUrl }: { videoUrl: string }) {
  const thumbPlayer = useVideoPlayer(videoUrl, p => {
    p.muted = true;
    p.pause();
  });
  return (
    <VideoView
      style={styles.pastFilmThumb}
      player={thumbPlayer}
      contentFit="cover"
      nativeControls={false}
    />
  );
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
  const [activeMomentIndex, setActiveMomentIndex] = useState(0);

  // ===== Video player setup =====
  const player = useVideoPlayer(currentAnalysis?.videoUrl || '', p => {
    p.loop = false;
    p.muted = false;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

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
          moments: f.moments || [],
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
        moments: analysis.moments,
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

      setActiveMomentIndex(0);
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

  // ===== Moment navigation =====
  const goToMoment = (index: number) => {
    if (!currentAnalysis || !currentAnalysis.moments || currentAnalysis.moments.length === 0) return;
    const safeIndex = Math.max(0, Math.min(index, currentAnalysis.moments.length - 1));
    setActiveMomentIndex(safeIndex);
    const moment = currentAnalysis.moments[safeIndex];
    if (player && moment) {
      player.currentTime = moment.timestamp;
      player.play();
    }
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  };

  const handleNextMoment = () => {
    goToMoment(activeMomentIndex + 1);
  };

  const handlePrevMoment = () => {
    goToMoment(activeMomentIndex - 1);
  };

  const handlePlayPause = () => {
    if (!player) return;
    if (isPlaying) player.pause();
    else player.play();
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

  const formatTimestamp = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
    const moments = currentAnalysis.moments || [];
    const activeMoment = moments[activeMomentIndex];
    const videoDuration = moments.length > 0 ? Math.max(...moments.map(m => m.timestamp)) + 5 : 60;

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>

          {/* ===== Top bar with back ===== */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => { setState('idle'); setCurrentAnalysis(null); player?.pause(); }}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <ChevronLeft size={22} color={Colors.textPrimary} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          </View>

          {/* ===== VIDEO PLAYER ===== */}
          <View style={styles.videoContainer}>
            <VideoView
              style={styles.videoPlayer}
              player={player}
              contentFit="contain"
              nativeControls={false}
            />
            <TouchableOpacity
              style={styles.playOverlay}
              onPress={handlePlayPause}
              activeOpacity={0.8}
            >
              {!isPlaying && (
                <View style={styles.playBtnCircle}>
                  <Play size={28} color={Colors.white} fill={Colors.white} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ===== TIMELINE WITH MOMENT MARKERS ===== */}
          {moments.length > 0 && (
            <View style={styles.timelineWrap}>
              <View style={styles.timelineTrack}>
                {moments.map((m, i) => {
                  const left = (m.timestamp / videoDuration) * 100;
                  const isActive = i === activeMomentIndex;
                  const color = m.type === 'strength' ? '#8B9A6B' : '#C47A6C';
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.momentMarker,
                        {
                          left: `${left}%`,
                          backgroundColor: color,
                          transform: [{ scale: isActive ? 1.4 : 1 }],
                          borderColor: isActive ? Colors.textPrimary : 'transparent',
                          borderWidth: isActive ? 2 : 0,
                        },
                      ]}
                      onPress={() => goToMoment(i)}
                      activeOpacity={0.7}
                    />
                  );
                })}
              </View>
              <View style={styles.timelineLabels}>
                <Text style={styles.timelineLabel}>0:00</Text>
                <Text style={styles.timelineLabel}>{formatTimestamp(videoDuration)}</Text>
              </View>
            </View>
          )}

          {/* ===== MOMENT NAVIGATION ===== */}
          {moments.length > 0 && activeMoment && (
            <View style={styles.momentNav}>
              <TouchableOpacity
                style={[styles.navBtn, activeMomentIndex === 0 && styles.navBtnDisabled]}
                onPress={handlePrevMoment}
                disabled={activeMomentIndex === 0}
                activeOpacity={0.7}
              >
                <ChevronLeft size={18} color={activeMomentIndex === 0 ? Colors.textMuted : Colors.textPrimary} />
                <Text style={[styles.navBtnText, activeMomentIndex === 0 && { color: Colors.textMuted }]}>Prev</Text>
              </TouchableOpacity>

              <View style={styles.momentCounter}>
                <Text style={styles.momentCounterText}>
                  {activeMomentIndex + 1} of {moments.length}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.navBtn, activeMomentIndex === moments.length - 1 && styles.navBtnDisabled]}
                onPress={handleNextMoment}
                disabled={activeMomentIndex === moments.length - 1}
                activeOpacity={0.7}
              >
                <Text style={[styles.navBtnText, activeMomentIndex === moments.length - 1 && { color: Colors.textMuted }]}>Next</Text>
                <ChevronRight size={18} color={activeMomentIndex === moments.length - 1 ? Colors.textMuted : Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          )}

          {/* ===== ACTIVE MOMENT — COACH X COMMENTARY ===== */}
          {activeMoment && (
            <View style={styles.commentaryBox}>
              <View style={styles.commentaryHeader}>
                <Image source={COACH_X_PORTRAIT} style={styles.commentaryPortrait} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <View style={styles.commentaryLabelRow}>
                    <Text style={styles.commentaryTimestamp}>{formatTimestamp(activeMoment.timestamp)}</Text>
                    <View style={[
                      styles.commentaryTypeTag,
                      { backgroundColor: activeMoment.type === 'strength' ? '#E8EDD8' : '#F5DDD6' }
                    ]}>
                      <Text style={[
                        styles.commentaryTypeTagText,
                        { color: activeMoment.type === 'strength' ? '#5C6843' : '#8B4A3C' }
                      ]}>
                        {activeMoment.type === 'strength' ? 'STRENGTH' : 'WORK ON'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.commentaryLabel}>{activeMoment.label}</Text>
                </View>
              </View>
              <Text style={styles.commentaryDetail}>"{activeMoment.detail}"</Text>
            </View>
          )}

          {/* ===== COACH X PEEKS OUT — opening line + summary + grade ===== */}
          {(currentAnalysis.openingLine || currentAnalysis.summary) && (
            <View style={styles.coachSpeakWrap}>
              <Image source={COACH_X_PORTRAIT} style={styles.coachSpeakPortrait} resizeMode="contain" />
              <View style={styles.coachSpeakBubble}>
                <View style={styles.coachSpeakArrow} />
                <View style={styles.coachSpeakHeader}>
                  <Text style={styles.coachSpeakLabel}>COACH X · OVERALL</Text>
                  <View style={styles.coachSpeakGrade}>
                    <Text style={styles.coachSpeakGradeText}>{currentAnalysis.overallGrade}</Text>
                  </View>
                </View>
                {currentAnalysis.openingLine ? (
                  <Text style={styles.coachSpeakOpening}>"{currentAnalysis.openingLine}"</Text>
                ) : null}
                {currentAnalysis.summary ? (
                  <Text style={styles.coachSpeakSummary}>{currentAnalysis.summary}</Text>
                ) : null}
              </View>
            </View>
          )}

          {/* ===== DRILL RECOMMENDATIONS ===== */}
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
                    <TouchableOpacity
                      style={styles.drillRecMain}
                      onPress={() => {
                        if (Platform.OS !== 'web') void Haptics.selectionAsync();
                        router.push(`/drill/${rec.drillId}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.drillRecName}>{drill.name}</Text>
                        <Text style={styles.drillRecMeta}>
                          {drill.category} · {drill.duration}min · {drill.difficulty}
                        </Text>
                        <Text style={styles.drillRecReason}>"{rec.reason}"</Text>
                      </View>
                      <ChevronRight size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
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

          {/* COACH X SAYS box removed — opening line + speech bubble already serves this role */}
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

        {pastFilms.length > 0 && (
          <View style={styles.pastFilmsSection}>
            <Text style={styles.pastFilmsTitle}>YOUR FILM</Text>
            {pastFilms.map(f => (
              <TouchableOpacity
                key={f.id}
                style={styles.pastFilmCard}
                onPress={() => { setActiveMomentIndex(0); setCurrentAnalysis(f); setState('result'); }}
                activeOpacity={0.7}
              >
                <View style={styles.pastFilmThumbWrap}>
                  {f.videoUrl ? (
                    <PastFilmThumbnail videoUrl={f.videoUrl} />
                  ) : (
                    <View style={[styles.pastFilmThumb, styles.pastFilmThumbFallback]}>
                      <Play size={20} color={Colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.pastFilmThumbGradeOverlay}>
                    <Text style={styles.pastFilmThumbGradeText}>{f.overallGrade}</Text>
                  </View>
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

  // ===== TOP BAR (result screen) =====
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingVertical: 8, paddingRight: 12,
  },
  backBtnText: {
    fontSize: 15, color: Colors.textPrimary, fontWeight: '500',
  },

  // ===== VIDEO PLAYER =====
  videoContainer: {
    width: SCREEN_WIDTH,
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoPlayer: {
    width: '100%', height: '100%',
  },
  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtnCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ===== TIMELINE =====
  timelineWrap: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
    backgroundColor: '#1A1A1A',
  },
  timelineTrack: {
    height: 8, backgroundColor: '#3A3A3A', borderRadius: 4,
    position: 'relative',
  },
  momentMarker: {
    position: 'absolute', top: -4,
    width: 16, height: 16, borderRadius: 8,
    marginLeft: -8,
  },
  timelineLabels: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 6,
  },
  timelineLabel: {
    fontSize: 11, color: '#999', fontWeight: '600', letterSpacing: 0.3,
  },

  // ===== MOMENT NAV =====
  momentNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: '#2A2A2A',
    borderRadius: 100,
    minWidth: 90, justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: {
    fontSize: 14, fontWeight: '600', color: Colors.white, letterSpacing: -0.1,
  },
  momentCounter: {
    paddingHorizontal: 12,
  },
  momentCounterText: {
    fontSize: 13, color: '#999', fontWeight: '600', letterSpacing: 0.3,
  },

  // ===== COACH X COMMENTARY BOX =====
  commentaryBox: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16,
  },
  commentaryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 12,
  },
  commentaryPortrait: { width: 48, height: 48 },
  commentaryLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 4,
  },
  commentaryTimestamp: {
    fontSize: 12, fontWeight: '800', color: Colors.primary,
    letterSpacing: 0.5, fontVariant: ['tabular-nums'],
  },
  commentaryTypeTag: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 100,
  },
  commentaryTypeTagText: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1,
  },
  commentaryLabel: {
    fontSize: 16, fontWeight: '700', color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  commentaryDetail: {
    fontSize: 14, color: Colors.textPrimary, lineHeight: 20,
    fontStyle: 'italic',
  },

  // ===== COACH X SPEECH BUBBLE (opening line + summary) =====
  coachSpeakWrap: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8,
    gap: 0,
  },
  coachSpeakPortrait: {
    width: 56, height: 56,
    marginTop: 8,
    marginRight: -8,
    zIndex: 2,
  },
  coachSpeakBubble: {
    flex: 1,
    backgroundColor: '#FBF5E2',
    borderWidth: 1, borderColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 16,
    paddingLeft: 24,
    position: 'relative',
  },
  coachSpeakHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  coachSpeakLabel: {
    fontSize: 10, fontWeight: '800', color: Colors.primary,
    letterSpacing: 1.5,
  },
  coachSpeakGrade: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 100,
  },
  coachSpeakGradeText: {
    fontSize: 12, fontWeight: '800', color: Colors.white, letterSpacing: -0.2,
  },
  coachSpeakArrow: {
    position: 'absolute',
    left: -7, top: 18,
    width: 14, height: 14,
    backgroundColor: '#FBF5E2',
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: Colors.primary, borderLeftColor: Colors.primary,
    transform: [{ rotate: '-45deg' }],
  },
  coachSpeakOpening: {
    fontSize: 16, fontWeight: '700', color: Colors.textPrimary,
    letterSpacing: -0.3, lineHeight: 22, marginBottom: 8,
    fontStyle: 'italic',
  },
  coachSpeakSummary: {
    fontSize: 13, color: Colors.textSecondary, lineHeight: 19,
  },

  // ===== DRILLS =====
  section: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: Colors.textMuted,
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

  // ===== IDLE =====
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
  pastFilmThumbWrap: {
    width: 76, height: 56, borderRadius: 8,
    overflow: 'hidden', position: 'relative',
    backgroundColor: '#000',
  },
  pastFilmThumb: {
    width: '100%', height: '100%',
  },
  pastFilmThumbFallback: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  pastFilmThumbGradeOverlay: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
  },
  pastFilmThumbGradeText: {
    fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: -0.2,
  },
  pastFilmDate: {
    fontSize: 11, color: Colors.textMuted, marginBottom: 3, fontWeight: '600', letterSpacing: 0.5,
  },
  pastFilmSummary: {
    fontSize: 13, color: Colors.textPrimary, lineHeight: 18,
  },

  // ===== LOADING =====
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
});
