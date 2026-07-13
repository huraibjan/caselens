"""Document processing Temporal workflow."""

from datetime import timedelta
from dataclasses import dataclass

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from caselens_worker.activities.extraction import (
        validate_file,
        compute_checksum,
        extract_text,
        assess_quality,
    )
    from caselens_worker.activities.chunking import create_chunks
    from caselens_worker.activities.embedding import generate_embeddings
    from caselens_worker.activities.indexing import index_document


@dataclass
class DocumentProcessingInput:
    """Input for the document processing workflow."""

    document_id: str
    organization_id: str
    matter_id: str
    storage_key: str
    original_filename: str


@workflow.defn
class DocumentProcessingWorkflow:
    """Temporal workflow for processing uploaded documents.

    Steps:
    1. Validate file (magic bytes, size)
    2. Compute SHA-256 checksum
    3. Extract text per page (PyMuPDF)
    4. Assess extraction quality
    5. Create page-aware chunks
    6. Generate embeddings
    7. Index into PostgreSQL (full-text + pgvector)
    """

    @workflow.run
    async def run(self, input: DocumentProcessingInput) -> dict:
        """Execute the document processing pipeline."""
        result: dict = {"document_id": input.document_id, "steps": {}}

        # Step 1: Validate file
        validation = await workflow.execute_activity(
            validate_file,
            args=[input.storage_key],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        result["steps"]["validate"] = validation

        # Step 2: Compute checksum
        checksum = await workflow.execute_activity(
            compute_checksum,
            args=[input.storage_key],
            start_to_close_timeout=timedelta(seconds=60),
        )
        result["steps"]["checksum"] = checksum

        # Step 3: Extract text
        extraction = await workflow.execute_activity(
            extract_text,
            args=[input.document_id, input.storage_key],
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        result["steps"]["extraction"] = extraction

        # Step 4: Assess quality
        quality = await workflow.execute_activity(
            assess_quality,
            args=[input.document_id],
            start_to_close_timeout=timedelta(seconds=30),
        )
        result["steps"]["quality"] = quality

        # Step 5: Create chunks
        chunking = await workflow.execute_activity(
            create_chunks,
            args=[input.document_id],
            start_to_close_timeout=timedelta(minutes=2),
        )
        result["steps"]["chunking"] = chunking

        # Step 6: Generate embeddings
        embedding = await workflow.execute_activity(
            generate_embeddings,
            args=[input.document_id],
            start_to_close_timeout=timedelta(minutes=5),
        )
        result["steps"]["embedding"] = embedding

        # Step 7: Index document (AI analysis). Bounded retries so a persistent
        # AI-provider outage fails the workflow instead of retrying forever;
        # the activity marks the document ERROR on the final failure.
        indexing = await workflow.execute_activity(
            index_document,
            args=[input.document_id],
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        result["steps"]["indexing"] = indexing

        result["status"] = "completed"
        return result
