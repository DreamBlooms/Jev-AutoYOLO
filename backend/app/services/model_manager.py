"""Download and initialise local models from the web UI (ModelScope)."""

from __future__ import annotations

import contextlib
import json
import logging
import threading
from pathlib import Path
from typing import Any

from ..core.config import settings

logger = logging.getLogger(__name__)

KINDS = ("vlm", "sam2", "sam3")
_ACTIVE_STATES = ("downloading", "loading", "error")

_lock = threading.Lock()
_start_locks = {kind: threading.Lock() for kind in KINDS}
_run_lock = threading.Lock()
_states: dict[str, dict[str, Any]] = {
    kind: {"state": "unloaded", "stage": "", "progress": 0, "error": "", "source": ""}
    for kind in KINDS
}


def _paths_file() -> Path:
    return settings.resolved_modelscope_dir / "paths.json"


def _save_path(kind: str, path: Path) -> None:
    file = _paths_file()
    try:
        data = json.loads(file.read_text()) if file.exists() else {}
    except (OSError, json.JSONDecodeError):
        data = {}
    data[kind] = str(path)
    file.write_text(json.dumps(data, indent=2))


def _load_paths() -> dict[str, str]:
    file = _paths_file()
    try:
        data = json.loads(file.read_text())
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def restore_paths() -> None:
    """Restore model paths downloaded from the web UI after a restart."""
    paths = _load_paths()
    vlm = paths.get("vlm")
    if vlm and not settings.model_dir and (Path(vlm) / "config.json").is_file():
        settings.model_dir = vlm
    sam2 = paths.get("sam2")
    if sam2 and not settings.sam2_checkpoint_path and Path(sam2).is_file():
        settings.sam2_checkpoint_path = sam2
    sam3 = paths.get("sam3")
    if sam3 and not settings.sam3_model_path and Path(sam3).is_dir():
        settings.sam3_model_path = sam3


def _set(
    kind: str,
    *,
    state: str | None = None,
    stage: str | None = None,
    progress: int | None = None,
    error: str | None = None,
    source: str | None = None,
) -> None:
    with _lock:
        item = _states[kind]
        if state is not None:
            item["state"] = state
        if stage is not None:
            item["stage"] = stage
        if progress is not None:
            item["progress"] = max(0, min(100, progress))
        if error is not None:
            item["error"] = error
        if source is not None:
            item["source"] = source


def get_status(kind: str) -> dict[str, Any]:
    with _lock:
        return dict(_states[kind])


def get_all_status() -> dict[str, dict[str, Any]]:
    return {kind: get_status(kind) for kind in KINDS}


def reset(kind: str) -> None:
    if kind in _states:
        _set(kind, state="unloaded", stage="", progress=0, error="", source="")


def merge_status(kind: str, local_status: dict[str, Any]) -> dict[str, Any]:
    """Show download/initialise progress, otherwise the worker's own state."""
    managed = get_status(kind)
    if managed["state"] in _ACTIVE_STATES:
        return managed
    if managed["state"] == "loaded":
        return managed
    return local_status


def merge_sam3(health_status: dict[str, Any]) -> dict[str, Any]:
    managed = get_status("sam3")
    if managed["state"] in _ACTIVE_STATES or managed["state"] == "loaded":
        return {
            "loaded": managed["state"] == "loaded",
            "status": managed["state"],
            "stage": managed["stage"],
            "progress": managed["progress"],
            "error": managed["error"],
            "source": managed["source"],
        }
    return health_status


def start_download(kind: str) -> dict[str, Any]:
    if kind not in KINDS:
        raise ValueError(f"Unknown model kind: {kind}")

    with _start_locks[kind]:
        state = get_status(kind)["state"]
        if state in ("downloading", "loading", "loaded"):
            return get_status(kind)
        if not _run_lock.acquire(blocking=False):
            _set(
                kind,
                state="error",
                stage="",
                progress=0,
                error="Another model download or initialization is in progress. Try again.",
            )
            return get_status(kind)
        _set(kind, state="downloading", stage="starting", progress=1, error="")
        thread = threading.Thread(
            target=_run_download_guarded,
            args=(kind,),
            name=f"model-download-{kind}",
            daemon=True,
        )
        thread.start()
        return get_status(kind)


class _ProgressTracker:
    """Aggregate ModelScope per-file progress into one percentage."""

    def __init__(self, kind: str, start: int, end: int) -> None:
        self.kind = kind
        self.start = start
        self.end = end
        self.files: dict[str, tuple[int, int]] = {}
        self.lock = threading.Lock()

    def callback_class(self):
        from modelscope.hub.callback import ProgressCallback

        tracker = self

        class Callback(ProgressCallback):
            def __init__(self, filename: str, file_size: int):
                super().__init__(filename, file_size)
                with tracker.lock:
                    tracker.files[filename] = (max(0, file_size), 0)

            def update(self, size: int) -> None:
                with tracker.lock:
                    file_size = tracker.files.get(self.filename, (self.file_size, 0))[0]
                    tracker.files[self.filename] = (file_size, max(0, size))
                    done = sum(min(n, total) for total, n in tracker.files.values())
                    total = max(sum(total for total, _ in tracker.files.values()), done, 1)
                    pct = tracker.start + (tracker.end - tracker.start) * done / total
                _set(tracker.kind, state="downloading", stage="download", progress=int(pct))

            def end(self) -> None:
                with tracker.lock:
                    file_size = tracker.files.get(self.filename, (self.file_size, 0))[0]
                    tracker.files[self.filename] = (file_size, file_size)

        return Callback


