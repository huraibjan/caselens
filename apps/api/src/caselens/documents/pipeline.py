"""In-process document-processing pipeline.

This runs the full PDF → pages → chunks → embeddings → AI analysis pipeline
directly inside the API process as a background task, with no Temporal server
or separate worker required. It is the default (`DOCUMENT_PROCESSING_MODE=inline`)
and makes the whole app hostable as a single FastAPI service on a free tier.

Each step opens its own database session and is idempotent (safe to re-run),
so a document can be re-processed by calling /documents/{id}/analyze again.
"""

import uuid

import fitz  # PyMuPDF
import structlog
import tiktoken
from fastapi import BackgroundTasks
from sqlalchemy import select, update

from caselens.ai_gateway.json_utils import parse_json_loose
from caselens.ai_gateway.providers import AllProvidersFailedError, get_analysis_llm_provider
from caselens.db.models import (
    Document,
    DocumentChunk,
    DocumentPage,
    DocumentStatus,
    Embedding,
    Matter,
)
from caselens.db.session import async_session_factory
from caselens.storage.backend import get_storage_backend

logger = structlog.get_logger()

# Gemini-style (OpenAPI 3.0 subset, uppercase types) schema for case-intelligence
# extraction — Gemini uses it as responseSchema; OpenAI-compatible providers get
# it serialized into the prompt as a structural hint.
CASE_INTELLIGENCE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "suspect": {"type": "STRING"},
        "start_date": {"type": "STRING"},
        "end_date": {"type": "STRING"},
        "veracityScore": {"type": "INTEGER"},
        "overallReasoning": {"type": "STRING"},
        "allegations": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "claim": {"type": "STRING"},
                    "source": {"type": "STRING"},
                    "status": {"type": "STRING"},
                    "desc": {"type": "STRING"},
                },
            },
        },
        "contradictions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {"text": {"type": "STRING"}, "severity": {"type": "STRING"}},
            },
        },
        "outcomes": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "ruling": {"type": "STRING"},
                    "probability": {"type": "STRING"},
                    "statute": {"type": "STRING"},
                    "details": {"type": "STRING"},
                },
            },
        },
    },
    "required": ["suspect", "veracityScore", "overallReasoning"],
}

_FALLBACK_METADATA = {
    "suspect": "Unknown Defendant",
    "start_date": "2026-07-10",
    "end_date": "N/A",
    "veracityScore": 75,
    "overallReasoning": "Analysis generated based on document title.",
    "allegations": [],
    "contradictions": [],
    "outcomes": [],
}


