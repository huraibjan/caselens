"""practice management: contacts, calendar_events, filings

Revision ID: a1f2c3d4e5f6
Revises: 88db15a1dd96
Create Date: 2026-07-14

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "a1f2c3d4e5f6"
down_revision: str | None = "88db15a1dd96"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _common() -> list[sa.Column]:
    return [
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("matter_id", UUID(as_uuid=True), sa.ForeignKey("matters.id", ondelete="SET NULL"), nullable=True),
    ]


def upgrade() -> None:
    op.create_table(
        "contacts",
        *_common(),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="client"),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("firm", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_contacts_org", "contacts", ["organization_id"])

    op.create_table(
        "calendar_events",
        *_common(),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False, server_default="hearing"),
        sa.Column("event_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("event_time", sa.String(20), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("urgent", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_calendar_events_org_date", "calendar_events", ["organization_id", "event_date"])

    op.create_table(
        "filings",
        *_common(),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("filing_type", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("filed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_filings_org", "filings", ["organization_id"])


def downgrade() -> None:
    op.drop_table("filings")
    op.drop_table("calendar_events")
    op.drop_table("contacts")
