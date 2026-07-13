# Architectural Decision Record: ADR-001 — Modular Monolith

## Status
Approved

## Context
CaseLens requires rapid initial development and deployment, with logical isolation of critical business concerns (Authentication, Matters, Search, Document Processing, and RAG). A microservices approach introduces massive operational complexity (network latency, distributed transaction tracing, multi-repo sync) which is unnecessary for early phases.

## Decision
We will construct CaseLens as a modular monolith. All modules (auth, matters, search, documents, rag, ai_gateway, storage, audit) reside inside a single FastAPI backend application with clearly defined directory structures and boundary dependencies.

## Consequences
* **Pros**: Simple deployment, single codebase, synchronous local function calls, straightforward shared database schema.
* **Cons**: Scaling is done at the monolith level; code modules could bleed boundaries if guidelines are ignored.
