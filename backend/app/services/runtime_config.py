"""Runtime configuration and inference-device switching."""

from __future__ import annotations

import logging

import torch

from ..core.config import settings
from ..core.gpu_memory import gpu_name, is_rocm

logger = logging.getLogger(__name__)

VALID_DEVICES = ("auto", "cpu", "cuda", "mps")


def available_devices() -> list[str]:
    devices = ["cpu"]
    if torch.cuda.is_available():
        devices.append("cuda")
    if torch.backends.mps.is_available():
        devices.append("mps")
    return devices


def device_preference() -> str:
    return settings.device.strip().lower() or "auto"


def get_runtime_config() -> dict:
    return {
        "annotationOnly": settings.annotation_only,
        "trainingEnabled": not settings.annotation_only,
        "validationEnabled": True,
        "samEnabled": True,
        "device": settings.resolved_device,
        "devicePreference": device_preference(),
        "availableDevices": available_devices(),
        "gpuAvailable": any(device != "cpu" for device in available_devices()),
        "rocm": is_rocm(),
        "gpuName": gpu_name(),
        "jevProvider": settings.resolved_jev_provider,
        "jevConfigured": settings.jev_configured,
        "jevModel": settings.resolved_jev_model,
    }


def set_inference_device(choice: str) -> dict:
    """Switch the local inference device and release models bound to the old one."""
    requested = (choice or "").strip().lower()
    if requested not in VALID_DEVICES:
        raise ValueError(f"Unsupported device: {choice}. Choose one of {VALID_DEVICES}")

    devices = available_devices()
    if requested == "cuda" and "cuda" not in devices:
        raise ValueError("CUDA is not available on this device")
    if requested == "mps" and "mps" not in devices:
        raise ValueError("MPS is not available on this device")

    from .locate_anything import is_model_loaded, unload_model
    from .sam2_service import is_sam_loaded, unload_sam
    from .sam3_client import is_sam3_running, stop_sam3_server
    from .trainer import _model_cache

    if is_model_loaded():
        unload_model()
    if is_sam_loaded():
        unload_sam()
    if is_sam3_running():
        stop_sam3_server()

    _model_cache.clear()
    from . import model_manager

    for kind in ("vlm", "sam2", "sam3"):
        model_manager.reset(kind)
    import gc

    import torch

    from ..core.gpu_memory import get_memory_manager, is_rocm

    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        if not is_rocm():
            torch.cuda.ipc_collect()

    settings.device = "" if requested == "auto" else requested
    get_memory_manager.cache_clear()
    logger.info("Inference device set to %s (resolved=%s)", requested, settings.resolved_device)
    return get_runtime_config()
