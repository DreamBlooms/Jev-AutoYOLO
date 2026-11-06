"""Jev (TypeSafe System One) visual grounding service.

Jev is a hosted API. This module prepares images, builds Box/Noul/Choice
questions, parses normalised answers back into pixels, and performs optional
adaptive tiling for multi-instance scenes.
"""

from __future__ import annotations

import base64
import enum
import json
import logging
import math
import threading
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

from ..core.config import settings
from ..core.exceptions import InferenceError
from .box_filter import iou, overlap_coefficient

logger = logging.getLogger(__name__)

JEV_MIN_SIDE = 280
JEV_MAX_SIDE = 1568
JEV_MAX_AREA = JEV_MAX_SIDE * JEV_MAX_SIDE
JEV_MAX_FILE_BYTES = 16 * 1024 * 1024
IMAGE_HEADERS = {"TypeSafe-Danger-Zone-Images": "true"}


class JevError(Exception):
    """Base class for Jev failures."""


class JevNotConfiguredError(JevError):
    """No TypeSafe API key is configured."""


class JevRequestError(JevError):
    """The request itself is invalid (4xx). Do not fall back automatically."""


class JevUnavailableError(JevError):
    """Transient or transport failure. A local fallback may be attempted."""


class JevState(enum.StrEnum):
    UNLOADED = "unloaded"
    LOADED = "loaded"
    ERROR = "error"


_state_lock = threading.Lock()
_jev_state: dict[str, Any] = {
    "state": JevState.LOADED if settings.jev_configured else JevState.UNLOADED,
    "mode": "remote" if settings.jev_configured else "unconfigured",
    "model": settings.resolved_jev_model,
    "stage": "",
    "progress": 100 if settings.jev_configured else 0,
    "error": "" if settings.jev_configured else "TYPESAFE_API_KEY not configured",
}


def _set_state(
    *,
    state: JevState | None = None,
    mode: str | None = None,
    error: str | None = None,
) -> None:
    with _state_lock:
        if state is not None:
            _jev_state["state"] = state
        if mode is not None:
            _jev_state["mode"] = mode
        if error is not None:
            _jev_state["error"] = error
        _jev_state["model"] = settings.resolved_jev_model
        if _jev_state["state"] == JevState.LOADED:
            _jev_state["progress"] = 100
            _jev_state["stage"] = ""


def get_status() -> dict[str, Any]:
    if not settings.jev_configured:
        return {
            "state": JevState.UNLOADED,
            "mode": "unconfigured",
            "model": settings.resolved_jev_model,
            "stage": "",
            "progress": 0,
            "error": "TYPESAFE_API_KEY not configured",
        }
    with _state_lock:
        status = dict(_jev_state)
    if status["state"] == JevState.UNLOADED:
        status["state"] = JevState.LOADED
        status["mode"] = "remote"
        status["progress"] = 100
        status["error"] = ""
    return status


def mark_fallback() -> None:
    """Record that the last successful detection used the local fallback."""
    _set_state(state=JevState.LOADED, mode="local-fallback")


def _answer_to_dict(answer: Any) -> dict[str, Any]:
    if answer is None:
        return {}
    if isinstance(answer, dict):
        return answer
    if hasattr(answer, "model_dump"):
        return answer.model_dump(mode="json")
    return {}


def _response_to_dict(response: Any) -> dict[str, Any]:
    if isinstance(response, dict):
        return response
    if hasattr(response, "model_dump"):
        return response.model_dump(mode="json")
    raise JevUnavailableError("Unexpected TypeSafe response type")


def _state_with_extra(reference: str, extra_state: Any = None) -> dict[str, Any]:
    state: dict[str, Any] = {"image": reference}
    if isinstance(extra_state, dict):
        state.update({key: value for key, value in extra_state.items() if key != "image"})
    elif extra_state is not None:
        state["context"] = extra_state
    return state


