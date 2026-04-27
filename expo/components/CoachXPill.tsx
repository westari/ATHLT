import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import CoachXBottomSheet from './CoachXBottomSheet';

/**
 * CoachXPill — a tappable pill that lives at the top of every main screen.
 * Shows "Ask Coach X..." text and his face on the right.
 * Opens a bottom sheet (70% height) with the full Coach X chat when tapped.
 *
 * Usage in any screen:
 *   <CoachXPill />
 *
 * Drop it just below the header / above the main content.
 */
export default function CoachXPill() {
  const [open, setOpen] = useState(false);

  const handlePress = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(true);
  };

  return (
    <>
      <TouchableOpacity
        style={s.pill}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View style={s.iconCircle}>
          <Sparkles size={14} color={Colors.primary} />
        </View>
        <Text style={s.pillText}>Ask Coach X...</Text>
        <View style={s.faceWrap}>
          <Image
            source={require('@/assets/images/coach-x-small.png')}
            style={s.face}
            resizeMode="cover"
          />
        </View>
      </TouchableOpacity>

      <CoachXBottomSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FBF5E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pillText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  faceWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  face: {
    width: '100%',
    height: '100%',
  },
});
