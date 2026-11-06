from __future__ import annotations

import asyncio
import json
import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from ...core.config import settings
from ...core.exceptions import AppError, NotFoundError
from ...models.detection import FilterMode
from ...repositories.detection import DetectionRepository
from ...schemas.common import APIResponse, BaseSchema
from ...schemas.detection import DetectionListItem, DetectionOut, DetectionParams
from ...services import model_manager
from ...services.detection_service import process_detection
from ...services.jev_service import get_status as get_jev_status
from ...services.locate_anything import (
    get_model_status as get_local_model_status,
)
from ...services.locate_anything import (
    is_model_loaded,
    unload_model,
)
from ...services.sam2_service import get_sam2_status, is_sam_loaded, unload_sam
from ...services.sam3_client import is_sam3_running, stop_sam3_server
from ..deps import get_repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["detection"])


def _save_upload(file: UploadFile) -> tuple[str, str]:
    safe_name = f"{uuid.uuid4().hex}_{Path(file.filename).name}"  # type: ignore[arg-type]
    filepath = str(settings.upload_dir / safe_name)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return filepath, safe_name


@router.post("/detect", status_code=201)
async def create_detection(
    file: UploadFile = File(...),
    categories: str = Form(...),
    extra_state: str = Form(""),
    extra_instructions: str = Form(""),
    category_instructions: str = Form(""),
    use_vlm: bool = Form(False),
    use_sam2: bool = Form(False),
    use_sam3: bool = Form(False),
    sam2_score_threshold: float = Form(0.0, ge=0.0, le=1.0),
    sam3_text: str = Form(""),
    use_sam3_seg: bool = Form(True),
    sam3_threshold: float = Form(0.5, ge=0.0, le=1.0),
    sam3_mask_threshold: float = Form(0.5, ge=0.0, le=1.0),
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, detail="File must be an image")

    file.file.seek(0, 2)
    size_mb = file.file.tell() / (1024 * 1024)
    file.file.seek(0)
    if size_mb > settings.max_upload_size_mb:
        raise HTTPException(400, detail=f"File exceeds {settings.max_upload_size_mb}MB limit")

    try:
        cat_list: list[str] = json.loads(categories)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, detail="categories must be a JSON array") from exc
    if not cat_list:
        raise HTTPException(400, detail="categories cannot be empty")

    parsed_extra_state = None
    if extra_state.strip():
        if len(extra_state) > 16_384:
            raise HTTPException(400, detail="extra_state exceeds 16KB")
        try:
            parsed_extra_state = json.loads(extra_state)
        except json.JSONDecodeError as exc:
            raise HTTPException(400, detail="extra_state must be valid JSON") from exc
        if not isinstance(parsed_extra_state, (dict, list, str)):
            raise HTTPException(400, detail="extra_state must be a JSON object, array, or string")
    if len(extra_instructions) > 4_000:
        raise HTTPException(400, detail="extra_instructions exceeds 4000 characters")

    parsed_category_instructions = None
    if category_instructions.strip():
        if len(category_instructions) > 8_192:
            raise HTTPException(400, detail="category_instructions exceeds 8KB")
        try:
            parsed_category_instructions = json.loads(category_instructions)
        except json.JSONDecodeError as exc:
            raise HTTPException(400, detail="category_instructions must be valid JSON") from exc
        if not isinstance(parsed_category_instructions, dict):
            raise HTTPException(400, detail="category_instructions must be a JSON object")
        if not all(
            isinstance(key, str) and isinstance(value, str)
            for key, value in parsed_category_instructions.items()
        ):
            raise HTTPException(400, detail="category_instructions values must be strings")
        if any(len(value) > 1_000 for value in parsed_category_instructions.values()):
            raise HTTPException(400, detail="each category instruction exceeds 1000 characters")

    filepath, safe_name = _save_upload(file)
    original_name = Path(file.filename).name  # type: ignore[arg-type]

    try:
        detection = await process_detection(
            filepath=filepath,
            original_name=original_name,
            categories=cat_list,
            params=DetectionParams(
                use_vlm=use_vlm,
                extra_state=parsed_extra_state,
                extra_instructions=extra_instructions,
                category_instructions=parsed_category_instructions,
                use_sam2=use_sam2,
                use_sam3=use_sam3,
                sam2_score_threshold=sam2_score_threshold,
                sam3_text=sam3_text,
                use_sam3_seg=use_sam3_seg,
                sam3_threshold=sam3_threshold,
                sam3_mask_threshold=sam3_mask_threshold,
            ),
            repo=repo,
        )
    except AppError as exc:
        raise HTTPException(exc.status_code, detail=exc.detail) from exc

    return APIResponse(
        data=DetectionOut.model_validate(detection).model_dump(by_alias=True),
    )


