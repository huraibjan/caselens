"""RAG Pydantic schemas."""

import uuid

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=5000)
    top_k: int = Field(5, ge=1, le=20)
    conversation_id: uuid.UUID | None = None


class CitationDetail(BaseModel):
    document_id: uuid.UUID
    document_name: str
    page_number: int
    chunk_id: uuid.UUID
    excerpt: str
    relevance_score: float
    source_type: str


class AskResponse(BaseModel):
    answer: str
    confidence: float
    citations: list[CitationDetail]
    requires_human_review: bool = True
    conversation_id: uuid.UUID
    message_id: uuid.UUID
    model_run_id: uuid.UUID | None = None
    retrieval_run_id: uuid.UUID | None = None
    abstained: bool = False
    disclaimer: str = (
        "This response is AI-generated and should not be treated as legal advice. "
        "All claims are supported by cited source documents. "
        "A qualified attorney should review this analysis before relying on it."
    )


class ReviewRequest(BaseModel):
    status: str = Field(..., pattern=r"^(approved|rejected|revised)$")
    note: str | None = None
