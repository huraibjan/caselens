import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy · CaseIntelix',
  description: 'How CaseIntelix collects, uses, stores, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="How we handle your account information and the legal documents you entrust to CaseIntelix."
      effectiveDate="July 13, 2026"
    >
      <section>
        <p>
          CaseIntelix (&ldquo;CaseIntelix,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) provides an AI-assisted platform for
          analyzing legal documents, generating drafts, and answering questions grounded in
          your case files. This Privacy Policy explains what data we process and why. Because
          the documents you upload are often sensitive and may be subject to attorney–client
          privilege, we treat them with corresponding care.
        </p>
      </section>

      <section>
        <h2>1. Information we collect</h2>
        <h3>Account information</h3>
        <p>
          Your name, email address, hashed password, and — if you use Google Sign-In — the
          basic Google profile data (name, email, verified-email status) returned by Google.
          We never receive or store your Google password.
        </p>
        <h3>Organization &amp; matter data</h3>
        <p>
          Organizations, matters, memberships, and the metadata you create (titles, matter
          numbers, notes).
        </p>
        <h3>Documents &amp; derived data</h3>
        <p>
          The files you upload (currently PDFs), the text extracted from them, page-level and
          chunk-level content, vector embeddings, AI-generated summaries, case-intelligence
          metadata, citations, and AI conversation history.
        </p>
        <h3>Operational data</h3>
        <p>
          Audit events (who did what and when), model-run records (which AI provider served a
          request, token counts, timing), and standard server logs.
        </p>
      </section>

      <section>
        <h2>2. How we use your information</h2>
        <ul>
          <li>To operate the service: authentication, document processing, retrieval, and AI generation.</li>
          <li>To produce grounded, cited answers and drafts from your own documents.</li>
          <li>To maintain security, prevent abuse, and keep an audit trail for accountability.</li>
          <li>To debug, monitor reliability, and improve the product.</li>
        </ul>
        <p>
          We do <strong>not</strong> sell your personal information, and we do not use the
          contents of your documents to train our own models.
        </p>
      </section>

      <section>
        <h2>3. AI subprocessors</h2>
        <p>
          To generate answers, summaries, and drafts, CaseIntelix sends relevant text — which may
          include excerpts of your uploaded documents and your questions — to third-party AI
          inference providers. Depending on configuration and availability, these may include:
        </p>
        <ul>
          <li>Google (Gemini API) — chat and embeddings</li>
          <li>Cerebras — inference</li>
          <li>Groq — inference</li>
          <li>NVIDIA (NIM) — inference</li>
          <li>OpenRouter — inference routing (fallback)</li>
        </ul>
        <p>
          Each provider processes the data under its own terms and privacy policy. We send the
          minimum context needed to answer a request, and requests are made over encrypted
          connections. Operators who deploy CaseIntelix can configure which providers are enabled
          via the provider-chain settings. If you require that document contents never leave a
          specific boundary, do not enable external providers for that deployment.
        </p>
      </section>

      <section>
        <h2>4. Data storage &amp; retention</h2>
        <p>
          Documents are stored in object storage (S3-compatible), and structured data and
          embeddings are stored in a PostgreSQL database. We retain your data for as long as
          your account and organization remain active, or as needed to provide the service and
          meet legal obligations. When you delete a document, matter, or account, the
          associated records are removed from active systems; backups age out on their normal
          cycle.
        </p>
      </section>

      <section>
        <h2>5. How we share information</h2>
        <p>We share data only with:</p>
        <ul>
          <li>Members of your own organization, according to matter membership and role.</li>
          <li>The AI subprocessors listed above, strictly to fulfil your requests.</li>
          <li>Infrastructure providers (hosting, storage, database) that run the service.</li>
          <li>Authorities, where required by law or to protect rights and safety.</li>
        </ul>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>
          We encrypt data in transit, hash passwords with bcrypt, isolate data by organization,
          and enforce role-based access. See our <a href="/security">Security</a> page for
          details. No system is perfectly secure, and you use the service at your own risk.
        </p>
      </section>

      <section>
        <h2>7. Your rights &amp; choices</h2>
        <p>
          You may access, correct, export, or delete your data through the application or by
          contacting us. Depending on your jurisdiction (e.g. GDPR, CCPA), you may have
          additional rights, including the right to object to or restrict certain processing.
          You can also delete individual documents and matters at any time.
        </p>
      </section>

      <section>
        <h2>8. Cookies &amp; local storage</h2>
        <p>
          CaseIntelix uses browser local storage to hold your session tokens so you stay signed in.
          We do not use third-party advertising or cross-site tracking cookies.
        </p>
      </section>

      <section>
        <h2>9. Children</h2>
        <p>The service is intended for legal professionals and is not directed to anyone under 18.</p>
      </section>

      <section>
        <h2>10. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Material changes will be reflected by an
          updated effective date, and where appropriate we will provide additional notice.
        </p>
      </section>

      <section>
        <h2>11. Contact</h2>
        <p>
          Questions about privacy? Contact <a href="mailto:privacy@caselens.app">privacy@caselens.app</a>.
        </p>
      </section>
    </LegalPage>
  );
}