@router.get("/detections")
def list_detections(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100000, validation_alias="pageSize"),
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    items, total = repo.list(page=page, page_size=page_size)
    return APIResponse(
        data=[DetectionListItem.model_validate(d).model_dump(by_alias=True) for d in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/detections/{detection_id}")
def get_detection(
    detection_id: str,
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    return APIResponse(
        data=DetectionOut.model_validate(det).model_dump(by_alias=True),
    )


@router.post("/detections/{detection_id}/delete", status_code=204)
def delete_detection(
    detection_id: str,
    repo: DetectionRepository = Depends(get_repo),
) -> None:
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    try:
        Path(det.image_path).unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not delete image file: %s", det.image_path)
    repo.delete(det, commit=True)


@router.post("/detections/{detection_id}/boxes/{box_id}/delete", status_code=204)
def delete_box(
    detection_id: str,
    box_id: str,
    repo: DetectionRepository = Depends(get_repo),
) -> None:
    box = repo.get_box(detection_id, box_id)
    if not box:
        raise NotFoundError("DetectionBox", box_id)
    repo.delete_box(box, commit=True)


class AddBoxBody(BaseSchema):
    class_name: str
    x1: int
    y1: int
    x2: int
    y2: int


class UpdateBoxBody(BaseSchema):
    x1: int
    y1: int
    x2: int
    y2: int


@router.post("/detections/{detection_id}/boxes", status_code=201)
def add_box(
    detection_id: str,
    body: AddBoxBody,
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    repo.add_boxes(
        detection_id,
        [
            {
                "class_name": body.class_name,
                "x1": body.x1,
                "y1": body.y1,
                "x2": body.x2,
                "y2": body.y2,
            }
        ],
        commit=True,
    )
    return APIResponse(data={"ok": True})


class ReplaceBoxItem(BaseSchema):
    class_name: str
    x1: int
    y1: int
    x2: int
    y2: int


class ReplaceBoxesBody(BaseSchema):
    boxes: list[ReplaceBoxItem]


@router.put("/detections/{detection_id}/boxes")
def replace_boxes(
    detection_id: str,
    body: ReplaceBoxesBody,
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    repo.replace_boxes(detection_id, [b.model_dump() for b in body.boxes], commit=True)
    return APIResponse(data={"ok": True, "count": len(body.boxes)})


class FilterSettingsBody(BaseSchema):
    filter_mode: FilterMode
    filter_nms_iou: float | None = None


@router.put("/detections/{detection_id}/filter-settings")
def save_filter_settings(
    detection_id: str,
    body: FilterSettingsBody,
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    det.filter_mode = body.filter_mode
    det.filter_nms_iou = body.filter_nms_iou
    repo.update_detection(det, commit=True)
    return APIResponse(data={"ok": True})


@router.put("/detections/{detection_id}/boxes/{box_id}")
def update_box(
    detection_id: str,
    box_id: str,
    body: UpdateBoxBody,
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    box = repo.get_box(detection_id, box_id)
    if not box:
        raise NotFoundError("DetectionBox", box_id)
    box.x1, box.y1, box.x2, box.y2 = body.x1, body.y1, body.x2, body.y2
    repo.update_box(box, commit=True)
    return APIResponse(data={"ok": True})


@router.get("/detections/{detection_id}/image")
def get_detection_image(
    detection_id: str,
    repo: DetectionRepository = Depends(get_repo),
):
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    path = Path(det.image_path)
    if not path.exists():
        raise HTTPException(404, "Image file not found")
    return FileResponse(str(path))


def _status_payload(status: dict) -> dict:
    return {
        "loaded": status["state"] == "loaded",
        "state": status["state"],
        "mode": status.get("mode", "remote"),
        "model": status.get("model", ""),
        "stage": status.get("stage", ""),
        "progress": status.get("progress", 0),
        "error": status.get("error", ""),
    }


@router.get("/model/status")
def model_status() -> APIResponse:
    status = get_jev_status()
    local = model_manager.merge_status("vlm", get_local_model_status())
    return APIResponse(
        data={
            **_status_payload(status),
            "fallback": {
                "state": local["state"],
                "stage": local["stage"],
                "progress": local["progress"],
                "error": local["error"],
            },
        }
    )


@router.post("/model/unload", status_code=204)
def model_unload() -> None:
    # Jev is a remote API and has no local state to unload. This endpoint only
    # releases the local LocateAnything fallback when it has been loaded.
    if is_model_loaded():
        unload_model()
    model_manager.reset("vlm")


@router.get("/model/download/status")
def download_status() -> APIResponse:
    return APIResponse(data=model_manager.get_all_status())


@router.post("/model/{kind}/download", status_code=202)
def download_model(kind: str) -> APIResponse:
    try:
        status = model_manager.start_download(kind)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
    return APIResponse(data=status)


@router.get("/model/sam2/status")
def sam2_status() -> APIResponse:
    status = get_sam2_status()
    return APIResponse(
        data={
            "loaded": status["state"] == "loaded",
            "state": status["state"],
            "stage": status["stage"],
            "progress": status["progress"],
            "error": status["error"],
        }
    )


@router.post("/model/sam2/unload", status_code=204)
def sam2_unload() -> None:
    if is_sam_loaded():
        unload_sam()
    model_manager.reset("sam2")


@router.get("/model/sam3/status")
def sam3_status() -> APIResponse:
    import urllib.request

    try:
        resp = urllib.request.urlopen("http://127.0.0.1:8002/health", timeout=2)
        import json as _json

        data = _json.loads(resp.read())
        status = data.get("status", "unloaded")
        return APIResponse(data={"loaded": status == "loaded", "status": status})
    except Exception:
        return APIResponse(data={"loaded": False, "status": "unloaded"})


@router.get("/model/events")
async def model_events():
    """SSE endpoint that pushes Jev, local fallback, SAM2, and SAM3 status."""

    async def event_stream():
        import urllib.request

        prev = ""
        # Fast poll during startup, slow down once all models are stable
        fast_interval = 1.5
        slow_interval = 10.0
        stable_count = 0
        prev_sam3: dict = {"loaded": False, "status": "unloaded"}

        while True:
            # Jev is the primary provider; vlm is the local fallback state.
            jev = get_jev_status()
            vlm = model_manager.merge_status("vlm", get_local_model_status())
            sam2 = model_manager.merge_status("sam2", get_sam2_status())

            # SAM3 status — keep previous value on transient health check failure
            # (SAM3's WSGI server is single-threaded; /health times out during inference)
            sam3_data = prev_sam3
            try:
                resp = urllib.request.urlopen("http://127.0.0.1:8002/health", timeout=1)
                import json as _json

                data = _json.loads(resp.read())
                sam3_data = {
                    "loaded": data.get("status") == "loaded",
                    "status": data.get("status", "unloaded"),
                }
                prev_sam3 = sam3_data
            except Exception:
                pass

            sam3_data = model_manager.merge_sam3(sam3_data)
            payload = json.dumps({"jev": jev, "vlm": vlm, "sam2": sam2, "sam3": sam3_data})
            if payload != prev:
                prev = payload
                yield f"data: {payload}\n\n"

            # Use fast interval while any model is in transition, slow otherwise
            all_stable = all(
                s in ("loaded", "unloaded", "error")
                for s in (
                    jev.get("state", ""),
                    vlm.get("state", ""),
                    sam2.get("state", ""),
                    sam3_data.get("status", ""),
                )
            )
            if all_stable:
                stable_count += 1
            else:
                stable_count = 0

            interval = slow_interval if stable_count > 3 else fast_interval
            await asyncio.sleep(interval)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/model/sam3/unload", status_code=204)
def sam3_unload() -> None:
    if is_sam3_running():
        stop_sam3_server()
    model_manager.reset("sam3")
