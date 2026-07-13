# CaseIntelix Deployment Architecture

## 1. Container Topology
CaseIntelix services run inside isolated Docker containers orchestrated via Docker Compose:

* **PostgreSQL (pgvector/pgvector:pg17)**: Database containing multi-tenant tables and vector embeddings.
* **Redis (redis:7-alpine)**: Session tracking, token metadata, and service coordination.
* **MinIO (minio/minio)**: S3-compatible document storage object store.
* **Temporal (temporalio/auto-setup)**: Workflow orchestration engine.
* **API Service (FastAPI)**: Web server serving API routes.
* **Worker Service (Python Temporal Worker)**: Background document processing.
* **Web Service (Next.js)**: Frontend user interface.

## 2. Infrastructure Networking
* **External Access**: Next.js (port 3000) and FastAPI API (port 8000) are mapped to host ports.
* **Internal Services**: PostgreSQL, Redis, MinIO, and Temporal are accessed via local Docker network names.
* **Storage Isolation**: Volumes are mounted to persist Postgres data, Redis keys, and MinIO files locally.
