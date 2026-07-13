# Architectural Decision Record: ADR-005 — Local JWT Authentication

## Status
Approved

## Context
CaseLens needs authentication and role-based tenant routing from day one. Using identity providers (e.g., Auth0) in early development adds setup friction and limits offline local dev capability.

## Decision
We will implement local username/password JWT authentication for Phase 1. Users register and log in to obtain JWT access and refresh tokens signed with a local HS256 secret.

## Consequences
* **Pros**: Simple self-contained auth flow, zero external dependencies, easily tested offline.
* **Cons**: Manual security management of passwords and tokens; requires migration to OIDC/SSO in later production phases.
