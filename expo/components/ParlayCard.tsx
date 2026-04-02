import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { Parlay } from '@/types/parlay';

interface ParlayCardProps {
  parlay: Parlay;
  animate?: boolean;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 75) return Colors.green;
  if (confidence >= 65) return Colors.greenLight;
  if (confidence >= 55) return Colors.orange;
  return Colors.yellow;
}

function getLegColor(index: number): string {
  const colors = [Colors.green, Colors.accent, Colors.orange, Colors.primaryLight, Colors.yellow, Colors.red];
  return colors[index % colors.length];
}

export default function ParlayCard({ parlay, animate = true }: ParlayCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (animate) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          delay: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
    }
  }, [animate, fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.card,
        animate ? { opacity: fadeAnim, transform: [{ translateY: slideAnim }] } : {},
      ]}
    >
      <LinearGradient
        colors={[Colors.accent, Colors.accentBlue, Colors.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientLine}
      />

      <View style={styles.cardHeader}>
        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>AI-BUILT</Text>
          </View>
          <Text style={styles.tagDot}>·</Text>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{parlay.legCount}-LEG PARLAY</Text>
          </View>
        </View>
        <View style={styles.oddsContainer}>
          <Text style={styles.oddsLabel}>COMBINED ODDS</Text>
          <Text style={styles.oddsValue}>{parlay.combinedOdds}</Text>
        </View>
      </View>

      <Text style={styles.slateTitle}>{parlay.title}</Text>

      <View style={styles.legsContainer}>
        {parlay.legs.map((leg, index) => (
          <View key={leg.id} style={styles.legRow}>
            <View style={styles.legLeft}>
              <View style={[styles.legNumber, { backgroundColor: getLegColor(index) }]}>
                <Text style={styles.legNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.legInfo}>
                <Text style={styles.legPick}>{leg.pick}</Text>
                <Text style={styles.legDetails}>{leg.details}</Text>
              </View>
            </View>
            <View style={styles.legRight}>
              <Text style={[styles.confidenceValue, { color: getConfidenceColor(leg.confidence) }]}>
                {leg.confidence}%
              </Text>
              <Text style={styles.confidenceLabel}>CONFIDENCE</Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  gradientLine: {
    height: 3,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tag: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  tagDot: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  oddsContainer: {
    alignItems: 'flex-end',
  },
  oddsLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '600' as const,
    letterSpacing: 1.2,
  },
  oddsValue: {
    color: Colors.green,
    fontSize: 24,
    fontWeight: '800' as const,
    marginTop: 2,
  },
  slateTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 14,
  },
  legsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 2,
  },
  legRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(37, 42, 69, 0.4)',
  },
  legLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  legNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legNumberText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '800' as const,
  },
  legInfo: {
    flex: 1,
  },
  legPick: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  legDetails: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  legRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  confidenceValue: {
    fontSize: 16,
    fontWeight: '800' as const,
  },
  confidenceLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '600' as const,
    letterSpacing: 1,
    marginTop: 1,
  },
});
