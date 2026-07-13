# CaseLens System Architecture Specification

## 1. Modular Monolith Design
CaseLens is built as a modular monolith to maximize simplicity of deployment while enforcing clean logical separation of concerns.

```
+-------------------------------------------------------------+
|                          Next.js Web                        |
+-------------------------------------------------------------+
                              | REST / SSE
                              v
+-------------------------------------------------------------+
|                         FastAPI API                         |
|  +--------+ +--------------+ +-----------+ +-------------+  |
|  |  Auth  | |  Org/Matter  | | Documents | | RAG/Search  |  |
|  +--------+ +--------------+ +-----------+ +-------------+  |
+-------------------------------------------------------------+
      |               |                      |
      v               v                      v
+------------+  +------------+         +------------+
|   Redis    |  | PostgreSQL |         | MinIO (S3) |
+------------+  +------------+         +------------+
                      ^                      ^
                      |   Temporal Workflows |
                      +----------- Worker ---+
```

## 2. Component Boundaries
* **Auth**: Handles password registration, JWT token generation, refresh tokens, and authentication/authorization middleware.
* **Organizations / Matters**: Models tenants and permissions. Users belong to Organizations and can be members of specific Matters.
* **Documents**: Manages file upload metadata, pages, and async processing states.
* **Storage**: Abstract interface covering file actions, with local MinIO implementation.
* **AI Gateway**: Interface for LLMs, embeddings, and rerankers.
* **RAG & Search**: Implements hybrid retrieval, citation parsing, and validation.
* **Audit**: Records all operations in an append-only table.

## 3. Data Flow for Document Processing
1. Client uploads document to `/api/v1/matters/{id}/documents`.
2. API validates file metadata, stores raw PDF in MinIO, creates a pending `Document` record in PostgreSQL.
3. API triggers Temporal workflow `DocumentProcessingWorkflow` asynchronously.
4. Temporal worker executes extraction, quality review, page-aware chunking, mock embedding, and database indexing.
5. API marks status as `ready` and makes the document searchable.
