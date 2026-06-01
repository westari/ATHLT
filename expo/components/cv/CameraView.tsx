/**
 * CVCameraView — React Native wrapper over the ATHLTCamera native module.
 *
 * Owns the full camera lifecycle:
 *   mount  → startSession() → loadModel() → setMode('detection')
 *   active → startTracking() / stopTracking() controlled by `active` prop
 *   unmount → stopSession()
 *
 * Shot detection is 100% native (Swift AVCaptureSession + CoreML).
 * Hoop detection events (detection mode) are forwarded via onHoopDetected prop.
 * Shot events (tracking mode) are forwarded via onShotDetected prop.
 *
 * Falls back to a clear placeholder if the native module isn't linked
 * (e.g. in Expo Go or before an EAS build).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Colors from '@/constants/colors';
import ShotOverlay from './ShotOverlay';
import type { ShotEvent } from '@/lib/cv/ShotTracker';
import {
  isNativeModuleLinked,
  startSession,
  stopSession,
  loadModel,
  setMode,
  startTracking,
  stopTracking,
  addShotListener,
  addHoopListener,
  ATHLTCameraView as NativeCamera,
  type HoopDetectedEvent,
} from '@/modules/athlt-camera/src/index';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  active:             boolean;
  onShotDetected:     (event: ShotEvent) => void;
  onHoopDetected?:    (event: HoopDetectedEvent) => void;
  onCameraReady?:     () => void;
}

// ─── States ────────────────────────────────────────────────────────────────────

type CameraState = 'loading' | 'permissionDenied' | 'modelError' | 'ready';

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CVCameraView({ active, onShotDetected, onHoopDetected, onCameraReady }: Props) {
  const [camState, setCamState]     = useState<CameraState>('loading');
  const [errorMsg, setErrorMsg]     = useState('');
  const [showDebugBoxes, setShowDebugBoxes] = useState(false);

  const activeRef        = useRef(active);
  activeRef.current      = active;
  const onHoopDetectedRef = useRef(onHoopDetected);
  onHoopDetectedRef.current = onHoopDetected;

  const moduleLinked = isNativeModuleLinked();

  // ── Lifecycle: start session + load model on mount ────────────────────────
  useEffect(() => {
    if (!moduleLinked) {
      setCamState('modelError');
      setErrorMsg('ATHLTCamera native module not linked. Run: eas build --profile development');
      return;
    }

    let cancelled = false;

    const init = async () => {
      const sessionResult = await startSession();
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

      const modelResult = await loadModel();
      if (cancelled) return;

      if (!modelResult.loaded) {
        setCamState('modelError');
        setErrorMsg(modelResult.error ?? 'CoreML model load failed');
        return;
      }

      setCamState('ready');
      // Enter detection mode immediately — CV starts looking for the hoop
      setMode('detection').catch(() => {});
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
      stopSession().catch(() => {});
    };
  }, [moduleLinked]);

  // ── Start / stop tracking when `active` changes ───────────────────────────
  useEffect(() => {
    if (camState !== 'ready' || !moduleLinked) return;
    if (active) {
      // Switch to tracking mode before starting the shot detection counter
      setMode('tracking').catch(() => {});
      startTracking().catch(e => console.error('[CVCameraView] startTracking:', e));
    } else {
      stopTracking().catch(() => {});
    }
  }, [active, camState, moduleLinked]);

  // ── Subscribe to native shot events ───────────────────────────────────────
  useEffect(() => {
    if (camState !== 'ready' || !moduleLinked) return;

    const sub = addShotListener(nativeShot => {
      if (!activeRef.current) return;
      const event: ShotEvent = {
        type:          nativeShot.type,
        timestamp:     nativeShot.timestamp,
        confidence:    nativeShot.confidence,
        zone:          null,
        ballPositions: [],
      };
      onShotDetected(event);
    });

    return () => sub.remove();
  }, [camState, moduleLinked, onShotDetected]);

  // ── Subscribe to hoop detection events ───────────────────────────────────
  useEffect(() => {
    if (camState !== 'ready' || !moduleLinked) return;

    const sub = addHoopListener(event => {
      // Always call the latest version of the callback via ref
      onHoopDetectedRef.current?.(event);
    });

    return () => sub.remove();
  }, [camState, moduleLinked]);

  // ── Render states ─────────────────────────────────────────────────────────

  if (!moduleLinked) {
    return <PlaceholderView reason="ATHLTCamera not linked" detail="Run: eas build --profile development" />;
  }

  if (camState === 'permissionDenied') {
    return (
      <PlaceholderView
        reason="Camera permission needed"
        detail="Enable in iOS Settings → ATHLT → Camera"
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

  // ── Ready: show native camera preview ─────────────────────────────────────
  return (
    <View style={styles.container}>
      <NativeCamera style={StyleSheet.absoluteFillObject} />
      <ShotOverlay detections={[]} showDebugBoxes={showDebugBoxes} />
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onLongPress={() => setShowDebugBoxes(v => !v)}
        activeOpacity={1}
      />
    </View>
  );
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

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
      <View style={styles.icon}>
        <Text style={styles.iconText}>CAM</Text>
      </View>
      <Text style={styles.reason}>{reason}</Text>
      {detail && <Text style={styles.detail}>{detail}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  placeholder: {
    flex: 1, backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12,
  },
  icon: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  iconText:   { color: Colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  reason:     { color: Colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  detail:     { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  loadingText:{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 12, textAlign: 'center' },
});
