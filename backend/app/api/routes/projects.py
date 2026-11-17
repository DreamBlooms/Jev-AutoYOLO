from __future__ import annotations

import contextlib
import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.detection import Detection, DetectionBox
from ...models.project import Project
from ...models.train import TrainingDetection, TrainingJob
from ...models.video import KeyFrame, Video
from ...schemas.common import APIResponse
from ...schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def _stats(db: Session, project: Project) -> dict:
    project_id = project.id
    image_count = db.query(func.count(Detection.id)).filter(Detection.project_id == project_id).scalar() or 0
    box_count = (
        db.query(func.count(DetectionBox.id))
        .join(Detection, Detection.id == DetectionBox.detection_id)
        .filter(Detection.project_id == project_id)
        .scalar()
        or 0
    )
    pending_review_count = (
        db.query(func.count(Detection.id))
        .filter(Detection.project_id == project_id, Detection.review_status == "pending")
        .scalar()
        or 0
    )
    video_count = db.query(func.count(Video.id)).filter(Video.project_id == project_id).scalar() or 0
    training_job_count = (
        db.query(func.count(TrainingJob.id)).filter(TrainingJob.project_id == project_id).scalar() or 0
    )
    model_count = (
        db.query(func.count(TrainingJob.id))
        .filter(
            TrainingJob.project_id == project_id,
            TrainingJob.status == "completed",
            TrainingJob.model_path.is_not(None),
        )
        .scalar()
        or 0
    )
    return {
        "imageCount": image_count,
        "boxCount": box_count,
        "videoCount": video_count,
        "trainingJobCount": training_job_count,
        "modelCount": model_count,
        "pendingReviewCount": pending_review_count,
    }


def _serialize(db: Session, project: Project) -> dict:
    data = ProjectOut.model_validate(project, from_attributes=True).model_dump(by_alias=True)
    data.update(_stats(db, project))
    return data


@router.get("")
def list_projects(db: Session = Depends(get_db)) -> APIResponse:
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return APIResponse(data=[_serialize(db, project) for project in projects], total=len(projects))


@router.post("", status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)) -> APIResponse:
    project = Project(
        name=body.name.strip(),
        description=body.description.strip(),
        categories=[item.strip() for item in body.categories if item.strip()],
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return APIResponse(data=_serialize(db, project))


@router.get("/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)) -> APIResponse:
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(400, "Invalid project id") from exc
    project = db.query(Project).filter(Project.id == project_uuid).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return APIResponse(data=_serialize(db, project))


@router.patch("/{project_id}")
def update_project(
    project_id: str,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
) -> APIResponse:
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(400, "Invalid project id") from exc
    project = db.query(Project).filter(Project.id == project_uuid).first()
    if not project:
        raise HTTPException(404, "Project not found")
    if body.name is not None:
        project.name = body.name.strip()
    if body.description is not None:
        project.description = body.description.strip()
    if body.categories is not None:
        project.categories = [item.strip() for item in body.categories if item.strip()]
    db.commit()
    db.refresh(project)
    return APIResponse(data=_serialize(db, project))


@router.post("/{project_id}/delete", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)) -> None:
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(400, "Invalid project id") from exc
    project = db.query(Project).filter(Project.id == project_uuid).first()
    if not project:
        raise HTTPException(404, "Project not found")

    jobs = db.query(TrainingJob).filter(TrainingJob.project_id == project_uuid).all()
    for job in jobs:
        for path in (job.model_path, job.onnx_path):
            if path:
                with contextlib.suppress(OSError):
                    Path(path).unlink(missing_ok=True)
        db.delete(job)
    db.flush()

    detections = db.query(Detection).filter(Detection.project_id == project_uuid).all()
    for detection in detections:
        db.query(TrainingDetection).filter(TrainingDetection.detection_id == detection.id).delete()
        with contextlib.suppress(OSError):
            Path(detection.image_path).unlink(missing_ok=True)
        db.delete(detection)
    db.flush()

    videos = db.query(Video).filter(Video.project_id == project_uuid).all()
    for video in videos:
        db.query(KeyFrame).filter(KeyFrame.video_id == video.id).delete()
        with contextlib.suppress(OSError):
            Path(video.file_path).unlink(missing_ok=True)
        db.delete(video)

    db.delete(project)
    db.commit()
    logger.info("Deleted project %s", project_id)
