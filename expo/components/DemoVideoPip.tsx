// expo/components/DemoVideoPip.tsx
// Plays a YouTube demo video in fullscreen, then animates down to a small
// picture-in-picture box in the top-right corner.
//
// Requires `react-native-webview` (standard in Expo SDK 54).
// YouTube URLs are converted to embed URLs with autoplay + minimal controls.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Animated, Text, Platform, Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

type Props = {
  /** YouTube URL or video ID for the demo. */
  videoUrl: string;
  /** True = video plays fullscreen. False = video sits in top-right PIP. */
  isFullscreen: boolean;
  /** Called when user taps the PIP to expand back to fullscreen (optional). */
  onTapPip?: () => void;
  /** Called when video has been playing fullscreen for a while (demo duration). */
  onDemoComplete?: () => void;
  /** Duration (ms) the demo plays fullscreen before auto-shrinking to PIP. */
  fullscreenDurationMs?: number;
};

// Default 7 second demo before zoom-out to PIP
const DEFAULT_FULLSCREEN_DURATION = 7000;

export default function DemoVideoPip({
  videoUrl,
  isFullscreen,
  onTapPip,
  onDemoComplete,
  fullscreenDurationMs = DEFAULT_FULLSCREEN_DURATION,
}: Props) {
  const { width: screenW, height: screenH } = Dimensions.get('window');

  // Pip target (top-right, ~22% of screen width)
  const PIP_WIDTH = Math.round(screenW * 0.22);
  const PIP_HEIGHT = Math.round(PIP_WIDTH * 9 / 16);
  const PIP_RIGHT = 16;
  const PIP_TOP = 60; // below top status bar

  // Animated dimensions / position
  const animValue = useRef(new Animated.Value(isFullscreen ? 1 : 0)).current;
  // 1 = fullscreen, 0 = PIP

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: isFullscreen ? 1 : 0,
      duration: 600,
      useNativeDriver: false, // we're animating layout, not transform
    }).start();
  }, [isFullscreen, animValue]);

  // Auto-trigger onDemoComplete after fullscreenDurationMs while fullscreen
  useEffect(() => {
    if (!isFullscreen || !onDemoComplete) return;
    const t = setTimeout(() => {
      onDemoComplete();
    }, fullscreenDurationMs);
    return () => clearTimeout(t);
  }, [isFullscreen, fullscreenDurationMs, onDemoComplete]);

  // Build YouTube embed URL with autoplay + no related videos
  const embedHtml = useMemo(() => {
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) {
      return `<html><body style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;font-family:sans-serif;">Invalid video</body></html>`;
    }
    // Mute by default per autoplay restrictions; can unmute via player controls.
    const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&mute=1&playsinline=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3`;
    return `
<!doctype html>
<html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
  <style>
    html,body { margin:0; padding:0; height:100%; width:100%; background:#000; overflow:hidden; }
    iframe { border:0; width:100%; height:100%; }
  </style>
</head>
<body>
  <iframe src="${src}" allow="autoplay; encrypted-media" allowfullscreen></iframe>
</body></html>`;
  }, [videoUrl]);

  // Animated dimensions
  const width  = animValue.interpolate({ inputRange: [0, 1], outputRange: [PIP_WIDTH,  screenW] });
  const height = animValue.interpolate({ inputRange: [0, 1], outputRange: [PIP_HEIGHT, screenH] });
  const top    = animValue.interpolate({ inputRange: [0, 1], outputRange: [PIP_TOP, 0] });
  const right  = animValue.interpolate({ inputRange: [0, 1], outputRange: [PIP_RIGHT, 0] });
  const borderRadius = animValue.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const borderWidth  = animValue.interpolate({ inputRange: [0, 1], outputRange: [2, 0] });

  const handleTap = () => {
    if (!onTapPip || isFullscreen) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTapPip();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width,
          height,
          top,
          right,
          borderRadius,
          borderWidth,
          borderColor: Colors.primary,
        },
      ]}
      pointerEvents={isFullscreen ? 'none' : 'auto'}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleTap}
        style={styles.touchable}
      >
        <WebView
          source={{ html: embedHtml }}
          style={styles.web}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
        />

        {!isFullscreen && (
          <View style={styles.pipLabel} pointerEvents="none">
            <Text style={styles.pipLabelText}>DEMO</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ===== Helpers =====

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  // Already an ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  // Various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#000',
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  touchable: {
    flex: 1,
  },
  web: {
    flex: 1,
    backgroundColor: '#000',
  },
  pipLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    alignItems: 'center',
  },
  pipLabelText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
