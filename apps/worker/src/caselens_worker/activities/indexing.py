"""Indexing activity — AI analysis + status finalization (Temporal path).

The schemas, prompts, and 3-call analysis orchestration live in the shared
module `caselens.documents.analysis` so this Temporal path can never drift
from the inline pipeline (`caselens.documents.pipeline`).
"""

import structlog
from temporalio import activity
from sqlalchemy import select

from caselens.ai_gateway.providers import AllProvidersFailedError
from caselens.db.session import async_session_factory
from caselens.db.models import Document, DocumentStatus
from caselens.documents.analysis import merge_matter_metadata, run_case_analysis

logger = structlog.get_logger()


@activity.defn
async def index_document(document_id_str: str) -> dict:
    """Run the AI case analysis, store metadata, mark document as ready."""
    logger.info("activity.index_document", document_id=document_id_str)
    import uuid
    document_id = uuid.UUID(document_id_str)

    from caselens.ai_gateway.providers import get_analysis_llm_provider
    llm = get_analysis_llm_provider()

    # Load text in a short-lived session; don't hold a DB connection across
    # the (slow) LLM calls.
    async with async_session_factory() as session:
        result = await session.execute(
            select(Document.title).where(Document.id == document_id)
        )
        title = result.scalar_one_or_none()
        if title is None:
            return {"document_id": document_id_str, "indexed": False, "status": "missing"}

        from caselens.db.models import DocumentChunk
        chunk_result = await session.execute(
            select(DocumentChunk.text_content)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.page_number, DocumentChunk.id)
        )
        full_text = "\n\n".join(chunk_result.scalars().all())

    try:
        summary, metadata_dict = await run_case_analysis(llm, title, full_text)
    except AllProvidersFailedError:
        # Every AI provider is unavailable — mark the document ERROR
        # (retryable) instead of saving fake analysis, and re-raise so
        # Temporal records the activity failure.
        logger.error(
            "activity.index_document.providers_unavailable",
            document_id=document_id_str,
        )
        async with async_session_factory() as session:
            result = await session.execute(
                select(Document).where(Document.id == document_id)
            )
            doc = result.scalar_one_or_none()
            if doc:
                doc.status = DocumentStatus.ERROR
                await session.commit()
        raise

    async with async_session_factory() as session:
        result = await session.execute(
            select(Document).where(Document.id == document_id)
        )
        doc = result.scalar_one_or_none()
        if doc:
            from caselens.db.models import Matter

            doc.summary = summary
            doc.status = DocumentStatus.READY
            doc.metadata_ = metadata_dict

            result_matter = await session.execute(
                select(Matter).where(Matter.id == doc.matter_id)
            )
            matter = result_matter.scalar_one_or_none()
            if matter:
                merged, new_title = merge_matter_metadata(matter.metadata_, metadata_dict)
                matter.metadata_ = merged
                if new_title:
                    matter.title = new_title

            await session.commit()

    return {
        "document_id": document_id_str,
        "indexed": True,
        "status": "ready",
    }
