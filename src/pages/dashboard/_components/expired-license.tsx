import { Link } from "react-router-dom";
import { ShieldAlert, CreditCard, KeyRound } from "lucide-react";
import { useDashboardLocale } from "./dashboard-locale-context.tsx";

/**
 * Non-blocking notice when the restaurant license is past expiry (or suspended).
 * The web dashboard stays usable for renewal and account management; the Windows
 * POS app enforces the license separately.
 */
export function DashboardLicenseExpiredBanner({
  licenseExpiry,
}: {
  licenseExpiry: string;
}) {
  const { t, lang } = useDashboardLocale();
  const dateStr = new Date(licenseExpiry).toLocaleDateString(
    lang === "sq" ? "sq-AL" : "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <div
      className="sticky top-0 z-30 border-b border-red-500/35 bg-red-950/80 px-4 py-3 text-left shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md sm:px-6"
      role="status"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex shrink-0 gap-2 text-red-100">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-400" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-red-50">{t("license_expired.banner_title")}</p>
            <p className="mt-1 text-xs leading-relaxed text-red-100/85 sm:text-sm">
              {t("license_expired.banner_line1", { date: dateStr })}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-red-100/80 sm:text-sm">
              {t("license_expired.banner_line2")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto sm:pt-0.5">
          <Link
            to="/dashboard/settings?tab=billing"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
          >
            <CreditCard className="size-3.5" aria-hidden />
            {t("license_expired.link_billing")}
          </Link>
          <Link
            to="/dashboard/licenses"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
          >
            <KeyRound className="size-3.5" aria-hidden />
            {t("license_expired.link_licenses")}
          </Link>
        </div>
      </div>
    </div>
  );
}
