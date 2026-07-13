# Architectural Decision Record: ADR-002 — PostgreSQL + pgvector

## Status
Approved

## Context
CaseLens stores structured relational legal metadata (matters, organizations, users, logs) and high-dimensional document chunk vector embeddings. Introducing a separate specialized vector database (e.g., Pinecone, Milvus, Qdrant) creates data synchronization issues, additional costs, and splits transaction integrity.

## Decision
We will use PostgreSQL with the `pgvector` extension. All document chunk metadata, full-text search indexes, and vector embeddings will reside inside the same PostgreSQL instance.

## Consequences
* **Pros**: Single database system to backup, transactional consistency (ACID) between vector data and metadata, combined relational and vector queries.
* **Cons**: High index build memory usage; HNSW indexes in pgvector can consume significant RAM as the dataset expands.
