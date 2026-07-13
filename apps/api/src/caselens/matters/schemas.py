"""Matter Pydantic schemas."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CreateMatterRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    matter_number: str | None = Field(None, max_length=100)


class UpdateMatterRequest(BaseModel):
    title: str | None = Field(None, max_length=500)
    description: str | None = None
    status: str | None = None


class MatterResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    title: str
    description: str | None
    matter_number: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    document_count: int = 0
    metadata: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class MatterListResponse(BaseModel):
    items: list[MatterResponse]
    total: int
