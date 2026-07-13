# CaseLens Risk Register

This document tracks system-level risks and mitigation strategies.

| ID | Risk | Severity | Probability | Mitigation Strategy |
|---|---|---|---|---|
| R-01 | Cross-tenant data leakage | Critical | Low | Scoping of all queries with `organization_id` using database constraints and FastAPI verification dependencies. |
| R-02 | AI hallucination in legal answers | High | Medium | Enforced citation matching where every claim must map to page content, else response falls back to explicit abstention. |
| R-03 | Performance bottlenecks on vector query | Medium | Medium | Database indexing using pgvector indexes (HNSW or IVFFlat) when dataset grows. |
| R-04 | File upload exhaustion or virus uploads | High | Low | Upload file validation checking file headers (`%PDF-`) and enforcing a 100MB limit. |
| R-05 | Loss of trace on processing errors | Medium | Medium | Temporal async workflow engine with automatic retries and structured logging for document state tracking. |
