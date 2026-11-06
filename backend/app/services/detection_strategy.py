"""Detection strategy pattern — Jev, Jev+SAM2, or SAM3."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod

from PIL import Image

logger = logging.getLogger(__name__)


class DetectionResult:
    """Uniform output regardless of which model produced it."""

    def __init__(
        self,
        boxes: list[dict],
        img_w: int,
        img_h: int,
        raw_text: str = "",
        polygons: list | None = None,
        model_name: str = "",
        provider: str = "vlm",
        used_sam3: bool = False,
    ):
        self.boxes = boxes
        self.img_w = img_w
        self.img_h = img_h
        self.raw_text = raw_text
        self.polygons = polygons or []
        self.model_name = model_name
        self.provider = provider
        self.used_sam3 = used_sam3


class DetectionStrategy(ABC):
    @abstractmethod
    def detect(self, filepath: str, categories: list[str], **kwargs) -> DetectionResult:
        """Return unified DetectionResult."""


def _normalise_result(result: dict) -> tuple[list[dict], int, int]:
    """Scale boxes from detection space back to original image space."""
    boxes = result["boxes"]
    detect_w, detect_h = result["img_w"], result["img_h"]
    orig_w = result.get("orig_w", detect_w)
    orig_h = result.get("orig_h", detect_h)

    scale_x = orig_w / detect_w if detect_w != orig_w else 1.0
    scale_y = orig_h / detect_h if detect_h != orig_h else 1.0
    if scale_x != 1.0 or scale_y != 1.0:
        boxes = [
            {
                **box,
                "x1": int(box["x1"] * scale_x),
                "y1": int(box["y1"] * scale_y),
                "x2": int(box["x2"] * scale_x),
                "y2": int(box["y2"] * scale_y),
            }
            for box in boxes
        ]
    return boxes, orig_w, orig_h


def _result_metadata(result: dict) -> dict:
    return {
        "model_name": result.get("model_name", ""),
        "provider": result.get("provider", "vlm"),
        "used_sam3": bool(result.get("used_sam3", False)),
    }


class JevDetection(DetectionStrategy):
    """Jev (or local fallback) only, no segmentation."""

    def __init__(self, vlm_detect_fn):
        self._vlm_detect = vlm_detect_fn

    def detect(self, filepath: str, categories: list[str], **kwargs) -> DetectionResult:
        result = self._vlm_detect(
            filepath,
            categories,
            extra_state=kwargs.get("extra_state"),
            extra_instructions=kwargs.get("extra_instructions", ""),
            category_instructions=kwargs.get("category_instructions"),
        )
        boxes, orig_w, orig_h = _normalise_result(result)
        return DetectionResult(
            boxes=boxes,
            img_w=orig_w,
            img_h=orig_h,
            raw_text=result.get("raw_text", ""),
            **_result_metadata(result),
        )


class JevWithSAM2(DetectionStrategy):
    """Jev (or local fallback) detection + SAM2 mask refinement."""

    def __init__(self, vlm_detect_fn, sam2_segment_fn):
        self._vlm_detect = vlm_detect_fn
        self._sam2_segment = sam2_segment_fn

    def detect(self, filepath: str, categories: list[str], **kwargs) -> DetectionResult:
        score_threshold = kwargs.get("sam2_score_threshold", 0.0)

        result = self._vlm_detect(
            filepath,
            categories,
            extra_state=kwargs.get("extra_state"),
            extra_instructions=kwargs.get("extra_instructions", ""),
            category_instructions=kwargs.get("category_instructions"),
        )
        boxes, orig_w, orig_h = _normalise_result(result)

        polygons = []
        if boxes:
            try:
                img = Image.open(filepath).convert("RGB")
                try:
                    polygons = self._sam2_segment(img, boxes, score_threshold=score_threshold)
                finally:
                    img.close()
            except Exception:
                logger.exception("SAM2 segmentation failed, falling back to bbox-only")

        return DetectionResult(
            boxes=boxes,
            img_w=orig_w,
            img_h=orig_h,
            raw_text=result.get("raw_text", ""),
            polygons=polygons,
            **_result_metadata(result),
        )


class SAM3Detection(DetectionStrategy):
    """SAM3 via standalone HTTP server — detection + segmentation in one call."""

    def __init__(self, sam3_segment_fn):
        self._sam3_segment = sam3_segment_fn

    def detect(self, filepath: str, categories: list[str], **kwargs) -> DetectionResult:
        text = " ".join(categories) if categories else ""
        use_seg = kwargs.get("use_sam3_seg", True)
        threshold = kwargs.get("sam3_threshold", 0.5)
        mask_threshold = kwargs.get("sam3_mask_threshold", 0.5)

        sam3_boxes = self._sam3_segment(
            filepath,
            text,
            segmentation=use_seg,
            threshold=threshold,
            mask_threshold=mask_threshold,
        )

        img = Image.open(filepath)
        w, h = img.size
        img.close()

        polygons = [b.pop("mask_polygon", None) for b in sam3_boxes]

        return DetectionResult(
            boxes=sam3_boxes,
            img_w=w,
            img_h=h,
            polygons=polygons,
            model_name="SAM3",
            provider="sam3",
        )


def create_strategy(
    use_sam2: bool = False,
    use_sam3: bool = False,
    use_vlm: bool = False,
) -> DetectionStrategy:
    if use_sam3:
        from .sam3_client import segment_sam3

        return SAM3Detection(segment_sam3)

    if use_vlm:
        from .vlm_provider import detect_with_local_vlm

        detect_fn = detect_with_local_vlm
    else:
        from .vlm_provider import detect_with_provider

        detect_fn = detect_with_provider

    if use_sam2:
        from .sam2_service import segment_image

        return JevWithSAM2(detect_fn, segment_image)

    return JevDetection(detect_fn)


# Backwards-compatible aliases for older imports/tests.
VLMDetection = JevDetection
VLMWithSAM2 = JevWithSAM2
