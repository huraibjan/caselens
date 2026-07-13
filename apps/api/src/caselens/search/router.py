"""Search API routes — hybrid search across matter documents."""

import time
import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, text

from caselens.db.models import Document, MatterMember
from caselens.dependencies import DbSession, OrgMember
from caselens.search.schemas import SearchRequest, SearchResponse, SearchResultItem

router = APIRouter()


@router.post("/matters/{matter_id}/search", response_model=SearchResponse)
async def search_matter_documents(
    matter_id: uuid.UUID,
    request: SearchRequest,
    current_user: OrgMember,
    db: DbSession,
) -> SearchResponse:
    """Perform hybrid search across documents in a matter."""
    assert current_user.organization_id is not None
    start_time = time.monotonic()

    # Verify matter access
    member_result = await db.execute(
        select(MatterMember).where(
            MatterMember.matter_id == matter_id,
            MatterMember.user_id == current_user.sub,
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="No access to this matter"
        )

    results: list[SearchResultItem] = []

    # Full-text search using PostgreSQL ts_vector
    if request.search_type in ("hybrid", "fulltext"):
        ft_query = text("""
            SELECT dc.id, dc.document_id, dc.page_number, dc.text_content,
                   ts_rank(to_tsvector('english', dc.text_content), plainto_tsquery('english', :query)) as score
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            WHERE d.matter_id = :matter_id
              AND d.organization_id = :org_id
              AND to_tsvector('english', dc.text_content) @@ plainto_tsquery('english', :query)
            ORDER BY score DESC
            LIMIT :limit
        """)
        ft_result = await db.execute(
            ft_query,
            {
                "query": request.query,
                "matter_id": str(matter_id),
                "org_id": str(current_user.organization_id),
                "limit": request.top_k,
            },
        )
        for row in ft_result:
            # Get document title
            doc_result = await db.execute(
                select(Document.title).where(Document.id == row.document_id)
            )
            doc_title = doc_result.scalar() or "Unknown"

            results.append(
                SearchResultItem(
                    chunk_id=row.id,
                    document_id=row.document_id,
                    document_title=doc_title,
                    page_number=row.page_number,
                    text_content=row.text_content[:500],
                    relevance_score=float(row.score),
                    search_type="fulltext",
                )
            )

    # Vector search using pgvector
    if request.search_type in ("hybrid", "vector"):
        from caselens.ai_gateway.providers import get_embedding_provider
        embedder = get_embedding_provider()
        embed_resp = await embedder.embed([request.query])
        query_vector = embed_resp.vectors[0]

        vec_query = text("""
            SELECT dc.id, dc.document_id, dc.page_number, dc.text_content,
                   1 - (e.vector <=> CAST(:query_vector AS vector)) as score
            FROM embeddings e
            JOIN document_chunks dc ON dc.id = e.chunk_id
            JOIN documents d ON d.id = dc.document_id
            WHERE d.matter_id = :matter_id
              AND d.organization_id = :org_id
              AND d.status = 'READY'
            ORDER BY e.vector <=> CAST(:query_vector AS vector)
            LIMIT :limit
        """)
        vec_result = await db.execute(
            vec_query,
            {
                "query_vector": str(query_vector),
                "matter_id": str(matter_id),
                "org_id": str(current_user.organization_id),
                "limit": request.top_k,
            },
        )
        for row in vec_result:
            doc_result = await db.execute(
                select(Document.title).where(Document.id == row.document_id)
            )
            doc_title = doc_result.scalar() or "Unknown"

            results.append(
                SearchResultItem(
                    chunk_id=row.id,
                    document_id=row.document_id,
                    document_title=doc_title,
                    page_number=row.page_number,
                    text_content=row.text_content[:500],
                    relevance_score=float(row.score),
                    search_type="vector",
                )
            )

    # Deduplicate and sort by relevance
    seen_chunks: set[uuid.UUID] = set()
    unique_results: list[SearchResultItem] = []
    for r in sorted(results, key=lambda x: x.relevance_score, reverse=True):
        if r.chunk_id not in seen_chunks:
            seen_chunks.add(r.chunk_id)
            unique_results.append(r)

    duration_ms = int((time.monotonic() - start_time) * 1000)

    return SearchResponse(
        query=request.query,
        results=unique_results[: request.top_k],
        total_results=len(unique_results),
        search_type=request.search_type,
        duration_ms=duration_ms,
    )
