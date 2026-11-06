# Jev-AutoYOLO 项目架构设计图

根据对当前代码库的分析，这是一个全栈架构的 AI 平台，主要用于基于 Jev（TypeSafe System One）的自动标注、可选本地 VLM 回退以及 YOLO 模型训练。项目采用现代化的前后端分离架构，默认通过 `deploy.sh` 原生部署；仓库同时保留可选的 `docker-compose.yml`。

以下是系统的整体架构图：

```mermaid
graph TD
    %% 客户端层
    subgraph Client ["客户端 (浏览器)"]
        User((用户))
    end

    %% 前端层
    subgraph Frontend ["前端 (Vite + React 19 + TS)"]
        direction TB
        UI["UI 组件 (Ant Design + Tailwind CSS)"]
        State["状态管理 (Zustand)"]
        DataFetch["数据请求 (React Query + ahooks + Axios)"]
        Pages["路由页面 (React Router)"]
        
        UI --> Pages
        Pages --> State
        Pages --> DataFetch
    end

    %% 后端层
    subgraph Backend ["后端 API (FastAPI)"]
        direction TB
        Router["API 路由 (Routers / Controllers)"]
        Schemas["数据校验 (Pydantic Schemas)"]
        Services["业务逻辑层 (Services)"]
        Repos["数据访问层 (Repositories)"]
        Models["ORM 模型 (SQLAlchemy)"]

        Router --> Schemas
        Router --> Services
        Services --> Repos
        Repos --> Models
    end

    %% AI 引擎层
    subgraph AIEngine ["AI & ML 引擎 (PyTorch / OpenCV)"]
        direction TB
        VLM["Jev 自动标注服务 (TypeSafe System One)"]
        YOLO["YOLO 训练与推理服务"]
        SAM3["SAM3 图像分割服务 (sam3_server.py)"]
        CV["图像预处理 (OpenCV + Pillow)"]
    end

    %% 数据存储层
    subgraph Storage ["数据与存储层"]
        PG[(PostgreSQL 16)]
        Alembic["数据迁移 (Alembic)"]
        FileSys[("本地文件系统 (模型/图片/标注数据)")]
        
        Alembic -.-> PG
    end

    %% 部署层
    subgraph Infrastructure ["部署"]
        Docker["deploy.sh 原生部署（可选 docker-compose）"]
    end

    %% 关联连线
    User -- "交互" --> Frontend
    DataFetch -- "HTTP / REST API" --> Router
    Services -- "调用模型推理与训练" --> AIEngine
    Repos -- "SQL 查询 (SQLAlchemy)" --> PG
    Services -- "读写文件" --> FileSys
    AIEngine -- "加载模型/数据集" --> FileSys
    
    %% 基础设施作用域
    Infrastructure -. "部署与管理" .-> Frontend
    Infrastructure -. "部署与管理" .-> Backend
    Infrastructure -. "部署与管理" .-> Storage
```

## 架构说明

### 1. 前端层 (Frontend)
- **核心框架**：使用 Vite 构建的 React 19 单页应用 (SPA)。
- **样式与 UI**：采用 `Ant Design` 配合 `Tailwind CSS` 进行响应式和现代化界面开发，并配置了 `unocss` 进行样式处理。
- **状态管理**：使用轻量级的 `Zustand` 管理全局状态。
- **数据请求**：结合 `Axios`, `React Query` 和 `ahooks`（如 `useRequest`）进行高效的异步数据获取和缓存管理。
- **国际化**：支持 `react-i18next` 提供多语言支持。

### 2. 后端层 (Backend)
- **核心框架**：基于 `FastAPI` 构建的高性能异步 RESTful API。
- **架构模式**：采用经典的分层架构：
  - **Routers/API**: 处理 HTTP 请求和路由分发。
  - **Schemas**: 使用 `Pydantic` 进行请求和响应的数据校验。
  - **Services**: 封装核心业务逻辑。
  - **Repositories**: 抽象数据库访问逻辑，解耦业务与数据层。
  - **Models**: `SQLAlchemy` ORM 模型定义。

### 3. AI & ML 引擎 (AI Engine)
- 此层主要与机器学习相关，是自动标注和模型训练的核心：
  - **Jev 自动标注**：通过 TypeSafe System One（或 OpenRouter Decisions）执行 Box / Noul / Choice 判断；可选回退到本地 LocateAnything-3B。
  - **SAM2 / SAM3 分割**：SAM2 根据 BBox 生成 mask；SAM3 通过独立 `sam3_server.py` 完成文本驱动的检测与分割。
  - **YOLO 训练与验证**：集成目标检测/分割训练流程，并支持训练模型验证。
  - **模型下载**：可从网页通过 ModelScope（或 HuggingFace）拉取 VLM / SAM2 / SAM3 并初始化，支持字节级下载进度、缓存复用和单任务互斥。
  - 依赖 `PyTorch` (`torch`) 和 `OpenCV` 进行张量计算与图像处理；支持 CPU、CUDA、MPS 和 AMD ROCm。

