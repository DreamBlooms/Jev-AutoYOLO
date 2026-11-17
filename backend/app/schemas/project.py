from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field, field_validator

from .common import BaseSchema, _coerce_uuid


class ProjectCreate(BaseSchema):
    name: str = Field(..., min_length=1, max_length=128)
    description: str = Field(default="", max_length=4000)
    categories: list[str] = Field(default_factory=list)


class ProjectUpdate(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=4000)
    categories: list[str] | None = None


class ProjectOut(BaseSchema):
    id: str
    name: str
    description: str
    categories: list[str]
    created_at: datetime
    updated_at: datetime
    image_count: int = 0
    box_count: int = 0
    video_count: int = 0
    training_job_count: int = 0
    model_count: int = 0
    pending_review_count: int = 0

    model_config = {"from_attributes": True}

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, v: Any) -> str:
        return _coerce_uuid(v)
