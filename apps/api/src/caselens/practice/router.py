"""CRUD routes for contacts, calendar events, and filings (org-scoped)."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete as sa_delete
from sqlalchemy import select

from caselens.db.models import CalendarEvent, Contact, Filing, Matter
from caselens.dependencies import DbSession, OrgMember
from caselens.practice.schemas import (
    CalendarEventCreate,
    CalendarEventResponse,
    ContactCreate,
    ContactResponse,
    FilingCreate,
    FilingResponse,
)

contacts_router = APIRouter()
calendar_router = APIRouter()
filings_router = APIRouter()


async def _matter_titles(db: DbSession, org_id: uuid.UUID, matter_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    ids = [m for m in matter_ids if m]
    if not ids:
        return {}
    result = await db.execute(
        select(Matter.id, Matter.title).where(
            Matter.id.in_(ids), Matter.organization_id == org_id
        )
    )
    return {row[0]: row[1] for row in result}


async def _validate_matter(db: DbSession, org_id: uuid.UUID, matter_id: uuid.UUID | None) -> None:
    if matter_id is None:
        return
    result = await db.execute(
        select(Matter.id).where(Matter.id == matter_id, Matter.organization_id == org_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Matter not found")


# ── Contacts ───────────────────────────────────────────────────────
@contacts_router.get("", response_model=list[ContactResponse])
async def list_contacts(current_user: OrgMember, db: DbSession) -> list[ContactResponse]:
    assert current_user.organization_id is not None
    result = await db.execute(
        select(Contact)
        .where(Contact.organization_id == current_user.organization_id)
        .order_by(Contact.created_at.desc())
    )
    rows = list(result.scalars().all())
    titles = await _matter_titles(db, current_user.organization_id, [r.matter_id for r in rows if r.matter_id])
    out: list[ContactResponse] = []
    for r in rows:
        resp = ContactResponse.model_validate(r)
        resp.matter_title = titles.get(r.matter_id) if r.matter_id else None
        out.append(resp)
    return out


@contacts_router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(request: ContactCreate, current_user: OrgMember, db: DbSession) -> ContactResponse:
    assert current_user.organization_id is not None
    await _validate_matter(db, current_user.organization_id, request.matter_id)
    contact = Contact(organization_id=current_user.organization_id, **request.model_dump())
    db.add(contact)
    await db.flush()
    return ContactResponse.model_validate(contact)


@contacts_router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(contact_id: uuid.UUID, current_user: OrgMember, db: DbSession) -> None:
    assert current_user.organization_id is not None
    await db.execute(
        sa_delete(Contact).where(
            Contact.id == contact_id, Contact.organization_id == current_user.organization_id
        )
    )


# ── Calendar events ────────────────────────────────────────────────
@calendar_router.get("", response_model=list[CalendarEventResponse])
async def list_events(current_user: OrgMember, db: DbSession) -> list[CalendarEventResponse]:
    assert current_user.organization_id is not None
    result = await db.execute(
        select(CalendarEvent)
        .where(CalendarEvent.organization_id == current_user.organization_id)
        .order_by(CalendarEvent.event_date.asc())
    )
    rows = list(result.scalars().all())
    titles = await _matter_titles(db, current_user.organization_id, [r.matter_id for r in rows if r.matter_id])
    out: list[CalendarEventResponse] = []
    for r in rows:
        resp = CalendarEventResponse.model_validate(r)
        resp.matter_title = titles.get(r.matter_id) if r.matter_id else None
        out.append(resp)
    return out


@calendar_router.post("", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(request: CalendarEventCreate, current_user: OrgMember, db: DbSession) -> CalendarEventResponse:
    assert current_user.organization_id is not None
    await _validate_matter(db, current_user.organization_id, request.matter_id)
    event = CalendarEvent(organization_id=current_user.organization_id, **request.model_dump())
    db.add(event)
    await db.flush()
    return CalendarEventResponse.model_validate(event)


@calendar_router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(event_id: uuid.UUID, current_user: OrgMember, db: DbSession) -> None:
    assert current_user.organization_id is not None
    await db.execute(
        sa_delete(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.organization_id == current_user.organization_id,
        )
    )


# ── Filings ────────────────────────────────────────────────────────
@filings_router.get("", response_model=list[FilingResponse])
async def list_filings(current_user: OrgMember, db: DbSession) -> list[FilingResponse]:
    assert current_user.organization_id is not None
    result = await db.execute(
        select(Filing)
        .where(Filing.organization_id == current_user.organization_id)
        .order_by(Filing.created_at.desc())
    )
    rows = list(result.scalars().all())
    titles = await _matter_titles(db, current_user.organization_id, [r.matter_id for r in rows if r.matter_id])
    out: list[FilingResponse] = []
    for r in rows:
        resp = FilingResponse.model_validate(r)
        resp.matter_title = titles.get(r.matter_id) if r.matter_id else None
        out.append(resp)
    return out


@filings_router.post("", response_model=FilingResponse, status_code=status.HTTP_201_CREATED)
async def create_filing(request: FilingCreate, current_user: OrgMember, db: DbSession) -> FilingResponse:
    assert current_user.organization_id is not None
    await _validate_matter(db, current_user.organization_id, request.matter_id)
    filing = Filing(organization_id=current_user.organization_id, **request.model_dump())
    db.add(filing)
    await db.flush()
    return FilingResponse.model_validate(filing)


@filings_router.patch("/{filing_id}", response_model=FilingResponse)
async def update_filing(
    filing_id: uuid.UUID, request: dict[str, Any], current_user: OrgMember, db: DbSession
) -> FilingResponse:
    assert current_user.organization_id is not None
    result = await db.execute(
        select(Filing).where(
            Filing.id == filing_id, Filing.organization_id == current_user.organization_id
        )
    )
    filing = result.scalar_one_or_none()
    if not filing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filing not found")
    if "status" in request and isinstance(request["status"], str):
        filing.status = request["status"][:20]
    await db.flush()
    return FilingResponse.model_validate(filing)


@filings_router.delete("/{filing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_filing(filing_id: uuid.UUID, current_user: OrgMember, db: DbSession) -> None:
    assert current_user.organization_id is not None
    await db.execute(
        sa_delete(Filing).where(
            Filing.id == filing_id, Filing.organization_id == current_user.organization_id
        )
    )
