"""Search Pydantic schemas."""

import uuid

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(5, ge=1, le=50)
    search_type: str = Field("hybrid", pattern=r"^(hybrid|fulltext|vector)$")


class SearchResultItem(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    page_number: int
    text_content: str
    relevance_score: float
    search_type: str


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total_results: int
    search_type: str
    duration_ms: int
