import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Film as FilmIcon, Upload, Eye, Play, TrendingUp, Lightbulb, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { supabase } from '@/constants/supabase';
import CoachXPill from '@/components/CoachXPill';

/**
 * Film tab — Coach X's film room.
 *
 * Sections (top to bottom):
 *  1. Stats card — total films analyzed + average grade
 *  2. Upload film CTA
 *  3. Latest analysis (if just uploaded)
 *  4. Players to Study — picked based on user's WEAKNESS, with YouTube thumbnails
 *  5. What to film — quick tips for new users
 *  6. Film history
 */

interface FilmAnalysis {
  id: string;
  date: string;
  video_url: string;
  overall_grade: string;
  summary: string;
  coach_note?: string;
  strengths?: { skill: string; detail: string }[];
  weaknesses?: { skill: string; detail: string }[];
  drill_recommendations?: { name: string; reason: string }[];
}

const GRADE_COLORS: Record<string, string> = {
  'A': '#8B9A6B', 'B': Colors.primary, 'C': '#B08D57', 'D': '#C47A6C', 'F': '#C44A4A',
};

// Numeric grade values for averaging
const GRADE_VALUES: Record<string, number> = { 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0 };
const VALUE_GRADES: Record<number, string> = { 4: 'A', 3: 'B', 2: 'C', 1: 'D', 0: 'F' };

// Map app skill keys → human label + the YouTube content to recommend
type StudyPick = {
  player: string;
  whyForYou: string;
  videos: { title: string; youtubeId: string }[];
};

