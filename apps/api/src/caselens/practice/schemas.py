"""Pydantic schemas for practice-management resources."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Contacts ───────────────────────────────────────────────────────
class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    role: str = Field("client", max_length=50)
    email: str | None = Field(None, max_length=320)
    phone: str | None = Field(None, max_length=50)
    firm: str | None = Field(None, max_length=255)
    notes: str | None = None
    matter_id: uuid.UUID | None = None


class ContactResponse(BaseModel):
    id: uuid.UUID
    name: str
    role: str
    email: str | None
    phone: str | None
    firm: str | None
    notes: str | None
    matter_id: uuid.UUID | None
    matter_title: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Calendar ───────────────────────────────────────────────────────
class CalendarEventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    event_type: str = Field("hearing", max_length=30)
    event_date: datetime
    event_time: str | None = Field(None, max_length=20)
    location: str | None = Field(None, max_length=255)
    notes: str | None = None
    urgent: bool = False
    matter_id: uuid.UUID | None = None


class CalendarEventResponse(BaseModel):
    id: uuid.UUID
    title: str
    event_type: str
    event_date: datetime
    event_time: str | None
    location: str | None
    notes: str | None
    urgent: bool
    matter_id: uuid.UUID | None
    matter_title: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Filings ────────────────────────────────────────────────────────
class FilingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    filing_type: str = Field(..., max_length=100)
    status: str = Field("draft", max_length=20)
    filed_at: datetime | None = None
    due_at: datetime | None = None
    notes: str | None = None
    matter_id: uuid.UUID | None = None


class FilingResponse(BaseModel):
    id: uuid.UUID
    title: str
    filing_type: str
    status: str
    filed_at: datetime | None
    due_at: datetime | None
    notes: str | None
    matter_id: uuid.UUID | None
    matter_title: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
