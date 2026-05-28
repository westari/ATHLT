import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageSquare, Dumbbell, ClipboardList } from 'lucide-react-native';
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
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.action, styles.actionAccent]}
              onPress={() => handleNav('/coachx')}
              activeOpacity={0.82}
            >
              <View style={[styles.iconWrap, { backgroundColor: Colors.primarySoft }]}>
                <MessageSquare size={20} color={Colors.primary} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Ask Coach X</Text>
                <Text style={styles.actionSub}>Chat with your AI coach</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.action}
              onPress={() => handleNav('/build-workout')}
              activeOpacity={0.82}
            >
              <View style={[styles.iconWrap, { backgroundColor: Colors.inkA8 }]}>
                <Dumbbell size={20} color={Colors.textPrimary} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Build a Workout</Text>
                <Text style={styles.actionSub}>Coach X builds it for you</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.action}
              onPress={() => handleNav('/log-game')}
              activeOpacity={0.82}
            >
              <View style={[styles.iconWrap, { backgroundColor: Colors.inkA8 }]}>
                <ClipboardList size={20} color={Colors.textPrimary} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Log a Game</Text>
                <Text style={styles.actionSub}>Quick stats from your last game</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,14,18,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.paperA88,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.inkA24,
    alignSelf: 'center',
    marginBottom: 20,
  },
  actions: {
    gap: 10,
    marginBottom: 12,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  actionAccent: {
    borderColor: Colors.glowGold,
    backgroundColor: Colors.primarySoft,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: Colors.textSecondary,
  },
  cancelBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: -0.2,
  },
});
