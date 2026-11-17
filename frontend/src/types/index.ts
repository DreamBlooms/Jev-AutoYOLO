export interface BBox {
  id: string;
  className: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number | null;
  maskPolygon?: number[][] | null;
}

export type ReviewStatus = "pending" | "accepted" | "rejected";

export interface Detection {
  id: string;
  projectId: string | null;
  imageName: string;
  categories: string[];
  modelName: string;
  modelType: string | null;
  imageWidth: number;
  imageHeight: number;
  elapsedMs: number | null;
  filterMode: string | null;
  filterNmsIou: number | null;
  status: string;
  reviewStatus: ReviewStatus;
  createdAt: string;
  boxes: BBox[];
}

export type DetectResponse = Detection;

export interface TrainingJob {
  id: string;
  projectId: string | null;
  name: string | null;
  modelVariant: string;
  epochs: number;
  imgsz: number;
  batch: number;
  trainRatio: number;
  valRatio: number;
  taskType: string;
  detectionIds: string[];
  classMap: Record<string, string> | null;
  status: "pending" | "running" | "completed" | "failed";
  metrics: Record<string, unknown> | null;
  modelPath: string | null;
  onnxPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface KeyFrame {
  id: string;
  videoId: string;
  frameNumber: number;
  timestampSeconds: number;
  sceneScore: number | null;
  createdAt: string;
}

export interface VideoInfo {
  id: string;
  projectId: string | null;
  fileName: string;
  duration: number | null;
  fps: number | null;
  totalFrames: number | null;
  width: number | null;
  height: number | null;
  status: string;
  createdAt: string;
  keyframes: KeyFrame[];
}

export interface VideoList {
  total: number;
  items: VideoInfo[];
}

export interface ListResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  categories: string[];
  createdAt: string;
  updatedAt: string;
  imageCount: number;
  boxCount: number;
  videoCount: number;
  trainingJobCount: number;
  modelCount: number;
  pendingReviewCount: number;
}