class JevTransport:
    """Thin wrapper around the TypeSafe SDK, injectable for tests."""

    provider = "typesafe"

    def __init__(self, api_key: str, base_url: str = "", timeout: float = 60.0) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = timeout
        self._local = threading.local()

    def _client(self) -> Any:
        try:
            from typesafe_sdk import TypeSafeClient
        except ImportError as exc:  # pragma: no cover - depends on install
            raise JevUnavailableError(
                "typesafe-sdk is not installed. Run: pip install 'typesafe-sdk[pil]'"
            ) from exc

        client = getattr(self._local, "client", None)
        if client is None:
            kwargs: dict[str, Any] = {"api_key": self.api_key, "timeout": self.timeout}
            if self.base_url:
                kwargs["base_url"] = self.base_url
            client = TypeSafeClient(**kwargs)
            self._local.client = client
        return client

    def ask(
        self,
        *,
        model: str,
        questions: dict[str, Any],
        headers: dict[str, str],
        image: Image.Image,
        extra_state: Any = None,
    ) -> dict[str, Any]:
        client = self._client()
        reference = f"image-{uuid.uuid4().hex}"
        try:
            response = client.system_one(
                model=model,
                state=_state_with_extra(reference, extra_state),
                questions=questions,
                assets={reference: _image_asset(image)},
                extra_headers=headers,
            )
        except Exception as exc:
            _raise_transport_error(exc)
        return _response_to_dict(response)


