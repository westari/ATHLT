# Net-Region Make Detection

**Status:** Implemented — requires EAS rebuild to take effect.  
**File:** `modules/athlt-camera/ios/ATHLTCameraModule.swift` — `NetRegionAnalyzer` + `BallTrackingPipeline`  
**Reference:** Ballogy patent US11839805B2

---

## The Problem

2D ball tracking cannot distinguish these two situations from trajectory alone:
- Ball **through** the net (make)
- Ball **in front of** the rim at the same XY position (ball near rim, no score)

Path A/B/C trajectory correctly identifies WHERE the ball is, but pixel coordinates are identical for both cases. This is the fundamental flaw that causes false makes.

---

## The Solution: Net-Pixel Interspersion + Shot Window

When a basketball goes **through** the net:
- Orange ball pixels appear inside the net bounding box
- White net cord pixels are also present in the same region
- Ball and net pixels are **interspersed** in the same grid cells

No other scenario produces this pattern:
- Ball **in front** of rim: orange pixels present, but no net cord (net is behind the ball)
- Ball **off to the side**: neither ball nor net pixels in region
- False positives from crowd/wall: won't produce simultaneous orange+white in net geometry

---

## Architecture: Shot Window

**Path A/B/C are demoted to "attempt detectors" only — they NEVER register makes directly.**

```
Path A/B detects make candidate
    → openShotWindow(candidateType: "make")
    → evaluateShotWindow() runs each frame:
        • Accumulate windowPeakInterspersion, windowPeakMotion
        • If net threshold crossed → MAKE (fires immediately)
        • If rim bounce detected → MISS (immediate, reliable)
        • If window timeout + net was sampling → MISS (ball in front of rim)
        • If window timeout + net unavailable → trajectory fallback
```

**Path A/B/C misses (rim bounce, side miss, rim out) bypass the window and register directly.** These are mechanical events that don't need net corroboration.

---

## `NetRegionAnalyzer` Implementation

### Net region geometry (derived from locked `HoopGeometry`)
```
netMinX = rimCenterX - (rimWidth/2) × netWidthFactor  (1.1)
netMaxX = rimCenterX + (rimWidth/2) × netWidthFactor
netMinY = rimLineY                                      (top edge of hoop bbox)
netMaxY = rimLineY + rimWidth × netHeightFactor         (1.0)
```
Net hangs BELOW the rim. Larger Y = lower on screen (top-left origin).

### Pixel sampling (BGRA buffer, 1280×720)
- Stride: every 2 pixels (denser than before for better coverage)
- Region: only net bounding box

### Color classification (BGR → HSV)
- Ball orange (worn/faded): hue 5–38°, sat ≥ **0.12**, val ≥ 0.18
  - Worn balls shift from vibrant orange → brownish-tan with much lower saturation
  - If `b=` stays near 0 on real makes: lower `ballSatMin` further (try 0.08) or widen hue
- Net white: sat ≤ 0.35, val ≥ 0.50

### Interspersion score (6×6 grid, 36 cells)
- Flag each cell as `hasBall` or `hasNet`
- `interspersion = cells_with_both / 36`
- A real make should produce `b=` in the hundreds, not single digits

### Motion score (frame-to-frame delta)
- `motion = changed_pixels / total_samples`
- **Motion is NOT a make trigger** — ball flying near net causes motion even without passing through
- Motion only contributes to confidence weighting after interspersion triggers

---

## Shot Window Constants

| Constant | Value | Description |
|---|---|---|
| `shotWindowDurationSeconds` | 2.5 | Max time window stays open before timeout |
| `makeInterspersionThreshold` | 0.14 | Interspersion value that fires MAKE (sole trigger) |
| `makeMotionThreshold` | 0.15 | Motion threshold — weight only, NOT a standalone trigger |
| `shotCooldownSeconds` | 1.5 | Min time between any two shots |

## NetRegionAnalyzer Constants

| Constant | Value | Description |
|---|---|---|
| `netHeightFactor` | 1.0 | Net depth = rimWidth × 1.0 |
| `netWidthFactor` | 1.1 | Net slightly wider than rim |
| `sampleStride` | 2 | Sample every 2nd pixel |
| `gridDivisions` | 6 | 6×6 = 36 cells |
| `ballHueMin` | 5° | Ball hue start (allow dark reddish-orange) |
| `ballHueMax` | 38° | Ball hue end (worn balls go brown not yellow) |
| `ballSatMin` | 0.12 | Ball saturation minimum (LOW — worn ball is desaturated) |
| `ballValMin` | 0.18 | Ball value minimum (allow ball in net shadow) |
| `netSatMax` | 0.35 | Net max saturation |
| `netValMin` | 0.50 | Net minimum brightness |
| `motionChannelThreshold` | 22 | Per-channel delta for "changed" |

