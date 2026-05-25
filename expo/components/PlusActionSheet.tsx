// expo/components/PlusActionSheet.tsx
// Bottom action sheet shown when user taps the + button.
// 4 options: Ask Coach X / Build a Workout / Log a Game / Track Shots (CV).

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageSquare, Dumbbell, ClipboardList, X, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function PlusActionSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleNav = (path: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    setTimeout(() => router.push(path as any), 200);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Quick Actions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {/* Ask Coach X — gold accent */}
            <TouchableOpacity
              style={[styles.action, styles.actionAccent]}
              onPress={() => handleNav('/coach-x')}
              activeOpacity={0.85}
            >
              <View style={[styles.iconWrap, styles.iconWrapAccent]}>
                <MessageSquare size={20} color={Colors.primary} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Ask Coach X</Text>
                <Text style={styles.actionSub}>Chat with your AI coach</Text>
              </View>
            </TouchableOpacity>

            {/* Build a Workout */}
            <TouchableOpacity
              style={styles.action}
              onPress={() => handleNav('/build-workout')}
              activeOpacity={0.85}
            >
              <View style={styles.iconWrap}>
                <Dumbbell size={20} color={Colors.textPrimary} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Build a Workout</Text>
                <Text style={styles.actionSub}>Coach X builds it for you</Text>
              </View>
            </TouchableOpacity>

            {/* Log a Game */}
            <TouchableOpacity
              style={styles.action}
              onPress={() => handleNav('/log-game')}
              activeOpacity={0.85}
            >
              <View style={styles.iconWrap}>
                <ClipboardList size={20} color={Colors.textPrimary} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Log a Game</Text>
                <Text style={styles.actionSub}>Quick stats from your last game</Text>
              </View>
            </TouchableOpacity>

            {/* Track Shots — CV open run */}
            <TouchableOpacity
              style={styles.action}
              onPress={() => handleNav('/open-run')}
              activeOpacity={0.85}
            >
              <View style={styles.iconWrap}>
                <Camera size={20} color={Colors.textPrimary} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Track Shots</Text>
                <Text style={styles.actionSub}>Live make/miss tracking — no drill guide</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceBorder,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  actions: {
    gap: 10,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  actionAccent: {
    borderColor: 'rgba(212, 160, 23, 0.35)',
    backgroundColor: 'rgba(212, 160, 23, 0.06)',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapAccent: {
    backgroundColor: 'rgba(212, 160, 23, 0.15)',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  actionSub: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
  },
});
