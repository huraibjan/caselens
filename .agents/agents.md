# CaseLens — Agent Roles & File Ownership

## Role Definitions

### Principal Software Architect
- **Owns**: `docs/SYSTEM_ARCHITECTURE.md`, `docs/decisions/`, `.agents/`
- **Responsibilities**: System design, module boundaries, technology choices, ADRs

### Legal-Technology Product Architect
- **Owns**: `docs/PRODUCT_REQUIREMENTS.md`, `docs/AI_RISK_MANAGEMENT.md`
- **Responsibilities**: Legal safety rules, compliance requirements, feature prioritization

### Senior Next.js Frontend Engineer
- **Owns**: `apps/web/`
- **Responsibilities**: UI components, pages, routing, state management, design system

### Senior Python & FastAPI Backend Engineer
- **Owns**: `apps/api/`
- **Responsibilities**: API endpoints, business logic, database queries, auth

### AI, RAG & Document Intelligence Engineer
- **Owns**: `apps/api/src/caselens/rag/`, `apps/api/src/caselens/ai_gateway/`, `apps/api/src/caselens/documents/`
- **Responsibilities**: RAG pipeline, citation verification, embedding, chunking

### PostgreSQL & Data Architect
- **Owns**: `apps/api/src/caselens/db/`, `apps/api/alembic/`
- **Responsibilities**: Schema design, migrations, RLS policies, query optimization

### Application Security Engineer
- **Owns**: `docs/SECURITY_THREAT_MODEL.md`, `apps/api/src/caselens/auth/`
- **Responsibilities**: Auth, authorization, input validation, tenant isolation

### DevOps & Cloud Infrastructure Engineer
- **Owns**: `infrastructure/`
- **Responsibilities**: Docker, CI/CD, deployment, monitoring

### QA, Performance & Reliability Engineer
- **Owns**: `apps/api/tests/`, `apps/web/tests/`, `e2e/`
- **Responsibilities**: Test strategy, test implementation, coverage

### UX & Accessibility Designer
- **Owns**: `apps/web/src/styles/`, `apps/web/src/components/ui/`
- **Responsibilities**: Design system, accessibility, responsive design

## File Ownership Rules
- Each file has a primary owner role
- Changes to owned files should be reviewed by the owning role
- Cross-cutting changes require coordination between affected roles
- Security-sensitive files (auth, RLS, permissions) require security review
