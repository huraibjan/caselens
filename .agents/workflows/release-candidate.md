# Release Candidate Workflow

## Trigger
When a phase milestone is considered complete.

## Steps
1. **All Tests Green**: `make test` passes completely
2. **Type Safety**: `make typecheck` passes completely
3. **Lint Clean**: `make lint` passes completely
4. **Security Review**: Security checklist completed
5. **Documentation**: All docs updated to reflect current state
6. **Browser Walkthrough**: Complete user flow verified manually
7. **Performance**: No obvious bottlenecks
8. **Release Notes**: Document what's included and what's not
9. **Known Issues**: Document remaining technical debt
10. **User Acceptance**: Present to user for final approval

## Phase 1 Acceptance Criteria
- Register → Login → Create org → Create matter
- Upload PDF → Processing completes
- Search documents → Results with highlighting
- Ask question → Streamed answer with citations
- Click citation → PDF scrolls to cited page
- Approve answer → Status updated
- Check audit log → All actions recorded
