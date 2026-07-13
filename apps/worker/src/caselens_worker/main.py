"""Temporal worker entry point."""

import asyncio
import structlog
from temporalio.client import Client
from temporalio.worker import Worker

from caselens_worker.workflows.document_processing import DocumentProcessingWorkflow
from caselens_worker.activities.extraction import (
    validate_file,
    compute_checksum,
    extract_text,
    assess_quality,
)
from caselens_worker.activities.chunking import create_chunks
from caselens_worker.activities.embedding import generate_embeddings
from caselens_worker.activities.indexing import index_document
from caselens_worker.config import worker_settings

logger = structlog.get_logger()


async def main() -> None:
    """Start the Temporal worker."""
    logger.info("worker.starting", host=worker_settings.TEMPORAL_HOST)

    client = await Client.connect(worker_settings.TEMPORAL_HOST)

    worker = Worker(
        client,
        task_queue=worker_settings.TEMPORAL_TASK_QUEUE,
        workflows=[DocumentProcessingWorkflow],
        activities=[
            validate_file,
            compute_checksum,
            extract_text,
            assess_quality,
            create_chunks,
            generate_embeddings,
            index_document,
        ],
    )

    logger.info("worker.started", task_queue=worker_settings.TEMPORAL_TASK_QUEUE)
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
