import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Upload, Play, ChevronRight, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react-native';
import Colors from '@/constants/colors';

const MOCK_ANALYSIS = {
  title: 'vs. Westside Hawks — March 28',
  duration: 'Full game · 32 min played',
  overallGrade: 'B+',
  strengths: [
    { area: 'Transition offense', detail: 'Pushed the ball in transition 8 times, scored on 6. Great decision making in the open court.' },
    { area: 'Catch & shoot', detail: '4/6 on catch and shoot threes. Quick release, good balance on every attempt.' },
    { area: 'Help defense', detail: 'Rotated to help side correctly on 9/11 possessions. Good awareness.' },
  ],
  weaknesses: [
    { area: 'Left hand finishing', detail: '1/5 on left hand layups. Switched to right hand twice when left was the better option.' },
    { area: 'Ball security in half court', detail: '4 turnovers in half court sets. Most came from picking up dribble too early under pressure.' },
    { area: 'Off-ball movement', detail: 'Stood still on weak side for 12+ seconds on 7 possessions. Need to cut and relocate.' },
  ],
  planImpact: 'Based on this game, your next 2 weeks will emphasize left hand finishing and ball handling under pressure. We also added off-ball movement drills to your warmups.',
};

export default function FilmScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <Text style={styles.headerTitle}>Film Study</Text>
        <Text style={styles.headerSubtitle}>Upload game footage and get AI analysis that feeds directly into your training plan.</Text>

        {/* Upload section */}
        <View style={styles.uploadSection}>
          <TouchableOpacity style={styles.uploadCard} activeOpacity={0.8}>
            <View style={styles.uploadIconWrap}>
              <Upload size={24} color={Colors.primary} />
            </View>
            <View style={styles.uploadContent}>
              <Text style={styles.uploadTitle}>Upload full game</Text>
              <Text style={styles.uploadSubtitle}>Best for overall analysis — record from the stands showing full court</Text>
            </View>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadCard} activeOpacity={0.8}>
            <View style={styles.uploadIconWrap}>
              <Play size={24} color={Colors.primary} />
            </View>
            <View style={styles.uploadContent}>
              <Text style={styles.uploadTitle}>Upload specific plays</Text>
              <Text style={styles.uploadSubtitle}>Clips of possessions you want analyzed — good or bad</Text>
            </View>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadCard} activeOpacity={0.8}>
            <View style={styles.uploadIconWrap}>
              <AlertCircle size={24} color={Colors.primary} />
            </View>
            <View style={styles.uploadContent}>
              <Text style={styles.uploadTitle}>Upload a workout</Text>
              <Text style={styles.uploadSubtitle}>Shooting, handles, or drill footage for form feedback</Text>
            </View>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Past analysis section */}
        <Text style={styles.sectionTitle}>RECENT ANALYSIS</Text>

        {/* Example analysis card */}
        <View style={styles.analysisCard}>
          {/* Analysis header */}
          <View style={styles.analysisHeader}>
            <View>
              <Text style={styles.analysisTitle}>{MOCK_ANALYSIS.title}</Text>
              <Text style={styles.analysisMeta}>{MOCK_ANALYSIS.duration}</Text>
            </View>
            <View style={styles.gradeBadge}>
              <Text style={styles.gradeText}>{MOCK_ANALYSIS.overallGrade}</Text>
            </View>
          </View>

          {/* Strengths */}
          <View style={styles.analysisSection}>
            <View style={styles.analysisSectionHeader}>
              <TrendingUp size={14} color={Colors.accent} />
              <Text style={styles.analysisSectionTitle}>Strengths</Text>
            </View>
            {MOCK_ANALYSIS.strengths.map((item, i) => (
              <View key={i} style={styles.analysisItem}>
                <View style={[styles.analysisDot, { backgroundColor: Colors.accent }]} />
                <View style={styles.analysisItemContent}>
                  <Text style={styles.analysisItemArea}>{item.area}</Text>
                  <Text style={styles.analysisItemDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Weaknesses */}
          <View style={styles.analysisSection}>
            <View style={styles.analysisSectionHeader}>
              <TrendingDown size={14} color={Colors.danger} />
              <Text style={styles.analysisSectionTitle}>Needs work</Text>
            </View>
            {MOCK_ANALYSIS.weaknesses.map((item, i) => (
              <View key={i} style={styles.analysisItem}>
                <View style={[styles.analysisDot, { backgroundColor: Colors.danger }]} />
                <View style={styles.analysisItemContent}>
                  <Text style={styles.analysisItemArea}>{item.area}</Text>
                  <Text style={styles.analysisItemDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Plan impact */}
          <View style={styles.planImpact}>
            <View style={styles.planImpactHeader}>
              <View style={styles.planImpactDot} />
              <Text style={styles.planImpactLabel}>HOW THIS CHANGES YOUR PLAN</Text>
            </View>
            <Text style={styles.planImpactText}>{MOCK_ANALYSIS.planImpact}</Text>
          </View>
        </View>

        {/* Tips card */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Tips for better film</Text>
          <View style={styles.tipRow}>
            <Text style={styles.tipBullet}>·</Text>
            <Text style={styles.tipText}>Record from the stands, not the sideline — we need to see the full court</Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipBullet}>·</Text>
            <Text style={styles.tipText}>Landscape mode, steady camera — propped up is better than handheld</Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipBullet}>·</Text>
            <Text style={styles.tipText}>Even phone footage works — you don't need a professional camera</Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipBullet}>·</Text>
            <Text style={styles.tipText}>Tell us your jersey number so we can track you</Text>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, paddingTop: 16, marginBottom: 8 },
  headerSubtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24 },
  uploadSection: { gap: 10, marginBottom: 8 },
  uploadCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, gap: 14,
  },
  uploadIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#1A1708', alignItems: 'center', justifyContent: 'center',
  },
  uploadContent: { flex: 1 },
  uploadTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  uploadSubtitle: { fontSize: 12, color: Colors.textMuted, lineHeight: 16 },
  divider: { height: 1, backgroundColor: Colors.surfaceBorder, marginVertical: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 14 },
  analysisCard: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, marginBottom: 16,
  },
  analysisHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  analysisTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  analysisMeta: { fontSize: 13, color: Colors.textSecondary },
  gradeBadge: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  gradeText: { fontSize: 18, fontWeight: '900', color: Colors.black },
  analysisSection: { marginBottom: 20 },
  analysisSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  analysisSectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  analysisItem: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  analysisDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  analysisItemContent: { flex: 1 },
  analysisItemArea: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  analysisItemDetail: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  planImpact: {
    backgroundColor: '#141210', borderRadius: 12,
    borderWidth: 1, borderColor: '#2A2518', padding: 16,
  },
  planImpactHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  planImpactDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  planImpactLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5 },
  planImpactText: { fontSize: 13, color: Colors.primary, lineHeight: 19, fontWeight: '500' },
  tipsCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 18, marginBottom: 12,
  },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tipBullet: { fontSize: 14, color: Colors.textMuted },
  tipText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, flex: 1 },
});
