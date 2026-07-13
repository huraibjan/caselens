"""Shared FastAPI dependencies for database sessions, auth, and org context."""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from caselens.auth.schemas import TokenPayload
from caselens.auth.service import get_current_user_from_token
from caselens.db.session import get_db_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session for the request lifecycle."""
    async for session in get_db_session():
        yield session


DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    token_payload: Annotated[TokenPayload, Depends(get_current_user_from_token)],
) -> TokenPayload:
    """Extract and validate the current user from the JWT token."""
    return token_payload


CurrentUser = Annotated[TokenPayload, Depends(get_current_user)]


async def require_org_member(
    current_user: CurrentUser,
    db: DbSession,
) -> TokenPayload:
    """Ensure the current user belongs to an organization."""
    from caselens.auth.service import get_user_membership
    membership = await get_user_membership(db, current_user.sub)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization",
        )
    current_user.organization_id = membership.organization_id
    current_user.org_role = membership.role.value
    return current_user


OrgMember = Annotated[TokenPayload, Depends(require_org_member)]