class OpenRouterTransport:
    """TypeSafe Jev through OpenRouter's /api/alpha/decisions endpoint."""

    provider = "openrouter"

    def __init__(
        self, api_key: str, base_url: str = "https://openrouter.ai", timeout: float = 60.0
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def ask(
        self,
        *,
        model: str,
        questions: dict[str, Any],
        headers: dict[str, str],
        image: Image.Image,
        extra_state: Any = None,
    ) -> dict[str, Any]:
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=90, optimize=True)
        reference = f"image-{uuid.uuid4().hex}"
        body = {
            "model": model,
            "state": _state_with_extra(reference, extra_state),
            "assets": {
                reference: {
                    "type": "image",
                    "format": "jpg",
                    "data_base64": base64.b64encode(buffer.getvalue()).decode("ascii"),
                }
            },
            "questions": questions,
        }
        request = urllib.request.Request(
            f"{self.base_url}/api/alpha/decisions",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as exc:
            message = _http_error_message(exc)
            if exc.code in (400, 404, 413, 422):
                raise JevRequestError(message) from exc
            raise JevUnavailableError(message) from exc
        except Exception as exc:
            raise JevUnavailableError(str(exc)) from exc


def _http_error_message(exc: urllib.error.HTTPError) -> str:
    try:
        payload = json.loads(exc.read())
        error = payload.get("error") or {}
        if isinstance(error, dict):
            return f"{exc.code} {error.get('message', exc.reason)}"
        return f"{exc.code} {error}"
    except Exception:
        return f"{exc.code} {exc.reason}"


def _raise_transport_error(exc: Exception) -> None:
    status_code = getattr(exc, "status_code", None)
    if not isinstance(status_code, int):
        status_code = getattr(exc, "status", None)
    message = str(exc)
    if status_code in (400, 404, 413, 422):
        raise JevRequestError(message) from exc
    raise JevUnavailableError(message) from exc


_transport: JevTransport | OpenRouterTransport | None = None
_transport_lock = threading.Lock()


def get_transport() -> JevTransport | OpenRouterTransport:
    global _transport
    with _transport_lock:
        if (
            _transport is None
            or _transport.provider != settings.resolved_jev_provider
            or _transport.api_key != settings.resolved_jev_api_key
            or _transport.base_url != settings.resolved_jev_base_url
            or _transport.timeout != settings.jev_timeout_seconds
        ):
            transport_class = (
                OpenRouterTransport
                if settings.resolved_jev_provider == "openrouter"
                else JevTransport
            )
            _transport = transport_class(
                settings.resolved_jev_api_key,
                settings.resolved_jev_base_url,
                settings.jev_timeout_seconds,
            )
        return _transport


@dataclass(frozen=True)
class ImageTransform:
    """Maps prepared-image pixels back to the original image."""

    scale_x: float
    scale_y: float
    pad_left: int
    pad_top: int
    original_width: int
    original_height: int
    prepared_width: int
    prepared_height: int

    def point_to_original(self, x: float, y: float) -> tuple[float, float]:
        return (
            (x - self.pad_left) / self.scale_x,
            (y - self.pad_top) / self.scale_y,
        )


def prepare_for_jev(image: Image.Image) -> tuple[Image.Image, ImageTransform]:
    """Resize/pad an image into Jev's accepted size range."""
    transposed = ImageOps.exif_transpose(image)
    original = transposed.convert("RGB")
    if original is not transposed:
        transposed.close()
    width, height = original.size
    scale = min(1.0, JEV_MAX_SIDE / max(width, height))
    if width * height * scale * scale > JEV_MAX_AREA:
        scale = min(scale, math.sqrt(JEV_MAX_AREA / (width * height)))
    scale = max(scale, 1e-9)

    scaled_w = max(1, round(width * scale))
    scaled_h = max(1, round(height * scale))
    if (scaled_w, scaled_h) != (width, height):
        resized = original.resize((scaled_w, scaled_h), Image.LANCZOS)
        original.close()
        work = resized
    else:
        work = original

    target_w = max(scaled_w, JEV_MIN_SIDE)
    target_h = max(scaled_h, JEV_MIN_SIDE)
    target_w = min(target_w, JEV_MAX_SIDE)
    target_h = min(target_h, JEV_MAX_SIDE)
    pad_left = (target_w - scaled_w) // 2
    pad_top = (target_h - scaled_h) // 2

    if (target_w, target_h) != (scaled_w, scaled_h):
        prepared = Image.new("RGB", (target_w, target_h), (0, 0, 0))
        prepared.paste(work, (pad_left, pad_top))
        work.close()
    else:
        prepared = work

    if max(prepared.size) > JEV_MAX_SIDE or prepared.size[0] * prepared.size[1] > JEV_MAX_AREA:
        prepared.close()
        raise InferenceError("Image could not be fitted into Jev's size limits")

    transform = ImageTransform(
        scale_x=scaled_w / width,
        scale_y=scaled_h / height,
        pad_left=pad_left,
        pad_top=pad_top,
        original_width=width,
        original_height=height,
        prepared_width=prepared.size[0],
        prepared_height=prepared.size[1],
    )
    return prepared, transform


def _encode_checked(image: Image.Image) -> None:
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=90, optimize=True)
    if buffer.tell() > JEV_MAX_FILE_BYTES:
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=70, optimize=True)
    if buffer.tell() > JEV_MAX_FILE_BYTES:
        raise InferenceError("Prepared image exceeds Jev's 16 MiB limit")


def _image_asset(image: Image.Image) -> Any:
    try:
        from typesafe_sdk import Image as TypeSafeImage
    except ImportError as exc:  # pragma: no cover - depends on install
        raise JevUnavailableError(
            "typesafe-sdk is not installed. Run: pip install 'typesafe-sdk[pil]'"
        ) from exc
    return TypeSafeImage.from_pil(image)


@dataclass(frozen=True)
class CategoryQuestions:
    category: str
    present_key: str
    box_key: str
    count_key: str | None


