# CaseLens Security Threat Model (STRIDE)

## 1. Spoofing
* **Threat**: A malicious user spoofing another firm member's account.
* **Mitigation**: Secure JWT tokens with HS256 signatures, short-lived access tokens (15 minutes), and secure HTTP-Only cookies. Proper password hashing via bcrypt.

## 2. Tampering
* **Threat**: Tampering with uploaded PDF files or modifying the immutable audit logs.
* **Mitigation**:
  * PDF files are cryptographically validated by checking magic headers (`%PDF-`).
  * Audit logs are stored in an append-only table without UPDATE/DELETE access paths allowed at the application layer.

## 3. Repudiation
* **Threat**: User performing unauthorized actions (e.g., viewing confidential documents) and claiming they did not.
* **Mitigation**: Immutable audit log system tracking all queries, search queries, document views, downloads, and RAG requests.

## 4. Information Disclosure
* **Threat**: Cross-tenant data leakage (Firm A accessing Firm B's legal cases).
* **Mitigation**:
  * Scoping of all models using `organization_id`.
  * Enforcement of Row-Level Security (RLS) policies within PostgreSQL.
  * Validation of JWT claims mapping to the user's organization.

## 5. Denial of Service
* **Threat**: Oversized document uploads exhausting disk storage or memory.
* **Mitigation**: Strict upload size constraints checked prior to disk storage (100MB max limit).

## 6. Elevation of Privilege
* **Threat**: Regular associate editing matter details or removing administrators.
* **Mitigation**: Strict role-based checks (Owner/Admin vs Associate/Viewer) within organization operations.
