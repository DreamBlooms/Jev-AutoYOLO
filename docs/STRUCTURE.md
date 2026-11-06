# Project Structure

```
Jev-AutoYOLO/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # Dependency injection
│   │   │   └── routes/
│   │   │       ├── detection.py     # Detection CRUD, manual annotation, model mgmt
│   │   │       ├── export.py        # Multi-format dataset export
│   │   │       ├── import_dataset.py # Dataset import (5 formats, chunked upload, resume)
│   │   │       ├── predict.py       # Model validation, video inference (MJPEG/SSE)
│   │   │       ├── train.py         # YOLO training, SSE progress, retrain, cancel
│   │   │       └── video.py         # Video upload, keyframe extraction
│   │   ├── core/
│   │   │   ├── config.py            # Settings, device auto-detect, allocator tuning
│   │   │   ├── database.py          # SQLAlchemy engine + session
│   │   │   ├── gpu_memory.py        # GPU memory strategy (CUDA / MPS / CPU)
│   │   │   ├── exceptions.py        # Custom exceptions
│   │   │   └── middleware.py        # Request ID, CORS, logging
│   │   ├── models/                  # SQLAlchemy ORM
│   │   │   ├── detection.py         # Detection & bounding boxes (incl. mask_polygon)
│   │   │   ├── train.py             # Training jobs (detect & segment)
│   │   │   └── video.py             # Videos & keyframes
│   │   ├── repositories/            # Data access layer
│   │   │   └── detection.py         # DetectionRepository
│   │   ├── schemas/                 # Pydantic models (camelCase)
│   │   │   ├── common.py            # APIResponse, BaseSchema
│   │   │   ├── detection.py         # DetectionOut, DetectionBoxOut, ExportBatchIn
│   │   │   └── train.py             # TrainingJobOut, TrainRequest
│   │   ├── services/
│   │   │   ├── detection_strategy.py # Strategy pattern (Jev / Jev+SAM2 / SAM3)
│   │   │   ├── jev_service.py        # Jev requests, tiling, coordinate mapping, dedupe
│   │   │   ├── vlm_provider.py       # Jev-first provider + local VLM fallback
│   │   │   ├── model_manager.py      # Web ModelScope/HF download + init
│   │   │   ├── runtime_config.py     # Runtime device switching/config
│   │   │   ├── box_filter.py        # Box filtering, NMS dedup
│   │   │   ├── locate_anything.py   # local VLM fallback inference engine
│   │   │   ├── sam2_service.py      # SAM2 segmentation service
│   │   │   ├── sam3_client.py       # SAM3 HTTP client + watchdog
│   │   │   ├── trainer.py           # YOLO training + validation
│   │   │   ├── detection_service.py # Detection orchestration (offload → infer → persist)
│   │   │   ├── detection_strategy.py # Strategy pattern (Jev / Jev+SAM2 / SAM3)
│   │   │   ├── dataset_import.py    # Dataset import parsers (5 formats)
│   │   │   ├── training_queue.py    # Training job queue with cancel
│   │   │   ├── export.py            # Multi-format export dispatcher
│   │   │   ├── yolo_format.py       # YOLO label conversion (bbox + seg)
│   │   │   ├── coco_format.py       # COCO JSON exporter
│   │   │   ├── voc_format.py        # Pascal VOC XML exporter
│   │   │   ├── createml_format.py   # CreateML JSON exporter
│   │   │   ├── video_service.py     # ffmpeg keyframe extraction + SSIM dedup
│   │   │   └── frame_utils.py       # Frame prediction & annotation drawing
│   │   └── main.py                  # FastAPI entry point
│   ├── alembic/                     # Database migrations
│   │   ├── env.py
│   │   └── versions/
│   ├── sam3_server.py              # SAM3 standalone WSGI server (port 8002)
│   ├── sam3-venv/                   # SAM3 dedicated virtual environment
│   ├── tests/
│   │   ├── test_api_integration.py  # API integration tests (detection → training → validation)
│   │   ├── test_regression.py       # Regression snapshot tests (box position drift detection)
│   │   ├── snapshots/               # Baseline JSON fixtures for regression tests
│   │   └── ...
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── components/              # React UI components
│       │   ├── DetectionCanvas.tsx  # Image annotation canvas (bbox + mask)
│       │   ├── DetectionResult.tsx  # Detection result with multi-format export
│       │   ├── TrainingPanel.tsx    # YOLO training panel (detect & segment, dataset download)
│       │   ├── HistoryList.tsx      # Detection history (paginated, export)
│       │   ├── HistoryListItem.tsx  # Individual history item card
│       │   ├── ResultTable.tsx      # Results table with mask column
│       │   ├── ModelStatus.tsx      # Jev/VLM + SAM2 model status
│       │   ├── DeviceSelector.tsx   # CPU/GPU(ROCm/CUDA/MPS) switching
│       │   ├── JevAdvancedSettings.tsx # Extra state / global & per-category instructions
│       │   ├── AnnotationExportPanel.tsx # Annotation-only export panel
│       │   ├── ModelDownloadButton.tsx # Web model pull & init display
│       │   ├── Sam3Status.tsx       # SAM3 model status display
│       │   ├── training/            # YOLO training sub-components
│       │   │   ├── TrainingCandidateList.tsx
│       │   │   ├── CandidateListItem.tsx
│       │   │   ├── TrainingJobItem.tsx
│       │   │   ├── TrainingPreview.tsx
│       │   │   ├── HoverPreview.tsx # On-demand detection detail for hover
│       │   │   └── StatusBadge.tsx
│       │   ├── Sidebar.tsx          # Main sidebar (model selector, SAM2/SAM3 toggle)
│       │   ├── VideoPanel.tsx       # Video upload & keyframe timeline
│       │   ├── VideoValidator.tsx   # Video validation
│       │   ├── ModelSelector.tsx    # YOLO model variant selector
│       │   ├── ValidationSettings.tsx # Conf/IoU threshold controls
│       │   ├── ImageUploader.tsx    # Drag-and-drop image upload
│       │   ├── CategoryInput.tsx    # Category quick-fill input
│       │   ├── FilterPanel.tsx      # Filter mode selector
│       │   ├── BatchProgress.tsx    # Batch annotation progress
│       │   ├── KeyframeGrid.tsx     # Video keyframe grid
│       │   ├── ThemeProvider.tsx    # Light/dark theme
│       │   ├── Layout.tsx           # App layout
│       │   └── ...
│       ├── pages/Home.tsx           # Main page
│       ├── store/                   # Zustand global state (useAppStore)
│       ├── hooks/                   # Custom hooks (useHomeState, useDetectionTimer, useModelEvents, ...)
│       ├── e2e/                      # Playwright E2E tests
│       ├── i18n/locales/            # en.json, zh.json, ja.json
│       ├── services/api.ts          # Unified API layer
│       ├── lib/                     # Constants, filters, parsers, yoloExport
│       └── types/index.ts           # TypeScript types (BBox, Detection, TrainingJob)
├── docs/                            # Documentation
│   ├── API.md                       # API reference
│   ├── STRUCTURE.md                 # Project structure (this file)
│   ├── architecture_diagram.md      # Chinese architecture/workflow Mermaid
│   ├── architecture_diagram_en.md   # English architecture/workflow Mermaid
│   ├── guide/                       # 中文用户指南
│   └── guide/en/                    # English user guide
├── deploy.sh                       # Native production deploy/start/stop helper
├── docker-compose.yml              # Optional container deployment
├── start.sh / start.bat            # Development launchers
├── AGENTS.md                       # Guidance for coding agents
└── README.md
```
