"""Document upload route — attached to matters router for /matters/{id}/documents."""

import uuid

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select

from caselens.config import settings
from caselens.db.models import Document, DocumentStatus, Matter, MatterMember
from caselens.dependencies import DbSession, OrgMember
from caselens.documents.pipeline import dispatch_processing
from caselens.documents.schemas import (
    DocumentListResponse,
    DocumentResponse,
    QuickUploadResponse,
)

logger = structlog.get_logger()

router = APIRouter()

_ALLOWED_EXTENSIONS = (".pdf", ".docx", ".txt")


async def _validate_and_read(file: UploadFile) -> tuple[bytes, str]:
    """Validate the upload (type, size, PDF signature) and return (bytes, mime)."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No filename provided")

    # Accept by MIME type OR extension — browsers report Office/plain-text MIME
    # types inconsistently (sometimes application/octet-stream).
    content_type = file.content_type or "application/octet-stream"
    ext_ok = file.filename.lower().endswith(_ALLOWED_EXTENSIONS)
    mime_ok = content_type in settings.allowed_mime_types_list
    if not (mime_ok or ext_ok):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Please upload a PDF, Word (.docx), or text (.txt) file.",
        )

    file_content = await file.read()
    if len(file_content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum of {settings.MAX_UPLOAD_SIZE_MB}MB",
        )

    is_pdf = content_type == "application/pdf" or file.filename.lower().endswith(".pdf")
    if is_pdf and not file_content[:5] == b"%PDF-":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File does not appear to be a valid PDF",
        )
    return file_content, content_type


async def _ingest_document(
    *,
    file: UploadFile,
    file_content: bytes,
    content_type: str,
    org_id: uuid.UUID,
    matter_id: uuid.UUID,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> Document:
    """Persist the file, create the Document row, and dispatch processing."""
    import hashlib as _hashlib

    checksum = _hashlib.sha256(file_content).hexdigest()
    storage_key = (
        f"orgs/{org_id}/matters/{matter_id}/documents/{uuid.uuid4()}/{file.filename}"
    )

    doc = Document(
        organization_id=org_id,
        matter_id=matter_id,
        title=file.filename,
        original_filename=file.filename,
        mime_type=content_type,
        file_size_bytes=len(file_content),
        storage_key=storage_key,
        checksum_sha256=checksum,
        status=DocumentStatus.PENDING,
    )
    db.add(doc)
    await db.flush()

    from caselens.storage.backend import get_storage_backend
    storage = get_storage_backend()
    await storage.upload(storage_key, file_content, content_type)

    # Commit now so the row is durably visible to the background task's session.
    doc.status = DocumentStatus.PROCESSING
    await db.commit()
    await db.refresh(doc)

    try:
        await dispatch_processing(background_tasks, doc)
    except Exception as e:
        logger.error("documents.ingest.dispatch_failed", document_id=str(doc.id), error=str(e))
        doc.status = DocumentStatus.ERROR
        await db.commit()

    return doc


@router.post("/quick-upload", response_model=QuickUploadResponse, status_code=status.HTTP_201_CREATED)
async def quick_upload(
    file: UploadFile,
    current_user: OrgMember,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> QuickUploadResponse:
    """Drop a file with no matter form — auto-creates a matter, ingests the
    document, and analyzes it. The matter is renamed to the AI-detected case
    caption once analysis completes (see analysis.merge_matter_metadata)."""
    assert current_user.organization_id is not None

    # Validate before creating anything, so a bad file doesn't leave an orphan matter.
    file_content, content_type = await _validate_and_read(file)

    stem = (file.filename or "Untitled").rsplit(".", 1)[0][:120]
    matter = Matter(
        organization_id=current_user.organization_id,
        title=stem,
        metadata_={"auto_named": True},
    )
    db.add(matter)
    await db.flush()
    db.add(MatterMember(matter_id=matter.id, user_id=current_user.sub, role="lead"))
    await db.commit()

    doc = await _ingest_document(
        file=file,
        file_content=file_content,
        content_type=content_type,
        org_id=current_user.organization_id,
        matter_id=matter.id,
        db=db,
        background_tasks=background_tasks,
    )

    return QuickUploadResponse(
        matter_id=matter.id,
        document_id=doc.id,
        matter_title=matter.title,
        status=doc.status.value.lower(),
    )


@router.post(
    "/{matter_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    matter_id: uuid.UUID,
    file: UploadFile,
    current_user: OrgMember,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> DocumentResponse:
    """Upload a document to a matter."""
    assert current_user.organization_id is not None

    # Verify matter access
    matter_result = await db.execute(
        select(Matter).where(
            Matter.id == matter_id,
            Matter.organization_id == current_user.organization_id,
        )
    )
    matter = matter_result.scalar_one_or_none()
    if not matter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matter not found")

    member_result = await db.execute(
        select(MatterMember).where(
            MatterMember.matter_id == matter_id,
            MatterMember.user_id == current_user.sub,
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this matter")

    file_content, content_type = await _validate_and_read(file)
    doc = await _ingest_document(
        file=file,
        file_content=file_content,
        content_type=content_type,
        org_id=current_user.organization_id,
        matter_id=matter_id,
        db=db,
        background_tasks=background_tasks,
    )

    return DocumentResponse(
        id=doc.id,
        matter_id=doc.matter_id,
        organization_id=doc.organization_id,
        title=doc.title,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        file_size_bytes=doc.file_size_bytes,
        page_count=doc.page_count,
        status=doc.status.value,
        summary=doc.summary,
        checksum_sha256=doc.checksum_sha256,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        metadata=doc.case_metadata,
    )


@router.get("/{matter_id}/documents", response_model=DocumentListResponse)
async def list_matter_documents(
    matter_id: uuid.UUID,
    current_user: OrgMember,
    db: DbSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> DocumentListResponse:
    """List documents in a matter."""
    assert current_user.organization_id is not None

    # Verify matter access
    member_result = await db.execute(
        select(MatterMember).where(
            MatterMember.matter_id == matter_id,
            MatterMember.user_id == current_user.sub,
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this matter")

    # Count
    count_result = await db.execute(
        select(func.count()).where(
            Document.matter_id == matter_id,
            Document.organization_id == current_user.organization_id,
        )
    )
    total = count_result.scalar() or 0

    # Fetch
    result = await db.execute(
        select(Document)
        .where(
            Document.matter_id == matter_id,
            Document.organization_id == current_user.organization_id,
        )
        .order_by(Document.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    docs = result.scalars().all()

    items = [
        DocumentResponse(
            id=d.id,
            matter_id=d.matter_id,
            organization_id=d.organization_id,
            title=d.title,
            original_filename=d.original_filename,
            mime_type=d.mime_type,
            file_size_bytes=d.file_size_bytes,
            page_count=d.page_count,
            status=d.status.value,
            summary=d.summary,
            checksum_sha256=d.checksum_sha256,
            created_at=d.created_at,
            updated_at=d.updated_at,
            metadata=d.case_metadata,
        )
        for d in docs
    ]

    return DocumentListResponse(items=items, total=total)