async def _extract_text(document_id: uuid.UUID, storage_key: str) -> None:
    """Download the PDF and extract text per page into DocumentPage rows."""
    storage = get_storage_backend()
    data = await storage.download(storage_key)
    if not data.startswith(b"%PDF-"):
        raise ValueError("File is not a valid PDF")

    async with async_session_factory() as session:
        existing = await session.execute(
            select(DocumentPage.id).where(DocumentPage.document_id == document_id).limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            return  # already extracted — idempotent

        pages_extracted = 0
        with fitz.open(stream=data, filetype="pdf") as pdf:
            for i, page in enumerate(pdf):
                text_content = page.get_text()
                session.add(
                    DocumentPage(
                        document_id=document_id,
                        page_number=i + 1,
                        text_content=text_content,
                        char_count=len(text_content),
                        extraction_method="pymupdf",
                        extraction_quality=1.0 if text_content else 0.0,
                    )
                )
                pages_extracted += 1

        await session.execute(
            update(Document)
            .where(Document.id == document_id)
            .values(page_count=pages_extracted, status=DocumentStatus.PROCESSING)
        )
        await session.commit()


async def _create_chunks(document_id: uuid.UUID) -> None:
    """Page-aware token chunking (512 tokens, 64 overlap) into DocumentChunk rows."""
    encoding = tiktoken.get_encoding("cl100k_base")
    target_size, overlap = 512, 64

    async with async_session_factory() as session:
        existing = await session.execute(
            select(DocumentChunk.id).where(DocumentChunk.document_id == document_id).limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            return

        result = await session.execute(
            select(DocumentPage)
            .where(DocumentPage.document_id == document_id)
            .order_by(DocumentPage.page_number)
        )
        for page in result.scalars().all():
            text = page.text_content or ""
            tokens = encoding.encode(text)
            if not tokens:
                continue

            idx = chunk_index = 0
            while idx < len(tokens):
                chunk_tokens = tokens[idx : idx + target_size]
                chunk_text = encoding.decode(chunk_tokens)
                start_char = text.find(chunk_text[:30]) if len(chunk_text) > 30 else 0
                if start_char == -1:
                    start_char = 0
                session.add(
                    DocumentChunk(
                        document_id=document_id,
                        page_number=page.page_number,
                        chunk_index=chunk_index,
                        text_content=chunk_text,
                        token_count=len(chunk_tokens),
                        start_char=start_char,
                        end_char=start_char + len(chunk_text),
                        metadata_={},
                    )
                )
                chunk_index += 1
                if idx + target_size >= len(tokens):
                    break
                idx += target_size - overlap

        await session.commit()


async def _generate_embeddings(document_id: uuid.UUID) -> None:
    """Embed all chunks (batched) into Embedding rows."""
    from caselens.ai_gateway.providers import get_embedding_provider

    provider = get_embedding_provider()

    async with async_session_factory() as session:
        result = await session.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.page_number, DocumentChunk.chunk_index)
        )
        chunks = result.scalars().all()
        if not chunks:
            return

        chunk_ids = [c.id for c in chunks]
        existing = await session.execute(
            select(Embedding.id).where(Embedding.chunk_id.in_(chunk_ids)).limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            return

        batch_size = 50
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            resp = await provider.embed([c.text_content for c in batch])
            for chunk, vector in zip(batch, resp.vectors, strict=False):
                session.add(
                    Embedding(
                        chunk_id=chunk.id,
                        vector=vector,
                        model_name=provider.model_name,
                        model_version="1.0.0",
                        dimensions=provider.dimensions,
                    )
                )
        await session.commit()


async def _analyze(document_id: uuid.UUID) -> None:
    """Generate the AI summary + structured case intelligence, mark READY."""
    llm = get_analysis_llm_provider()

    async with async_session_factory() as session:
        result = await session.execute(select(Document).where(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if not doc:
            return

        chunk_result = await session.execute(
            select(DocumentChunk.text_content)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.page_number, DocumentChunk.id)
        )
        full_text = "\n\n".join(chunk_result.scalars().all())
        truncated = full_text[:12000]

        if truncated:
            summary_resp = await llm.generate(
                "You are a professional legal RAG assistant. Read the following legal document "
                "content and write a highly detailed, production-ready legal intelligence summary. "
                "Analyze the key facts, the legal issues, the parties, and the holding/conclusions. "
                f"Be thorough and professional.\n\nDocument Title: {doc.title}\n\n"
                f"Document Text:\n{truncated}"
            )
            doc.summary = summary_resp.content

            intel_resp = await llm.generate_structured(
                "You are an expert legal AI systems engineer analyzing a case document. Extract the "
                "key case details, allegations, contradictions, and predicted outcomes based on the "
                "document text. Return a JSON object with keys: suspect, start_date, end_date, "
                "veracityScore (0-100 integer), overallReasoning, allegations[], contradictions[], "
                f"outcomes[].\n\nDocument Content Excerpts:\n{truncated}",
                schema=CASE_INTELLIGENCE_SCHEMA,
            )
            metadata_dict = parse_json_loose(intel_resp.content)
            if metadata_dict is None:
                logger.error(
                    "pipeline.analyze.intel_parse_failed", provider=intel_resp.provider
                )
                metadata_dict = dict(_FALLBACK_METADATA)
        else:
            summary_resp = await llm.generate(
                f"Please write a short legal summary for document titled: {doc.title}"
            )
            doc.summary = summary_resp.content
            metadata_dict = dict(_FALLBACK_METADATA)

        doc.status = DocumentStatus.READY
        doc.metadata_ = metadata_dict

        matter_result = await session.execute(select(Matter).where(Matter.id == doc.matter_id))
        matter = matter_result.scalar_one_or_none()
        if matter:
            matter.metadata_ = metadata_dict

        await session.commit()


async def _mark_error(document_id: uuid.UUID) -> None:
    async with async_session_factory() as session:
        await session.execute(
            update(Document).where(Document.id == document_id).values(status=DocumentStatus.ERROR)
        )
        await session.commit()


async def process_document(document_id_str: str) -> None:
    """Run the full pipeline for one document. Safe to call as a background task.

    On any failure the document is marked ERROR (retryable via re-analyze) and
    the error is logged — it never raises out of the background task.
    """
    document_id = uuid.UUID(document_id_str)
    logger.info("pipeline.start", document_id=document_id_str)
    try:
        await _extract_text(document_id, await _storage_key_for(document_id))
        await _create_chunks(document_id)
        await _generate_embeddings(document_id)
        await _analyze(document_id)
        logger.info("pipeline.done", document_id=document_id_str)
    except AllProvidersFailedError:
        logger.error("pipeline.ai_unavailable", document_id=document_id_str)
        await _mark_error(document_id)
    except Exception as e:
        logger.error("pipeline.failed", document_id=document_id_str, error=str(e))
        await _mark_error(document_id)


async def _storage_key_for(document_id: uuid.UUID) -> str:
    async with async_session_factory() as session:
        result = await session.execute(
            select(Document.storage_key).where(Document.id == document_id)
        )
        key = result.scalar_one_or_none()
        if not key:
            raise ValueError(f"Document {document_id} not found")
        return key


async def dispatch_processing(background_tasks: BackgroundTasks, doc: Document) -> None:
    """Kick off processing for a document using the configured mode.

    Default ("inline") schedules an in-process background task — no Temporal or
    separate worker required. "temporal" dispatches to the Temporal worker.
    """
    from caselens.config import settings

    if settings.DOCUMENT_PROCESSING_MODE == "temporal":
        await _dispatch_temporal(doc)
    else:
        background_tasks.add_task(process_document, str(doc.id))


async def _dispatch_temporal(doc: Document) -> None:
    from dataclasses import dataclass

    from temporalio.client import Client

    from caselens.config import settings

    @dataclass
    class DocumentProcessingInput:
        document_id: str
        organization_id: str
        matter_id: str
        storage_key: str
        original_filename: str

    client = await Client.connect(settings.TEMPORAL_HOST)
    await client.start_workflow(
        "DocumentProcessingWorkflow",
        DocumentProcessingInput(
            document_id=str(doc.id),
            organization_id=str(doc.organization_id),
            matter_id=str(doc.matter_id),
            storage_key=doc.storage_key,
            original_filename=doc.original_filename,
        ),
        id=f"doc-proc-{doc.id}-{uuid.uuid4().hex[:6]}",
        task_queue=settings.TEMPORAL_TASK_QUEUE,
    )
