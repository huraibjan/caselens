# Build Phase Workflow

## Trigger
After plan is approved, during implementation.

## Steps
1. **Database First**: Create/update models and migrations
2. **Backend Services**: Implement service layer with business logic
3. **API Routes**: Wire up FastAPI routes with proper auth
4. **Frontend Components**: Build UI components
5. **Frontend Pages**: Assemble pages and connect to API
6. **Integration**: Verify end-to-end flow works

## Rules
- Implement backend before frontend (API-first)
- Run type checking after each module
- Test as you build (not just at the end)
- Commit logical units of work
- Never skip input validation or auth checks
