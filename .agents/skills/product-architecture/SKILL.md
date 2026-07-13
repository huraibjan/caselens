---
name: product-architecture
description: Guides high-level product architecture decisions, feature scoping, and legal-domain requirements for the CaseIntelix platform.
---

# Product Architecture Skill

## Purpose
Ensure all architectural decisions align with legal-technology product requirements, multi-tenancy constraints, and compliance mandates.

## Key Principles
1. **Legal Safety First**: All AI outputs are hypotheses, never legal conclusions
2. **Evidence Provenance**: Every claim traces to a source document with page-level granularity
3. **Tenant Isolation**: Organization data is architecturally segregated
4. **Audit Everything**: Every user and system action creates an immutable audit record
5. **Citation Verification**: Unsupported claims are stripped; citations must be verifiable

## Decision Framework
When making architecture decisions:
- Consider multi-tenancy implications
- Assess legal compliance requirements
- Evaluate security and privacy impact
- Check evidence provenance requirements
- Verify audit trail completeness