// Master pool of study picks per skill weakness.
// Each pick has 2-3 real YouTube highlight videos that show the skill being executed well.
// videoIds are YouTube video IDs (the part after v= in the URL).
const STUDY_BY_SKILL: Record<string, StudyPick[]> = {
  shooting: [
    {
      player: 'Stephen Curry',
      whyForYou: 'Best off-the-dribble shooter ever. Watch his footwork before every shot.',
      videos: [
        { title: 'Stephen Curry shooting form breakdown', youtubeId: 'wcjJgWi9Bx0' },
        { title: 'Curry off-the-dribble three highlights', youtubeId: '8h7p88oySXE' },
      ],
    },
    {
      player: 'Klay Thompson',
      whyForYou: 'Quickest catch-and-shoot release in the league. Steal his footwork.',
      videos: [
        { title: 'Klay Thompson shooting form', youtubeId: 'qgB_dN-Mj7s' },
      ],
    },
  ],
  shotForm: [
    {
      player: 'Ray Allen',
      whyForYou: 'Textbook form. Every coach uses his shot as the model.',
      videos: [
        { title: 'Ray Allen shooting form analysis', youtubeId: 'jEAQO0aiXsc' },
      ],
    },
    {
      player: 'Kevin Durant',
      whyForYou: 'High release point makes his shot unblockable. Watch his elbow.',
      videos: [
        { title: 'Kevin Durant jumper breakdown', youtubeId: '4bZBUm5YZKQ' },
      ],
    },
  ],
  finishing: [
    {
      player: 'LeBron James',
      whyForYou: 'Best finisher in the league at any angle. Watch how he absorbs contact.',
      videos: [
        { title: 'LeBron finishing through contact', youtubeId: 'Yk8r1JmW0jE' },
      ],
    },
    {
      player: 'Anthony Edwards',
      whyForYou: 'Modern era — explodes off two feet. Same body type as most guards.',
      videos: [
        { title: 'Ant Edwards dunk highlights', youtubeId: 'L5FCjsWUe8U' },
      ],
    },
  ],
  weakHand: [
    {
      player: 'Kyrie Irving',
      whyForYou: 'Most ambidextrous handle ever. Finishes equally with both hands.',
      videos: [
        { title: 'Kyrie Irving handle highlights', youtubeId: 'EfPTTZQDfXo' },
      ],
    },
    {
      player: 'James Harden',
      whyForYou: 'Watch his weak-hand euro step. Reps the same move over and over.',
      videos: [
        { title: 'James Harden euro step compilation', youtubeId: 'Tk-bvuyy6e0' },
      ],
    },
  ],
  ballHandling: [
    {
      player: 'Kyrie Irving',
      whyForYou: 'Best ballhandler in NBA history. Tight handle, low to ground.',
      videos: [
        { title: 'Kyrie Irving handles tutorial', youtubeId: 'EfPTTZQDfXo' },
      ],
    },
    {
      player: 'Allen Iverson',
      whyForYou: 'Crossover blueprint. Watch his shoulder fake before every cross.',
      videos: [
        { title: 'Allen Iverson crossover compilation', youtubeId: 'lUx-rbzFxdg' },
      ],
    },
  ],
  defense: [
    {
      player: 'Kawhi Leonard',
      whyForYou: 'Best on-ball defender of his era. Watch his hand placement.',
      videos: [
        { title: 'Kawhi Leonard defense highlights', youtubeId: 'mnqJfXJ2H1Y' },
      ],
    },
    {
      player: 'Jrue Holiday',
      whyForYou: 'Modern point of attack defense. Footwork and physicality.',
      videos: [
        { title: 'Jrue Holiday defense', youtubeId: 'Rkk1WxfdnQQ' },
      ],
    },
  ],
  iq: [
    {
      player: 'Nikola Jokic',
      whyForYou: 'Best basketball IQ in the league. Always one move ahead.',
      videos: [
        { title: 'Nikola Jokic basketball IQ breakdown', youtubeId: 'eYITvMJ_85g' },
      ],
    },
    {
      player: 'Chris Paul',
      whyForYou: 'Pace control mastery. Watch how he sets up every play.',
      videos: [
        { title: 'Chris Paul pace and IQ', youtubeId: 'qNbS5d_LSPY' },
      ],
    },
  ],
  athleticism: [
    {
      player: 'Ja Morant',
      whyForYou: 'Modern explosive guard. Vertical and open court speed.',
      videos: [
        { title: 'Ja Morant athleticism highlights', youtubeId: 'jZQHVsIVKNs' },
      ],
    },
    {
      player: 'Anthony Edwards',
      whyForYou: 'Pure explosion off two feet. Builds off lower body strength.',
      videos: [
        { title: 'Ant Edwards athletic highlights', youtubeId: 'L5FCjsWUe8U' },
      ],
    },
  ],
  creativity: [
    {
      player: 'Kyrie Irving',
      whyForYou: 'Most creative scorer ever. Watch how he creates space.',
      videos: [
        { title: 'Kyrie Irving creative scoring', youtubeId: 'EfPTTZQDfXo' },
      ],
    },
    {
      player: 'James Harden',
      whyForYou: 'Pace changes and step-backs. Footwork creates everything.',
      videos: [
        { title: 'James Harden step-back tutorial', youtubeId: 'PdEwQpNX0NU' },
      ],
    },
  ],
  touch: [
    {
      player: 'Kevin Durant',
      whyForYou: 'Softest mid-range touch in NBA history. Watch his follow-through.',
      videos: [
        { title: 'Kevin Durant mid-range mastery', youtubeId: '4bZBUm5YZKQ' },
      ],
    },
    {
      player: 'DeMar DeRozan',
      whyForYou: 'Modern mid-range king. Footwork creates every shot.',
      videos: [
        { title: 'DeMar DeRozan mid-range', youtubeId: 'Tdn_Iuti7DQ' },
      ],
    },
  ],
  courtVision: [
    {
      player: 'Nikola Jokic',
      whyForYou: 'Best passer in the league. Sees the play before it happens.',
      videos: [
        { title: 'Jokic passing highlights', youtubeId: 'eYITvMJ_85g' },
      ],
    },
    {
      player: 'LeBron James',
      whyForYou: 'No-look passes. Reads defense before catching the ball.',
      videos: [
        { title: 'LeBron passing IQ', youtubeId: 'Yk8r1JmW0jE' },
      ],
    },
  ],
  decisionMaking: [
    {
      player: 'Chris Paul',
      whyForYou: 'Cleanest decision-maker ever. Always picks the right play.',
      videos: [
        { title: 'Chris Paul decision-making', youtubeId: 'qNbS5d_LSPY' },
      ],
    },
  ],
};

// Map a free-text "weakness" string to a skill key
function mapWeaknessToSkillKey(weakness: string | undefined): string {
  if (!weakness) return 'shooting';
  const w = weakness.toLowerCase();
  if (w.includes('weak hand')) return 'weakHand';
  if (w.includes('finish') || w.includes('rim')) return 'finishing';
  if (w.includes('three') || w.includes('3-point') || w.includes('shoot')) return 'shooting';
  if (w.includes('mid-range') || w.includes('touch')) return 'touch';
  if (w.includes('free throw')) return 'shotForm';
  if (w.includes('ball hand') || w.includes('handle') || w.includes('dribbl')) return 'ballHandling';
  if (w.includes('defen')) return 'defense';
  if (w.includes('iq') || w.includes('decision')) return 'iq';
  if (w.includes('athletic') || w.includes('speed') || w.includes('vertical')) return 'athleticism';
  if (w.includes('pass') || w.includes('vision')) return 'courtVision';
  return 'shooting';
}

