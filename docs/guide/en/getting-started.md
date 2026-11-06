# Getting Started

This guide will walk you through your first object detection labeling and training workflow from scratch.

## 1. Launch the Project

```bash
# macOS / Linux
./start.sh

# Windows
start.bat
```

After launching, access:
- **Frontend Interface**: http://localhost:5173
- **API Documentation**: http://localhost:8000/docs

### Configure the Jev API key

Jev is TypeSafe's hosted System One API. A key is required for the default Jev provider. Choose one channel:

**Option A — TypeSafe direct**

1. Open <https://console.typesafe.ai/> and create an API key.
2. Set the following in `backend/.env`:

```env
JEV_PROVIDER=typesafe
TYPESAFE_API_KEY=your_typesafe_key
TYPESAFE_JEV_MODEL=jev-1.14.0
```

**Option B — OpenRouter**

1. Open <https://openrouter.ai/> and create an API key.
2. Set the following in `backend/.env`:

```env
JEV_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_JEV_MODEL=~typesafe/jev-latest
```

`JEV_MODEL` is a shared fallback; the provider-specific variable takes precedence.

Create `backend/.env` first if it does not exist:

```bash
cp backend/.env.example backend/.env
```

Restart the backend after changing the key:

```bash
./deploy.sh restart
# or, for development mode:
python3 cli.py stop && python3 cli.py start
```

Verify the configuration:

- In the UI, the Jev model card shows `Ready · Remote API`.
- `GET http://localhost:8000/api/v1/config` returns `"jevConfigured": true` and the selected `jevModel`.
- If the key is missing or invalid, download the local VLM fallback with `python3 cli.py download --models=vlm`, or use the VLM/SAM3 tab.

Keep API keys only in the backend environment. `backend/.env` is gitignored and must never be committed.

## 2. Upload Images or Videos

### Image Mode
1. Select the "Image" tab in the left sidebar
2. Click the upload area and select one or more images (folder drag-and-drop supported)
3. Images are automatically compressed to 1280px to save VRAM

### Video Mode
1. Select the "Video" tab
2. Upload video files (MP4/MOV/AVI/MKV supported)
3. Choose keyframe extraction method:
   - **Scene Change**: Automatically detects scene transitions
   - **Motion Detection**: Detects moving objects using optical flow
   - **Fixed Interval**: Extracts frames at regular time intervals
4. Select desired keyframes and click "Load to Labeling Queue"

## 3. Choose Detection Model

Use the model selector at the top of the sidebar to switch between:

### Jev + SAM2 (Default)
- Jev (TypeSafe, with local LocateAnything-3B fallback) generates bounding boxes
- Optionally enable SAM2 segmentation for pixel-precise masks

### SAM3
- Text-driven end-to-end detection + segmentation in a single pass
- Open-vocabulary prompts (e.g. `cat`, `red car`)
- Adjustable parameters:
  - **Confidence threshold** (Conf ≥ 0.5): lower = more detections
  - **Mask threshold** (Mask ≥ 0.5): higher = tighter masks
  - **Enable SAM3 Segmentation** toggle: disable for bbox-only mode
- Requires `HF_TOKEN` environment variable on first use; model cached locally after download

## 4. Auto-Labeling

1. Enter target categories in the "Target Categories" input box (English works better)
   - Examples: `person, car, dog`
   - Natural language descriptions supported: `red car`, `person wearing hat`
2. Click "Start Detection"
3. The selected model generates bounding box annotations
   - First result appears immediately
   - Subsequent results are appended in real-time during batch upload

**Tips**:
- More specific category names yield better detection results
- Avoid overly generic descriptions (like `object`)
- Use commas to separate multiple categories

## 5. Manual Refinement

Jev annotations may not be perfect and require manual adjustment:

### View Mode
- **All**: Display all detection boxes
- **Best**: Keep only the highest confidence box per category
- **NMS**: Non-Maximum Suppression to remove overlapping boxes

### Annotation Mode
1. Switch to the "Annotation" tab
2. Drag on the canvas to draw new bounding boxes
3. Enter category name (quick selection from history available)
4. Click unwanted boxes and press Delete to remove

### Filter Settings
- Adjust NMS IoU threshold to control overlapping box filtering
- Click "Save Filter Results" to persist settings

## 6. Export Dataset

### Single Image Export
- Click "Export YOLO (.txt)" on the results page
- Directly download the annotation file for a single image

### Batch Export
1. Select multiple images in the history list
2. Click "Export All (X images)"
3. Download ZIP package containing images and annotations

**Export Format**:
```
dataset/
├── images/
│   ├── img1.jpg
│   └── img2.jpg
├── labels/
│   ├── img1.txt
│   └── img2.txt
└── data.yaml
```

## 7. Train YOLO Model

1. Select detection records to train in the "YOLO Training" panel
2. Choose YOLO series:
   - **YOLOv5**: Classic and stable, good compatibility
   - **YOLOv8**: Balanced speed and accuracy
   - **YOLOv11**: Latest architecture, best performance
   - **YOLOv26**: Experimental, cutting-edge
3. Select model size:
   - **n** (nano): Fastest, suitable for edge devices
   - **s** (small): Balanced speed and accuracy
   - **m** (medium): General recommendation
   - **l** (large): High accuracy, slower
   - **x** (xlarge): Highest accuracy, slowest
4. Set training parameters:
   - **Epochs**: Training iterations (recommended 100-300)
   - **ImgSz**: Input image size (recommended 640)
   - **Batch**: Batch size (adjust based on VRAM, 8-16)
5. Click "Start Training"
6. Monitor training progress in real-time:
   - Epoch progress bar
   - Loss curves
   - mAP metrics

## 8. Validate Model

### Image Validation
1. After training completes, click "Validate" in training records
2. Upload test images
3. Adjust Conf and IoU thresholds
4. View detection results and confidence scores

### Video Validation
1. Select the "Video" tab
2. Upload test video
3. Select trained model
4. Click "Validate Video (Real-time)"
5. Watch real-time detection stream, pause/replay supported

## 9. Download Model

After training completes, you can download:
- **PT Model**: PyTorch format for continued training or inference
- **ONNX Model**: Cross-platform deployment format
- **Dataset**: Complete dataset with images and annotations

## Next Steps

- Learn [Annotation Best Practices](./annotation-tips.md) to improve labeling quality
- Understand [Training Parameter Tuning](./training-guide.md) to enhance model performance

## FAQ

**Q: Jev or the local VLM can't detect the target?**
A: Try more specific category descriptions, or check image quality

**Q: Out of VRAM during training?**
A: Reduce Batch Size or choose smaller model size (like n or s)

**Q: Video validation is laggy?**
A: Reduce video resolution or choose smaller model

**Q: Bounding box positions are inaccurate?**
A: Use annotation mode to manually adjust, or adjust NMS threshold
