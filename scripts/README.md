# ATHLT — Model Training Scripts

## What's here

| File | Purpose |
|------|---------|
| `train_basketball_model.py` | YOLOv8 training script — run in Google Colab |

---

## Basketball detection model — full workflow

### What the model does

Detects basketball game objects in real-time camera frames. On-device, no server round-trips.

| Object | Use in app |
|--------|-----------|
| `ball` | Track ball trajectory → make/miss detection |
| `hoop` | Fixed target coordinate for trajectory math |
| `player` | Present in dataset, not used in v1 shot detection |

The model outputs bounding boxes. `shotDetection.ts` reads the ball + hoop boxes per frame and runs trajectory math to call make/miss.

---

### Prerequisites

1. **Google account** (for Colab + Drive)
2. **Roboflow account** (free tier is fine) — [app.roboflow.com](https://app.roboflow.com)
3. Your Roboflow API key (profile → top-right → API Keys)

---

### Step 1 — Get your Roboflow API key

1. Sign up at [roboflow.com](https://roboflow.com) if you don't have an account
2. Go to [app.roboflow.com](https://app.roboflow.com)
3. Click your profile icon (top-right) → API Keys
4. Copy the key — it looks like: `xxxxxxxxxxxxxxxxxxx`
5. Paste it into Cell 1 of the training script: `ROBOFLOW_API_KEY = "your_key_here"`

---

### Step 2 — Open the script in Google Colab

**Option A — Upload the file directly:**
1. Go to [colab.research.google.com](https://colab.research.google.com)
2. File → Upload notebook... → upload `train_basketball_model.py`
3. Colab will convert it to a notebook — each `# %%` section becomes a cell

**Option B — Copy cells manually (most reliable):**
1. New notebook at colab.research.google.com
2. Copy each `── CELL N ──` section from the script into its own Colab cell
3. There are 12 cells total

Either way: **Runtime → Change runtime type → T4 GPU → Save** before running anything.

---

### Step 3 — Set up Google Drive backup (strongly recommended)

Colab sessions disconnect after ~90 min of inactivity. Without Drive backup, a disconnected session loses everything mid-training.

In Cell 1:
```python
SAVE_DRIVE = True
DRIVE_DIR  = "/content/drive/MyDrive/ATHLT_models"  # or your preferred path
```

Cell 2 will prompt you to authorize Drive access. Allow it.

---

### Step 4 — Run all cells in order

| Cell | What it does | Expected time |
|------|-------------|--------------|
| 1 | Config — set API key here | < 1 sec |
| 2 | Mount Google Drive | 10 sec |
| 3 | Install ultralytics + roboflow | 2 min (may prompt restart) |
| 4 | Verify GPU | < 1 sec |
| 5 | Download dataset | 1–3 min |
| 6 | Validate class names + image counts | < 5 sec |
| 7 | **Train** (100 epochs) | ~45 min on T4 |
| 8 | Validate + print per-class metrics | 2 min |
| 9 | Export float32 + INT8 TFLite | 5–10 min |
| 10 | Backup to Google Drive | 1 min |
| 11 | Quick inference test on val image | 10 sec |
| 12 | Print summary + next steps | < 1 sec |

**Run each cell to completion (green checkmark) before the next.**

---

### Step 5 — Read the metrics (Cell 8 output)

```
mAP@0.5:          0.74   (target: > 0.70)  ✓
Precision (mean): 0.81
Recall (mean):    0.68

Per-class AP@0.5:
  ✓ ball          : 0.71
  ✓ hoop          : 0.83
  ✓ player        : 0.70
```

**Target:** `mAP@0.5 > 0.70` overall, and `ball AP > 0.65` specifically.

If ball AP is low (< 0.50):
- Ball is small and fast — this is the hardest class to detect
- Try `BASE_MODEL = "yolov8s.pt"` in Cell 1 for better accuracy at slight speed cost
- Or increase `EPOCHS = 150` and re-run Cell 7 with `resume=True`

If hoop AP is low (< 0.60):
- The hoop is often partially out of frame in training data — this is normal
- Hoop detection is more forgiving in the app since the rim moves slowly
- Threshold hoop confidence lower (0.3 instead of 0.5) at inference time

---

### Step 6 — Download the TFLite model

After Cell 9 completes, two TFLite files are in:
```
runs/detect/basketball_v1/weights/
  best_float32.tflite   (~6 MB)
  best_int8.tflite      (~2 MB)
```

**To download from Colab:**
- Left sidebar → Files icon (folder icon)
- Navigate to `runs/detect/basketball_v1/weights/`
- Right-click `best_int8.tflite` → Download

**Which one to use:**
| Model | Size | Speed on iPhone A15 | When to use |
|-------|------|---------------------|-------------|
| `best_int8.tflite` | ~2 MB | ~30 fps | Production — prefer this |
| `best_float32.tflite` | ~6 MB | ~18 fps | Fallback if INT8 has issues |

---

### Step 7 — Drop the model into the app

1. Rename the downloaded file to `basketball_detector.tflite`
2. Place it at: `expo/assets/models/basketball_detector.tflite`

Confirm `expo/app.json` has this in `assetBundlePatterns`:
```json
"assetBundlePatterns": [
  "**/*",
  "assets/models/*"
]
```

Proceed to **CV-PLAN.md Step 4** (add fast-tflite + wire the model).

---

### Resuming a disconnected training run

If Colab disconnects mid-training:

1. Reconnect and re-run Cells 1–4 (config, Drive, install, GPU check)
2. Skip Cell 5 (dataset already downloaded)
3. In Cell 7, when prompted `"Found existing run... Resume? [y/N]"`, type `y`

Alternatively, set manually:
```python
model = YOLO("runs/detect/basketball_v1/weights/last.pt")
model.train(resume=True)
```

If Drive backup was enabled, copy `last.pt` from Drive back to Colab first:
```python
import shutil
shutil.copy("/content/drive/MyDrive/ATHLT_models/basketball_v1/weights/last.pt",
            "runs/detect/basketball_v1/weights/last.pt")
```

---

### Class index mapping (for shotDetection.ts)

After training, Cell 12 prints the class indices. They depend on the Roboflow dataset version but are typically:

| Class | Index (v3) |
|-------|-----------|
| ball | 0 |
| hoop | 1 |
| player | 2 |
| made | 3 (if present) |
| missed | 4 (if present) |

These indices are what come back from the TFLite model. In `shotDetection.ts` (CV-PLAN Step 4), you'll filter to only act on class indices for `ball` and `hoop`.

---

### Retraining / improving the model

To retrain with more data or a larger base model:
- Change `BASE_MODEL = "yolov8s.pt"` in Cell 1 (small model — better accuracy)
- Bump `ROBOFLOW_VERSION` if a newer dataset version is available
- After the full pipeline is live (post-Apple Dev), collect real app footage and add it to the dataset via Roboflow for a domain-adapted fine-tuned model

---

### Files produced by training

```
runs/detect/basketball_v1/
  weights/
    best.pt               ← Best checkpoint (keep this)
    last.pt               ← Last checkpoint (for resuming)
    best_float32.tflite   ← Float32 TFLite model
    best_int8.tflite      ← INT8 TFLite model (prefer)
  results.csv             ← Loss + mAP per epoch
  results.png             ← Training curve plot
  confusion_matrix.png    ← Per-class confusion matrix
  PR_curve.png            ← Precision-recall curve
  val_batch0_pred.jpg     ← Sample validation predictions (visual check)
```

The Drive backup copies all of the above to `DRIVE_DIR/basketball_v1/`.
