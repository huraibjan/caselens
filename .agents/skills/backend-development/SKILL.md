---
name: backend-development
description: FastAPI backend development with SQLAlchemy 2.0, Pydantic v2, and async Python for the CaseLens platform.
---

# Backend Development Skill

## Tech Stack
- Python 3.12+
- FastAPI with async endpoints
- SQLAlchemy 2.0 (async, mapped columns)
- Pydantic v2 for request/response models
- Alembic for migrations
- uv for package management

## Conventions
- All endpoints use dependency injection for auth and database sessions
- Organization-scoped queries always include `organization_id` filter
- Matter-scoped queries verify user has matter access
- Use repository pattern for data access
- All input validated by Pydantic models
- All errors return structured JSON error responses
- Pagination via cursor-based or offset pagination
- Rate limiting on auth endpoints

## Module Structure
Each module (`auth`, `organizations`, `matters`, etc.) contains:
- `router.py` — API route definitions
- `service.py` — Business logic
- `models.py` — SQLAlchemy ORM models
- `schemas.py` — Pydantic request/response schemas
- `dependencies.py` — FastAPI dependencies (optional)
