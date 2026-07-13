"""Matters API routes."""

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from caselens.db.models import Document, Matter, MatterMember, MatterStatus
from caselens.dependencies import DbSession, OrgMember
from caselens.matters.schemas import (
    CreateMatterRequest,
    MatterListResponse,
    MatterResponse,
    UpdateMatterRequest,
)

router = APIRouter()


async def _verify_matter_access(
    db: DbSession, matter_id: uuid.UUID, user_id: uuid.UUID, org_id: uuid.UUID
) -> Matter:
    """Verify user has access to a matter within their org."""
    result = await db.execute(
        select(Matter).where(
            Matter.id == matter_id,
            Matter.organization_id == org_id,
        )
    )
    matter = result.scalar_one_or_none()
    if not matter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matter not found")

    # Check matter membership
    member_result = await db.execute(
        select(MatterMember).where(
            MatterMember.matter_id == matter_id,
            MatterMember.user_id == user_id,
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this matter")

    return matter


@router.post("", response_model=MatterResponse, status_code=status.HTTP_201_CREATED)
async def create_matter(
    request: CreateMatterRequest,
    current_user: OrgMember,
    db: DbSession,
) -> MatterResponse:
    """Create a new matter. Creator is added as a member."""
    assert current_user.organization_id is not None

    matter = Matter(
        organization_id=current_user.organization_id,
        title=request.title,
        description=request.description,
        matter_number=request.matter_number,
    )
    db.add(matter)
    await db.flush()

    # Add creator as matter member
    member = MatterMember(
        matter_id=matter.id,
        user_id=current_user.sub,
        role="lead",
    )
    db.add(member)
    await db.flush()

    return MatterResponse(
        id=matter.id,
        organization_id=matter.organization_id,
        title=matter.title,
        description=matter.description,
        matter_number=matter.matter_number,
        status=matter.status.value,
        created_at=matter.created_at,
        updated_at=matter.updated_at,
        document_count=0,
        metadata=matter.case_metadata,
    )


@router.get("", response_model=MatterListResponse)
async def list_matters(
    current_user: OrgMember,
    db: DbSession,
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> MatterListResponse:
    """List matters the current user has access to."""
    assert current_user.organization_id is not None

    # Base query: matters in the user's org that they are members of
    base = (
        select(Matter)
        .join(MatterMember, MatterMember.matter_id == Matter.id)
        .where(
            Matter.organization_id == current_user.organization_id,
            MatterMember.user_id == current_user.sub,
        )
    )

    if status_filter:
        base = base.where(Matter.status == MatterStatus(status_filter))

    # Count
    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar() or 0

    # Fetch
    result = await db.execute(
        base.order_by(Matter.updated_at.desc()).offset(skip).limit(limit)
    )
    matters = result.scalars().all()

    items = []
    for m in matters:
        # Count documents for each matter
        doc_count_result = await db.execute(
            select(func.count()).where(Document.matter_id == m.id)
        )
        doc_count = doc_count_result.scalar() or 0

        items.append(
            MatterResponse(
                id=m.id,
                organization_id=m.organization_id,
                title=m.title,
                description=m.description,
                matter_number=m.matter_number,
                status=m.status.value,
                created_at=m.created_at,
                updated_at=m.updated_at,
                document_count=doc_count,
                metadata=m.case_metadata,
            )
        )

    return MatterListResponse(items=items, total=total)


@router.get("/{matter_id}", response_model=MatterResponse)
async def get_matter(
    matter_id: uuid.UUID,
    current_user: OrgMember,
    db: DbSession,
) -> MatterResponse:
    """Get a specific matter."""
    assert current_user.organization_id is not None
    matter = await _verify_matter_access(db, matter_id, current_user.sub, current_user.organization_id)

    doc_count_result = await db.execute(
        select(func.count()).where(Document.matter_id == matter.id)
    )
    doc_count = doc_count_result.scalar() or 0

    return MatterResponse(
        id=matter.id,
        organization_id=matter.organization_id,
        title=matter.title,
        description=matter.description,
        matter_number=matter.matter_number,
        status=matter.status.value,
        created_at=matter.created_at,
        updated_at=matter.updated_at,
        document_count=doc_count,
        metadata=matter.case_metadata,
    )


@router.patch("/{matter_id}", response_model=MatterResponse)
async def update_matter(
    matter_id: uuid.UUID,
    request: UpdateMatterRequest,
    current_user: OrgMember,
    db: DbSession,
) -> MatterResponse:
    """Update a matter."""
    assert current_user.organization_id is not None
    matter = await _verify_matter_access(db, matter_id, current_user.sub, current_user.organization_id)

    if request.title is not None:
        matter.title = request.title
    if request.description is not None:
        matter.description = request.description
    if request.status is not None:
        matter.status = MatterStatus(request.status)

    await db.flush()

    return MatterResponse(
        id=matter.id,
        organization_id=matter.organization_id,
        title=matter.title,
        description=matter.description,
        matter_number=matter.matter_number,
        status=matter.status.value,
        created_at=matter.created_at,
        updated_at=matter.updated_at,
        document_count=0,
        metadata=matter.case_metadata,
    )
