---
name: document-intelligence
description: PDF document processing pipeline using Temporal workflows, PyMuPDF extraction, and page-aware chunking.
---

# Document Intelligence Skill

## Pipeline
1. File upload → S3-compatible storage (MinIO)
2. File validation (magic bytes, size limits, malware scan stub)
3. SHA-256 checksum generation and duplicate detection
4. Text extraction via PyMuPDF (page-level)
5. Extraction quality assessment (character density, language detection)
6. OCR fallback via Tesseract (when extraction quality is low)
7. Page-aware semantic chunking
8. Embedding generation (via AI gateway)
9. Full-text and vector indexing
10. Document summary generation
11. Status notification

## Chunking Strategy
- Page-aware: chunks never cross page boundaries
- Target chunk size: 512 tokens with 64-token overlap
- Metadata preserved: page number, document ID, matter ID, org ID
- Chunks linked to source pages for citation verification

## Idempotency
- Every processing step is idempotent and retryable
- Steps record duration, status, and error details
- Failed steps can be retried without reprocessing completed steps
