# Architectural Decision Record: ADR-003 — Temporal Workflows

## Status
Approved

## Context
Document processing (PDF validation, page-level text extraction, OCR, chunking, and embedding) is an asynchronous, error-prone, multi-step pipeline. Standard task queues (e.g., Celery) require manual error tracking, lack built-in retry-state persistence, and make complex DAG workflow management difficult to write reliably.

## Decision
We will use Temporal to orchestrate the document ingestion pipeline. Workflows and individual activities will be defined using the Temporal Python SDK.

## Consequences
* **Pros**: Built-in state persistence, automatic step retries with exponential backoff, visual UI for workflow tracking, guaranteed execution completion.
* **Cons**: Introduces a dependency on the Temporal service/server.
