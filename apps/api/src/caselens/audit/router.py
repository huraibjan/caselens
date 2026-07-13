"""Audit events API routes — query immutable audit log."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import func, select

from caselens.db.models import AuditEvent
from caselens.dependencies import DbSession, OrgMember

router = APIRouter()


class AuditEventResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID | None
    user_id: uuid.UUID | None
    action: str
    resource_type: str
    resource_id: uuid.UUID | None
    details: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditEventListResponse(BaseModel):
    items: list[AuditEventResponse]
    total: int


@router.get("", response_model=AuditEventListResponse)
async def list_audit_events(
    current_user: OrgMember,
    db: DbSession,
    action: str | None = None,
    resource_type: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> AuditEventListResponse:
    """Query the audit log for the current organization."""
    assert current_user.organization_id is not None

    base = select(AuditEvent).where(
        AuditEvent.organization_id == current_user.organization_id
    )

    if action:
        base = base.where(AuditEvent.action == action)
    if resource_type:
        base = base.where(AuditEvent.resource_type == resource_type)

    # Count
    count_result = await db.execute(
        select(func.count()).select_from(base.subquery())
    )
    total = count_result.scalar() or 0

    # Fetch
    result = await db.execute(
        base.order_by(AuditEvent.created_at.desc()).offset(skip).limit(limit)
    )
    events = result.scalars().all()

    items = [
        AuditEventResponse(
            id=e.id,
            organization_id=e.organization_id,
            user_id=e.user_id,
            action=e.action,
            resource_type=e.resource_type,
            resource_id=e.resource_id,
            details=e.details,
            ip_address=e.ip_address,
            created_at=e.created_at,
        )
        for e in events
    ]

    return AuditEventListResponse(items=items, total=total)
