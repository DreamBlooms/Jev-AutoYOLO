# AGENTS.md

This file provides guidance to coding agents (Claude Code, Codex, OpenCode, etc.) when working with code in this repository.

## 工作流规则

- **不要主动提交**。只有用户明确说"提交"/"commit"时才提交
- **不要主动推送**。只有用户明确说"推送"/"push"时才推送
- **不要主动打 tag**。只有用户明确说"打 tag"/"add tag"时才打 tag

## 命令

### 启动开发环境

```bash
./start.sh                    # 同时启动前后端（推荐，会自动加载 .env）
cd backend && PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
cd frontend && pnpm dev       # Vite dev server → localhost:5173
```

**重要**：后端启动前确保 `backend/.env` 中 `DATABASE_URL` 指向正确的 PostgreSQL。若未设置会降级到 SQLite 空库，导致看不到已有数据。

### 生产部署

```bash
./deploy.sh setup              # 安装依赖、迁移数据库、构建前端
./deploy.sh start              # 启动，后端同时提供 UI 和 API
./deploy.sh status             # 查看健康状态
./deploy.sh restart            # 重启
./deploy.sh stop               # 停止
./deploy.sh logs               # 跟踪 deploy.log
```

默认访问 `http://<host>:8000`，API 文档为 `http://<host>:8000/docs`。仓库保留可选的 `docker-compose.yml`，但不是默认部署路径。

### 前端 (`frontend/`)

```bash
pnpm dev                       # 开发服务器（HMR）
pnpm run lint                  # ESLint
npx tsc --noEmit --pretty      # TypeScript 类型检查
pnpm run build                 # 生产构建 = tsc + vite build
```

### 后端 (`backend/`)

```bash
PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

ruff check app/                # Lint，必须零错误
ruff format --check app/       # 格式检查，必须无待格式化文件
ruff format app/               # 自动格式化
ruff check app/ --fix          # 自动修可修的 lint 问题

PYTHONPATH=. pytest tests/ -v              # 运行全部测试
PYTHONPATH=. pytest tests/path.py -v       # 运行单个测试文件
PYTHONPATH=. pytest tests/ -k "test_name"  # 运行匹配名称的测试

# 注意：test_images/ 已被 gitignore 且不再纳入版本控制；
# 本地没有该目录时，test_api_integration / test_regression 会自动跳过。

PYTHONPATH=. alembic upgrade head          # 运行数据库迁移
PYTHONPATH=. alembic stamp <revision>      # 标记迁移版本（跳过冲突迁移）
```

### 提交前检查

GitHub Actions 工作流已移除，CI 检查需要在本地执行：

| 改动范围 | 必须执行 |
|---------|---------|
| `frontend/` | `npx tsc --noEmit --pretty` + `pnpm run lint` |
| `backend/` | `ruff check app/` + `ruff format --check app/` |

### Tag 前额外检查

除了上述检查，还必须：

```bash
cd frontend && pnpm run build              # 完整前端构建
cd backend && PYTHONPATH=. pytest tests/ -v # 全部测试通过
```

以上通过后，同步更新 `CHANGELOG.md` 和必要时更新 README 文档。

## 架构

### 数据流

```
上传图片 → 策略模式路由（Jev / Jev+SAM2 / SAM3）
         → Jev: TypeSafe System One API（失败时回退本地 LocateAnything-3B）→ bbox
         → Jev+SAM2: Jev bbox → SAM2 分割 → mask polygon
         → SAM3: facebook/sam3 独立服务 → bbox + mask polygon（一次调用）
         → DetectionBox 存入 PostgreSQL
         → 前端 Canvas 渲染（bbox + mask 可独立开关）
         → 导出（5 种格式）→ YOLO 训练（检测/分割）
```

### 检测策略（Strategy Pattern）

`detection_strategy.py` 提供三种策略，通过 `create_strategy()` 工厂创建：

| 策略 | 类 | 模型 | 输出 |
|------|------|------|------|
| Jev | `JevDetection` | Jev（`jev_service.py`），本地回退 LocateAnything-3B | bbox |
| Jev+SAM2 | `JevWithSAM2` | Jev + SAM 2.1 | bbox + mask polygon |
| SAM3 | `SAM3Detection` | facebook/sam3 | bbox + mask polygon |

`vlm_provider.detect_with_provider()` 负责 provider 选择：优先 Jev；无 API Key、网络错误或 5xx 时按 `JEV_FALLBACK_TO_LOCAL` 回退到本地模型。400 请求错误不回退。`VLMDetection` / `VLMWithSAM2` 仅作为旧类名别名保留。

Jev 支持两种接入：
- `JEV_PROVIDER=typesafe`：TypeSafe SDK，`POST /v1/systemone`，使用 `TYPESAFE_API_KEY`。
- `JEV_PROVIDER=openrouter`：OpenRouter Decisions API，`POST /api/alpha/decisions`，使用 `OPENROUTER_API_KEY`，模型由 `OPENROUTER_JEV_MODEL` 设置（默认 `~typesafe/jev-latest`），图片以 base64 `assets` 发送。
- `JEV_MODEL` 是两个渠道的通用回退；`TYPESAFE_JEV_MODEL` / `OPENROUTER_JEV_MODEL` 可按渠道覆盖。

策略参数通过路由的 `strategy_kwargs` 传入 `detect(**kwargs)`，不通过 `create_strategy()`。

### SAM3 架构