def _category_questions(
    categories: list[str],
    *,
    include_count: bool,
    prefix: str = "q",
    extra_instructions: str = "",
    category_instructions: dict[str, str] | None = None,
) -> tuple[dict[str, Any], list[CategoryQuestions]]:
    questions: dict[str, Any] = {}
    metas: list[CategoryQuestions] = []
    for index, category in enumerate(categories):
        per_category = (category_instructions or {}).get(category, "").strip()
        extra = "\n\n".join(part for part in (extra_instructions.strip(), per_category) if part)
        suffix = f"\n\nAdditional instruction: {extra}" if extra else ""
        present_key = f"{prefix}{index}_present"
        box_key = f"{prefix}{index}_box"
        count_key = f"{prefix}{index}_count" if include_count else None
        questions[present_key] = {
            "type": "noul",
            "instructions": f"Is at least one {category} visible in `image`?{suffix}",
        }
        questions[box_key] = {
            "type": "box",
            "instructions": f"the most prominent {category} in `image`{suffix}",
        }
        if count_key:
            questions[count_key] = {
                "type": "choice",
                "instructions": f"How many instances of {category} are visible in `image`?{suffix}",
                "criteria": {
                    "none": f"No {category} at all.",
                    "one": f"Exactly one {category}.",
                    "several": f"Two or more instances of {category}.",
                },
            }
        metas.append(
            CategoryQuestions(
                category=category,
                present_key=present_key,
                box_key=box_key,
                count_key=count_key,
            )
        )
    return questions, metas


def _ask(
    prepared: Image.Image,
    questions: dict[str, Any],
    transport: JevTransport | OpenRouterTransport | None,
    extra_state: Any = None,
) -> dict[str, Any]:
    client = transport or get_transport()
    try:
        payload = client.ask(
            model=settings.resolved_jev_model,
            questions=questions,
            headers=dict(IMAGE_HEADERS),
            image=prepared,
            extra_state=extra_state,
        )
    except JevRequestError as exc:
        _set_state(state=JevState.ERROR, mode="remote", error=str(exc))
        raise
    except JevUnavailableError as exc:
        _set_state(state=JevState.ERROR, mode="unavailable", error=str(exc))
        raise
    except Exception as exc:  # pragma: no cover - defensive
        _set_state(state=JevState.ERROR, mode="remote", error=str(exc))
        raise JevUnavailableError(str(exc)) from exc

    _set_state(state=JevState.LOADED, mode="remote", error="")
    usage = payload.get("usage") or {}
    logger.info(
        "Jev answered %s (input=%s, output=%s)",
        payload.get("model", settings.resolved_jev_model),
        usage.get("input_tokens"),
        usage.get("output_tokens"),
    )
    return payload


def _clamp_box(
    edges: dict[str, Any],
    transform: ImageTransform,
) -> tuple[float, float, float, float] | None:
    try:
        left = float(edges["left"]) * transform.prepared_width
        right = float(edges["right"]) * transform.prepared_width
        top = float(edges["top"]) * transform.prepared_height
        bottom = float(edges["bottom"]) * transform.prepared_height
    except (KeyError, TypeError, ValueError):
        return None

    x1, y1 = transform.point_to_original(left, top)
    x2, y2 = transform.point_to_original(right, bottom)
    x1, x2 = sorted((max(0.0, x1), max(0.0, x2)))
    y1, y2 = sorted((max(0.0, y1), max(0.0, y2)))
    x1 = min(x1, transform.original_width)
    x2 = min(x2, transform.original_width)
    y1 = min(y1, transform.original_height)
    y2 = min(y2, transform.original_height)
    if x2 - x1 < 1 or y2 - y1 < 1:
        return None
    return x1, y1, x2, y2


