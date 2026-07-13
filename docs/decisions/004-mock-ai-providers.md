# Architectural Decision Record: ADR-004 — Mock AI Providers

## Status
Approved

## Context
Phase 1 development focuses on architecture, database integrity, multi-tenant boundaries, and workflow stability. Directly integrating external paid LLM/Embedding API endpoints (OpenAI, Anthropic, Gemini) introduces network unreliability, costs, and data privacy concerns for development environments.

## Decision
We will construct a local AI Gateway abstraction and implement mock providers (`MockLLMProvider`, `MockEmbeddingProvider`, `MockRerankingProvider`) that run locally with deterministic responses and zero external network calls.

## Consequences
* **Pros**: No external developer credentials/keys required, $0 operating cost, deterministic tests, offline development enabled.
* **Cons**: No real-world semantic answers.
