"""Organization API routes."""

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from caselens.auth.service import get_user_by_email
from caselens.db.models import Membership, Organization, OrgRole
from caselens.dependencies import CurrentUser, DbSession
from caselens.organizations.schemas import (
    AddMemberRequest,
    CreateOrganizationRequest,
    MemberResponse,
    OrganizationResponse,
    UpdateOrganizationRequest,
)

router = APIRouter()


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    request: CreateOrganizationRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> OrganizationResponse:
    """Create a new organization. The creator becomes the owner."""
    # Check slug uniqueness
    existing = await db.execute(
        select(Organization).where(Organization.slug == request.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization slug already exists",
        )

    org = Organization(name=request.name, slug=request.slug)
    db.add(org)
    await db.flush()

    # Add creator as owner
    membership = Membership(
        user_id=current_user.sub,
        organization_id=org.id,
        role=OrgRole.OWNER,
    )
    db.add(membership)
    await db.flush()

    return OrganizationResponse.model_validate(org)


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> OrganizationResponse:
    """Get organization details. User must be a member."""
    # Verify membership
    membership = await db.execute(
        select(Membership).where(
            Membership.user_id == current_user.sub,
            Membership.organization_id == org_id,
            Membership.is_active == True,  # noqa: E712
        )
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member")

    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    return OrganizationResponse.model_validate(org)


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: uuid.UUID,
    request: UpdateOrganizationRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> OrganizationResponse:
    """Update organization. Requires admin or owner role."""
    # Verify admin/owner membership
    membership_result = await db.execute(
        select(Membership).where(
            Membership.user_id == current_user.sub,
            Membership.organization_id == org_id,
            Membership.role.in_([OrgRole.OWNER, OrgRole.ADMIN]),
            Membership.is_active == True,  # noqa: E712
        )
    )
    if not membership_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    if request.name is not None:
        org.name = request.name

    await db.flush()
    return OrganizationResponse.model_validate(org)


@router.post("/{org_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    org_id: uuid.UUID,
    request: AddMemberRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> MemberResponse:
    """Add a member to the organization. Requires admin or owner role."""
    # Verify admin/owner
    membership_result = await db.execute(
        select(Membership).where(
            Membership.user_id == current_user.sub,
            Membership.organization_id == org_id,
            Membership.role.in_([OrgRole.OWNER, OrgRole.ADMIN]),
            Membership.is_active == True,  # noqa: E712
        )
    )
    if not membership_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    # Find user by email
    user = await get_user_by_email(db, request.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Check existing membership
    existing = await db.execute(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.organization_id == org_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member")

    membership = Membership(
        user_id=user.id,
        organization_id=org_id,
        role=OrgRole(request.role),
    )
    db.add(membership)
    await db.flush()

    return MemberResponse(
        id=membership.id,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=membership.role.value,
        is_active=membership.is_active,
    )
