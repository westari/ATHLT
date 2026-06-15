/**
 * athlt-camera — JS bridge for the ATHLTCamera native module.
 *
 * requireNativeModule is wrapped in try/catch so the module never crashes
 * if the native side isn't linked (Expo Go, wrong build, etc.).
 * All exported functions degrade gracefully.
 */

import { requireNativeModule, EventEmitter, requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import type { ViewStyle } from 'react-native';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ShotBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShotDetection {
  type: 'make' | 'miss';
  confidence: number;
  timestamp: number;     // ms
  bbox: ShotBBox;
  makes: number;
  attempts: number;
}

export interface HoopDetectedEvent {
  detected: boolean;
  confidence: number;
  bbox: ShotBBox;
}

/** Emitted every ~250ms when diagnostic mode is active. Shows raw model output. */
export interface DetectionDebugEvent {
  class: string;         // top detected class name, or "none"
  confidence: number;    // top class confidence 0..1
  framesAnalyzed: number;
  fps: number;           // analyzed frames per second (~5 at default throttle)
}

/** Emitted every 1 second while tracking. Shows session-aggregate debug counters. */
export interface DebugStatsEvent {
  totalBallDetections: number;   // ALL ball detections this session (any confidence)
  totalHoopDetections: number;   // ALL hoop/basket/rim detections this session
  peakBallConf:        number;   // highest ball confidence seen (0..1)
  peakHoopConf:        number;   // highest hoop confidence seen (0..1)
  ballX:               number;   // latest accepted ball X (-1 if none)
  ballY:               number;   // latest accepted ball Y (-1 if none)
  hoopLocked:          boolean;  // whether hoop bbox is locked
  hoopX:               number;   // hoop center X (-1 if unlocked)
  hoopY:               number;   // hoop center Y (-1 if unlocked)
  hoopW:               number;   // hoop width
  hoopH:               number;   // hoop height
  inFlight:            boolean;  // whether a shot is currently in flight
  makes:               number;
  attempts:            number;
  // Deep-trace fields (see MARK: Deep-trace counters in ATHLTCameraModule.swift)
  totalFramesReceived:  number;  // pre-throttle camera frames; 0 = delegate not firing at all
  totalFramesAnalyzed:  number;  // frames that passed all guards and entered runInference; 0 + received>0 = guard blocking
  lastRawObsClass:      string;  // top class from last frame BEFORE confidence filter ("none" if empty)
  lastRawObsConf:       number;  // confidence of lastRawObsClass (0..1)
  // Scoring pipeline observability
  scoringState:         string;  // human-readable pipeline state (path A/B/C phase, why not scoring)
  lastShotPath:         string;  // "A", "B", "C", or "none" — which path scored the last shot
  // Net-region analysis (set during tracking when hoop is locked)
  netInterspersion:     number;  // 0..1 — fraction of 6×6 cells containing both ball+net pixels
  netMotion:            number;  // 0..1 — fraction of net-region pixels that changed vs prev frame
  makeConfidence:       number;  // 0..1 — last make's window confidence (intersp×0.55 + motion×0.25 + 0.20)
  // Net diagnostics — non-zero confirms pixel sampling is working
  netPixelsSampled:     number;  // total pixels sampled in net region (0 = sampling not working)
  netBallPixels:        number;  // pixels classified as ball-orange
  netNetPixels:         number;  // pixels classified as net-white
  netAvgR:              number;  // average R channel (0..255) of all sampled pixels
  netAvgG:              number;  // average G channel
  netAvgB:              number;  // average B channel
  netRegionPxX:         number;  // net region left edge in pixel coords
  netRegionPxY:         number;  // net region top edge in pixel coords
  netRegionPxW:         number;  // net region width in pixels
  netRegionPxH:         number;  // net region height in pixels
}

/** Emitted once when loadModel completes (success or failure). */
export interface ModelLoadStatusEvent {
  loaded:     boolean;
  modelPath:  string;   // filename of the loaded model, or "" if not found
  error?:     string;   // present only on failure
}

export interface StartSessionResult {
  success: boolean;
  error?: string;
}

export interface LoadModelResult {
  loaded: boolean;
  modelName?: string;
  error?: string;
}

export interface SessionStats {
  makes: number;
  attempts: number;
  fgPercent: number;
}

// ─── Native module resolution ─────────────────────────────────────────────────

let ATHLTCameraNative: Record<string, any> | null = null;
let nativeEmitter: any = null;
let NativeViewManager: any = null;

try {
  ATHLTCameraNative = requireNativeModule('ATHLTCamera');
  nativeEmitter     = new EventEmitter(ATHLTCameraNative as any);
} catch {
  // Module not linked — Expo Go or wrong build.
}

try {
  NativeViewManager = requireNativeViewManager('ATHLTCamera_ATHLTCameraView');
} catch {
  // View manager not available.
}

export const isNativeModuleLinked = () => ATHLTCameraNative !== null;

// ─── Session lifecycle ─────────────────────────────────────────────────────────

export async function startSession(): Promise<StartSessionResult> {
  if (!ATHLTCameraNative) return { success: false, error: 'ATHLTCamera native module not linked. Run EAS build.' };
  return ATHLTCameraNative.startSession();
}

export async function stopSession(): Promise<{ success: boolean }> {
  if (!ATHLTCameraNative) return { success: false };
  return ATHLTCameraNative.stopSession();
}

// ─── Model ────────────────────────────────────────────────────────────────────

export async function loadModel(): Promise<LoadModelResult> {
  if (!ATHLTCameraNative) return { loaded: false, error: 'ATHLTCamera native module not linked.' };
  return ATHLTCameraNative.loadModel();
}

export function isModelLoaded(): boolean {
  if (!ATHLTCameraNative) return false;
  try { return ATHLTCameraNative.isModelLoaded(); } catch { return false; }
}

// ─── Mode control ─────────────────────────────────────────────────────────────

export async function setMode(mode: 'detection' | 'tracking' | 'idle'): Promise<void> {
  if (!ATHLTCameraNative) return;
  return ATHLTCameraNative.setMode(mode);
}

// ─── Manual hoop region ───────────────────────────────────────────────────────
// Called when user taps the camera preview to manually mark the hoop position.
// x, y, width, height are top-left normalized coords (0..1).
// Overrides any auto-detected hoop so the user can always correct a bad lock.

export async function setManualHoopRegion(
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  if (!ATHLTCameraNative) return;
  return ATHLTCameraNative.setManualHoopRegion(x, y, width, height);
}

// ─── Camera flip ──────────────────────────────────────────────────────────────
// NOTE: Front camera provides lower CV accuracy (~20% fewer detections) due to
// sensor quality and angle from the hoop. Use back camera for best results.

export async function flipCamera(): Promise<{ position: 'front' | 'back' }> {
  if (!ATHLTCameraNative) return { position: 'back' };
  return ATHLTCameraNative.flipCamera();
}

// ─── Diagnostic mode ──────────────────────────────────────────────────────────

export async function setDiagnosticMode(enabled: boolean): Promise<void> {
  if (!ATHLTCameraNative) return;
  return ATHLTCameraNative.setDiagnosticMode(enabled);
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

export async function startTracking(): Promise<void> {
  if (!ATHLTCameraNative) return;
  return ATHLTCameraNative.startTracking();
}

export async function stopTracking(): Promise<SessionStats> {
  if (!ATHLTCameraNative) return { makes: 0, attempts: 0, fgPercent: 0 };
  return ATHLTCameraNative.stopTracking();
}

// ─── Events ───────────────────────────────────────────────────────────────────

type EventSubscription = { remove: () => void };

export function addShotListener(
  callback: (shot: ShotDetection) => void
): EventSubscription {
  if (!nativeEmitter) return { remove: () => {} };
  return nativeEmitter.addListener('onShotDetected', callback);
}

export function addHoopListener(
  callback: (event: HoopDetectedEvent) => void
): EventSubscription {
  if (!nativeEmitter) return { remove: () => {} };
  return nativeEmitter.addListener('onHoopDetected', callback);
}

/** Subscribe to raw detection events. Only fires when diagnostic mode is on. */
export function addDetectionDebugListener(
  callback: (event: DetectionDebugEvent) => void
): EventSubscription {
  if (!nativeEmitter) return { remove: () => {} };
  return nativeEmitter.addListener('onDetectionDebug', callback);
}

export function addDebugStatsListener(
  callback: (event: DebugStatsEvent) => void
): EventSubscription {
  if (!nativeEmitter) return { remove: () => {} };
  return nativeEmitter.addListener('onDebugStats', callback);
}

export function addErrorListener(
  callback: (err: { message: string }) => void
): EventSubscription {
  if (!nativeEmitter) return { remove: () => {} };
  return nativeEmitter.addListener('onError', callback);
}

export function addModelLoadStatusListener(
  callback: (event: ModelLoadStatusEvent) => void
): EventSubscription {
  if (!nativeEmitter) return { remove: () => {} };
  return nativeEmitter.addListener('onModelLoadStatus', callback);
}

// ─── Native View ──────────────────────────────────────────────────────────────

export interface ATHLTCameraViewProps {
  style?: ViewStyle;
}

export function ATHLTCameraView(props: ATHLTCameraViewProps): React.ReactElement | null {
  if (!NativeViewManager) return null;
  return React.createElement(NativeViewManager, props);
}
