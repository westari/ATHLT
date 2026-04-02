import React, { useState, useRef, useCallback } from 'react';
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
import { ArrowLeft, Zap, ChevronDown, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import ParlayCard from '@/components/ParlayCard';
import { sportOptions, legCountOptions, sampleParlay, sampleNFLParlay } from '@/mocks/parlays';
import { Parlay } from '@/types/parlay';

export default function BuildParlayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedSport, setSelectedSport] = useState<string>('NBA');
  const [selectedLegs, setSelectedLegs] = useState<number>(4);
  const [notes, setNotes] = useState<string>('');
  const [showSportPicker, setShowSportPicker] = useState<boolean>(false);
  const [generatedParlay, setGeneratedParlay] = useState<Parlay | null>(null);
  const resultFade = useRef(new Animated.Value(0)).current;

  const buildMutation = useMutation({
    mutationFn: async (): Promise<Parlay> => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return selectedSport === 'NFL' ? sampleNFLParlay : {
        ...sampleParlay,
        legCount: selectedLegs,
        legs: sampleParlay.legs.slice(0, selectedLegs),
      };
    },
    onSuccess: (data) => {
      setGeneratedParlay(data);
      resultFade.setValue(0);
      Animated.timing(resultFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    },
  });

  const handleBuild = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    setGeneratedParlay(null);
    buildMutation.mutate();
  }, [buildMutation]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Build Parlay</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSmall}>
          <Sparkles size={18} color={Colors.accent} />
          <Text style={styles.heroText}>Configure your AI parlay below</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SPORT</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowSportPicker(!showSportPicker)}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownText}>{selectedSport}</Text>
            <ChevronDown size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          {showSportPicker && (
            <View style={styles.pickerOptions}>
              {sportOptions.map((sport) => (
                <TouchableOpacity
                  key={sport}
                  style={[
                    styles.pickerOption,
                    selectedSport === sport && styles.pickerOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedSport(sport);
                    setShowSportPicker(false);
                    if (Platform.OS !== 'web') {
                      void Haptics.selectionAsync();
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      selectedSport === sport && styles.pickerOptionTextActive,
                    ]}
                  >
                    {sport}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NUMBER OF LEGS</Text>
          <View style={styles.legsRow}>
            {legCountOptions.map((count) => (
              <TouchableOpacity
                key={count}
                style={[
                  styles.legOption,
                  selectedLegs === count && styles.legOptionActive,
                ]}
                onPress={() => {
                  setSelectedLegs(count);
                  if (Platform.OS !== 'web') {
                    void Haptics.selectionAsync();
                  }
                }}
                activeOpacity={0.7}
              >
                {selectedLegs === count ? (
                  <LinearGradient
                    colors={[Colors.primary, '#6D28D9']}
                    style={styles.legOptionGradient}
                  >
                    <Text style={styles.legOptionTextActive}>{count}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.legOptionText}>{count}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTES (OPTIONAL)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. I like the Celtics tonight, avoid player props..."
            placeholderTextColor={Colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.buildBtn, buildMutation.isPending && styles.buildBtnDisabled]}
          onPress={handleBuild}
          activeOpacity={0.85}
          disabled={buildMutation.isPending}
        >
          <LinearGradient
            colors={buildMutation.isPending ? [Colors.surfaceLight, Colors.surfaceLight] : [Colors.primary, '#6D28D9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buildBtnGradient}
          >
            {buildMutation.isPending ? (
              <ActivityIndicator color={Colors.textPrimary} size="small" />
            ) : (
              <Zap size={18} color={Colors.white} />
            )}
            <Text style={styles.buildBtnText}>
              {buildMutation.isPending ? 'BUILDING YOUR PARLAY...' : 'BUILD MY PARLAY'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {generatedParlay && (
          <Animated.View style={[styles.resultSection, { opacity: resultFade }]}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>YOUR AI PARLAY</Text>
              <View style={styles.resultBadge}>
                <Text style={styles.resultBadgeText}>GENERATED</Text>
              </View>
            </View>
            <ParlayCard parlay={generatedParlay} animate={false} />

            <View style={styles.reasoningCard}>
              <Text style={styles.reasoningTitle}>AI REASONING</Text>
              <Text style={styles.reasoningText}>
                Based on tonight's slate, I've identified strong edges in these matchups. The Celtics are 8-2 ATS at home this month and the line hasn't moved despite 72% of public money on them. Jokic has recorded a triple-double in 4 of his last 5 games against Houston. SGA is averaging 31.2 points and facing the league's worst perimeter defense. The Knicks-Cavs game projects low-scoring with both teams in the bottom 10 in pace.
              </Text>
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
  heroSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    marginBottom: 28,
  },
  heroText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  pickerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  pickerOption: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pickerOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
  },
  pickerOptionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  pickerOptionTextActive: {
    color: Colors.primaryLight,
  },
  legsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  legOption: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    overflow: 'hidden',
  },
  legOptionActive: {
    borderColor: Colors.primary,
    borderWidth: 0,
  },
  legOptionGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  legOptionText: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  legOptionTextActive: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800' as const,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 14,
    minHeight: 80,
    lineHeight: 20,
  },
  buildBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  buildBtnDisabled: {
    opacity: 0.8,
  },
  buildBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 14,
  },
  buildBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  resultSection: {
    marginTop: 36,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  resultTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  resultBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resultBadgeText: {
    color: Colors.green,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  reasoningCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 18,
    marginTop: 16,
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
});
