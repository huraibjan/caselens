---
name: quality-assurance
description: Test strategy, test implementation, and quality gates for the CaseLens platform across backend, frontend, and E2E.
---

# Quality Assurance Skill

## Test Pyramid
1. **Unit Tests**: Individual functions and classes (pytest, vitest)
2. **Integration Tests**: API endpoints with real PostgreSQL (testcontainers)
3. **Component Tests**: React components with mocked data (vitest)
4. **E2E Tests**: Full user workflows (Playwright)

## Backend Testing (pytest)
- Async test support with `pytest-asyncio`
- Test database isolation per test (transactions rolled back)
- Factory pattern for test data generation
- Mock AI providers for deterministic behavior

## Frontend Testing (vitest)
- Component rendering tests
- Hook behavior tests
- Form validation tests
- Error boundary tests

## E2E Testing (Playwright)
- Full Phase 1 acceptance workflow
- Multi-browser testing (Chromium, Firefox, WebKit)
- Screenshot comparison for visual regression

## Quality Gates
- All tests pass before merge
- No type errors (tsc, mypy)
- No lint errors (ESLint, Ruff)
- Code coverage ≥ 80% for critical paths
