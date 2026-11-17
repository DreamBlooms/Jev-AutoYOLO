"""add_projects_and_project_scoping

Revision ID: d4e5f6a7b8c9
Revises: c2f5a8b9d3e6
Create Date: 2026-11-17 12:00:00.000000
"""
from collections.abc import Sequence
import uuid
from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "c2f5a8b9d3e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON_TYPE = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
DEFAULT_PROJECT_ID = uuid.UUID("a0000000-0000-0000-0000-000000000001")
DEFAULT_PROJECT_ID_HEX = DEFAULT_PROJECT_ID.hex


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("categories", JSON_TYPE, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_projects_created_at", "projects", ["created_at"], unique=False)

    from app.models.project import Project

    now = datetime.now(UTC)
    op.get_bind().execute(
        Project.__table__.insert().values(
            id=DEFAULT_PROJECT_ID,
            name="Default Project",
            description="Existing detections and training jobs migrated automatically.",
            categories=[],
            created_at=now,
            updated_at=now,
        )
    )

    with op.batch_alter_table("detections") as batch_op:
        batch_op.add_column(sa.Column("project_id", sa.UUID(), nullable=True))
        batch_op.add_column(
            sa.Column("review_status", sa.String(length=16), nullable=False, server_default="pending")
        )
        batch_op.create_foreign_key(
            "fk_detections_project_id", "projects", ["project_id"], ["id"], ondelete="SET NULL"
        )
        batch_op.create_index("ix_detections_project_id", ["project_id"], unique=False)
        batch_op.create_index("ix_detections_review_status", ["review_status"], unique=False)

    with op.batch_alter_table("videos") as batch_op:
        batch_op.add_column(sa.Column("project_id", sa.UUID(), nullable=True))
        batch_op.create_foreign_key(
            "fk_videos_project_id", "projects", ["project_id"], ["id"], ondelete="SET NULL"
        )
        batch_op.create_index("ix_videos_project_id", ["project_id"], unique=False)

    with op.batch_alter_table("training_jobs") as batch_op:
        batch_op.add_column(sa.Column("project_id", sa.UUID(), nullable=True))
        batch_op.create_foreign_key(
            "fk_training_jobs_project_id", "projects", ["project_id"], ["id"], ondelete="SET NULL"
        )
        batch_op.create_index("ix_training_jobs_project_id", ["project_id"], unique=False)

    for table in ("detections", "videos", "training_jobs"):
        op.execute(
            sa.text(f"UPDATE {table} SET project_id = :project_id WHERE project_id IS NULL").bindparams(
                project_id=DEFAULT_PROJECT_ID_HEX
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("training_jobs") as batch_op:
        batch_op.drop_index("ix_training_jobs_project_id")
        batch_op.drop_constraint("fk_training_jobs_project_id", type_="foreignkey")
        batch_op.drop_column("project_id")

    with op.batch_alter_table("videos") as batch_op:
        batch_op.drop_index("ix_videos_project_id")
        batch_op.drop_constraint("fk_videos_project_id", type_="foreignkey")
        batch_op.drop_column("project_id")

    with op.batch_alter_table("detections") as batch_op:
        batch_op.drop_index("ix_detections_review_status")
        batch_op.drop_index("ix_detections_project_id")
        batch_op.drop_constraint("fk_detections_project_id", type_="foreignkey")
        batch_op.drop_column("review_status")
        batch_op.drop_column("project_id")

    op.drop_index("ix_projects_created_at", table_name="projects")
    op.drop_table("projects")
