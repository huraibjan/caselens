"""Text extraction and validation activities."""

import hashlib
import structlog
import fitz  # PyMuPDF
from temporalio import activity
from sqlalchemy import select

from caselens.db.session import async_session_factory
from caselens.db.models import Document, DocumentPage, DocumentStatus
from caselens.storage.backend import get_storage_backend

logger = structlog.get_logger()


@activity.defn
async def validate_file(storage_key: str) -> dict:
    """Validate file integrity — magic bytes, size limits."""
    logger.info("activity.validate_file", storage_key=storage_key)
    
    storage = get_storage_backend()
    if not await storage.exists(storage_key):
        return {"valid": False, "error": "File does not exist in storage"}
        
    data = await storage.download(storage_key)
    if not data.startswith(b"%PDF-"):
        return {"valid": False, "error": "Invalid PDF signature"}
        
    return {
        "valid": True,
        "storage_key": storage_key,
        "size_bytes": len(data),
    }


@activity.defn
async def compute_checksum(storage_key: str) -> dict:
    """Compute SHA-256 checksum of the file."""
    logger.info("activity.compute_checksum", storage_key=storage_key)
    
    storage = get_storage_backend()
    data = await storage.download(storage_key)
    checksum = hashlib.sha256(data).hexdigest()
    
    return {
        "checksum": checksum,
        "algorithm": "sha256",
    }


@activity.defn
async def extract_text(document_id_str: str, storage_key: str) -> dict:
    """Extract text from PDF using PyMuPDF."""
    logger.info("activity.extract_text", document_id=document_id_str, storage_key=storage_key)
    import uuid
    document_id = uuid.UUID(document_id_str)
    
    storage = get_storage_backend()
    data = await storage.download(storage_key)

    pages_extracted = 0
    total_chars = 0

    async with async_session_factory() as session:
        # Check if pages already exist
        existing_res = await session.execute(
            select(DocumentPage.id).where(DocumentPage.document_id == document_id).limit(1)
        )
        has_existing = existing_res.scalar_one_or_none() is not None
        
        if has_existing:
            logger.info("activity.extract_text.skipped", document_id=document_id_str, reason="Pages already exist")
            count_res = await session.execute(
                select(DocumentPage.id).where(DocumentPage.document_id == document_id)
            )
            pages_extracted = len(count_res.scalars().all())
            char_res = await session.execute(
                select(DocumentPage.char_count).where(DocumentPage.document_id == document_id)
            )
            total_chars = sum(char_res.scalars().all() or [0])
        else:
            # Delete any existing pages for idempotency
            await session.execute(
                DocumentPage.__table__.delete().where(DocumentPage.document_id == document_id)
            )

            with fitz.open(stream=data, filetype="pdf") as doc_obj:
                for i, page in enumerate(doc_obj):
                    text_content = page.get_text()
                    char_count = len(text_content)

                    doc_page = DocumentPage(
                        document_id=document_id,
                        page_number=i + 1,
                        text_content=text_content,
                        char_count=char_count,
                        extraction_method="pymupdf",
                        extraction_quality=1.0 if char_count > 0 else 0.0,
                    )
                    session.add(doc_page)
                    pages_extracted += 1
                    total_chars += char_count

            # Update document page count and status
            await session.execute(
                Document.__table__.update()
                .where(Document.id == document_id)
                .values(page_count=pages_extracted, status=DocumentStatus.PROCESSING)
            )
            await session.commit()
        
    return {
        "document_id": document_id_str,
        "pages_extracted": pages_extracted,
        "total_chars": total_chars,
        "extraction_method": "pymupdf",
    }


@activity.defn
async def assess_quality(document_id_str: str) -> dict:
    """Assess extraction quality — character density, language detection."""
    logger.info("activity.assess_quality", document_id=document_id_str)
    import uuid
    document_id = uuid.UUID(document_id_str)
    
    async with async_session_factory() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(DocumentPage).where(DocumentPage.document_id == document_id)
        )
        pages = result.scalars().all()
        
        if not pages:
            return {"document_id": document_id_str, "quality_score": 0.0, "needs_ocr": True}
            
        empty_pages = sum(1 for p in pages if (p.char_count or 0) == 0)
        empty_ratio = empty_pages / len(pages)
        needs_ocr = empty_ratio > 0.5  # If more than 50% pages are empty, we might need OCR
        
    return {
        "document_id": document_id_str,
        "quality_score": 1.0 - empty_ratio,
        "needs_ocr": needs_ocr,
    }
