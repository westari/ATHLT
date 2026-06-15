# Net-Region Make Detection

**Status:** Implemented — requires EAS rebuild to take effect.  
**File:** `modules/athlt-camera/ios/ATHLTCameraModule.swift` — `NetRegionAnalyzer` class  
**Reference:** Ballogy patent US11839805B2

---

## The Problem

2D ball tracking cannot distinguish these two situations from trajectory alone:
- Ball **through** the net (make)
- Ball **in front of** the rim at the same XY position (ball near rim, no score)

Path A/B/C trajectory analysis correctly identifies WHERE the ball is, but pixel coordinates are identical for both cases. This is the fundamental flaw that causes false makes.

---

## The Solution: Net-Pixel Interspersion

When a basketball goes **through** the net:
- Orange ball pixels appear inside the net bounding box
- White net cord pixels are also present in the same region
- Ball and net pixels are **interspersed** — they appear in the same grid cells

No other scenario produces this pattern:
- Ball **in front** of rim: orange pixels present, but no net cord (net is behind the ball)
- Ball **off to the side**: neither ball nor net pixels in the region
- False positive from crowd/wall: won't produce simultaneous orange+white in net geometry

---

## Implementation

### `NetRegionAnalyzer` class (in ATHLTCameraModule.swift)

**Net region geometry** — derived from locked `HoopGeometry`:
```
netMinX = rimCenterX - (rimWidth/2) × netWidthFactor  (1.1)
netMaxX = rimCenterX + (rimWidth/2) × netWidthFactor
netMinY = rimLineY                                      (top edge of hoop = rim line)
netMaxY = rimLineY + rimWidth × netHeightFactor         (1.0)
```
Net hangs BELOW the rim (larger Y = lower on screen, top-left origin).

**Pixel sampling** — BGRA pixel buffer (`kCVPixelFormatType_32BGRA`, 1280×720):
- Stride: every 3 pixels (performance/coverage tradeoff)
- Region: only net bounding box, not full frame

**Color classification** — BGR → HSV conversion:
- Ball orange: hue 10–40°, sat ≥ 0.40, val ≥ 0.28
- Net white: sat ≤ 0.28, val ≥ 0.60

**Interspersion score** — 6×6 grid (36 cells):
- Divide net region into 6×6 cells
- Flag each cell as `hasBall` or `hasNet` based on sampled pixels
- `interspersion = cells_with_both / 36`
- Range: 0.0 (no co-location) → 1.0 (all cells have both)

**Motion score** — frame-to-frame delta:
- Compare current net samples to previous frame
- Count pixels where any channel changed > 22 units
- `motion = changed_pixels / total_samples`
- Rises when ball enters net, falls to baseline during idle

---

## Confidence Voting

When a shot is detected (Path A/B/C returns a result), the final confidence is:

```
makeConfidence = interspersion × 0.55
              + motion          × 0.25
              + trajectory      × 0.20
```

**Weights rationale:**
- Interspersion (0.55): PRIMARY signal — physical proof of ball in mesh
- Motion (0.25): secondary corroboration — net moves when ball goes through
- Trajectory (0.20): necessary but not sufficient alone

**Key property:** Trajectory alone peaks at 0.20 (below any useful threshold). Net signal is **required** for high make confidence. No net signal = low confidence make.

**Misses:** Confidence passes through unchanged. Net analysis only modulates make confidence.

---

## Constants

| Constant | Value | Description |
|---|---|---|
| `netHeightFactor` | 1.0 | Net depth = rimWidth × 1.0 |
| `netWidthFactor` | 1.1 | Net slightly wider than rim |
| `sampleStride` | 3 | Sample every 3rd pixel |
| `gridDivisions` | 6 | 6×6 = 36 cells |
| `ballHueMin` | 10° | Ball orange hue start |
| `ballHueMax` | 40° | Ball orange hue end |
| `ballSatMin` | 0.40 | Ball saturation minimum |
| `ballValMin` | 0.28 | Ball value minimum |
| `netSatMax` | 0.28 | Net max saturation (nearly white) |
| `netValMin` | 0.60 | Net minimum brightness |
| `motionChannelThreshold` | 22 | Per-channel delta for "changed" |
| `netWeightInterspersion` | 0.55 | Interspersion voting weight |
| `netWeightMotion` | 0.25 | Motion voting weight |
| `netWeightTrajectory` | 0.20 | Trajectory voting weight |

---

## Debug Observability

**DBG panel** (open-run.tsx, toggle with DBG button):
```
Net   I=0.72 M=0.61 conf=0.88
```
- `I` = interspersion score (gold if > 0.10)
- `M` = motion score
- `conf` = last make's net-weighted confidence

**NSLog strings** (Xcode console):
```
[Net] MAKE traj=0.75 net_intersp=0.42 net_motion=0.31 → conf=0.49
[Net] make vote: intersp=0.42×0.55 + motion=0.31×0.25 + traj=0.75×0.20 = 0.49 (net corroborates)
```

**DebugStatsEvent fields** (JS):
- `netInterspersion` — current frame interspersion (0..1)
- `netMotion` — current frame motion (0..1)
- `makeConfidence` — last make's final confidence

---

## Tuning Guide

**If valid makes have low confidence (interspersion near 0):**
- Lower `netValMin` or `netSatMax` (catch off-white nets in different lighting)
- Lower `ballSatMin` (faded balls, worn leather)
- Check Xcode logs for `[Net] make vote` lines to see raw scores

**If false makes persist (interspersion > 0 on misses):**
- Raise `ballHueMin` / lower `ballHueMax` (tighter orange range)
- Raise `netValMin` (only catch bright white, not gray)
- The ball occasionally reflects off the rim at similar orange hues — expected

**If motion is always near 0:**
- Normal when phone is very still and ball passes quickly (< 1 frame in net)
- Motion is a secondary signal; interspersion is primary
- Consider lowering `motionChannelThreshold`

**Testing without a rebuild:**
Add `NSLog` prints in `analyze()` to see real color values vs thresholds.

---

## What Is NOT Changed

The existing Path A / Path B / Path C scoring logic is untouched. Net analysis is **additive** — it modulates confidence but does not gate or block shot events. All three paths continue to fire shots; net analysis adjusts the confidence of makes reported to the JS layer.

To add a confidence gate (only count makes above a threshold), filter in `handleShotDetected` in `open-run.tsx`:
```javascript
if (event.type === 'make' && event.confidence < 0.35) return; // skip low-conf makes
```
