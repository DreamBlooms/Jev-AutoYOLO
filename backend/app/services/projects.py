from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from ..models.project import DEFAULT_PROJECT_ID, Project

DEFAULT_PROJECT_UUID = uuid.UUID(DEFAULT_PROJECT_ID)


def ensure_default_project(db: Session) -> Project:
    project = db.query(Project).filter(Project.id == DEFAULT_PROJECT_UUID).first()
    if project is None:
        project = Project(
            id=DEFAULT_PROJECT_UUID,
            name="Default Project",
            description="Default workspace for existing AutoYOLO data.",
            categories=[],
        )
        db.add(project)
        db.flush()
    return project


def resolve_project_id(db: Session, value: str | uuid.UUID | None) -> uuid.UUID:
    if value in (None, ""):
        return ensure_default_project(db).id
    try:
        project_id = value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid project id") from exc
    if db.query(Project.id).filter(Project.id == project_id).first() is None:
        raise ValueError("Project not found")
    return project_id
