"""Pydantic schemas for authentication requests and responses."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    """The ID-token credential returned by Google Identity Services."""

    credential: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenPayload(BaseModel):
    """Decoded JWT payload."""

    sub: uuid.UUID  # user_id
    email: str
    full_name: str
    organization_id: uuid.UUID | None = None
    org_role: str | None = None
    exp: datetime | None = None
    iat: datetime | None = None
    jti: str | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    organization_id: uuid.UUID | None = None
    org_role: str | None = None

    model_config = {"from_attributes": True}
