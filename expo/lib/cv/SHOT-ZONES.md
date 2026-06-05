# Shot Zone Schema & Coordinate Mapping

## Supabase columns (shots table)

| Column | Type | Description |
|---|---|---|
| `zone` | `text` | Fine zone name from `CourtZone` type in `CourtZones.ts`. One of the 13 values below, or `'Unknown'`. |
| `made` | `boolean` | Whether the shot went in. |
| `court_x` | `float4` | Shooter x position in normalized frame coords (0..1, left→right). |
| `court_y` | `float4` | Shooter y position in normalized frame coords (0..1, top→bottom). |
| `user_id` | `uuid` | FK to `auth.users`. |
| `created_at` | `timestamptz` | Auto-set on insert. Used for 30-day rolling window in `getUserShotZones`. |

## Fine zones (CourtZones.ts → shots.zone)

Zones are set by `getCourtZone(shooterX, shooterY, rim?)` using rim-relative distance and angle. All coordinates are normalized 0..1 frame space, origin at top-left.

```
'Restricted Area'   distance < 0.08 from rim center
'Left Block'        distance 0.08–0.15, dx < -0.04
'Right Block'       distance 0.08–0.15, dx > 0.04
'Free Throw'        distance 0.15–0.24, |dx| < 0.07
'Left Elbow'        distance 0.15–0.18, dx < 0
'Right Elbow'       distance 0.15–0.18, dx > 0
'Left Mid'          distance 0.18–0.24, dx < 0
'Right Mid'         distance 0.18–0.24, dx > 0
'Left Corner 3'     distance >= 0.24, |dx| > 0.30, dx < 0
'Right Corner 3'    distance >= 0.24, |dx| > 0.30, dx > 0
'Left Wing 3'       distance >= 0.24, 0.16 < |dx| <= 0.30, dx < 0
'Right Wing 3'      distance >= 0.24, 0.16 < |dx| <= 0.30, dx > 0
'Top of Key 3'      distance >= 0.24, |dx| <= 0.16
```

## 6-zone heatmap mapping (HEATMAP_ZONE_MAP in ShotSync.ts)

The `CourtHeatmap` component displays 6 zones. Fine zones are bucketed as follows:

```
paint        ← Restricted Area, Left Block, Right Block,
               Free Throw, Left Elbow, Right Elbow, Left Mid, Right Mid
leftCorner   ← Left Corner 3
rightCorner  ← Right Corner 3
leftWing     ← Left Wing 3
rightWing    ← Right Wing 3
topOfKey     ← Top of Key 3
```

`'Unknown'` is discarded and never counted.

## SVG coordinate system (CourtHeatmap.tsx)

ViewBox `0 0 400 370`. Hoop at `(200, 293)`. 3pt arc center `(200, 300)`, radius 146.
Zone boundaries are purely visual — they don't connect to frame coordinates.
The mapping above (frame coords → zone string → heatmap bucket) is the full pipeline.
