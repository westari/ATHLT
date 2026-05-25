/**
 * CVCameraView — live camera feed with shot tracking.
 *
 * Requires react-native-vision-camera v5 and react-native-worklets-core.
 * See expo/cv/INSTALL.md for setup instructions before using.
 *
 * Props:
 *   onShotDetected  — called on JS thread whenever a make/miss is detected
 *   onSessionEnd    — called when user taps Stop
 *   tracker         — ShotTracker instance shared with the parent screen
 *   active          — whether tracking is currently running
 *
 * The camera is always back-facing and runs at the device's preferred 30fps.
 * The frame processor runs on the VisionCamera JS-Runtime (off main thread).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator,
  Linking,
} from 'react-native';
import Colors from '@/constants/colors';
import ShotOverlay from './ShotOverlay';
import { ShotTracker, type ShotEvent } from '@/lib/cv/ShotTracker';
import { loadModel } from '@/modules/shot-detector';

// VisionCamera v5 imports — guarded so the file compiles before the package is installed
let Camera: any = null;
let useCameraDevice: any = null;
let useCameraPermission: any = null;
let useFrameProcessor: any = null;
let detectShots: any = null;
let Worklets: any = null;

try {
  const VC = require('react-native-vision-camera');
  Camera           = VC.Camera;
  useCameraDevice  = VC.useCameraDevice;
  useCameraPermission = VC.useCameraPermission;
  useFrameProcessor = VC.useFrameProcessor;
  Worklets         = require('react-native-worklets-core').Worklets;
  detectShots      = require('@/modules/shot-detector').detectShots;
} catch {
  // VisionCamera not yet installed — show placeholder in dev
}

interface Props {
  tracker: ShotTracker;
  active: boolean;
  onShotDetected: (event: ShotEvent) => void;
  onCameraReady?: () => void;
}

type ModelState = 'loading' | 'ready' | 'error';

export default function CVCameraView({ tracker, active, onShotDetected, onCameraReady }: Props) {
  const [modelState, setModelState] = useState<ModelState>('loading');
  const [modelError, setModelError]  = useState<string>('');
  const [lastShotType, setLastShotType] = useState<'make' | 'miss' | null>(null);
  const [lastDetections, setLastDetections] = useState<any[]>([]);
  const [showDebugBoxes, setShowDebugBoxes] = useState(false);
  const [makes, setMakes]       = useState(0);
  const [totalShots, setTotal]  = useState(0);

  // Guards against referencing stale closures in worklet callbacks
  const activeRef = useRef(active);
  activeRef.current = active;

  // Load model on mount
  useEffect(() => {
    let cancelled = false;
    loadModel().then((result) => {
      if (cancelled) return;
      if (result.loaded) {
        setModelState('ready');
        onCameraReady?.();
      } else {
        setModelState('error');
        setModelError(result.error ?? 'Unknown error');
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Wire tracker.onShot to update UI
  useEffect(() => {
    tracker.onShot = (event: ShotEvent) => {
      setLastShotType(event.type);
      setMakes(tracker.getMakes());
      setTotal(tracker.getTotalShots());
      onShotDetected(event);
    };
    return () => { tracker.onShot = null; };
  }, [tracker, onShotDetected]);

  // ---- VisionCamera hooks ----

  const hasCameraPackage = Camera !== null;

  const { hasPermission, requestPermission } = hasCameraPackage
    ? useCameraPermission()
    : { hasPermission: false, requestPermission: async () => false };

  const device = hasCameraPackage
    ? useCameraDevice('back')
    : null;

  // Callback bridging worklet → JS thread
  const onDetectionsJS = hasCameraPackage && Worklets
    ? Worklets.createRunOnJS((dets: any[], ts: number) => {
        if (!activeRef.current) return;
        setLastDetections(dets);
        tracker.processFrame(dets, ts);
      })
    : null;

  const frameProcessor = hasCameraPackage && useFrameProcessor && onDetectionsJS
    ? useFrameProcessor((frame: any) => {
        'worklet';
        if (!activeRef.current) return;
        const result = detectShots(frame, { minConfidence: 0.35 });
        onDetectionsJS(result.detections, result.timestampMs);
      }, [onDetectionsJS])
    : undefined;

  // ---- Render states ----

  if (!hasCameraPackage) {
    return <PlaceholderView reason="VisionCamera not installed" detail="Run: npm install react-native-vision-camera@5.0.10 react-native-worklets-core --legacy-peer-deps" />;
  }

  if (!hasPermission) {
    return (
      <PlaceholderView
        reason="Camera permission needed"
        detail="Tap to grant camera access"
        onPress={requestPermission}
      />
    );
  }

  if (!device) {
    return <PlaceholderView reason="No back camera found" />;
  }

  if (modelState === 'loading') {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading shot detection model...</Text>
      </View>
    );
  }

  if (modelState === 'error') {
    return (
      <PlaceholderView
        reason="Model not loaded"
        detail={modelError || 'best.mlpackage not found in bundle. Run Colab training and EAS build.'}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={active}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
        fps={30}
      />

      <ShotOverlay
        makes={makes}
        totalShots={totalShots}
        lastShotType={lastShotType}
        detections={lastDetections}
        showDebugBoxes={showDebugBoxes}
      />

      {/* Debug toggle (long-press anywhere on the camera) */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onLongPress={() => setShowDebugBoxes(prev => !prev)}
        activeOpacity={1}
      />
    </View>
  );
}

// ---- Placeholder for unavailable states ----

function PlaceholderView({
  reason,
  detail,
  onPress,
}: {
  reason: string;
  detail?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.placeholder}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      <View style={styles.placeholderIcon}>
        <Text style={styles.placeholderIconText}>CAM</Text>
      </View>
      <Text style={styles.placeholderReason}>{reason}</Text>
      {detail && <Text style={styles.placeholderDetail}>{detail}</Text>}
      {onPress && <Text style={styles.placeholderCta}>Tap to continue</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  placeholderIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 160, 23, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  placeholderIconText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  placeholderReason: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  placeholderDetail: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  placeholderCta: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
});
