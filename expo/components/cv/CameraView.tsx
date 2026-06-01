/**
 * CVCameraView — React Native wrapper over the ATHLTCamera native module.
 *
 * Owns the full camera lifecycle:
 *   mount  → startSession() → loadModel()
 *   active → startTracking() / stopTracking() controlled by the `active` prop
 *   unmount → stopSession()
 *
 * Shot detection runs entirely in Swift (AVFoundation + CoreML + state machine).
 * This component just subscribes to onShotDetected events and forwards them to
 * the parent via the `onShotDetected` prop.
 *
 * No VisionCamera. No worklets. No frame processors.
 * See modules/athlt-camera/ for the native implementation.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Colors from '@/constants/colors';
import ShotOverlay from './ShotOverlay';
import type { ShotEvent } from '@/lib/cv/ShotTracker';

// Import the new native module — guarded so TS compilation succeeds even
// before an EAS build (the module is present after `expo prebuild`).
let athlt: typeof import('@/modules/athlt-camera/src/index') | null = null;
try {
  athlt = require('@/modules/athlt-camera/src/index');
} catch {
  // Module not yet linked (running in web or before native build)
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Whether shot tracking is active. Camera preview always runs. */
  active: boolean;
  /** Called on the JS thread whenever the native module detects a make or miss. */
  onShotDetected: (event: ShotEvent) => void;
  onCameraReady?: () => void;
}

// ─── Camera states ─────────────────────────────────────────────────────────────

type CameraState = 'loading' | 'permissionDenied' | 'modelError' | 'ready';

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CVCameraView({ active, onShotDetected, onCameraReady }: Props) {
  const [camState, setCamState] = useState<CameraState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [showDebugBoxes, setShowDebugBoxes] = useState(false);

  const activeRef = useRef(active);
  activeRef.current = active;

  // Module availability check (first render is synchronous)
  const hasModule = athlt !== null;

  // ── Lifecycle: start session + load model on mount, stop on unmount ───────
  useEffect(() => {
    if (!hasModule) {
      setCamState('modelError');
      setErrorMsg('ATHLTCamera native module not found. Run EAS build first.');
      return;
    }

    let cancelled = false;

    const init = async () => {
      // 1. Start AVCaptureSession (requests permission internally)
      const sessionResult = await athlt!.startSession();
      if (cancelled) return;

      if (!sessionResult.success) {
        if (sessionResult.error?.toLowerCase().includes('permission')) {
          setCamState('permissionDenied');
        } else {
          setCamState('modelError');
          setErrorMsg(sessionResult.error ?? 'Session start failed');
        }
        return;
      }

      // 2. Load CoreML model
      const modelResult = await athlt!.loadModel();
      if (cancelled) return;

      if (!modelResult.loaded) {
        setCamState('modelError');
        setErrorMsg(modelResult.error ?? 'Model load failed');
        return;
      }

      setCamState('ready');
      onCameraReady?.();
    };

    init().catch(e => {
      if (!cancelled) {
        setCamState('modelError');
        setErrorMsg(String(e));
      }
    });

    return () => {
      cancelled = true;
      athlt!.stopSession().catch(() => {});
    };
  }, [hasModule]);

  // ── Tracking: startTracking / stopTracking whenever `active` changes ──────
  useEffect(() => {
    if (camState !== 'ready' || !hasModule) return;

    if (active) {
      athlt!.startTracking().catch(e => console.error('[CVCameraView] startTracking error:', e));
    } else {
      // Only stop if we were tracking (native side is idempotent but no need to call)
      athlt!.stopTracking().catch(() => {});
    }
  }, [active, camState, hasModule]);

  // ── Shot events: subscribe while ready ───────────────────────────────────
  useEffect(() => {
    if (camState !== 'ready' || !hasModule) return;

    const sub = athlt!.addShotListener((nativeShot) => {
      if (!activeRef.current) return;

      // Convert native ShotDetection → ShotEvent shape expected by the parent
      const event: ShotEvent = {
        type:          nativeShot.type,
        timestamp:     nativeShot.timestamp,
        confidence:    nativeShot.confidence,
        zone:          null,   // Court zone not yet computed natively (future)
        ballPositions: [],     // Trajectory not yet surfaced to JS (future)
      };
      onShotDetected(event);
    });

    return () => sub.remove();
  }, [camState, hasModule, onShotDetected]);

  // ── Render states ─────────────────────────────────────────────────────────

  if (!hasModule) {
    return <PlaceholderView reason="ATHLTCamera not linked" detail="Run: eas build --profile development" />;
  }

  if (camState === 'permissionDenied') {
    return (
      <PlaceholderView
        reason="Camera permission needed"
        detail="Enable camera access in iOS Settings → ATHLT → Camera"
      />
    );
  }

  if (camState === 'modelError') {
    return <PlaceholderView reason="Camera error" detail={errorMsg} />;
  }

  if (camState === 'loading') {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Starting camera…</Text>
      </View>
    );
  }

  // ── Ready: render native camera preview ──────────────────────────────────
  const ATHLTCameraView = athlt!.ATHLTCameraView;

  return (
    <View style={styles.container}>
      <ATHLTCameraView style={StyleSheet.absoluteFillObject} />
      <ShotOverlay detections={[]} showDebugBoxes={showDebugBoxes} />
      {/* Long-press anywhere to toggle debug overlay */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onLongPress={() => setShowDebugBoxes(v => !v)}
        activeOpacity={1}
      />
    </View>
  );
}

// ─── Placeholder for error/loading states ─────────────────────────────────────

function PlaceholderView({ reason, detail, onPress }: {
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
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  placeholderIconText: {
    color: Colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1,
  },
  placeholderReason: {
    color: Colors.white, fontSize: 16, fontWeight: '700',
    textAlign: 'center', letterSpacing: -0.3,
  },
  placeholderDetail: {
    color: 'rgba(255,255,255,0.5)', fontSize: 12,
    textAlign: 'center', lineHeight: 18,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)', fontSize: 14,
    marginTop: 12, textAlign: 'center',
  },
});
