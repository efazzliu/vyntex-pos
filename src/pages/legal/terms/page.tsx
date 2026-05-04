import { useTranslation } from "react-i18next";
import PageHeader from "@/components/page-header.tsx";
import { Link } from "react-router-dom";

export default function TermsPage() {
  const { t } = useTranslation("site");

  return (
    <>
      <PageHeader
        badge={t("legal.badge")}
        title={t("legal.termsTitle")}
        subtitle={t("legal.termsSubtitle")}
      />

      <section className="pb-24 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-relaxed prose-li:text-muted-foreground">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Vyntex POS platform, including any
              associated software, services, and documentation (collectively,
              the &quot;Service&quot;), you agree to be bound by these Terms of Service.
              If you do not agree to these Terms, you must not use the Service.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              Vyntex POS provides a cloud-based point-of-sale (POS) platform
              designed for hospitality businesses. The Service includes order
              management, payment processing, analytics, inventory tracking,
              and related tools accessible via web and mobile applications.
            </p>

            <h2>3. Account Registration</h2>
            <p>
              To use the Service, you must create an account and provide
              accurate, complete information. You are responsible for
              maintaining the security of your account credentials and for all
              activity under your account. You must notify us immediately of any
              unauthorized access.
            </p>

            <h2>4. Subscription and Payments</h2>
            <p>
              The Service is offered on a subscription basis. Pricing details
              are available on our{" "}
              <Link to="/pricing" className="text-primary hover:underline">
                Pricing page
              </Link>
              . Subscriptions automatically renew unless cancelled before the
              renewal date. All fees are non-refundable except as required by
              applicable law.
            </p>

            <h2>5. License and Usage</h2>
            <p>
              Upon subscription, Vyntex POS grants you a non-exclusive,
              non-transferable, revocable license to use the Service for your
              internal business operations. Each license is tied to a unique
              permanent license key and a specific device. Unauthorized sharing,
              redistribution, or resale of the Service is prohibited.
            </p>

            <h2>6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Attempt to gain unauthorized access to any systems</li>
              <li>Interfere with the operation or security of the Service</li>
              <li>Use the Service to process payments for illegal goods</li>
            </ul>

            <h2>7. Intellectual Property</h2>
            <p>
              All rights, title, and interest in the Service, including
              software, designs, logos, and content, are owned by Vyntex POS. You
              retain ownership of your data but grant Vyntex POS a limited license
              to process it as needed to provide the Service.
            </p>

            <h2>8. Data and Privacy</h2>
            <p>
              Your use of the Service is subject to our{" "}
              <Link
                to="/legal/privacy"
                className="text-primary hover:underline"
              >
                Privacy Policy
              </Link>
              , which describes how we collect, use, and protect your
              information.
            </p>

            <h2>9. Termination</h2>
            <p>
              Either party may terminate the subscription at any time. Vyntex POS
              reserves the right to suspend or terminate access immediately if
              you violate these Terms. Upon termination, your license expires
              and you must cease using the Service. Data export is available
              for 30 days after termination.
            </p>

            <h2>10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Vyntex POS shall not be
              liable for any indirect, incidental, special, consequential, or
              punitive damages. Our total liability shall not exceed the
              amount paid by you in the 12 months preceding the claim.
            </p>

            <h2>11. Modifications</h2>
            <p>
              Vyntex POS may update these Terms from time to time. We will notify
              you of material changes via email or through the Service.
              Continued use after changes take effect constitutes acceptance.
            </p>

            <h2>12. Contact</h2>
            <p>
              For questions about these Terms, please{" "}
              <Link to="/contact" className="text-primary hover:underline">
                contact us
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