def _dir_size(directory: Path) -> int:
    try:
        return sum(path.stat().st_size for path in directory.rglob("*") if path.is_file())
    except OSError:
        return 0


def _repo_size_hf(model_id: str) -> int:
    try:
        from huggingface_hub import HfApi

        info = HfApi().model_info(model_id, files_metadata=True)
        return sum(getattr(item, "size", 0) or 0 for item in info.siblings or [])
    except Exception:
        return 0


def _poll_dir_progress(
    kind: str, directory: Path, total: int, start: int, end: int, stop: threading.Event
) -> None:
    while not stop.wait(0.5):
        done = _dir_size(directory)
        if total > 0:
            pct = int(start + (end - start) * min(done, total) / total)
            _set(kind, state="downloading", stage="download", progress=min(pct, end - 1))
        else:
            _set(kind, state="downloading", stage="download", progress=max(start, 5))


def _download_modelscope(
    kind: str,
    model_id: str,
    local_dir: Path,
    start: int = 5,
    end: int = 60,
    ignore_patterns: str | list[str] | None = None,
) -> Path:
    from modelscope import snapshot_download

    local_dir.mkdir(parents=True, exist_ok=True)
    tracker = _ProgressTracker(kind, start, end)
    kwargs = {"progress_callbacks": [tracker.callback_class()]}
    if ignore_patterns:
        kwargs["ignore_file_pattern"] = ignore_patterns
    path = snapshot_download(model_id, local_dir=str(local_dir), **kwargs)
    _set(kind, state="downloading", stage="download", progress=end)
    return Path(path)


def _download_huggingface(
    kind: str, model_id: str, local_dir: Path, start: int = 5, end: int = 60
) -> Path:
    from huggingface_hub import snapshot_download

    local_dir.mkdir(parents=True, exist_ok=True)
    total = _repo_size_hf(model_id)
    stop = threading.Event()
    poller = threading.Thread(
        target=_poll_dir_progress,
        args=(kind, local_dir, total, start, end, stop),
        name=f"model-progress-{kind}",
        daemon=True,
    )
    poller.start()
    try:
        path = snapshot_download(model_id, local_dir=str(local_dir))
    finally:
        stop.set()
        poller.join(timeout=2)
    _set(kind, state="downloading", stage="download", progress=end)
    return Path(path)


def _find_checkpoint(directory: Path, preferred: str) -> Path | None:
    preferred_path = directory / preferred
    if preferred_path.is_file():
        return preferred_path
    candidates = sorted(directory.rglob("*.pt"), key=lambda p: p.stat().st_size, reverse=True)
    return candidates[0] if candidates else None


def _check_vlm_transformers() -> None:
    source = f"{settings.model_id} {settings.vlm_modelscope_id}".lower()
    if "locateanything" not in source:
        return
    try:
        import transformers

        major = int(transformers.__version__.split(".")[0])
    except Exception:
        return
    if major >= 5:
        raise RuntimeError(
            "LocateAnything-3B requires transformers==4.57.1 in the backend "
            "environment. SAM3 needs transformers>=5, so install SAM3 in the "
            "separate backend/sam3-venv instead of upgrading the main venv."
        )


def _run_download_guarded(kind: str) -> None:
    try:
        _run_download(kind)
    finally:
        _run_lock.release()


def _run_download(kind: str) -> None:
    try:
        if kind == "vlm":
            _download_vlm()
        elif kind == "sam2":
            _download_sam2()
        elif kind == "sam3":
            _download_sam3()
    except Exception as exc:
        logger.exception("Model download failed: %s", kind)
        _set(kind, state="error", stage="", progress=0, error=str(exc))


def _has_weight_file(directory: Path) -> bool:
    for pattern in ("*.safetensors", "*.bin", "*.pt"):
        if any(
            path.is_file() and path.stat().st_size > 1024 * 1024 for path in directory.glob(pattern)
        ):
            return True
    index = directory / "model.safetensors.index.json"
    if index.is_file():
        try:
            data = json.loads(index.read_text())
            weight_map = data.get("weight_map", {})
            return bool(weight_map) and all(
                (directory / name).is_file() for name in set(weight_map.values())
            )
        except (OSError, json.JSONDecodeError, AttributeError):
            return False
    return False


def _vlm_complete(directory: Path) -> bool:
    return (directory / "config.json").is_file() and _has_weight_file(directory)


def _sam2_checkpoint(directory: Path) -> Path | None:
    checkpoint = _find_checkpoint(directory, "sam2.1_hiera_base_plus.pt")
    return checkpoint if checkpoint and checkpoint.stat().st_size > 1024 * 1024 else None