---

## Debug Observability

### DBG panel (open-run.tsx)
```
Net   I=0.72 M=0.61 conf=0.88
Npx   px:420 b=18 n=95 rgb=(142,98,65)    ← red if px=0 (sampling broken)
Nreg  (582,310) 138×138                   ← pixel coords of net region
```
- `I` = interspersion (gold if > 0.10)
- `M` = motion
- `conf` = last make's window confidence
- `px` = pixels sampled (0 = sampling broken — check region + thresholds)
- `b` = ball-orange pixels, `n` = net-white pixels
- `rgb` = average RGB of all sampled pixels (diagnostic for threshold tuning)
- Nreg = net region pixel coords (verify it's pointing at the actual net)

### NSLog strings (Xcode console)
```
[NetAnalyzer] px=420 ball=18 net=95 rgb=(142,98,65) reg=(582,310,138x138) buf=1280x720
[NetAnalyzer] WARN region too small: px(0,0)-(0,0) norm...   ← hoop off-screen
[NetAnalyzer] WARN: 0 pixels sampled! reg=(...)               ← guard passed but loop empty
[Window] OPENED — candidate=make ts=1234.5
[Window] MAKE — intersp=0.18 motion=0.22 conf=0.46 px=420
[Window] MISS — rim bounce (ball above rim after 3 below-rim frames)
[Window] MISS — timeout no net signal intersp=0.03 px=420 elapsed=2.5s
[Window] TIMEOUT — net unavailable (px=0) → trajectory fallback: make
[Pipeline] SHOT MAKE via Path Net — 3/5 (conf=0.46)
```

### DebugStatsEvent fields (JS)
- `netInterspersion` — current frame interspersion (0..1)
- `netMotion` — current frame motion (0..1)
- `makeConfidence` — last make's window confidence
- `netPixelsSampled` — total pixels sampled (0 = broken)
- `netBallPixels` — pixels classified as ball-orange
- `netNetPixels` — pixels classified as net-white
- `netAvgR/G/B` — average RGB of all sampled pixels
- `netRegionPxX/Y/W/H` — net region in pixel coordinates

---

## Tuning Guide

**`netPixelsSampled = 0` in DBG panel:**
1. Check `Nreg` — if `(0,0) 0×0`, the hoop region is off-screen. Tap to set hoop manually.
2. If Nreg looks valid but px=0, the guard `pxMaxX > pxMinX + 2` is failing — hoop too small.
3. Check `[NetAnalyzer] WARN` in Xcode logs for exact pixel coordinates.

**Makes not registering (window times out as MISS despite ball going through):**
- Lower `makeInterspersionThreshold` (try 0.08)
- Check avg RGB — if `rgb=(250,250,250)` the region is all sky, not net. Check hoop lock position.
- Lower `netValMin` (catch nets under fluorescent lighting, e.g. 0.40)
- Lower `ballSatMin` (faded balls, e.g. 0.20)

**False makes (ball in front of rim scoring as MAKE):**
- Raise `makeInterspersionThreshold` (tighter gate)
- Raise `ballHueMin` / lower `ballHueMax` (tighter orange range)
- The rim itself can produce orange pixels — check if `rgb` avg is orangeish when ball is near rim but not through

**Miss called while ball is ascending and exits top of frame:**
- Fixed: rim-bounce MISS is suppressed if ball is ascending (`vel.isRising`) AND near the top of frame (`ballY < 0.22`). A layup going up through the net or a ball that exits upward after passing through is held in the window until net signals fire or timeout.
- The 0.22 threshold covers the top 22% of screen — adjust if rim is positioned very high in frame.

**Rim bounce detected incorrectly:**
- `windowBallBelowRimFrames > 0` check requires ball to have been seen below rim at least once before bouncing back above. This prevents false MISS on balls that were never below the rim.

---

## What Is NOT Changed

Path A/B/C detection logic is completely unchanged. They still detect flight, rim crossing, make zones, and disappearance. The only change is that their **make results** open a shot window instead of registering directly. **Miss results** still register directly (rim bounce, side miss, rim out are reliable mechanical signals).
