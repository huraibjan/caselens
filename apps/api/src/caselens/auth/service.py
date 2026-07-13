"""Authentication business logic — JWT tokens, password hashing, user management."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from caselens.auth.schemas import TokenPayload, TokenResponse
from caselens.config import settings
from caselens.db.models import Membership, User

bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""
    try:
        pwd_bytes = plain_password.encode("utf-8")
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False


def create_access_token(payload: dict[str, Any]) -> str:
    """Create a JWT access token."""
    to_encode = payload.copy()
    expire = datetime.now(UTC) + timedelta(
        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire, "iat": datetime.now(UTC), "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(payload: dict[str, Any]) -> str:
    """Create a JWT refresh token."""
    to_encode = payload.copy()
    expire = datetime.now(UTC) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(UTC),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_token_pair(user: User, membership: Membership | None = None) -> TokenResponse:
    """Create access + refresh token pair for a user."""
    payload: dict[str, Any] = {
        "sub": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
    }
    if membership:
        payload["organization_id"] = str(membership.organization_id)
        payload["org_role"] = membership.role.value

    access_token = create_access_token(payload)
    refresh_token = create_refresh_token(payload)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT token."""
    try:
        decoded: dict[str, Any] = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return decoded
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


async def get_current_user_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> TokenPayload:
    """FastAPI dependency to extract and validate the current user from JWT."""
    payload = decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    org_id = payload.get("organization_id")
    return TokenPayload(
        sub=uuid.UUID(payload["sub"]),
        email=payload["email"],
        full_name=payload["full_name"],
        organization_id=uuid.UUID(org_id) if org_id else None,
        org_role=payload.get("org_role"),
    )


async def verify_google_id_token(credential: str) -> dict[str, Any]:
    """Verify a Google ID token and return its claims.

    Uses Google's tokeninfo endpoint (no extra dependency). Validates the
    audience against GOOGLE_CLIENT_ID and requires a verified email.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Sign-In is not configured on this server.",
        )

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": credential},
            timeout=10.0,
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credential"
        )

    claims: dict[str, Any] = resp.json()
    if claims.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google credential was issued for a different application",
        )
    if claims.get("email_verified") not in (True, "true"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Google email is not verified"
        )
    if not claims.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Google credential has no email"
        )
    return claims


async def get_or_create_google_user(db: AsyncSession, claims: dict[str, Any]) -> User:
    """Find an existing user by Google email, or provision a new one."""
    email = claims["email"]
    user = await get_user_by_email(db, email)
    if user:
        return user

    user = User(
        email=email,
        # No local password for Google accounts — store an unusable random hash
        # so password login can never succeed for this account.
        hashed_password=hash_password(secrets.token_urlsafe(32)),
        full_name=claims.get("name") or email.split("@")[0],
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    return user


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Get a user by email."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Get a user by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_membership(
    db: AsyncSession, user_id: uuid.UUID
) -> Membership | None:
    """Get the first active membership for a user."""
    result = await db.execute(
        select(Membership).where(
            Membership.user_id == user_id,
            Membership.is_active == True,  # noqa: E712
        )
    )
    return result.scalar_one_or_none()
