"""Authentication API routes."""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status

from caselens.auth.schemas import (
    GoogleLoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from caselens.auth.service import (
    create_token_pair,
    decode_token,
    get_or_create_google_user,
    get_user_by_email,
    get_user_by_id,
    get_user_membership,
    hash_password,
    verify_google_id_token,
    verify_password,
)
from caselens.db.models import User
from caselens.dependencies import CurrentUser, DbSession

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: UserRegisterRequest, db: DbSession) -> TokenResponse:
    """Register a new user account."""
    existing = await get_user_by_email(db, request.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
    )
    db.add(user)
    await db.flush()

    return create_token_pair(user)


@router.post("/login", response_model=TokenResponse)
async def login(request: UserLoginRequest, db: DbSession) -> TokenResponse:
    """Login with email and password."""
    user = await get_user_by_email(db, request.email)
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # Update last login
    user.last_login_at = datetime.now(UTC)

    # Check for org membership
    membership = await get_user_membership(db, user.id)

    return create_token_pair(user, membership)


@router.post("/google", response_model=TokenResponse)
async def google_login(request: GoogleLoginRequest, db: DbSession) -> TokenResponse:
    """Sign in (or sign up) with a Google ID token from Google Identity Services."""
    claims = await verify_google_id_token(request.credential)
    user = await get_or_create_google_user(db, claims)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated"
        )

    user.last_login_at = datetime.now(UTC)
    membership = await get_user_membership(db, user.id)
    return create_token_pair(user, membership)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest, db: DbSession) -> TokenResponse:
    """Refresh an access token."""
    payload = decode_token(request.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type — expected refresh token",
        )

    import uuid

    user = await get_user_by_id(db, uuid.UUID(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    membership = await get_user_membership(db, user.id)
    return create_token_pair(user, membership)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: CurrentUser) -> None:
    """Logout (client should discard tokens; server-side revocation in Phase 2)."""
    # Phase 1: Client-side token discard
    # Phase 2: Redis-based token blacklist
    return


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: CurrentUser, db: DbSession) -> UserResponse:
    """Get the current authenticated user's profile."""
    user = await get_user_by_id(db, current_user.sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    membership = await get_user_membership(db, user.id)
    org_id = membership.organization_id if membership else None
    role = membership.role.value if membership else None

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at,
        organization_id=org_id,
        org_role=role,
    )
