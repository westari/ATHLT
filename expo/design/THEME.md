# ATHLT — Dark Theme

**Version:** Dark v1.0  
**Date:** 2026-06-08  
**File:** `constants/colors.ts`

---

## Concept

Warm near-black canvas. Champagne gold as the sole accent. Liquid-glass panels in dark tint. Off-white text that breathes rather than burns.

The palette is intentionally warm — `#0E0E10` has a hair of warmth vs pure `#000000`. Gold hits harder on dark than it did on the old bone-white. The glass panels (GlassPanel / BlurView) use `tint="dark"` throughout.

---

## Palette

### Surfaces

| Token | Value | Use |
|---|---|---|
| `background` | `#0E0E10` | Main app canvas |
| `surface` | `#1A1A1E` | Cards, sheets, elevated panels |
| `surfaceRecessed` | `#121215` | Recessed wells, deeper insets |
| `surfaceBorder` | `#2A2A30` | Card borders, container edges |
| `hairline` | `rgba(255,255,255,0.08)` | Subtle row dividers |

### Text

| Token | Value | Use |
|---|---|---|
| `textPrimary` | `#F4EFE6` | Headings, key numbers (note: old bg color recycled as text) |
| `textBody` | `#C8C4BC` | Body copy, descriptions |
| `textSecondary` | `#9A9690` | Captions, secondary labels |
| `textMuted` | `#6A6660` | Timestamps, metadata |
| `textDisabled` | `#3A3A3E` | Disabled UI state |

### Gold (Primary)

| Token | Value | Use |
|---|---|---|
| `primary` | `#C9A24A` | Champagne gold — buttons, active states, key metrics |
| `primaryPressed` | `#A88436` | Tap feedback |
| `primarySoft` | `rgba(201,162,74,0.14)` | Soft gold tint backgrounds (badges, selected rows) |
| `glowGold` | `rgba(201,162,74,0.35)` | Glow rings, shadow tints |

### Alpha Tokens

All alpha tokens are now white-based (reversed from the old dark-on-light tokens):

| Token | Value | Old value |
|---|---|---|
| `inkA8` | `rgba(255,255,255,0.06)` | `rgba(11,14,18,0.08)` |
| `inkA12` | `rgba(255,255,255,0.09)` | `rgba(11,14,18,0.12)` |
| `inkA24` | `rgba(255,255,255,0.16)` | `rgba(11,14,18,0.24)` |
| `inkA64` | `rgba(255,255,255,0.48)` | `rgba(11,14,18,0.64)` |
| `paperA72` | `rgba(14,14,16,0.84)` | `rgba(251,248,242,0.72)` |
| `paperA88` | `rgba(14,14,16,0.95)` | `rgba(251,248,242,0.88)` |

---

## Glass panels

All `GlassPanel` / `BlurView` components use `tint="dark"`. Intensity ranges:
- Tab bar: 60 (strong blur)
- Cards/sheets: 50–70
- Hint overlays: 55

The dark blur + `rgba(15,15,15,0.78)` overlay on the tab bar gives a near-opaque pill with visible edge glow from the `rgba(255,255,255,0.08)` border.

---

## Gold gradient (ProgressRing, SVGs)

```
#E7C76D → #C9A24A → #8A6A28
```

Track (empty portion): `rgba(255,255,255,0.10)` — visible against dark but doesn't compete with gold fill.

---

## StatusBar

`style="light"` — white icons on dark background.

---

## Legacy aliases

These keys exist for backward compatibility. Do not introduce new code that uses them:

| Token | New value | Note |
|---|---|---|
| `buttonDark` | `#F4EFE6` | Inverted — now a LIGHT button on dark bg |
| `buttonDarkText` | `#0E0E10` | Dark text on the light button |
| `black` | `#0E0E10` | Updated from #0B0E12 |
| `card` | `#1A1A1E` | = surface |
| `border` | `#2A2A30` | = surfaceBorder |
| `accent` | `#C9A24A` | = primary |
