import PageHeader from "@/components/page-header.tsx";
import { Link } from "react-router-dom";

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        badge="Legal"
        title="Privacy Policy"
        subtitle="Last updated: April 1, 2026"
      />

      <section className="pb-24 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-relaxed prose-li:text-muted-foreground">
            <h2>1. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul>
              <li>
                <strong>Account information:</strong> Name, email address, and
                business details provided during registration
              </li>
              <li>
                <strong>Transaction data:</strong> Order details, payment
                information, and sales records processed through the Service
              </li>
              <li>
                <strong>Usage data:</strong> How you interact with the Service,
                including features used, pages visited, and device information
              </li>
              <li>
                <strong>Communication data:</strong> Messages sent through our
                support channels and contact forms
              </li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul>
              <li>Provide and maintain the Service</li>
              <li>Process transactions and manage your account</li>
              <li>Send important notices and updates</li>
              <li>Improve the Service and develop new features</li>
              <li>Provide customer support</li>
              <li>Ensure security and prevent fraud</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2>3. Information Sharing</h2>
            <p>
              We do not sell your personal information. We may share information
              with:
            </p>
            <ul>
              <li>
                <strong>Payment processors:</strong> To facilitate transactions
                (e.g., Paddle for subscription billing)
              </li>
              <li>
                <strong>Service providers:</strong> Who help us operate the
                Service under strict confidentiality agreements
              </li>
              <li>
                <strong>Legal authorities:</strong> When required by law or to
                protect rights and safety
              </li>
            </ul>

            <h2>4. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your
              data, including encryption in transit and at rest, regular
              security audits, and access controls. However, no system is 100%
              secure, and we cannot guarantee absolute security.
            </p>

            <h2>5. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as
              needed to provide the Service. After account termination, we
              retain data for 30 days to allow export, then securely delete it
              within 90 days, except where retention is required by law.
            </p>

            <h2>6. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Object to or restrict certain processing</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>

            <h2>7. Cookies and Tracking</h2>
            <p>
              We use essential cookies to provide the Service and optional
              analytics cookies to improve your experience. You can manage
              cookie preferences through your browser settings. Disabling
              essential cookies may affect Service functionality.
            </p>

            <h2>8. International Data Transfers</h2>
            <p>
              Your data may be processed in countries other than your own. We
              ensure appropriate safeguards are in place for international
              transfers, including standard contractual clauses and compliance
              with applicable data protection regulations.
            </p>

            <h2>9. {"Children's"} Privacy</h2>
            <p>
              The Service is not intended for individuals under 16 years of
              age. We do not knowingly collect personal information from
              children. If we become aware that we have collected such data, we
              will take steps to delete it promptly.
            </p>

            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of material changes via email or through the Service.
              The date at the top of this page indicates when it was last
              updated.
            </p>

            <h2>11. Contact Us</h2>
            <p>
              For privacy-related questions or to exercise your rights, please{" "}
              <Link to="/contact" className="text-primary hover:underline">
                contact us
              </Link>{" "}
              or email privacy@vyntex.com.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
