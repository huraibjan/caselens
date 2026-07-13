---
name: database-engineering
description: PostgreSQL schema design, migrations, RLS policies, and pgvector configuration for multi-tenant legal data.
---

# Database Engineering Skill

## Tech Stack
- PostgreSQL 17 with pgvector extension
- SQLAlchemy 2.0 ORM with async support
- Alembic for schema migrations

## Multi-Tenancy
- All tenant-owned tables include `organization_id` column
- Row-Level Security (RLS) policies enforce tenant isolation
- Database sessions set `current_setting('app.current_org_id')` for RLS
- Composite indexes on `(organization_id, ...)` for all tenant queries

## Schema Conventions
- UUIDs for all primary keys
- `created_at` and `updated_at` timestamps on all tables
- `deleted_at` for soft deletes where required
- Foreign keys with appropriate CASCADE/RESTRICT rules
- Immutable tables (audit_events, document_versions) have no UPDATE/DELETE
- Check constraints for enum-like status fields
