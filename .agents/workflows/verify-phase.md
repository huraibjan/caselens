# Verify Phase Workflow

## Trigger
After building a feature or completing a milestone.

## Steps
1. **Lint**: `make lint` (ESLint + Ruff)
2. **Type Check**: `make typecheck` (tsc + mypy)
3. **Unit Tests**: `make test-unit`
4. **Integration Tests**: `make test-integration`
5. **E2E Tests**: `make test-e2e` (if applicable)
6. **Security Scan**: Check for hardcoded secrets, SQL injection
7. **Browser Verify**: Manual walkthrough of affected flows
8. **Performance Check**: Verify no obvious N+1 queries or memory leaks

## Quality Gates
- All tests pass
- No type errors
- No lint errors
- No security warnings
- Feature works end-to-end in browser