```
backend/sam3_server.py          ← 独立 WSGI 服务（端口 8002），https://huggingface.co/facebook/sam3
backend/sam3-venv/              ← SAM3 专用虚拟环境（Python 3.14, torch 2.12, transformers 5.10）
backend/app/services/sam3_client.py ← HTTP 客户端，自动启停 SAM3 服务，闲置 watchdog
```

- SAM3 模型是 HuggingFace gated 仓库，需要 `HF_TOKEN` 环境变量：
  1. 浏览器打开 https://huggingface.co/facebook/sam3 点击 "Agree and access repository"
  2. 创建 Read 类型 Token（无需 Fine-grained），设为 `HF_TOKEN` 环境变量
- 模型已缓存在 `~/.cache/huggingface/hub/`，后续启动不需下载
- Server 启动时先开 HTTP 再异步加载模型，`/health` 返回 `starting` → `loading` → `loaded`
- 闲置 `model_idle_timeout_seconds`（默认 600s）后自动卸载
- 检测时后端自动互斥卸载：用 SAM3 时释放本地回退/SAM2；Jev 为远程 API，不占显存

### 模型状态 SSE

`GET /api/v1/model/events` — 单个 SSE 端点推送 Jev、本地回退、SAM2、SAM3 状态：

```
data: {"jev": {"state":"loaded","mode":"remote",...}, "vlm": {"state":"unloaded",...}, "sam2": {...}, "sam3": {...}}
```

前端 `useModelEvents()` hook 订阅该 SSE，`ModelStatus` 和 `Sam3Status` 组件不再各自轮询。

### 检测记录模型标注

`Detection` 模型有 `model_type` 字段（`jev` / `jev+sam2` / `jev+sam3` / `sam3`；旧记录 `vlm` / `vlm+sam2`），历史列表和训练候选列表通过彩色标签展示。`model_name` 记录实际 provider。

列表接口 `GET /detections` 返回轻量 `DetectionListItem`（box 不含 `mask_polygon`），减少传输体积。详情接口 `GET /detections/{id}` 返回完整 `DetectionOut`（含 mask）。训练 hover 预览通过 `HoverPreview` 组件按需请求单张详情。

### 关键概念

- **Jev**：`jev_service.py` — TypeSafe System One API，图片预处理、Box/Noul/Choice 问题构造、归一化坐标解析、多实例分块；无需本地 GPU
- **CPU 推理**：`gpu_memory.py` 无 GPU 时返回 `cpu`；本地 LocateAnything、SAM2、SAM3 和 YOLO 验证均可在 CPU 上运行（速度较慢）。运行时通过 `POST /api/v1/config/device` 切换 CPU/GPU，切换会卸载本地模型
- **ROCm**：AMD GPU 通过 PyTorch HIP 暴露为 `cuda`；`is_rocm()` 检测 `torch.version.hip`，配置返回 `rocm=true` / `gpuName`，UI 显示 GPU (ROCm)。ROCm 不支持 `expandable_segments`，因此只在非 ROCm 环境设置 `PYTORCH_CUDA_ALLOC_CONF`
- **VLM 模式**：前端第三个模型 Tab 强制使用本地 LocateAnything（`use_vlm=true`），不走 Jev；支持与 SAM2 组合
- **仅标注模式**：`ANNOTATION_ONLY=true` 时只关闭训练路由/训练界面；验证、SAM、标注、历史和多格式导出保留。运行时配置由 `GET /api/v1/config` 提供
- **本地回退**：`locate_anything.py` — LocateAnything-3B 模型，惰性加载，支持 CUDA/MPS，CPU 禁止
- **SAM2**：`sam2_service.py` — SAM 2.1 模型，bbox → mask polygon，惰性加载，闲置卸载
- **SAM3**：`sam3_client.py` + `sam3_server.py` — facebook/sam3 文本驱动开放词汇分割，独立进程+独立 venv
- **GPU 内存**：`gpu_memory.py` — 策略模式，CUDA (`expandable_segments`) / MPS (`synchronize`+`empty_cache`)
- **检测框**：`DetectionBox` 模型含 `mask_polygon` JSON 列，`confidence` 预留
- **导出**：`export.py` 分发到 `yolo_format.py`/`coco_format.py`/`voc_format.py`/`createml_format.py`
- **训练**：`trainer.py` — `_build_dataset()` 按 task_type 选择 bbox 或 seg 标签格式
- **数据库**：SQLAlchemy 2.0，主用 PostgreSQL，SQLite 仅本地免配置降级
- **API 响应**：`APIResponse` 包装 `{data, error, total, page, pageSize}`，驼峰命名
- **前端状态**：`useHomeState.ts` 集中管理检测/训练/验证全流程状态，`useModelEvents.ts` 管理模型状态 SSE
- **i18n**：`i18next` 三语（zh/en/ja），浏览器语言自动检测

### 目录约定

- `backend/app/api/routes/` — FastAPI 路由，每个文件一个 `APIRouter`
- `backend/app/services/` — 业务逻辑，不直接触数据库 Session
- `backend/app/repositories/` — 数据访问层，封装所有 SQLAlchemy 查询
- `backend/app/schemas/` — Pydantic 模型，`from_attributes = True`
- `backend/app/core/` — 配置、数据库引擎、中间件、异常
- `frontend/src/components/` — React 组件，按功能拆分，`training/` 子目录
- `frontend/src/hooks/` — 自定义 hooks，每个功能一个文件
- `frontend/src/i18n/locales/` — 翻译 JSON，key 结构与 en.json 对齐
