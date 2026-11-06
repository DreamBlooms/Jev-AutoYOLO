"""Visual-grounding provider selection: hosted Jev first, local VLM fallback."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from ..core.config import settings
from ..core.exceptions import InferenceError
from . import jev_service

logger = logging.getLogger(__name__)


def _local_fallback_available() -> bool:
    model_dir = Path(settings.resolved_model_dir)
    if not (model_dir / "config.json").is_file():
        return False
    try:
        return settings.resolved_device != "cpu"
    except Exception:
        return False


def _augment_with_sam3(
    image_path: str | Path,
    result: dict[str, Any],
    categories: list[str],
) -> dict[str, Any]:
    several = result.get("several_categories") or []
    if not several:
        return result

    from .sam3_client import segment_sam3

    added = 0
    for category in several:
        try:
            proposals = segment_sam3(
                image_path,
                category,
                segmentation=False,
                threshold=0.5,
                mask_threshold=0.5,
            )
        except Exception:
            logger.exception("SAM3 multi-instance fallback failed for %s", category)
            continue
        for proposal in proposals:
            box = dict(proposal)
            box["class_name"] = category
            box.pop("mask_polygon", None)
            box.setdefault("confidence", 1.0)
            result["boxes"].append(box)
            added += 1

    result["boxes"] = jev_service.dedupe_boxes(result["boxes"])
    if added:
        result["used_sam3"] = True
        result["provider"] = "jev+sam3"
    return result


def detect_with_local_vlm(
    image_path: str | Path,
    categories: list[str],
    extra_state: Any = None,
    extra_instructions: str = "",
    category_instructions: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Force the local LocateAnything model instead of Jev."""
    from .locate_anything import detect as local_detect

    result = local_detect(image_path, categories)
    result["provider"] = "vlm"
    result["model_name"] = "LocateAnything-3B"
    result["used_sam3"] = False
    return result


def detect_with_provider(
    image_path: str | Path,
    categories: list[str],
    extra_state: Any = None,
    extra_instructions: str = "",
    category_instructions: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Run Jev when configured, otherwise fall back to the local VLM."""
    if settings.jev_configured:
        try:
            result = jev_service.detect(
                image_path,
                categories,
                extra_state=extra_state,
                extra_instructions=extra_instructions,
                category_instructions=category_instructions,
            )
            if settings.resolved_jev_multi_instance == "sam3":
                result = _augment_with_sam3(image_path, result, categories)
            return result
        except jev_service.JevRequestError as exc:
            raise InferenceError(f"Jev request failed: {exc}") from exc
        except jev_service.JevNotConfiguredError:
            pass
        except jev_service.JevUnavailableError as exc:
            if not settings.jev_fallback_to_local:
                raise InferenceError(f"Jev unavailable: {exc}") from exc
            if not _local_fallback_available():
                raise InferenceError(
                    f"Jev unavailable ({exc}); local fallback is not available. "
                    "Configure TYPESAFE_API_KEY or download the local VLM with "
                    "--models=vlm."
                ) from exc
            logger.warning("Jev unavailable (%s); falling back to local VLM", exc)
    elif not settings.jev_fallback_to_local:
        raise InferenceError(
            "TYPESAFE_API_KEY not configured and JEV_FALLBACK_TO_LOCAL is disabled"
        )

    result = detect_with_local_vlm(
        image_path, categories, extra_state, extra_instructions, category_instructions
    )
    jev_service.mark_fallback()
    return result
