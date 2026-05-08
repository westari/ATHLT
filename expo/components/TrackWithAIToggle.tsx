/**
 * TrackWithAIToggle.tsx
 * 
 * A toggle button that appears on shooting drill cards. Lets the user opt into
 * camera-based shot tracking for that specific drill instead of doing it manually.
 * 
 * Visual design:
 *  - Pill-shaped button with camera icon
 *  - Inactive: dark with gold border and "Track with AI" label
 *  - Active: gold filled with black icon and "Tracking" label
 *  - Tap to toggle, calls onChange(boolean)
 * 
 * Usage:
 *   <TrackWithAIToggle
 *     enabled={trackingEnabled}
 *     onChange={setTrackingEnabled}
 *     drillType="shooting"  // only renders for shooting drills
 *   />
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Camera, Zap, CheckCircle2 } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface TrackWithAIToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  drillType?: string; // 'shooting' | 'skill' | 'warmup' etc
  disabled?: boolean;
  size?: 'small' | 'medium';
  showSubtext?: boolean;
}

// Drill types that support CV tracking. For v1, only shooting.
const CV_ENABLED_TYPES = ['shooting'];

export default function TrackWithAIToggle({
  enabled,
  onChange,
  drillType,
  disabled = false,
  size = 'medium',
  showSubtext = false,
}: TrackWithAIToggleProps) {
  // Don't render if drill type doesn't support CV
  if (drillType && !CV_ENABLED_TYPES.includes(drillType)) {
    return null;
  }

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(!enabled);
  };

  const iconSize = size === 'small' ? 14 : 16;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
        style={[
          styles.toggle,
          size === 'small' && styles.toggleSmall,
          enabled && styles.toggleActive,
          disabled && styles.toggleDisabled,
        ]}
      >
        {enabled ? (
          <>
            <CheckCircle2 size={iconSize} color="#000" strokeWidth={2.5} />
            <Text
              style={[
                styles.text,
                styles.textActive,
                size === 'small' && styles.textSmall,
              ]}
            >
              Tracking
            </Text>
          </>
        ) : (
          <>
            <Camera
              size={iconSize}
              color={Colors.dark.gold}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.text,
                size === 'small' && styles.textSmall,
              ]}
            >
              Track with AI
            </Text>
          </>
        )}
      </TouchableOpacity>

      {showSubtext && (
        <Text style={styles.subtext}>
          {enabled
            ? 'Coach X will watch and count your shots'
            : 'Use your phone camera to auto-track makes and misses'}
        </Text>
      )}
    </View>
  );
}

// ----------------- Styles -----------------

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
    gap: 6,
  },
  toggleSmall: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  toggleActive: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  toggleDisabled: {
    opacity: 0.5,
  },
  text: {
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textSmall: {
    fontSize: 11,
  },
  textActive: {
    color: '#000',
  },
  subtext: {
    color: Colors.dark.subtext,
    fontSize: 11,
    marginTop: 6,
    marginLeft: 4,
    fontStyle: 'italic',
  },
});
