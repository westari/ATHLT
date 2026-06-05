# CourtHeatmap — API Reference

Basketball half-court heatmap with 6 zones, color-coded by FG%.

## Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `zones` | `CourtHeatmapZones` | yes | Shot data per zone. Use `EMPTY_ZONES` for new users. |
| `showLabels` | `boolean` | no | Render FG% label inside each zone. Default `false`. |
| `onZoneTap` | `(zoneName: string) => void` | no | Called when user taps a zone. Receives display name e.g. `"Top of key"`. Omit to disable tap targets. |

## Exported types & helpers

```ts
// Per-zone shot counts
interface ZoneData { makes: number; attempts: number; }

// Full zones object (all 6 required)
interface CourtHeatmapZones {
  leftCorner:  ZoneData;
  leftWing:    ZoneData;
  topOfKey:    ZoneData;
  rightWing:   ZoneData;
  rightCorner: ZoneData;
  paint:       ZoneData;
}

// Zero-state — use when user has no data
const EMPTY_ZONES: CourtHeatmapZones;

// Returns the display name of the zone with the highest FG%, or null if no data
function hotZoneName(zones: CourtHeatmapZones): string | null;
```

## Color scale

| FG% | Color |
|---|---|
| >= 60% | Gold, 70% opacity |
| 45–59% | Gold, 45% opacity |
| 30–44% | Grey, 30% opacity |
| < 30% | Red, 30% opacity |
| No data | Off-white hairline |

## Usage (TodayHome example)

```tsx
import CourtHeatmap, { EMPTY_ZONES, hotZoneName } from '@/components/CourtHeatmap';
import { getUserShotZones } from '@/lib/cv/ShotSync';

const [zones, setZones] = useState(EMPTY_ZONES);
useEffect(() => { getUserShotZones().then(setZones).catch(() => {}); }, []);
const hotZone = useMemo(() => hotZoneName(zones), [zones]);

<CourtHeatmap zones={zones} showLabels onZoneTap={(name) => console.log(name)} />
```

## Layout

`width: 100%`, `aspectRatio: 400/370`. The SVG scales to fill its container.
Tap targets are approximate `position: absolute` Views — not pixel-perfect SVG hit testing.

## Data source

Populate via `getUserShotZones(userId?)` in `lib/cv/ShotSync.ts`.
See `lib/cv/SHOT-ZONES.md` for the Supabase schema and zone-to-bucket mapping.
