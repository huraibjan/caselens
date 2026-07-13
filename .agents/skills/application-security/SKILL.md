---
name: application-security
description: Authentication, authorization, tenant isolation, input validation, and security threat modeling for the CaseIntelix platform.
---

# Application Security Skill

## Auth Architecture
- JWT-based authentication (Phase 1)
- Access tokens (15 min) + refresh tokens (7 days)
- Password hashing: bcrypt with work factor 12
- Session management via Redis

## Authorization Model
- Role-based access control (RBAC) with organization scope
- Roles: Owner, Admin, Partner, Associate, Paralegal, Viewer
- Matter-level access control (users must be matter members)
- Permission checks at service layer (not just route level)

## Tenant Isolation
- PostgreSQL RLS policies on all tenant tables
- Organization context set per database session
- API middleware extracts and validates org context from JWT
- Cross-tenant access attempts logged and blocked

## Input Validation
- All user input validated by Pydantic models
- File upload validation: magic bytes, size limits, content type
- SQL injection prevention: parameterized queries only
- XSS prevention: output encoding, CSP headers

## Audit Requirements
- All auth events logged (login, logout, failed attempts)
- All data access logged with user, resource, action
- All AI interactions logged with full telemetry
- Audit log is append-only (no updates or deletes)
