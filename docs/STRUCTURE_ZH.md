# 项目结构

```
Jev-AutoYOLO/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # 依赖注入
│   │   │   └── routes/
│   │   │       ├── detection.py     # 检测 CRUD、手动标注、模型管理
│   │   │       ├── export.py        # 多格式数据集导出
│   │   │       ├── predict.py       # 模型验证、视频推理（MJPEG/SSE）
│   │   │       ├── train.py         # YOLO 训练、SSE 进度、重训
│   │   │       └── video.py         # 视频上传、关键帧提取
│   │   ├── core/
│   │   │   ├── config.py            # 配置、设备检测、分配器调优
│   │   │   ├── database.py          # SQLAlchemy 引擎 + 会话
│   │   │   ├── gpu_memory.py        # GPU 内存策略（CUDA / MPS / CPU）
│   │   │   ├── exceptions.py        # 自定义异常
│   │   │   └── middleware.py        # 请求 ID、CORS、日志
│   │   ├── models/                  # SQLAlchemy ORM
│   │   │   ├── detection.py         # 检测 & 标注框（含 mask_polygon）
│   │   │   ├── train.py             # 训练任务（检测 & 分割）
│   │   │   └── video.py             # 视频 & 关键帧
│   │   ├── repositories/            # 数据访问层
│   │   │   └── detection.py         # DetectionRepository
│   │   ├── schemas/                 # Pydantic 模型（驼峰命名）
│   │   │   ├── common.py            # APIResponse、BaseSchema
│   │   │   ├── detection.py         # DetectionOut、DetectionBoxOut、ExportBatchIn
│   │   │   └── train.py             # TrainingJobOut、TrainRequest
│   │   ├── services/
│   │   │   ├── detection_strategy.py # 策略模式（Jev / Jev+SAM2 / SAM3）
│   │   │   ├── jev_service.py        # Jev 请求、分块、坐标映射与去重
│   │   │   ├── vlm_provider.py       # Jev 优先 + 本地 VLM 回退
│   │   │   ├── model_manager.py      # ModelScope/HF 网页下载与初始化
│   │   │   ├── runtime_config.py     # 运行时设备切换与配置
│   │   │   ├── box_filter.py        # 标注框过滤、NMS 去重
│   │   │   ├── locate_anything.py   # 本地回退 VLM 推理引擎
│   │   │   ├── sam2_service.py      # SAM2 分割服务
│   │   │   ├── sam3_client.py       # SAM3 HTTP 客户端 + 闲置看门狗
│   │   │   ├── trainer.py           # YOLO 训练 + 验证
│   │   │   ├── export.py            # 多格式导出分发器
│   │   │   ├── yolo_format.py       # YOLO 标签转换（bbox + seg）
│   │   │   ├── coco_format.py       # COCO JSON 导出
│   │   │   ├── voc_format.py        # Pascal VOC XML 导出
│   │   │   ├── createml_format.py   # CreateML JSON 导出
│   │   │   ├── video_service.py     # ffmpeg 关键帧提取 + SSIM 去重
│   │   │   └── frame_utils.py       # 帧预测与标注绘制
│   │   └── main.py                  # FastAPI 入口
│   ├── alembic/                     # 数据库迁移
│   │   ├── env.py
│   │   └── versions/
│   ├── sam3_server.py              # SAM3 独立 WSGI 服务（端口 8002）
│   ├── sam3-venv/                   # SAM3 专用虚拟环境
│   ├── tests/
│   │   ├── test_api_integration.py  # API 集成测试
│   │   ├── test_regression.py       # 回归快照测试
│   │   ├── snapshots/               # 回归测试基线
│   │   └── ...
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── components/              # React UI 组件
│       │   ├── DetectionCanvas.tsx  # 图片标注画布（bbox + mask）
│       │   ├── DetectionResult.tsx  # 检测结果（多格式导出）
│       │   ├── TrainingPanel.tsx    # YOLO 训练面板
│       │   ├── HistoryList.tsx      # 检测历史（分页 + 导出下拉菜单）
│       │   ├── HistoryListItem.tsx  # 历史记录单项卡片
│       │   ├── ResultTable.tsx      # 结果表格（含 Mask 列）
│       │   ├── ModelStatus.tsx      # Jev/VLM + SAM2 模型状态显示
│       │   ├── DeviceSelector.tsx   # CPU/GPU(ROCm/CUDA/MPS) 切换
│       │   ├── JevAdvancedSettings.tsx # 附加 state / 全局及按类别 instructions
│       │   ├── AnnotationExportPanel.tsx # 仅标注模式导出面板
│       │   ├── ModelDownloadButton.tsx # 网页拉取并初始化模型
│       │   ├── Sam3Status.tsx       # SAM3 模型状态显示
│       │   ├── training/            # YOLO 训练子组件
│       │   │   ├── TrainingCandidateList.tsx
│       │   │   ├── CandidateListItem.tsx
│       │   │   ├── TrainingJobItem.tsx
│       │   │   ├── TrainingPreview.tsx
│       │   │   ├── HoverPreview.tsx # hover 按需请求检测详情
│       │   │   └── StatusBadge.tsx
│       │   ├── Sidebar.tsx          # 主侧边栏（模型选择器、SAM2/SAM3 开关）
│       │   ├── VideoPanel.tsx       # 视频上传与关键帧时间轴
│       │   ├── VideoValidator.tsx   # 视频验证
│       │   ├── ModelSelector.tsx    # YOLO 模型选择器
│       │   ├── ValidationSettings.tsx # Conf/IoU 阈值控制
│       │   ├── ImageUploader.tsx    # 拖拽上传
│       │   ├── CategoryInput.tsx    # 类别快速填充
│       │   ├── FilterPanel.tsx      # 过滤模式选择
│       │   ├── BatchProgress.tsx    # 批量标注进度
│       │   ├── KeyframeGrid.tsx     # 视频关键帧网格
│       │   ├── ThemeProvider.tsx    # 亮色/暗色主题
│       │   ├── Layout.tsx           # 应用布局
│       │   └── ...
│       ├── pages/Home.tsx           # 主页面
│       ├── store/                   # Zustand 全局状态（useAppStore）
│       ├── hooks/                   # 自定义 Hooks（useHomeState, useDetectionTimer, useModelEvents, ...）
│       ├── e2e/                      # Playwright E2E 测试
│       ├── i18n/locales/            # en.json、zh.json、ja.json
│       ├── services/api.ts          # 统一 API 层
│       ├── lib/                     # 常量、过滤器、解析器、yoloExport
│       └── types/index.ts           # TypeScript 类型（BBox, Detection, TrainingJob）
├── docs/                            # 文档
│   ├── API.md / API_ZH.md           # API 参考
│   ├── STRUCTURE.md / STRUCTURE_ZH.md # 项目结构
│   ├── architecture_diagram.md      # 中文架构/流程 Mermaid 图
│   ├── architecture_diagram_en.md   # 英文架构/流程 Mermaid 图
│   ├── guide/                       # 中文用户指南
│   └── guide/en/                    # 英文用户指南
├── deploy.sh                       # 原生生产部署/启停脚本
├── docker-compose.yml              # 可选容器化部署
├── start.sh / start.bat            # 开发启动脚本
├── AGENTS.md                       # 编码代理工作指南
└── README.md
```
