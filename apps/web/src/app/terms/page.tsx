import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service · CaseIntelix',
  description: 'The terms governing your use of the CaseIntelix platform.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="The agreement between you and CaseIntelix for use of the platform."
      effectiveDate="July 13, 2026"
    >
      <section>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the
          CaseIntelix platform (the &ldquo;Service&rdquo;). By creating an account or using the
          Service, you agree to these Terms. If you are using CaseIntelix on behalf of a firm or
          organization, you represent that you are authorized to bind that organization.
        </p>
      </section>

      <section>
        <h2>1. The Service</h2>
        <p>
          CaseIntelix is an AI-assisted workspace for legal professionals. It analyzes documents
          you upload, retrieves relevant passages, and generates summaries, answers, and draft
          documents grounded in your case files. The Service is a productivity tool — not a
          lawyer, law firm, or provider of legal services.
        </p>
      </section>

      <section>
        <h2>2. Not legal advice; no attorney–client relationship</h2>
        <p>
          <strong>
            AI-generated output is not legal advice and must be independently reviewed by a
            qualified, licensed attorney before it is relied upon or used with any client,
            court, or counterparty.
          </strong>{' '}
          Use of CaseIntelix does not create an attorney–client relationship between you and
          CaseIntelix. AI systems can produce errors, omissions, or &ldquo;hallucinations,&rdquo;
          and every AI response in the Service is marked as requiring human review. You are
          solely responsible for verifying accuracy, citations, and legal sufficiency, and for
          all professional and ethical obligations to your clients.
        </p>
      </section>

      <section>
        <h2>3. Eligibility &amp; accounts</h2>
        <p>
          You must be at least 18 and capable of forming a binding contract. You are responsible
          for the security of your account, for all activity under it, and for keeping your
          credentials confidential. Notify us promptly of any unauthorized use.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Upload content you lack the right to process, or that infringes others&apos; rights.</li>
          <li>Use the Service to break the law or facilitate unlawful conduct.</li>
          <li>Attempt to breach security, access other organizations&apos; data, or disrupt the Service.</li>
          <li>Reverse engineer, scrape, or resell the Service except as permitted by law.</li>
          <li>Upload malware or attempt to exfiltrate data you are not authorized to access.</li>
        </ul>
      </section>

      <section>
        <h2>5. Your content</h2>
        <p>
          You retain all ownership of the documents and data you upload (&ldquo;Your
          Content&rdquo;). You grant CaseIntelix a limited license to store, process, and transmit
          Your Content solely to operate the Service for you — including sending relevant
          excerpts to the AI subprocessors described in our{' '}
          <a href="/privacy">Privacy Policy</a>. You are responsible for having the rights and
          any client consents necessary to process Your Content.
        </p>
      </section>

      <section>
        <h2>6. Intellectual property</h2>
        <p>
          The Service, including its software, design, and trademarks, belongs to CaseIntelix and
          its licensors. These Terms grant you a limited, non-exclusive, non-transferable right
          to use the Service; they do not transfer any of our intellectual property to you.
        </p>
      </section>

      <section>
        <h2>7. Third-party services</h2>
        <p>
          The Service relies on third-party AI and infrastructure providers. Their availability,
          performance, and terms are outside our control, and the Service may fail over between
          providers. We are not responsible for third-party outages or changes.
        </p>
      </section>

      <section>
        <h2>8. Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT
          WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT. We do not warrant that output is
          accurate, complete, current, or suitable for any particular legal purpose.
        </p>
      </section>

      <section>
        <h2>9. Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, CASELENS WILL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR
          GOODWILL, ARISING FROM YOUR USE OF THE SERVICE — INCLUDING RELIANCE ON AI-GENERATED
          OUTPUT. OUR TOTAL LIABILITY FOR ANY CLAIM WILL NOT EXCEED THE GREATER OF THE AMOUNTS
          YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM OR USD $100.
        </p>
      </section>

      <section>
        <h2>10. Indemnification</h2>
        <p>
          You agree to indemnify and hold CaseIntelix harmless from claims arising out of Your
          Content, your use of the Service, or your violation of these Terms or applicable law.
        </p>
      </section>

      <section>
        <h2>11. Termination</h2>
        <p>
          You may stop using the Service at any time. We may suspend or terminate access if you
          violate these Terms or to protect the Service or its users. Provisions that by their
          nature should survive termination will survive.
        </p>
      </section>

      <section>
        <h2>12. Changes</h2>
        <p>
          We may modify these Terms. Continued use after changes take effect constitutes
          acceptance. Material changes will be reflected by an updated effective date.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>
          Questions about these Terms? Contact <a href="mailto:legal@caselens.app">legal@caselens.app</a>.
        </p>
      </section>
    </LegalPage>
  );
}