def _parse_category(
    answers: dict[str, Any],
    meta: CategoryQuestions,
    transform: ImageTransform,
) -> tuple[dict[str, Any] | None, str | None]:
    present = _answer_to_dict(answers.get(meta.present_key))
    presence = float(present.get("noul") or 0.0)
    count_answer = _answer_to_dict(answers.get(meta.count_key)) if meta.count_key else {}
    count = count_answer.get("choice")

    if presence < settings.jev_present_threshold:
        return None, count

    box_answer = _answer_to_dict(answers.get(meta.box_key))
    edges = box_answer.get("box")
    if not isinstance(edges, dict):
        return None, count

    box = _clamp_box(edges, transform)
    if box is None:
        return None, count

    confidence = box_answer.get("confidence")
    try:
        confidence = presence if confidence is None else float(confidence)
    except (TypeError, ValueError):
        confidence = presence
    if confidence < settings.jev_box_confidence_threshold:
        return None, count

    x1, y1, x2, y2 = box
    return {
        "class_name": meta.category,
        "x1": int(round(x1)),
        "y1": int(round(y1)),
        "x2": int(round(x2)),
        "y2": int(round(y2)),
        "confidence": max(0.0, min(1.0, confidence)),
        "presence": max(0.0, min(1.0, presence)),
    }, count


@dataclass(frozen=True)
class Tile:
    x0: int
    y0: int
    x1: int
    y1: int


def _make_tiles(width: int, height: int, max_tiles: int, overlap: float) -> list[Tile]:
    if max_tiles < 2:
        return []
    cols = min(max_tiles, max(2, math.ceil(math.sqrt(max_tiles))))
    rows = max(1, math.ceil(max_tiles / cols))
    tile_w = width / cols
    tile_h = height / rows
    overlap = max(0.0, min(0.5, overlap))

    tiles: list[Tile] = []
    for row in range(rows):
        for col in range(cols):
            x0 = max(0, int(round(col * tile_w - tile_w * overlap / 2)))
            x1 = min(width, int(round((col + 1) * tile_w + tile_w * overlap / 2)))
            y0 = max(0, int(round(row * tile_h - tile_h * overlap / 2)))
            y1 = min(height, int(round((row + 1) * tile_h + tile_h * overlap / 2)))
            if x1 - x0 >= 2 and y1 - y0 >= 2:
                tiles.append(Tile(x0=x0, y0=y0, x1=x1, y1=y1))
    return tiles


