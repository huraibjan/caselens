# CaseLens — Project Context

## Product Overview
**CaseLens** is a production-oriented, multi-tenant legal case-intelligence and law-office management platform. It augments lawyers with AI-powered document processing, evidence analysis, and citation-grounded case questioning, while enforcing strict legal safety rules, tenant isolation, and evidence provenance.

## Architecture
- **Modular Monolith** — single deployable backend with strict module boundaries (auth, organizations, matters, documents, search, rag, ai_gateway, storage, audit)
- **Next.js App Router** frontend (TypeScript, React 19, shadcn/ui, Tailwind CSS)
- **FastAPI** backend (Python 3.12+, SQLAlchemy 2.0, Pydantic v2)
- **Temporal** for async document-processing workflows
- **PostgreSQL 17** + pgvector for data and vector search
- **Redis** for caching and session management
- **MinIO** (S3-compatible) for document storage
- **Mock AI providers** for Phase 1 (no paid services)

## Multi-Tenancy Model
- All tenant data is scoped by `organization_id` at the database level
- Row-Level Security (RLS) enforced by PostgreSQL policies
- Every query must include organization context
- Cross-tenant data access is architecturally prohibited

## Legal Safety Rules
- All AI outputs are marked as hypotheses, not legal conclusions
- Citation verification: every claim must trace to a source document chunk
- Human review workflow: approve/reject/revise AI-generated content
- Unsupported claims are stripped from responses
- Confidential documents never sent to external AI without explicit approval
- Complete audit trail for all operations

## Current Phase
**Phase 1 — Vertical Slice**: Register → Create org → Create matter → Upload PDF → Process → Search → Ask question → Get cited answer → Approve → Audit log

## Key Constraints
- $0 external service cost for Phase 1
- All AI providers are mocked with deterministic behavior
- Local development via Docker Compose
- No production deployment until security review is complete
