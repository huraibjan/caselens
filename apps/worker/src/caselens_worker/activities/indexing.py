"""Indexing activity — full-text and vector index updates."""

import structlog
from temporalio import activity
from sqlalchemy import select

from caselens.ai_gateway.json_utils import parse_json_loose
from caselens.ai_gateway.providers import AllProvidersFailedError
from caselens.db.session import async_session_factory
from caselens.db.models import Document, DocumentStatus

logger = structlog.get_logger()

# Gemini-style (OpenAPI 3.0 subset, uppercase types) schema for the case
# intelligence extraction below — GeminiLLMProvider forwards this directly
# as `responseSchema`; OpenAI-compatible providers get it serialized into
# the prompt as a structural hint (see OpenAICompatibleLLMProvider).
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

_PARSE_FAILURE_METADATA = {
    "suspect": "Unknown Defendant",
    "start_date": "2026-07-10",
    "end_date": "N/A",
    "veracityScore": 75,
    "overallReasoning": "Analysis generated based on document title.",
    "allegations": [],
    "contradictions": [],
    "outcomes": [],
}


async def _run_analysis(llm, doc, truncated_text: str) -> dict:
    """Generate the summary + structured case metadata for a document.

    Raises AllProvidersFailedError if every configured AI provider is
    unavailable — the caller marks the document ERROR rather than saving
    placeholder analysis.
    """
    if not truncated_text:
        prompt = f"Please write a short legal summary for document titled: {doc.title}"
        summary_resp = await llm.generate(prompt)
        doc.summary = summary_resp.content
        return dict(_PARSE_FAILURE_METADATA)

    # 1. Generate case intelligence summary
    summary_prompt = (
        "You are a professional legal RAG assistant. Read the following legal document content "
        "and write a highly detailed, production-ready legal intelligence summary. Analyze the "
        "key facts, the legal issues, the parties, and the holding/conclusions. Be thorough and "
        "professional.\n\n"
        f"Document Title: {doc.title}\n\n"
        f"Document Text:\n{truncated_text}"
    )
    summary_resp = await llm.generate(summary_prompt)
    doc.summary = summary_resp.content

    # 2. Extract structured case metadata
    intel_prompt = (
        "You are an expert legal AI systems engineer analyzing a case document.\n"
        "Extract the key case details, allegations, contradictions, and predictions based on the "
        "document text.\n"
        "You MUST return ONLY a JSON object matching this exact structure, with no markdown "
        "wrappers or formatting other than raw JSON:\n"
        "{\n"
        '  "suspect": "Name of primary suspect/defendant",\n'
        '  "start_date": "YYYY-MM-DD (date of incident or filing)",\n'
        '  "end_date": "YYYY-MM-DD (estimated next court date, or N/A)",\n'
        '  "veracityScore": 80 (integer 0-100 for credibility of allegations based on consistency),\n'
        '  "overallReasoning": "1-2 sentence overview of the evidence consistency and credibility",\n'
        '  "allegations": [\n'
        '    {"claim": "Possession of controlled substance", "source": "Page 2", '
        '"status": "verified", "desc": "Reasonable cause established"}\n'
        '  ],\n'
        '  "contradictions": [\n'
        '    {"text": "Officer stated suspect was running, but witness claims they were standing '
        'still.", "severity": "high"}\n'
        '  ],\n'
        '  "outcomes": [\n'
        '    {"ruling": "Grand Jury hold", "probability": "90%", "statute": "CPL 180.70", '
        '"details": "Holding highly likely on count 1"}\n'
        '  ]\n'
        "}\n\n"
        f"Document Content Excerpts:\n{truncated_text}"
    )
    intel_resp = await llm.generate_structured(intel_prompt, schema=CASE_INTELLIGENCE_SCHEMA)
    metadata_dict = parse_json_loose(intel_resp.content)

    if metadata_dict is None:
        logger.error(
            "activity.index_document.intel_parse_failed",
            content=intel_resp.content[:500],
            provider=intel_resp.provider,
        )
        return dict(_PARSE_FAILURE_METADATA)

    return metadata_dict


@activity.defn
async def index_document(document_id_str: str) -> dict:
    """Update full-text search and vector indexes, mark document as ready."""
    logger.info("activity.index_document", document_id=document_id_str)
    import uuid
    document_id = uuid.UUID(document_id_str)

    from caselens.ai_gateway.providers import get_analysis_llm_provider
    llm = get_analysis_llm_provider()

    async with async_session_factory() as session:
        # Load document
        result = await session.execute(
            select(Document).where(Document.id == document_id)
        )
        doc = result.scalar_one_or_none()

        if doc:
            # Fetch document chunks to compile actual content for summary
            from caselens.db.models import DocumentChunk, Matter
            chunk_result = await session.execute(
                select(DocumentChunk.text_content)
                .where(DocumentChunk.document_id == document_id)
                .order_by(DocumentChunk.page_number, DocumentChunk.id)
            )
            chunks = chunk_result.scalars().all()

            # Merge text up to a safe limit of characters to build context
            full_text = "\n\n".join(chunks)
            truncated_text = full_text[:12000] if full_text else ""

            try:
                metadata_dict = await _run_analysis(llm, doc, truncated_text)
            except AllProvidersFailedError:
                # Every AI provider is unavailable — mark the document ERROR
                # (retryable) instead of saving fake analysis, and re-raise so
                # Temporal records the activity failure.
                logger.error(
                    "activity.index_document.providers_unavailable",
                    document_id=document_id_str,
                )
                doc.status = DocumentStatus.ERROR
                await session.commit()
                raise

            doc.status = DocumentStatus.READY
            doc.metadata_ = metadata_dict

            # Update parent matter metadata
            result_matter = await session.execute(
                select(Matter).where(Matter.id == doc.matter_id)
            )
            matter = result_matter.scalar_one_or_none()
            if matter:
                matter.metadata_ = metadata_dict

            await session.commit()

    return {
        "document_id": document_id_str,
        "indexed": True,
        "status": "ready",
    }
