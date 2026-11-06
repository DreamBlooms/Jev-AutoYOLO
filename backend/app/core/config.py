from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings

# ── CUDA memory allocator tuning ───────────────────
# Use expandable segments (PyTorch 2.1+) for dynamic memory management;
# much better than the legacy max_split_size_mb for varying tensor sizes.
# ROCm/HIP reads the same variable but does not support expandable_segments,
# so only enable it when no ROCm installation is detected.
_is_rocm = bool(os.environ.get("ROCM_PATH")) or os.path.exists("/opt/rocm")
if not _is_rocm:
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    # Database
    database_url: str = ""

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        # Fallback to local SQLite if no DATABASE_URL is provided in env
        db_path = self.project_root / "autolabeling.db"
        return f"sqlite:///{db_path}"

    # ── Jev (TypeSafe System One API) ─────────────────
    # Hosted visual grounding. Used as the primary detector; LocateAnything-3B
    # remains available as an optional local fallback.
    typesafe_api_key: str = ""
    openrouter_api_key: str = ""
    jev_provider: str = "typesafe"  # typesafe | openrouter
    jev_model: str = ""  # shared fallback for either provider
    typesafe_jev_model: str = ""
    openrouter_jev_model: str = ""
    jev_base_url: str = ""
    jev_timeout_seconds: float = 60.0
    jev_present_threshold: float = 0.5
    jev_box_confidence_threshold: float = 0.0
    jev_multi_instance: str = "auto"  # auto | single | sam3
    jev_max_tiles: int = 4
    jev_tile_overlap: float = 0.1
    jev_max_concurrency: int = 4
    jev_fallback_to_local: bool = True

    @property
    def resolved_jev_provider(self) -> str:
        value = self.jev_provider.strip().lower()
        return value if value in ("typesafe", "openrouter") else "typesafe"

    @property
    def resolved_jev_api_key(self) -> str:
        if self.resolved_jev_provider == "openrouter":
            return self.openrouter_api_key.strip()
        return self.typesafe_api_key.strip()

    @property
    def jev_configured(self) -> bool:
        return bool(self.resolved_jev_api_key)

    @property
    def resolved_jev_model(self) -> str:
        shared = self.jev_model.strip()
        if self.resolved_jev_provider == "openrouter":
            return self.openrouter_jev_model.strip() or shared or "~typesafe/jev-latest"
        return self.typesafe_jev_model.strip() or shared or "jev-1.14.0"

    @property
    def resolved_jev_base_url(self) -> str:
        explicit = self.jev_base_url.strip()
        if explicit:
            return explicit
        if self.resolved_jev_provider == "openrouter":
            return "https://openrouter.ai"
        return "https://api.typesafe.ai"

    @property
    def resolved_jev_multi_instance(self) -> str:
        value = self.jev_multi_instance.strip().lower()
        return value if value in ("auto", "single", "sam3") else "auto"

    # ── Local fallback model (auto-detect: cuda → mps; CPU is not supported)
    model_dir: str = ""
    device: str = ""
    model_id: str = "nvidia/LocateAnything-3B"
    sam2_model_id: str = "facebook/sam2.1-hiera-base-plus"
    sam2_checkpoint_path: str = ""

    # ── Web model download (ModelScope) ───────────────
    model_download_source: str = "modelscope"  # modelscope | huggingface
    vlm_modelscope_id: str = ""  # optional ModelScope mirror for LocateAnything
    sam2_modelscope_id: str = "facebook/sam2.1-hiera-base-plus"
    sam3_modelscope_id: str = "facebook/sam3"
    sam3_model_path: str = ""
    sam3_startup_timeout_seconds: int = 180

    @property
    def resolved_device(self) -> str:
        from .gpu_memory import _detect_device

        return _detect_device(self.device)

    @property
    def gpu_available(self) -> bool:
        try:
            return self.resolved_device != "cpu"
        except Exception:
            return False

    # Annotation-only mode hides/disables training and model validation.
    annotation_only: bool = False

    # Model idle timeout (seconds) — auto-unload to free GPU memory
    model_idle_timeout_seconds: int = 600

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Upload
    max_upload_size_mb: int = 20
    max_import_size_mb: int = 10240  # 10 GB
    max_video_upload_size_mb: int = 500

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parent.parent.parent

    @property
    def upload_dir(self) -> Path:
        d = self.project_root / "uploads"
        d.mkdir(parents=True, exist_ok=True)
        return d

    @property
    def resolved_model_dir(self) -> str:
        return self.model_dir or str(self.project_root / "model")

    @property
    def resolved_modelscope_dir(self) -> Path:
        d = self.project_root / "modelscope_models"
        d.mkdir(parents=True, exist_ok=True)
        return d


settings = Settings()


def hf_repo_cache_dir(model_id: str) -> Path:
    """Resolve a Hugging Face repo cache directory using HF_HUB_CACHE/HF_HOME.

    Reads os.environ directly because values in backend/.env are only read by
    pydantic-settings and are not exported to transformers/huggingface_hub.
    """
    hub_cache = os.environ.get("HF_HUB_CACHE")
    if hub_cache:
        base = Path(hub_cache)
    else:
        base = Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface")) / "hub"
    return base / f"models--{model_id.replace('/', '--')}"
