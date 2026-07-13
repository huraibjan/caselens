# CaseIntelix Phase 1 Release Readiness Checklist

This document tracks items required before marking the vertical slice as complete.

## 1. Quality Checklist
- [ ] All unit, integration, and E2E tests run and pass without failures.
- [ ] Mypy static type checking reports 0 errors.
- [ ] Ruff lint checks report 0 errors.

## 2. Functionality Walkthrough Checklist
- [ ] User can register a new account.
- [ ] User can log in and retrieve a signed JWT.
- [ ] User can create an organization (onboarding).
- [ ] User can create a new Matter.
- [ ] User can upload a PDF document.
- [ ] Document async pipeline executes successfully via Temporal.
- [ ] Search queries retrieve relevant document chunks.
- [ ] Questions to RAG assistant yield answers grounded in text with page-level citations.
- [ ] Case workspace displays left PDF viewer and right chat panel correctly.

## 3. Compliance and Security Checklist
- [ ] All database queries scoped to the user's organization.
- [ ] Document uploads validate magic bytes.
- [ ] Passwords stored using safe bcrypt hashing.
