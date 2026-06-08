# CourtHeatmap

**File:** `components/CourtHeatmap.tsx`  
**Last updated:** 2026-06-08 — full rebuild to density heatmap

---

## What it does

Renders an accurate NBA half-court with a smooth inferno-colormap shot density overlay. No flat colored zones — each zone is represented by a soft radial gradient "heat blob" that grows with attempt count and shifts color with FG%.

Cold → hot colormap (Inferno/Magma):
```
#150030 → #3b0f70 → #8c2981 → #de4968 → #fe9f6d → #fcfdbf
(dark)   (purple)  (magenta)  (red)    (orange)  (yellow)
```

A COLD → HOT legend strip renders at the bottom of the SVG.

---

## Props

```typescript
interface CourtHeatmapProps {
  zones:       CourtHeatmapZones;  // required — zone aggregate data
  shots?:      ShotPoint[];        // optional — raw shot coordinates
  showLabels?: boolean;            // show FG% at each zone center (default false)
  onZoneTap?:  (name: string) => void;  // kept for API compat, not wired visually
}
```

### CourtHeatmapZones

```typescript
interface ZoneData { makes: number; attempts: number; }

interface CourtHeatmapZones {
  leftCorner: ZoneData;  leftWing: ZoneData;  topOfKey:    ZoneData;
  rightWing:  ZoneData;  rightCorner: ZoneData;  paint:    ZoneData;
}
```

### ShotPoint (optional raw coordinates)

```typescript
interface ShotPoint {
  x:    number;   // normalized 0–1 (0=left sideline, 1=right sideline)
  y:    number;   // normalized 0–1 (0=baseline, 1=half-court line)
  made: boolean;
}
```

If `shots` is provided, each shot renders as its own blob at its normalized court position. Zone blobs and shot blobs are additive.

---

## Exported helpers

```typescript
export const EMPTY_ZONES: CourtHeatmapZones   // all zeros
export function hotZoneName(zones): string | null  // best FG% zone (≥3 attempts)
```

---

## Court geometry — NBA proportions at 9 px/ft

```
ViewBox: 500 × 480
Basket at bottom (y=403), half-court line at top (y=25).

Half-court: 50ft wide × 47ft tall → 450 × 423 px
Basket:     5.25ft from baseline  → y=403
Paint:      16ft wide, 15ft long  → x 178–322, y 315–450
FT line:    15ft from baseline    → y=315
FT circle:  6ft radius            → r=54
Rest. area: 4ft radius            → r=36
3pt arc:    23.75ft radius        → r=214, corners at x=52/448, y=322
```

### Arc commands (all verified — large-arc=0, all arcs < 180°)

| Element | Command |
|---------|---------|
| Half-court circle (lower) | `M 196 25 A 54 54 0 0 1 304 25` |
| FT circle lower (solid) | `M 196 315 A 54 54 0 0 1 304 315` |
| FT circle upper (dashed) | `M 196 315 A 54 54 0 0 0 304 315` |
| Restricted area | `M 214 403 A 36 36 0 0 0 286 403` |
| 3-point arc | `M 52 322 A 214 214 0 0 0 448 322` |

Sweep=0 → CCW in SVG → arc bulges toward smaller y (toward center court). Sweep=1 → CW → toward basket.

---

## Heatmap blob rendering

For each zone with attempts > 0:
1. **Color**: `heatColors(zone)` returns three inferno stops based on FG%
   - ≥55%: yellow/orange/red
   - 40–55%: orange/red/magenta
   - 25–40%: red/magenta/purple
   - <25%: magenta/purple/black (dimmer)
2. **Opacity**: base 0.28 → 0.90 as `min(1, att/20)`
3. **Radius**: `baseR × (0.65 + √(min(att,30)/30) × 0.55)` — grows with shots
4. Rendered as `<Circle fill="url(#rg_zone)">` referencing a `<RadialGradient>` in `<Defs>`

### Zone shooting centers (SVG px)

| Zone | Position |
|------|----------|
| leftCorner | (40, 426) |
| leftWing | (84, 264) |
| topOfKey | (250, 192) |
| rightWing | (416, 264) |
| rightCorner | (460, 426) |
| paint | (250, 368) |

---

## Data source

`getUserShotZones()` in `lib/cv/ShotSync.ts` aggregates last-30-day shots into `CourtHeatmapZones`. Called in `TodayHome.tsx` on mount.

For raw coordinate mode (future): populate `court_x` / `court_y` columns in the `shots` table and pass as `shots={rawArray}`.
