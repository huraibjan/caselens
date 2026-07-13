"""Chunking activity — page-aware semantic chunking."""

import structlog
import tiktoken
from temporalio import activity
from sqlalchemy import select

from caselens.db.session import async_session_factory
from caselens.db.models import DocumentPage, DocumentChunk

logger = structlog.get_logger()


@activity.defn
async def create_chunks(document_id_str: str) -> dict:
    """Create page-aware chunks from extracted text.

    Chunking rules:
    - Chunks never cross page boundaries
    - Target size: 512 tokens with 64-token overlap
    - Each chunk preserves page number and position metadata
    """
    logger.info("activity.create_chunks", document_id=document_id_str)
    import uuid
    document_id = uuid.UUID(document_id_str)
    
    encoding = tiktoken.get_encoding("cl100k_base")
    target_size = 512
    overlap = 64
    chunks_created = 0
    
    async with async_session_factory() as session:
        # Check if chunks already exist
        existing_res = await session.execute(
            select(DocumentChunk.id).where(DocumentChunk.document_id == document_id).limit(1)
        )
        has_existing = existing_res.scalar_one_or_none() is not None
        
        if has_existing:
            logger.info("activity.create_chunks.skipped", document_id=document_id_str, reason="Chunks already exist")
            count_res = await session.execute(
                select(DocumentChunk.id).where(DocumentChunk.document_id == document_id)
            )
            chunks_created = len(count_res.scalars().all())
        else:
            # Delete any existing chunks for idempotency (if any)
            await session.execute(
                DocumentChunk.__table__.delete().where(DocumentChunk.document_id == document_id)
            )
            
            # Load all pages
            result = await session.execute(
                select(DocumentPage)
                .where(DocumentPage.document_id == document_id)
                .order_by(DocumentPage.page_number)
            )
            pages = result.scalars().all()
            
            for page in pages:
                text = page.text_content or ""
                tokens = encoding.encode(text)
                num_tokens = len(tokens)
                
                if num_tokens == 0:
                    continue
                    
                idx = 0
                chunk_index = 0
                while idx < num_tokens:
                    chunk_tokens = tokens[idx : idx + target_size]
                    chunk_text = encoding.decode(chunk_tokens)
                    
                    # Calculate start/end characters in original page text
                    start_char = text.find(chunk_text[:30]) if len(chunk_text) > 30 else 0
                    if start_char == -1:
                        start_char = 0
                    end_char = start_char + len(chunk_text)
                    
                    db_chunk = DocumentChunk(
                        document_id=document_id,
                        page_number=page.page_number,
                        chunk_index=chunk_index,
                        text_content=chunk_text,
                        token_count=len(chunk_tokens),
                        start_char=start_char,
                        end_char=end_char,
                        metadata_={},
                    )
                    session.add(db_chunk)
                    chunks_created += 1
                    chunk_index += 1
                    
                    # Advance index with overlap
                    if idx + target_size >= num_tokens:
                        break
                    idx += target_size - overlap
                    
            await session.commit()
        
    return {
        "document_id": document_id_str,
        "chunks_created": chunks_created,
        "chunk_size_tokens": target_size,
        "overlap_tokens": overlap,
    }
