# Liquid Glass in ATHLT

## What is expo-glass-effect?

`expo-glass-effect` is an Expo module that exposes Apple's **Liquid Glass** material — introduced with iOS 26 / iPadOS 26 — to React Native. When the device is running iOS 26 or later, the module renders a native `GlassView` that produces the "vitreous" translucent look Apple introduced with their redesigned OS.

On older iOS versions or Android, the module gracefully reports `isLiquidGlassSupported() === false` and falls back to a plain view. **Our `GlassPanel` component intercepts this and substitutes `expo-blur`'s `BlurView` so the app always looks good.**

---

## iOS Version Requirements

| iOS version | Behavior |
|---|---|
| iOS 26+ | Native Liquid Glass (`GlassView` via expo-glass-effect) |
| iOS 25 and below | expo-blur `BlurView` fallback |
| Android | expo-blur `BlurView` fallback |

---

## How GlassPanel Works

`expo/components/ui/GlassPanel.tsx` is a unified wrapper you use everywhere instead of choosing between GlassView and BlurView manually.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `intensity` | `number` | `50` | Blur intensity (0–100). Only used by the BlurView fallback. GlassView uses its own native intensity. |
| `tint` | `'light' \| 'dark' \| 'systemMaterial'` | `'dark'` | Visual tint. `systemMaterial` maps to `'light'` on the fallback. |
| `tintColor` | `string` | — | Optional semi-transparent color overlay inside the glass (e.g. `rgba(201,162,74,0.38)` for gold-tinted buttons). |
| `borderRadius` | `number` | — | Sets `borderRadius` + `overflow: 'hidden'` automatically (required for blur to respect rounded corners on iOS). |
| `style` | `ViewStyle` | — | Additional style applied to the container. |

### Example — frosted dark pill

```tsx
import GlassPanel from '@/components/ui/GlassPanel';

<GlassPanel tint="dark" intensity={50} borderRadius={999} style={{ paddingHorizontal: 14, height: 36 }}>
  <Text style={{ color: '#fff', fontWeight: '600' }}>Live text</Text>
</GlassPanel>
```

### Example — gold-tinted start button

```tsx
<GlassPanel
  tint="light"
  tintColor="rgba(201,162,74,0.38)"
  borderRadius={32}
  style={{ height: 64 }}
>
  <TouchableOpacity style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>Start</Text>
  </TouchableOpacity>
</GlassPanel>
```

---

## Current Usage

| Screen | Element | Tint | Notes |
|---|---|---|---|
| `app/open-run.tsx` | X close button | dark | 44px circle |
| `app/open-run.tsx` | Title / REC pill | dark | Switches content on track start |
| `app/open-run.tsx` | Stat pill (live FG%) | dark | Tracking state only |
| `app/open-run.tsx` | Hint card | light | Center screen, dismissible |
| `app/open-run.tsx` | Last shot indicator | dark | Fades in/out on each shot |
| `app/open-run.tsx` | Start Tracking button | light + gold tint | `tintColor="rgba(201,162,74,0.38)"` |
| `app/open-run.tsx` | Stop button | dark | Cross-fades with Start |
| `components/PlusActionSheet.tsx` | Sheet background | light | Native sheet overlay |

---

## How to Use GlassPanel in New Screens

1. Import it: `import GlassPanel from '@/components/ui/GlassPanel';`
2. Replace any `BlurView` or bare `View` that needs a glass effect
3. Set `overflow: 'hidden'` via the `borderRadius` prop (never set it in the style manually — let GlassPanel handle it)
4. All children render inside the glass layer

### Design rules for glass elements

- Always use **white text** over glass (`#FFFFFF` or `rgba(255,255,255,0.8)`)
- Add `textShadowColor: 'rgba(0,0,0,0.4)'` for readability over variable backgrounds
- Use `tint="dark"` for elements over camera/video feeds
- Use `tint="light"` for elements over light content (splash, maps, etc.)
- Gold `tintColor="rgba(201,162,74,0.38)"` for primary action buttons

---

## Roadmap — Planned Glass Redesigns

The following screens are marked for liquid glass treatment once the Track Shots screen is confirmed working:

1. `app/session.tsx` — top bar, drill type tag, timer controls
2. `app/workout-preview.tsx` — Begin Workout button
3. `components/PlusActionSheet.tsx` — already uses BlurView; upgrade to GlassPanel
4. `app/(tabs)/_layout.tsx` — tab bar frosted background

---

## Build Requirement

`expo-glass-effect` requires native iOS code (Swift/Objective-C). It will NOT work in Expo Go.

**After running `npm install expo-glass-effect --legacy-peer-deps --save`, you must do an EAS rebuild:**

```bash
npx eas-cli build --platform ios --profile development --non-interactive
```

The GlassView falls back transparently to BlurView until the build is installed, so you can develop and preview the layout without the rebuild. The blur effect is visible immediately — only the native Liquid Glass sheen requires iOS 26+ hardware and the EAS build.
