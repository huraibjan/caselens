"""Embedding generation activity."""

import structlog
from temporalio import activity
from sqlalchemy import select

from caselens.db.session import async_session_factory
from caselens.db.models import DocumentChunk, Embedding
from caselens.ai_gateway.providers import get_embedding_provider

logger = structlog.get_logger()


@activity.defn
async def generate_embeddings(document_id_str: str) -> dict:
    """Generate embeddings for all chunks using the AI gateway."""
    logger.info("activity.generate_embeddings", document_id=document_id_str)
    import uuid
    document_id = uuid.UUID(document_id_str)
    
    provider = get_embedding_provider()
    embeddings_generated = 0
    
    async with async_session_factory() as session:
        # Load all chunks
        result = await session.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.page_number, DocumentChunk.chunk_index)
        )
        chunks = result.scalars().all()
        
        # Check if embeddings already exist for all chunks of this document
        chunk_ids = [c.id for c in chunks]
        if chunk_ids:
            existing_emb_res = await session.execute(
                select(Embedding.id).where(Embedding.chunk_id.in_(chunk_ids)).limit(1)
            )
            has_existing_emb = existing_emb_res.scalar_one_or_none() is not None
            
            if has_existing_emb:
                logger.info("activity.generate_embeddings.skipped", document_id=document_id_str, reason="Embeddings already exist")
                count_res = await session.execute(
                    select(Embedding.id).where(Embedding.chunk_id.in_(chunk_ids))
                )
                embeddings_generated = len(count_res.scalars().all())
            else:
                await session.execute(
                    Embedding.__table__.delete().where(Embedding.chunk_id.in_(chunk_ids))
                )
                
                # Generate and save embeddings
                # Process in batches of 50 to avoid large memory allocations
                batch_size = 50
                for i in range(0, len(chunks), batch_size):
                    batch_chunks = chunks[i : i + batch_size]
                    texts = [c.text_content for c in batch_chunks]
                    
                    resp = await provider.embed(texts)
                    for chunk, vector in zip(batch_chunks, resp.vectors):
                        embedding = Embedding(
                            chunk_id=chunk.id,
                            vector=vector,
                            model_name=provider.model_name,
                            model_version="1.0.0",
                            dimensions=provider.dimensions,
                        )
                        session.add(embedding)
                        embeddings_generated += 1
                        
                await session.commit()
            
    return {
        "document_id": document_id_str,
        "embeddings_generated": embeddings_generated,
        "model": provider.model_name,
        "dimensions": provider.dimensions,
    }
