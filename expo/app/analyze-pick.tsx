import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Search, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { AnalysisResult } from '@/types/parlay';

const sampleAnalysis: AnalysisResult = {
  pick: 'Celtics -6.5 vs Lakers',
  confidence: 74,
  reasoning:
    'The Celtics are 12-3 ATS at home this season, while the Lakers are 5-9 ATS on the road. Boston ranks 2nd in net rating at home (+9.8) and LA has struggled covering spreads against elite teams. Tatum is averaging 29.1 PPG in his last 10 and the Celtics defense holds opponents to 106.3 PPG at home.',
  factors: [
    { label: 'Home Court', impact: 'positive', detail: 'Celtics 12-3 ATS at home' },
    { label: 'Road Record', impact: 'positive', detail: 'Lakers 5-9 ATS on the road' },
    { label: 'Star Power', impact: 'positive', detail: 'Tatum avg 29.1 PPG last 10' },
    { label: 'Rest Factor', impact: 'neutral', detail: 'Both teams on 1 day rest' },
    { label: 'Injury Report', impact: 'negative', detail: 'Porzingis questionable' },
    { label: 'Line Movement', impact: 'positive', detail: 'Line opened at -5.5, moved to -6.5' },
  ],
  verdict: 'LEAN: CELTICS -6.5',
};

function getImpactIcon(impact: 'positive' | 'negative' | 'neutral') {
  switch (impact) {
    case 'positive':
      return <TrendingUp size={14} color={Colors.green} />;
    case 'negative':
      return <TrendingDown size={14} color={Colors.red} />;
    case 'neutral':
      return <Minus size={14} color={Colors.textMuted} />;
  }
}

function getImpactColor(impact: 'positive' | 'negative' | 'neutral'): string {
  switch (impact) {
    case 'positive':
      return Colors.green;
    case 'negative':
      return Colors.red;
    case 'neutral':
      return Colors.textMuted;
  }
}

export default function AnalyzePickScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pickText, setPickText] = useState<string>('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const resultFade = useRef(new Animated.Value(0)).current;

  const analyzeMutation = useMutation({
    mutationFn: async (): Promise<AnalysisResult> => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return {
        ...sampleAnalysis,
        pick: pickText || sampleAnalysis.pick,
      };
    },
    onSuccess: (data) => {
      setAnalysis(data);
      resultFade.setValue(0);
      Animated.timing(resultFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    },
  });

  const handleAnalyze = () => {
    if (!pickText.trim()) return;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    setAnalysis(null);
    analyzeMutation.mutate();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analyze Pick</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.inputSection}>
          <Text style={styles.sectionLabel}>ENTER YOUR PICK</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Celtics -6.5, LeBron Over 25.5 pts..."
              placeholderTextColor={Colors.textMuted}
              value={pickText}
              onChangeText={setPickText}
            />
          </View>

          <View style={styles.quickPicks}>
            <Text style={styles.quickPicksLabel}>QUICK PICKS</Text>
            <View style={styles.quickPicksRow}>
              {['Celtics -6.5', 'SGA O29.5', 'Nuggets ML', 'Under 224.5'].map((pick) => (
                <TouchableOpacity
                  key={pick}
                  style={styles.quickPickChip}
                  onPress={() => {
                    setPickText(pick);
                    if (Platform.OS !== 'web') {
                      void Haptics.selectionAsync();
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickPickText}>{pick}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.analyzeBtn, (!pickText.trim() || analyzeMutation.isPending) && styles.analyzeBtnDisabled]}
          onPress={handleAnalyze}
          activeOpacity={0.85}
          disabled={!pickText.trim() || analyzeMutation.isPending}
        >
          <LinearGradient
            colors={!pickText.trim() ? [Colors.surfaceLight, Colors.surfaceLight] : [Colors.accent, Colors.accentBlue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.analyzeBtnGradient}
          >
            {analyzeMutation.isPending ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Search size={18} color={Colors.white} />
            )}
            <Text style={styles.analyzeBtnText}>
              {analyzeMutation.isPending ? 'ANALYZING...' : 'ANALYZE PICK'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {analysis && (
          <Animated.View style={[styles.resultSection, { opacity: resultFade }]}>
            <View style={styles.confidenceCard}>
              <View style={styles.confidenceHeader}>
                <Text style={styles.confidencePickText}>{analysis.pick}</Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceValue}>{analysis.confidence}%</Text>
                  <Text style={styles.confidenceLabel}>CONFIDENCE</Text>
                </View>
              </View>

              <View style={styles.confidenceBar}>
                <LinearGradient
                  colors={[Colors.primary, Colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.confidenceFill, { width: `${analysis.confidence}%` }]}
                />
              </View>

              <View style={styles.verdictContainer}>
                <Text style={styles.verdictText}>{analysis.verdict}</Text>
              </View>
            </View>

            <View style={styles.reasoningCard}>
              <Text style={styles.reasoningTitle}>AI ANALYSIS</Text>
              <Text style={styles.reasoningText}>{analysis.reasoning}</Text>
            </View>

            <View style={styles.factorsCard}>
              <Text style={styles.factorsTitle}>KEY FACTORS</Text>
              {analysis.factors.map((factor, i) => (
                <View key={i} style={styles.factorRow}>
                  <View style={styles.factorLeft}>
                    {getImpactIcon(factor.impact)}
                    <Text style={styles.factorLabel}>{factor.label}</Text>
                  </View>
                  <Text style={[styles.factorDetail, { color: getImpactColor(factor.impact) }]}>
                    {factor.detail}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        <View style={{ height: insets.bottom + 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  inputRow: {
    marginBottom: 18,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  quickPicks: {
    gap: 10,
  },
  quickPicksLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
  },
  quickPicksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPickChip: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickPickText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  analyzeBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  analyzeBtnDisabled: {
    opacity: 0.6,
  },
  analyzeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 14,
  },
  analyzeBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  resultSection: {
    marginTop: 32,
    gap: 16,
  },
  confidenceCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 20,
  },
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  confidencePickText: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800' as const,
    flex: 1,
  },
  confidenceBadge: {
    alignItems: 'center',
    marginLeft: 12,
  },
  confidenceValue: {
    color: Colors.green,
    fontSize: 28,
    fontWeight: '900' as const,
  },
  confidenceLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  confidenceBar: {
    height: 6,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  verdictContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  verdictText: {
    color: Colors.green,
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: 1.5,
  },
  reasoningCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 18,
  },
  reasoningTitle: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  reasoningText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  factorsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 18,
    gap: 12,
  },
  factorsTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
  },
  factorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37, 42, 69, 0.4)',
  },
  factorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factorLabel: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  factorDetail: {
    fontSize: 11,
    fontWeight: '600' as const,
    flex: 1,
    textAlign: 'right' as const,
    marginLeft: 12,
  },
});
