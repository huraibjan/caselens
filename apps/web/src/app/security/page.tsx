import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Security · CaseLens',
  description: 'How CaseLens protects your account, your documents, and your data.',
};

export default function SecurityPage() {
  return (
    <LegalPage
      title="Security"
      subtitle="The controls that protect your account, your documents, and the data derived from them."
      effectiveDate="July 13, 2026"
    >
      <section>
        <p>
          CaseLens handles sensitive legal documents, so security is a first-class design goal.
          This page describes the controls currently in place. We describe our practices
          honestly: where a control is a design principle rather than an independently audited
          certification, we say so.
        </p>
      </section>

      <section>
        <h2>1. Encryption</h2>
        <ul>
          <li><strong>In transit:</strong> all traffic between your browser, our API, and AI providers is served over HTTPS/TLS.</li>
          <li><strong>At rest:</strong> documents live in S3-compatible object storage and structured data in PostgreSQL, protected by the storage- and disk-level encryption of the underlying infrastructure.</li>
          <li><strong>Passwords:</strong> never stored in plaintext — they are hashed with bcrypt (per-user salt). Google Sign-In accounts have no local password at all.</li>
        </ul>
      </section>

      <section>
        <h2>2. Authentication</h2>
        <ul>
          <li>Stateless JWT access tokens (short-lived) plus refresh tokens.</li>
          <li>Optional Google Sign-In: we verify the Google-issued ID token server-side, confirm the audience and a verified email, and only then issue a CaseLens session.</li>
          <li>Tokens are scoped to a user and organization and are validated on every request.</li>
        </ul>
      </section>

      <section>
        <h2>3. Multi-tenant isolation &amp; access control</h2>
        <p>
          Every organization&apos;s data is logically isolated. Access to a matter requires
          explicit matter membership, and every document, chunk, embedding, and retrieval query
          is filtered by organization at the query level so one tenant can never read another&apos;s
          data. Role-based permissions govern sensitive actions.
        </p>
      </section>

      <section>
        <h2>4. Document handling</h2>
        <ul>
          <li>Uploads are validated by file signature (PDF magic bytes), not just file extension.</li>
          <li>A size limit is enforced to mitigate resource-exhaustion abuse.</li>
          <li>Text extraction, chunking, embedding, and analysis run as isolated, retryable background jobs.</li>
        </ul>
      </section>

      <section>
        <h2>5. AI safety controls</h2>
        <ul>
          <li><strong>Grounding:</strong> answers are generated from your own documents, with page-level citations, and the system abstains when evidence is insufficient rather than inventing an answer.</li>
          <li><strong>Human-in-the-loop:</strong> every AI response is flagged as requiring human review and carries a legal disclaimer.</li>
          <li><strong>Minimized context:</strong> only the excerpts needed to answer a request are sent to AI providers.</li>
          <li><strong>No silent fakes:</strong> if every AI provider is unavailable, the system returns an honest error instead of placeholder content.</li>
          <li><strong>Auditability:</strong> each generation records which provider and model served it, for traceability.</li>
        </ul>
      </section>

      <section>
        <h2>6. Auditing &amp; monitoring</h2>
        <p>
          Security-relevant actions are recorded in an append-only audit log (actor, action,
          resource, time), and model-run and retrieval-run records provide a trail for every AI
          interaction.
        </p>
      </section>

      <section>
        <h2>7. Data retention &amp; deletion</h2>
        <p>
          You can delete documents and matters at any time; deletion removes the associated
          records — including derived chunks and embeddings — from active systems. Account
          deletion removes your personal data as described in our{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </section>

      <section>
        <h2>8. Compliance posture</h2>
        <p>
          CaseLens is built with the principles behind frameworks such as SOC 2 in mind —
          least-privilege access, auditability, encryption, and tenant isolation. References to
          such frameworks in the product describe our design approach and do not, by themselves,
          represent a completed third-party certification unless separately stated in a current
          attestation report. Operators deploying CaseLens are responsible for the compliance of
          their own deployment and configuration.
        </p>
      </section>

      <section>
        <h2>9. Responsible disclosure</h2>
        <p>
          If you believe you have found a security vulnerability, please report it to{' '}
          <a href="mailto:security@caselens.app">security@caselens.app</a> with enough detail to
          reproduce it. Please act in good faith, avoid accessing data that isn&apos;t yours, and
          give us a reasonable opportunity to remediate before public disclosure.
        </p>
      </section>
    </LegalPage>
  );
}