def _sam3_complete(directory: Path) -> bool:
    return (directory / "config.json").is_file() and (
        (directory / "model.safetensors").is_file() or (directory / "sam3.pt").is_file()
    )


def _cleanup_ignored(directory: Path, names: tuple[str, ...]) -> None:
    for name in names:
        for path in directory.rglob(name):
            if path.is_file():
                with contextlib.suppress(OSError):
                    path.unlink()


def _download_vlm() -> None:
    _set("vlm", state="downloading", stage="download", progress=5)
    path: Path | None = None
    source = "cached"

    existing = Path(settings.resolved_model_dir)
    if _vlm_complete(existing):
        path = existing
    elif _vlm_complete(settings.resolved_modelscope_dir / "vlm"):
        path = settings.resolved_modelscope_dir / "vlm"

    if path is None:
        source = "huggingface"
        if settings.vlm_modelscope_id:
            try:
                _set("vlm", progress=10, source="modelscope")
                path = _download_modelscope(
                    "vlm",
                    settings.vlm_modelscope_id,
                    settings.resolved_modelscope_dir / "vlm",
                    start=5,
                    end=60,
                )
                source = "modelscope"
            except Exception as exc:
                logger.warning(
                    "ModelScope VLM download failed (%s); falling back to HuggingFace", exc
                )

        if path is None:
            _set("vlm", progress=10, source="huggingface")
            path = _download_huggingface(
                "vlm", settings.model_id, Path(settings.resolved_model_dir), start=5, end=60
            )

    _check_vlm_transformers()
    _set("vlm", state="loading", stage="init", progress=65, source=source)
    from .locate_anything import _get_worker, is_model_loaded, unload_model

    if is_model_loaded():
        unload_model()
    settings.model_dir = str(path)
    _save_path("vlm", path)
    _get_worker()
    _set("vlm", state="loaded", stage="", progress=100, error="", source=source)


def _download_sam2() -> None:
    _set("sam2", state="downloading", stage="download", progress=5)
    checkpoint: Path | None = None
    source = "cached"

    configured = Path(settings.sam2_checkpoint_path) if settings.sam2_checkpoint_path else None
    if configured and configured.is_file() and configured.stat().st_size > 1024 * 1024:
        checkpoint = configured
    if checkpoint is None:
        checkpoint = _sam2_checkpoint(settings.resolved_modelscope_dir / "sam2")
    if checkpoint is None:
        source = "huggingface"
        try:
            _set("sam2", progress=10, source="modelscope")
            path = _download_modelscope(
                "sam2",
                settings.sam2_modelscope_id,
                settings.resolved_modelscope_dir / "sam2",
                start=5,
                end=60,
                ignore_patterns="model.safetensors",
            )
            checkpoint = _sam2_checkpoint(path)
            if checkpoint:
                source = "modelscope"
        except Exception as exc:
            logger.warning("ModelScope SAM2 download failed (%s); falling back to HuggingFace", exc)
        _cleanup_ignored(settings.resolved_modelscope_dir / "sam2", ("model.safetensors",))

    _set("sam2", state="loading", stage="init", progress=65, source=source)
    from .sam2_service import _get_sam_worker, is_sam_loaded, unload_sam

    if is_sam_loaded():
        unload_sam()
    settings.sam2_checkpoint_path = str(checkpoint) if checkpoint else ""
    if checkpoint:
        _save_path("sam2", checkpoint)
    _get_sam_worker()
    _set("sam2", state="loaded", stage="", progress=100, error="", source=source)


def _download_sam3() -> None:
    _set("sam3", state="downloading", stage="download", progress=5)
    path: Path | None = None
    source = "cached"

    configured = Path(settings.sam3_model_path) if settings.sam3_model_path else None
    if configured and _sam3_complete(configured):
        path = configured
    elif _sam3_complete(settings.resolved_modelscope_dir / "sam3"):
        path = settings.resolved_modelscope_dir / "sam3"

    if path is None:
        source = "huggingface"
        try:
            _set("sam3", progress=10, source="modelscope")
            path = _download_modelscope(
                "sam3",
                settings.sam3_modelscope_id,
                settings.resolved_modelscope_dir / "sam3",
                start=5,
                end=60,
                ignore_patterns="sam3.pt",
            )
            source = "modelscope"
        except Exception as exc:
            logger.warning("ModelScope SAM3 download failed (%s); trying HuggingFace cache", exc)
        _cleanup_ignored(settings.resolved_modelscope_dir / "sam3", ("sam3.pt",))

    _set("sam3", state="loading", stage="init", progress=65, source=source)
    from .sam3_client import is_sam3_running, start_sam3_server, stop_sam3_server

    if path is not None:
        settings.sam3_model_path = str(path)
        _save_path("sam3", path)
    if is_sam3_running():
        stop_sam3_server()
    start_sam3_server()
    _set("sam3", state="loaded", stage="", progress=100, error="", source=source)
