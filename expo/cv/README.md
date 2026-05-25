# ATHLT Computer Vision — Setup Guide

This folder contains everything needed to train and deploy the basketball shot detection model.

## Files

| File | Purpose |
|------|---------|
| `train_shot_detector.ipynb` | Google Colab notebook — train YOLOv11n, export to CoreML |
| `INSTALL.md` | How to install VisionCamera + worklets, activate the config plugin |
| `supabase-schema.sql` | SQL to run in Supabase dashboard to create shot tracking tables |
| `best.mlpackage` | *(Created after training)* The trained CoreML model — not committed to git |
| `backend-endpoint/coach-shot-read.js` | Coach X postgame analysis endpoint — copy to `collectiq/api/` |

---

## Quickstart order

```
1. Run supabase-schema.sql in Supabase dashboard
2. Open train_shot_detector.ipynb in Colab → run all cells → download best.mlpackage
3. Place best.mlpackage in this folder (expo/cv/best.mlpackage)
4. Activate the CoreML config plugin in app.json (see INSTALL.md)
5. Copy backend-endpoint/coach-shot-read.js to collectiq/api/coach-shot-read.js and deploy
6. npm install react-native-vision-camera + worklets (see INSTALL.md)
7. Run EAS dev client build
```

---

## Training Notebook (Colab)

### How to open

1. Go to [colab.research.google.com](https://colab.research.google.com)
2. File → Upload notebook
3. Select `train_shot_detector.ipynb`
4. Runtime → Change runtime type → **T4 GPU** (free tier)
5. Runtime → Run all (or run cells one by one)

### What it does

1. Installs `ultralytics` (YOLOv11) and `roboflow`
2. Downloads the Basketball Detection dataset from Roboflow Universe
   - 5 classes: `ball`, `ball_in_basket`, `player`, `basket`, `player_shooting`
   - ~800–1,500 labeled images (depending on dataset version)
3. Fine-tunes **YOLOv11n** (nano, ~6MB) for 50 epochs on the dataset
4. Runs validation — logs mAP@50 and mAP@50-95
5. Shows sample detection images inline
6. Exports to CoreML: `model.export(format="coreml", nms=True)` → `best.mlpackage`
7. Zips the `.mlpackage` and triggers a browser download

### Expected training time

- Free Colab T4 GPU: **~45–90 minutes** for 50 epochs on ~1,000 images
- Free Colab A100 (if available): ~20–30 minutes
- YOLOv11n is the fastest YOLO variant — you can increase to YOLOv11s for ~5% more accuracy at the cost of ~25ms/frame extra latency on device

### Expected accuracy

At 50 epochs on the Basketball Detection dataset:
- mAP@50 ≈ 0.70–0.82 depending on dataset quality
- `ball` class tends to have lower recall (small object, motion blur) — this is normal
- `ball_in_basket` class mAP is the most important for make/miss detection

### What to do with the downloaded .mlpackage

1. Unzip if downloaded as `.zip`
2. You should have a folder called `best.mlpackage` (it's a directory, not a single file)
3. Move it to `expo/cv/best.mlpackage`
4. Activate the config plugin (see INSTALL.md Step 4)

---

## Troubleshooting

### Colab disconnects mid-training

Training saves checkpoints to `runs/detect/train/weights/`. If Colab disconnects:
- Re-run only the import cells and the export cell
- Or resume from last checkpoint: change `model = YOLO('yolov11n.pt')` to `model = YOLO('runs/detect/train/weights/last.pt')` and re-run training

### GPU not available

If you get "GPU not connected":
- Runtime → Change runtime type → T4 GPU
- If T4 is unavailable, you can train on CPU (~8–15 hours for 50 epochs) — not recommended
- Alternative: use Colab Pro ($10/month) for guaranteed GPU access

### CoreML export fails

- Requires Linux or macOS (Colab runs Linux — should be fine)
- If `model.export(format="coreml")` errors, try: `pip install --upgrade coremltools` and retry
- The export produces `best.mlpackage` in the `runs/detect/train/weights/` directory

### Dataset download fails

- Roboflow free API key is required (create free account at roboflow.com)
- The notebook will prompt you to paste your API key
- If the specific dataset is unavailable, any basketball detection dataset from Roboflow Universe with ball + rim classes will work

---

## .mlpackage in git

**Do not commit `best.mlpackage` to git.** It's a binary directory (~20–60MB). Add to `.gitignore`:

```
expo/cv/best.mlpackage
```