def _tile_boxes(
    prepared: Image.Image,
    transform: ImageTransform,
    categories: list[str],
    transport: JevTransport | OpenRouterTransport | None,
    extra_state: Any = None,
    extra_instructions: str = "",
    category_instructions: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    tiles = _make_tiles(
        prepared.size[0],
        prepared.size[1],
        settings.jev_max_tiles,
        settings.jev_tile_overlap,
    )
    if not tiles:
        return []

    def run(tile: Tile) -> list[dict[str, Any]]:
        crop = prepared.crop((tile.x0, tile.y0, tile.x1, tile.y1))
        try:
            tile_prepared, tile_transform = prepare_for_jev(crop)
            try:
                _encode_checked(tile_prepared)
                questions, metas = _category_questions(
                    categories,
                    include_count=False,
                    prefix="t",
                    extra_instructions=extra_instructions,
                    category_instructions=category_instructions,
                )
                payload = _ask(tile_prepared, questions, transport, extra_state=extra_state)
                answers = payload.get("answers") or {}
                found: list[dict[str, Any]] = []
                for meta in metas:
                    box, _ = _parse_category(answers, meta, tile_transform)
                    if box is None:
                        continue
                    px1, py1 = transform.point_to_original(tile.x0 + box["x1"], tile.y0 + box["y1"])
                    px2, py2 = transform.point_to_original(tile.x0 + box["x2"], tile.y0 + box["y2"])
                    found.append(
                        {
                            "class_name": box["class_name"],
                            "x1": int(round(px1)),
                            "y1": int(round(py1)),
                            "x2": int(round(px2)),
                            "y2": int(round(py2)),
                            "confidence": box["confidence"],
                            "presence": box["presence"],
                            "source": "tile",
                        }
                    )
                return found
            finally:
                tile_prepared.close()
        finally:
            crop.close()

    workers = max(1, min(settings.jev_max_concurrency, len(tiles)))
    if workers == 1:
        results = [run(tile) for tile in tiles]
    else:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            results = list(pool.map(run, tiles))
    return [box for result in results for box in result]


def _area(box: dict[str, Any]) -> int:
    return max(0, box["x2"] - box["x1"]) * max(0, box["y2"] - box["y1"])


def _overlap_len(a1: int, a2: int, b1: int, b2: int) -> int:
    return max(0, min(a2, b2) - max(a1, b1))


def _merge_tile_fragments(
    boxes: list[dict[str, Any]], image_w: int, image_h: int
) -> list[dict[str, Any]]:
    """Merge tile-boundary fragments belonging to the same object.

    Only boxes produced by tiles are merged. Complete full-image boxes are used
    later by dedupe to suppress fragments that are part of the same object.
    """
    by_class: dict[str, list[dict[str, Any]]] = {}
    for box in boxes:
        by_class.setdefault(box["class_name"], []).append(box)

    merged_all: list[dict[str, Any]] = []
    for group in by_class.values():
        full_boxes = [box for box in group if box.get("source") == "full"]
        orientation = None
        if full_boxes:
            reference = max(full_boxes, key=_area)
            orientation = (
                "vertical"
                if reference["y2"] - reference["y1"] >= reference["x2"] - reference["x1"]
                else "horizontal"
            )

        candidates: list[tuple[int, int, float, int, int]] = []
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                if a.get("source") != "tile" or b.get("source") != "tile":
                    continue
                x_overlap = _overlap_len(a["x1"], a["x2"], b["x1"], b["x2"])
                y_overlap = _overlap_len(a["y1"], a["y2"], b["y1"], b["y2"])
                w_a, w_b = a["x2"] - a["x1"], b["x2"] - b["x1"]
                h_a, h_b = a["y2"] - a["y1"], b["y2"] - b["y1"]
                x_ratio = x_overlap / max(1, min(w_a, w_b))
                y_ratio = y_overlap / max(1, min(h_a, h_b))
                gap_x = 0 if x_overlap else max(a["x1"], b["x1"]) - min(a["x2"], b["x2"])
                gap_y = 0 if y_overlap else max(a["y1"], b["y1"]) - min(a["y2"], b["y2"])

                vertical = x_ratio >= 0.6 and gap_y <= 0.12 * min(h_a, h_b)
                horizontal = y_ratio >= 0.6 and gap_x <= 0.12 * min(w_a, w_b)
                if not (vertical or horizontal):
                    continue

                union = {
                    "class_name": a["class_name"],
                    "x1": min(a["x1"], b["x1"]),
                    "y1": min(a["y1"], b["y1"]),
                    "x2": max(a["x2"], b["x2"]),
                    "y2": max(a["y2"], b["y2"]),
                }
                union_area = _area(union)
                if union_area > 0.7 * image_w * image_h:
                    continue
                direction = "vertical" if vertical else "horizontal"
                priority = 0 if orientation == direction else 1
                score = max(x_ratio, y_ratio)
                candidates.append((priority, union_area, -score, i, j))

        candidates.sort()
        used: set[int] = set()
        merged: list[dict[str, Any]] = []
        for _, _, _, i, j in candidates:
            if i in used or j in used:
                continue
            a, b = group[i], group[j]
            used.update((i, j))
            merged.append(
                {
                    "class_name": a["class_name"],
                    "x1": min(a["x1"], b["x1"]),
                    "y1": min(a["y1"], b["y1"]),
                    "x2": max(a["x2"], b["x2"]),
                    "y2": max(a["y2"], b["y2"]),
                    "confidence": max(a.get("confidence") or 0, b.get("confidence") or 0),
                    "presence": max(a.get("presence") or 0, b.get("presence") or 0),
                    "source": "tile-merged",
                }
            )
        merged.extend(box for index, box in enumerate(group) if index not in used)
        merged_all.extend(merged)
    return merged_all


def dedupe_boxes(
    boxes: list[dict[str, Any]],
    threshold: float = 0.5,
    containment_threshold: float = 0.5,
) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []
    # Larger boxes win: contained tile fragments must not replace a complete
    # full-image box just because Jev gave the fragment a higher confidence.
    ordered = sorted(
        boxes,
        key=lambda box: (_area(box), box.get("confidence") or 0.0),
        reverse=True,
    )
    for box in ordered:
        duplicate = False
        for other in kept:
            if box["class_name"] != other["class_name"]:
                continue
            if (
                iou(box, other) >= threshold
                or overlap_coefficient(box, other) >= containment_threshold
            ):
                duplicate = True
                break
        if not duplicate:
            kept.append(box)
    return kept


def _detect_prepared(
    prepared: Image.Image,
    transform: ImageTransform,
    categories: list[str],
    transport: JevTransport | OpenRouterTransport | None,
    extra_state: Any = None,
    extra_instructions: str = "",
    category_instructions: dict[str, str] | None = None,
) -> dict[str, Any]:
    include_count = settings.resolved_jev_multi_instance in ("auto", "sam3")
    questions, metas = _category_questions(
        categories,
        include_count=include_count,
        extra_instructions=extra_instructions,
        category_instructions=category_instructions,
    )
    payload = _ask(prepared, questions, transport, extra_state=extra_state)
    answers = payload.get("answers") or {}

    boxes: list[dict[str, Any]] = []
    several: list[str] = []
    for meta in metas:
        box, count = _parse_category(answers, meta, transform)
        if box is not None:
            box["source"] = "full"
            boxes.append(box)
        present = _answer_to_dict(answers.get(meta.present_key))
        presence = float(present.get("noul") or 0.0)
        if count == "several" and presence >= settings.jev_present_threshold:
            several.append(meta.category)

    if several and settings.resolved_jev_multi_instance == "auto":
        boxes.extend(
            _tile_boxes(
                prepared,
                transform,
                several,
                transport,
                extra_state=extra_state,
                extra_instructions=extra_instructions,
                category_instructions=category_instructions,
            )
        )

    boxes = _merge_tile_fragments(boxes, transform.original_width, transform.original_height)
    final_boxes = dedupe_boxes(boxes)
    for box in final_boxes:
        box.pop("source", None)
    return {
        "boxes": final_boxes,
        "several_categories": several,
        "answers": answers,
    }


def detect(
    image_path: str | Path,
    categories: list[str],
    *,
    transport: JevTransport | OpenRouterTransport | None = None,
    extra_state: Any = None,
    extra_instructions: str = "",
    category_instructions: dict[str, str] | None = None,
) -> dict[str, Any]:
    if not categories:
        raise InferenceError("At least one category is required")
    if not settings.jev_configured:
        raise JevNotConfiguredError("TYPESAFE_API_KEY not configured")

    with Image.open(image_path) as source:
        source.load()
        prepared, transform = prepare_for_jev(source)

    try:
        _encode_checked(prepared)
        result = _detect_prepared(
            prepared,
            transform,
            categories,
            transport,
            extra_state=extra_state,
            extra_instructions=extra_instructions,
            category_instructions=category_instructions,
        )
    finally:
        prepared.close()

    logger.info(
        "Jev detection: %s -> %d boxes for %s (several=%s)",
        image_path,
        len(result["boxes"]),
        categories,
        result["several_categories"],
    )

    return {
        "raw_text": json.dumps(result["answers"], ensure_ascii=False),
        "boxes": result["boxes"],
        "several_categories": result["several_categories"],
        "img_w": transform.original_width,
        "img_h": transform.original_height,
        "orig_w": transform.original_width,
        "orig_h": transform.original_height,
        "model_name": f"Jev ({settings.resolved_jev_model})",
        "provider": "jev",
    }