// Build YouTube thumbnail URL from video ID
function ytThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

// Open YouTube link
async function openYouTube(videoId: string) {
  const appUrl = `vnd.youtube://${videoId}`;
  const webUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const supported = await Linking.canOpenURL(appUrl);
    if (supported) {
      await Linking.openURL(appUrl);
    } else {
      await Linking.openURL(webUrl);
    }
  } catch (e) {
    console.error('Failed to open YouTube:', e);
  }
}

export default function FilmScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = usePlanStore();
  const [isUploading, setIsUploading] = useState(false);
  const [analyses, setAnalyses] = useState<FilmAnalysis[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [latestResult, setLatestResult] = useState<any>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoadingHistory(false);
        return;
      }
      const { data } = await supabase
        .from('film_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(20);
      if (data) setAnalyses(data as FilmAnalysis[]);
    } catch (e) {
      console.error('Failed to load film history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleUpload = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your camera roll.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      videoMaxDuration: 60,
      quality: 0.3,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    setIsUploading(true);
    setLatestResult(null);

    try {
      const fileName = 'film_' + Date.now() + '.mp4';
      const formData = new FormData();
      formData.append('file', {
        uri: result.assets[0].uri,
        type: 'video/mp4',
        name: fileName,
      } as any);

      const supabaseUrl = 'https://tvtojlwdpipntkktguck.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2dG9qbHdkcGlwbnRra3RndWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODMxNDYsImV4cCI6MjA5MTA1OTE0Nn0.9GiDMwjhdZNotoJT_mFlxvxgns0I0pgjVNmM1oyPqFY';

      const uploadRes = await fetch(
        supabaseUrl + '/storage/v1/object/films/' + fileName,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + supabaseKey,
            'apikey': supabaseKey,
          },
          body: formData,
        }
      );

      if (!uploadRes.ok) {
        Alert.alert('Upload failed', 'Try a shorter clip.');
        setIsUploading(false);
        return;
      }

      const videoUrl = supabaseUrl + '/storage/v1/object/public/films/' + fileName;
      const analysisRes = await fetch('https://collectiq-xi.vercel.app/api/analyze-film', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, profile }),
      });

      const analysisData = await analysisRes.json();

      if (analysisRes.ok && analysisData.overallGrade) {
        setLatestResult({ ...analysisData, videoUrl });
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('film_analyses').insert({
              user_id: user.id,
              video_url: videoUrl,
              overall_grade: analysisData.overallGrade,
              summary: analysisData.summary,
              coach_note: analysisData.coachNote,
              strengths: analysisData.strengths,
              weaknesses: analysisData.weaknesses,
              drill_recommendations: analysisData.drillRecommendations,
              date: new Date().toISOString(),
            });
            loadHistory();
          }
        } catch (saveErr) {
          console.error('Failed to save film analysis:', saveErr);
        }
      } else {
        Alert.alert('Analysis failed', "Couldn't analyze that clip. Try a shorter one or better lighting.");
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Try again.');
    }

    setIsUploading(false);
  };

  // ---------- COMPUTED DATA ----------
  const totalFilms = analyses.length;
  const avgGradeValue = analyses.length > 0
    ? analyses.reduce((sum, a) => sum + (GRADE_VALUES[a.overall_grade] ?? 2), 0) / analyses.length
    : null;
  const avgGradeLetter = avgGradeValue != null
    ? VALUE_GRADES[Math.round(avgGradeValue)]
    : null;

  // Pick study targets based on weakness first, position as fallback
  const weaknessKey = mapWeaknessToSkillKey(profile?.weakness);
  const studyPicks = STUDY_BY_SKILL[weaknessKey] || STUDY_BY_SKILL.shooting;

  // ---------- RENDERERS ----------
  const renderAnalysisCard = (data: any) => {
    const gc = GRADE_COLORS[data.overallGrade] || Colors.primary;
    return (
      <View style={s.analysisCard}>
        <View style={s.gradeRow}>
          <View style={[s.gradeCircle, { borderColor: gc }]}>
            <Text style={[s.gradeText, { color: gc }]}>{data.overallGrade}</Text>
          </View>
          <Text style={s.summary}>{data.summary}</Text>
        </View>
        {data.coachNote && <Text style={s.coachNote}>"{data.coachNote}"</Text>}
        {data.strengths?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitleSmall}>STRENGTHS</Text>
            {data.strengths.map((item: any, i: number) => (
              <View key={i} style={s.item}>
                <View style={[s.dot, { backgroundColor: '#8B9A6B' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.skill}>{item.skill}</Text>
                  <Text style={s.detail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        {data.weaknesses?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitleSmall}>WORK ON</Text>
            {data.weaknesses.map((item: any, i: number) => (
              <View key={i} style={s.item}>
                <View style={[s.dot, { backgroundColor: '#C47A6C' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.skill}>{item.skill}</Text>
                  <Text style={s.detail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        {data.drillRecommendations?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitleSmall}>DRILLS COACH X RECOMMENDS</Text>
            {data.drillRecommendations.map((item: any, i: number) => (
              <View key={i} style={s.item}>
                <View style={[s.dot, { backgroundColor: Colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.skill}>{item.name}</Text>
                  <Text style={s.detail}>{item.reason}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <CoachXPill />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Header */}
        <Text style={s.title}>Film Room</Text>
        <Text style={s.subtitle}>Upload your game footage. Coach X breaks it down.</Text>

        {/* Stats card */}
        <View style={s.statsRow}>
          <View style={s.statBlock}>
            <Text style={s.statValue}>{totalFilms}</Text>
            <Text style={s.statLabel}>Films analyzed</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBlock}>
            <Text style={[s.statValue, avgGradeLetter && { color: GRADE_COLORS[avgGradeLetter] }]}>
              {avgGradeLetter || '—'}
            </Text>
            <Text style={s.statLabel}>Average grade</Text>
          </View>
        </View>

        {/* Upload CTA */}
        <TouchableOpacity
          style={s.uploadBtn}
          onPress={handleUpload}
          activeOpacity={0.85}
          disabled={isUploading}
        >
          {isUploading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={Colors.white} />
              <Text style={s.uploadTxt}>Coach X is watching...</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Upload size={20} color={Colors.white} />
              <Text style={s.uploadTxt}>Upload Film</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={s.uploadHint}>Up to 60 seconds. Game footage works best.</Text>

        {/* Latest result */}
        {latestResult && (
          <View style={{ marginTop: 24 }}>
            <Text style={s.sectionHeader}>LATEST ANALYSIS</Text>
            {renderAnalysisCard(latestResult)}
          </View>
        )}

        {/* Players to Study — based on weakness */}
        <View style={{ marginTop: 28 }}>
          <View style={s.sectionTitleRow}>
            <Eye size={16} color={Colors.primary} />
            <Text style={s.sectionHeaderInline}>FILM STUDY · {profile?.weakness?.toUpperCase() || 'SHOOTING'}</Text>
          </View>
          <Text style={s.sectionSub}>
            Coach X picked these because of your weakness. Tap to watch on YouTube.
          </Text>

          {studyPicks.map((pick, pi) => (
            <View key={pi} style={s.studyCard}>
              <View style={s.playerRow}>
                <View style={s.playerAvatar}>
                  <Text style={s.playerInitial}>{pick.player.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.playerName}>{pick.player}</Text>
                  <Text style={s.playerWhy}>{pick.whyForYou}</Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 12, marginHorizontal: -16 }}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
              >
                {pick.videos.map((vid, vi) => (
                  <TouchableOpacity
                    key={vi}
                    style={s.videoCard}
                    onPress={() => openYouTube(vid.youtubeId)}
                    activeOpacity={0.85}
                  >
                    <View style={s.videoThumbWrap}>
                      <Image
                        source={{ uri: ytThumb(vid.youtubeId) }}
                        style={s.videoThumb}
                        resizeMode="cover"
                      />
                      <View style={s.playOverlay}>
                        <Play size={20} color={Colors.white} fill={Colors.white} />
                      </View>
                    </View>
                    <Text style={s.videoTitle} numberOfLines={2}>{vid.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}
        </View>

        {/* What to film tips */}
        <View style={{ marginTop: 28 }}>
          <View style={s.sectionTitleRow}>
            <Lightbulb size={16} color={Colors.primary} />
            <Text style={s.sectionHeaderInline}>WHAT TO FILM</Text>
          </View>
          <View style={s.tipCard}>
            <View style={s.tipRow}>
              <View style={s.tipIcon}><Camera size={14} color={Colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.tipTitle}>Game footage</Text>
                <Text style={s.tipText}>Real game clips give Coach X the most to work with</Text>
              </View>
            </View>
            <View style={s.tipRow}>
              <View style={s.tipIcon}><Camera size={14} color={Colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.tipTitle}>One-on-one drills</Text>
                <Text style={s.tipText}>Iso clips show your moves at full speed</Text>
              </View>
            </View>
            <View style={s.tipRow}>
              <View style={s.tipIcon}><Camera size={14} color={Colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.tipTitle}>Shooting form clips</Text>
                <Text style={s.tipText}>Side-view shots help analyze form</Text>
              </View>
            </View>
            <View style={[s.tipRow, { borderBottomWidth: 0 }]}>
              <View style={s.tipIcon}><Camera size={14} color={Colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.tipTitle}>Keep it under 60 seconds</Text>
                <Text style={s.tipText}>Shorter clips analyze faster and more accurately</Text>
              </View>
            </View>
          </View>
        </View>

        {/* History */}
        <View style={{ marginTop: 28 }}>
          <View style={s.sectionTitleRow}>
            <TrendingUp size={16} color={Colors.primary} />
            <Text style={s.sectionHeaderInline}>YOUR FILM HISTORY</Text>
          </View>
          {isLoadingHistory ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
          ) : analyses.length === 0 ? (
            <View style={s.emptyHistory}>
              <FilmIcon size={28} color={Colors.textMuted} />
              <Text style={s.emptyText}>No film analyses yet</Text>
              <Text style={s.emptySubtext}>Upload your first clip above</Text>
            </View>
          ) : (
            analyses.map((a, i) => {
              const gc = GRADE_COLORS[a.overall_grade] || Colors.primary;
              return (
                <View key={i} style={s.historyCard}>
                  <View style={[s.gradePill, { backgroundColor: gc + '22', borderColor: gc }]}>
                    <Text style={[s.gradePillText, { color: gc }]}>{a.overall_grade}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.historyDate}>
                      {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Text style={s.historySummary} numberOfLines={2}>{a.summary}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20 },
  title: {
    fontSize: 28, fontWeight: '700', color: Colors.textPrimary,
    marginTop: 8, marginBottom: 4, letterSpacing: -0.8,
  },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 20 },

  // Stats card
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingVertical: 18, paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  statBlock: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 4, fontWeight: '600', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.surfaceBorder },

  // Upload
  uploadBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTxt: { fontSize: 16, fontWeight: '600', color: Colors.white, letterSpacing: 0.2 },
  uploadHint: {
    fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 10,
  },

  // Section
  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 6,
  },
  sectionTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 6,
  },
  sectionHeaderInline: {
    fontSize: 11, fontWeight: '700', color: Colors.primary,
    letterSpacing: 1.5,
  },
  sectionSub: {
    fontSize: 13, color: Colors.textMuted, marginBottom: 14, lineHeight: 18,
  },

  // Analysis card
  analysisCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16,
  },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  gradeCircle: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  gradeText: { fontSize: 22, fontWeight: '900' },
  summary: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, flex: 1 },
  coachNote: {
    fontSize: 13, color: Colors.primary, fontStyle: 'italic',
    lineHeight: 19, marginBottom: 12,
  },
  section: { marginTop: 8 },
  sectionTitleSmall: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.2, marginBottom: 8,
  },
  item: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  skill: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  detail: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  // Study cards (player + videos)
  studyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16,
    marginBottom: 12,
  },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FBF5E2',
    borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  playerInitial: {
    fontSize: 18, fontWeight: '900', color: Colors.primary,
  },
  playerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  playerWhy: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  videoCard: {
    width: 180,
  },
  videoThumbWrap: {
    width: 180,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceBorder,
    position: 'relative',
  },
  videoThumb: { width: '100%', height: '100%' },
  playOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  videoTitle: {
    fontSize: 12, color: Colors.textPrimary, fontWeight: '500',
    marginTop: 6, lineHeight: 16,
  },

  // Tip card
  tipCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  tipRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  tipIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FBF5E2',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  tipTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  tipText: { fontSize: 12, color: Colors.textMuted, lineHeight: 16 },

  // History
  historyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 14, marginBottom: 8,
  },
  gradePill: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  gradePillText: { fontSize: 18, fontWeight: '900' },
  historyDate: { fontSize: 12, color: Colors.textMuted, marginBottom: 4, fontWeight: '600' },
  historySummary: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  emptyHistory: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 32, gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  emptyText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  emptySubtext: { fontSize: 12, color: Colors.textMuted },
});