### 4. 数据与存储层 (Storage)
- **关系型数据库**：使用 `PostgreSQL 16` 存储结构化数据（如任务、用户配置、标注元数据等）。
- **数据库迁移**：使用 `Alembic` 管理数据库 schema 的版本迭代。
- **文件存储**：本地挂载的 Volume（如 `model-cache`, `uploads`, `training_runs`）用于存储权重文件、上传的图片和训练输出。

### 5. 部署 (Deployment)
- 默认使用根目录的 `deploy.sh` 完成依赖安装、前端构建、数据库迁移和服务启动，后端同时提供构建后的前端页面。
- `docker-compose.yml` 作为可选容器化方案保留，不作为默认部署路径。

## 核心业务流程 (Workflow)

整个平台的业务流程设计紧扣“数据输入 -> AI 预处理 -> 人工校对 -> 模型产出”的飞轮机制，具体交互流程如下：

```mermaid
sequenceDiagram
    actor User as 用户
    participant UI as 前端页面
    participant API as 后端 API
    participant JEV as Jev / TypeSafe
    participant VLM as 本地 VLM (LocateAnything)
    participant SAM as SAM2 / SAM3
    participant DB as 数据库/文件系统
    participant YOLO as YOLO 训练引擎

    %% 数据导入阶段
    rect rgb(240, 248, 255)
    Note over User,DB: 1. 数据导入
    User->>UI: 上传图片、文件夹或视频文件
    UI->>API: 如果是视频，触发关键帧提取 (含SSIM去重)
    API->>DB: 存储原始媒体文件及元数据
    end

    %% 智能预标注阶段
    rect rgb(255, 245, 238)
    Note over User,DB: 2. 智能预标注与精修
    User->>UI: 输入开放词汇提示词 (如"红色汽车")，选择标注模型
    alt Jev 检测
        UI->>API: 发起 Jev 检测请求（可附加 state / instructions）
        API->>JEV: 发送 Box / Noul / Choice 问题
        JEV-->>API: 返回归一化框与结构化答案
        opt 启用 SAM2 分割
            API->>SAM: 根据 BBox 提示生成精确像素级 Mask
            SAM-->>API: 返回 Polygon 顶点数据
        end
        opt Jev 不可用或强制本地 VLM
            API->>VLM: 调用本地 LocateAnything-3B
            VLM-->>API: 返回边界框 (BBox) 坐标
        end
    else SAM3 端到端检测与分割
        UI->>API: 发起 SAM3 文本驱动推理请求
        API->>SAM: 执行端到端目标检测与实例分割
        SAM-->>API: 同时返回 BBox 与 Mask
    end
    API-->>UI: 返回标注结果并渲染在 Canvas
    end

    %% 人工修正与管理阶段
    rect rgb(245, 255, 250)
    Note over User,DB: 3. 人工修正与数据管理
    User->>UI: 在 Canvas 模式下进行人工修正 (增/删/改框，修改类别等)
    UI->>API: 保存最终校对完成的标注数据
    API->>DB: 持久化记录到数据库
    User->>UI: 选择数据集，一键导出 5 种格式之一 (如 YOLO/COCO)
    UI->>API: 请求导出
    API-->>UI: 生成并返回 ZIP 压缩包
    end

    %% 模型训练与验证阶段
    rect rgb(255, 250, 240)
    Note over User,YOLO: 4. 模型闭环 (训练与验证)
    User->>UI: 配置 YOLO 训练参数 (如版本、Epochs、检测或分割任务)
    UI->>API: 下发模型训练任务
    API->>YOLO: 处理预标注数据集并拉起训练子进程
    loop SSE 实时进度
        YOLO-->>API: 抛出训练日志 (Loss/mAP等)
        API-->>UI: 通过 SSE 将图表和进度实时推送渲染
    end
    YOLO-->>API: 训练完成，自动执行 ONNX 导出
    User->>UI: 使用训练好的模型（或上传外部模型）对新图/流媒体验证
    UI->>API: 发送推理测试请求
    API->>YOLO: 模型推理
    YOLO-->>UI: 实时返回检测效果，完成验证
    end
```
