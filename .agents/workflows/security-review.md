# Security Review Workflow

## Trigger
Before any security-sensitive change is merged (auth, permissions, RLS, file uploads, AI prompts).

## Checklist
- [ ] Authentication: JWT validation, token expiry, refresh flow
- [ ] Authorization: Permission check at service layer, not just route
- [ ] Tenant Isolation: RLS policy verified, org_id in all queries
- [ ] Input Validation: Pydantic models validate all user input
- [ ] File Uploads: Magic byte validation, size limits, content-type check
- [ ] SQL Injection: Parameterized queries only, no string formatting
- [ ] XSS: Output encoding, CSP headers
- [ ] CORS: Restrictive origin policy
- [ ] Rate Limiting: Auth endpoints rate limited
- [ ] Audit Logging: Security events recorded
- [ ] Error Messages: No internal details leaked to client
- [ ] Dependencies: No known CVEs in dependencies
