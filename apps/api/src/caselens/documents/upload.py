"""Document upload route — attached to matters router for /matters/{id}/documents."""

import hashlib
import uuid

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select

from caselens.config import settings
from caselens.db.models import Document, DocumentStatus, Matter, MatterMember
from caselens.dependencies import DbSession, OrgMember
from caselens.documents.pipeline import dispatch_processing
from caselens.documents.schemas import DocumentListResponse, DocumentResponse

logger = structlog.get_logger()

router = APIRouter()


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

    # Validate file
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No filename provided")

    content_type = file.content_type or "application/octet-stream"
    if content_type not in settings.allowed_mime_types_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{content_type}' is not allowed. Allowed: {settings.ALLOWED_MIME_TYPES}",
        )

    # Read file content
    file_content = await file.read()
    file_size = len(file_content)

    if file_size > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum of {settings.MAX_UPLOAD_SIZE_MB}MB",
        )

    # Validate PDF magic bytes
    if content_type == "application/pdf" and not file_content[:5] == b"%PDF-":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File does not appear to be a valid PDF",
        )

    # Generate checksum
    checksum = hashlib.sha256(file_content).hexdigest()

    # Generate storage key
    storage_key = (
        f"orgs/{current_user.organization_id}/matters/{matter_id}/"
        f"documents/{uuid.uuid4()}/{file.filename}"
    )

    # Create document record
    doc = Document(
        organization_id=current_user.organization_id,
        matter_id=matter_id,
        title=file.filename,
        original_filename=file.filename,
        mime_type=content_type,
        file_size_bytes=file_size,
        storage_key=storage_key,
        checksum_sha256=checksum,
        status=DocumentStatus.PENDING,
    )
    db.add(doc)
    await db.flush()

    # Store file in object storage
    from caselens.storage.backend import get_storage_backend
    storage = get_storage_backend()
    await storage.upload(storage_key, file_content, content_type)

    # Commit now so the row is durably visible to the background task's own
    # DB session (inline mode) before it starts.
    doc.status = DocumentStatus.PROCESSING
    await db.commit()
    await db.refresh(doc)

    try:
        await dispatch_processing(background_tasks, doc)
    except Exception as e:
        logger.error("documents.upload.dispatch_failed", document_id=str(doc.id), error=str(e))
        doc.status = DocumentStatus.ERROR
        await db.commit()

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
