"""Document Pydantic schemas."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_serializer


class DocumentResponse(BaseModel):
    id: uuid.UUID
    matter_id: uuid.UUID
    organization_id: uuid.UUID
    title: str
    original_filename: str
    mime_type: str
    file_size_bytes: int
    page_count: int | None
    status: str
    summary: str | None
    checksum_sha256: str | None
    created_at: datetime
    updated_at: datetime
    metadata: dict[str, Any] | None = None

    model_config = {"from_attributes": True}

    @field_serializer("status")
    def serialize_status(self, status: str) -> str:
        return status.lower()


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int


class DocumentStatusResponse(BaseModel):
    document_id: uuid.UUID
    status: str
    steps: list["ProcessingStepResponse"]

    @field_serializer("status")
    def serialize_status(self, status: str) -> str:
        return status.lower()


class ProcessingStepResponse(BaseModel):
    step_name: str
    step_order: int
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    duration_ms: int | None
    error_message: str | None

    @field_serializer("status")
    def serialize_status(self, status: str) -> str:
        return status.lower()


class PageContentResponse(BaseModel):
    document_id: uuid.UUID
    page_number: int
    text_content: str | None
    char_count: int
    extraction_method: str
