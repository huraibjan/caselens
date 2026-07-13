"""Documents API routes — upload, list, get, status, download, page content."""

import uuid
from typing import Any

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import select

from caselens.db.models import (
    Document,
    DocumentPage,
    DocumentStatus,
    MatterMember,
    ProcessingStep,
    ProcessingWorkflow,
)
from caselens.dependencies import DbSession, OrgMember
from caselens.documents.pipeline import dispatch_processing
from caselens.documents.schemas import (
    DocumentResponse,
    DocumentStatusResponse,
    PageContentResponse,
    ProcessingStepResponse,
)

logger = structlog.get_logger()

router = APIRouter()


async def _verify_document_access(
    db: DbSession, document_id: uuid.UUID, user_id: uuid.UUID, org_id: uuid.UUID
) -> Document:
    """Verify user has access to a document via matter membership."""
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.organization_id == org_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Verify matter access
    member_result = await db.execute(
        select(MatterMember).where(
            MatterMember.matter_id == doc.matter_id,
            MatterMember.user_id == user_id,
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="No access to this document"
        )

    return doc


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    current_user: OrgMember,
    db: DbSession,
) -> DocumentResponse:
    """Get document details."""
    assert current_user.organization_id is not None
    doc = await _verify_document_access(
        db, document_id, current_user.sub, current_user.organization_id
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


@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(
    document_id: uuid.UUID,
    current_user: OrgMember,
    db: DbSession,
) -> DocumentStatusResponse:
    """Get document processing status with step details."""
    assert current_user.organization_id is not None
    doc = await _verify_document_access(
        db, document_id, current_user.sub, current_user.organization_id
    )

    # Get workflow and steps
    workflow_result = await db.execute(
        select(ProcessingWorkflow).where(ProcessingWorkflow.document_id == doc.id)
    )
    workflow = workflow_result.scalar_one_or_none()

    steps: list[ProcessingStepResponse] = []
    if workflow:
        steps_result = await db.execute(
            select(ProcessingStep)
            .where(ProcessingStep.workflow_id == workflow.id)
            .order_by(ProcessingStep.step_order)
        )
        for step in steps_result.scalars().all():
            steps.append(
                ProcessingStepResponse(
                    step_name=step.step_name,
                    step_order=step.step_order,
                    status=step.status.value,
                    started_at=step.started_at,
                    completed_at=step.completed_at,
                    duration_ms=step.duration_ms,
                    error_message=step.error_message,
                )
            )

    return DocumentStatusResponse(
        document_id=doc.id,
        status=doc.status.value,
        steps=steps,
    )


@router.get("/{document_id}/pages/{page_number}", response_model=PageContentResponse)
async def get_page_content(
    document_id: uuid.UUID,
    page_number: int,
    current_user: OrgMember,
    db: DbSession,
) -> PageContentResponse:
    """Get the text content of a specific page."""
    assert current_user.organization_id is not None
    doc = await _verify_document_access(
        db, document_id, current_user.sub, current_user.organization_id
    )

    result = await db.execute(
        select(DocumentPage).where(
            DocumentPage.document_id == doc.id,
            DocumentPage.page_number == page_number,
        )
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")

    return PageContentResponse(
        document_id=doc.id,
        page_number=page.page_number,
        text_content=page.text_content,
        char_count=page.char_count,
        extraction_method=page.extraction_method,
    )


@router.get("/{document_id}/download")
async def download_document(
    document_id: uuid.UUID,
    current_user: OrgMember,
    db: DbSession,
) -> dict[str, Any]:
    """Get a signed download URL for the document."""
    assert current_user.organization_id is not None
    doc = await _verify_document_access(
        db, document_id, current_user.sub, current_user.organization_id
    )

    # In Phase 1, return a placeholder URL. Real signed URL requires storage backend.
    return {
        "download_url": f"/api/v1/storage/{doc.storage_key}",
        "filename": doc.original_filename,
        "expires_in": 3600,
    }


@router.post("/{document_id}/analyze", response_model=DocumentResponse)
async def analyze_document(
    document_id: uuid.UUID,
    current_user: OrgMember,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> DocumentResponse:
    """Trigger AI processing and analysis for an existing document."""
    assert current_user.organization_id is not None
    doc = await _verify_document_access(
        db, document_id, current_user.sub, current_user.organization_id
    )

    # Commit PROCESSING now so the background task's own DB session sees it.
    doc.status = DocumentStatus.PROCESSING
    await db.commit()
    await db.refresh(doc)

    try:
        await dispatch_processing(background_tasks, doc)
    except Exception as e:
        logger.error("documents.analyze.dispatch_failed", document_id=str(doc.id), error=str(e))
        doc.status = DocumentStatus.ERROR
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start analysis: {e}",
        ) from e

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

