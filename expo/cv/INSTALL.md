# CV Package Installation

Run these commands in order from `expo/` (the project root).

## Step 1 — Install VisionCamera + Worklets

```powershell
npm install react-native-vision-camera@5.0.10 react-native-worklets-core --legacy-peer-deps --save
```

## Step 2 — Register the worklets babel plugin

Open `babel.config.js` and add the worklets plugin. If the file currently looks like:

```js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

Change it to:

```js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-worklets-core/plugin'],
    ],
  };
};
```

## Step 3 — Add camera permissions to app.json

The iOS `NSCameraUsageDescription` is already in `app.json` (added during the CV planning phase).

For Android, add to the `android.permissions` array in `app.json`:
```json
"android.permission.CAMERA"
```
(Also already there.)

## Step 4 — Activate the CoreML config plugin

After you download `best.mlpackage` from the Colab training run:

1. Place the file at `expo/cv/best.mlpackage`
2. In `app.json`, update the plugins array to add:
   ```json
   ["./plugins/withCoreMLModel", { "modelPath": "./cv/best.mlpackage" }]
   ```

## Step 5 — Trigger a new EAS dev client build

```powershell
eas build --platform ios --profile development
```

You MUST do a new build after adding VisionCamera. It has native iOS code that requires compilation. The existing dev client build will not have VisionCamera.

## Step 6 — Test

Install the new dev client on your iPhone via the QR code or direct install link from EAS. Launch, and the camera screens should work.

---

## Compatibility notes

- `react-native-vision-camera` v5.0.10 + `react-native-worklets-core` are tested with RN 0.76+. RN 0.81.5 (your version) should be compatible.
- v4 is **archived** at `margelo/react-native-vision-camera-v4-snapshot` — don't install that.
- `react-native-worklets` (the old one you removed) is different from `react-native-worklets-core`. The one you removed was a Rork artifact. `react-native-worklets-core` is VisionCamera's official peer dependency.
