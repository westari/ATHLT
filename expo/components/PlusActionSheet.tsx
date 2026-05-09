import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated,
  TouchableWithoutFeedback, Dimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MessageSquare, Dumbbell, ClipboardList, Brain, X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const GOLD = '#D4AF37';
const SCREEN_HEIGHT = Dimensions.get('window').height;

interface ActionItem {
  id: string;
  Icon: any;
  iconBg: string;
  iconColor: string;
  label: string;
  description: string;
}

const ACTIONS: ActionItem[] = [
  {
    id: 'coachx',
    Icon: MessageSquare,
    iconBg: 'rgba(212, 175, 55, 0.15)',
    iconColor: GOLD,
    label: 'Ask Coach X',
    description: 'Got a question? Get a real answer.',
  },
  {
    id: 'workout',
    Icon: Dumbbell,
    iconBg: 'rgba(255, 255, 255, 0.08)',
    iconColor: '#FFFFFF',
    label: 'Build a Workout',
    description: 'Pick drills or tell Coach X what you need.',
  },
  {
    id: 'logGame',
    Icon: ClipboardList,
    iconBg: 'rgba(255, 255, 255, 0.08)',
    iconColor: '#FFFFFF',
    label: 'Log a Game',
    description: 'Record stats from a real game.',
  },
  {
    id: 'iqQuiz',
    Icon: Brain,
    iconBg: 'rgba(255, 255, 255, 0.08)',
    iconColor: '#FFFFFF',
    label: 'Game IQ Quiz',
    description: 'Train your brain. No ball needed.',
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function PlusActionSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 9,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleAction = (id: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: wire up actual nav to each action
    console.log('Tapped action:', id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.6)', opacity: backdropOpacity },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 24,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>What's the move?</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <X size={20} color="#9A9A9A" />
            </TouchableOpacity>
          </View>

          {/* Action grid */}
          <View style={styles.grid}>
            {ACTIONS.map((action) => {
              const { Icon } = action;
              return (
                <TouchableOpacity
                  key={action.id}
                  style={styles.actionCard}
                  onPress={() => handleAction(action.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconWrap, { backgroundColor: action.iconBg }]}>
                    <Icon size={24} color={action.iconColor} strokeWidth={2} />
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                  <Text style={styles.actionDesc}>{action.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F0F0F',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    minHeight: 130,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 12,
    color: '#9A9A9A',
    lineHeight: 16,
    fontWeight: '500',
  },
});
