# Expo Config Plugins

## withCoreMLModel.js

Bundles a CoreML `.mlpackage` model into the iOS app during EAS Build prebuild.

### How it works

1. During `expo prebuild` (run automatically by EAS Build), the plugin:
   - Copies `best.mlpackage` from `expo/cv/` into the `ios/` directory
   - Adds the model to the Xcode project's "Copy Bundle Resources" build phase
   - The model ends up inside the compiled `.app` bundle

2. At runtime, the Swift module loads it via:
   ```swift
   Bundle.main.url(forResource: "best", withExtension: "mlpackage")
   ```

### Activation

The plugin is **not active by default** — it's commented out in `app.json` until you have the trained model.

To activate, in `app.json`, change:
```json
"plugins": [
  "expo-router",
  "expo-font",
  "expo-dev-client"
]
```

To:
```json
"plugins": [
  "expo-router",
  "expo-font",
  "expo-dev-client",
  ["./plugins/withCoreMLModel", { "modelPath": "./cv/best.mlpackage" }]
]
```

### Requirements

- `best.mlpackage` must exist at `expo/cv/best.mlpackage` before running `eas build`
- The plugin will warn (but not crash) if the model file is missing
- `.mlpackage` is a directory, not a single file — the plugin handles this automatically

### iOS only

This plugin only affects iOS builds. Android doesn't use CoreML. When Android CV support is added, a separate TFLite plugin will be needed.
