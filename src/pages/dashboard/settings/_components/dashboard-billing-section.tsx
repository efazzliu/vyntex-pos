import { Link } from "react-router-dom";
import {
  ArrowRightLeft,
  BadgeEuro,
  Calendar,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import type { DashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { KeyRound } from "lucide-react";
import { dashboardDateLocale, dashboardPlanLabel, dashboardTypeLabel } from "@/lib/dashboard-i18n.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";

const MOCK_INVOICES = [
  { id: "INV-2026-003", period: "Mar 2026", amount: "€39.00", status: "paid" as const },
  { id: "INV-2026-002", period: "Feb 2026", amount: "€39.00", status: "paid" as const },
];

type Props = {
  restaurant: DashboardRestaurant;
  billingCheckoutUrl: string | null;
};

export function DashboardBillingSection({ restaurant, billingCheckoutUrl }: Props) {
  const { t, lang } = useDashboardLocale();
  const trialDaysLeft = daysUntil(restaurant.licenseExpiry);
  const planLabel = dashboardPlanLabel(restaurant.plan, lang);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(dashboardDateLocale(lang), {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.28)] dark:border-slate-700/80 dark:bg-slate-900/90">
        <div className="mb-5 flex items-start gap-3 border-b border-slate-200 pb-4 dark:border-slate-700/80">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#0066FF]/10 to-[#00AACC]/10 p-2.5 text-[#0066FF] dark:border-slate-600 dark:text-cyan-400">
            <CreditCard className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t("settings.billing.title")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t("settings.billing.subtitle")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-950/80">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("settings.billing.current_plan")}
            </p>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <BadgeEuro className="size-5 text-[#0066FF]" />
              {planLabel}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <Calendar className="mr-1.5 inline size-4" />
              {t("settings.billing.renewal_date")}{" "}
              <span className="font-medium">{formatDate(restaurant.licenseExpiry)}</span>
              <span className="text-slate-500">
                {" "}
                {t("settings.billing.days_left", { count: trialDaysLeft })}
              </span>
            </p>
            <p className="mt-3 text-xs text-slate-500">
              {t("settings.billing.status")}{" "}
              <span className="font-medium capitalize">{restaurant.licenseStatus}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-950/80">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("settings.billing.payment_method")}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {t("settings.billing.payment_hint")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!billingCheckoutUrl}
                className="rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white"
                onClick={() =>
                  billingCheckoutUrl && window.open(billingCheckoutUrl, "_blank", "noopener,noreferrer")
                }
              >
                <ExternalLink className="mr-1.5 size-3.5" />
                {billingCheckoutUrl
                  ? t("settings.billing.update_payment")
                  : t("settings.billing.checkout_unavailable")}
              </Button>
              <Button type="button" size="sm" variant="outline" asChild className="rounded-xl">
                <Link to="/dashboard/settings?tab=billing">
                  <FileText className="mr-1.5 size-3.5" />
                  {t("settings.billing.full_billing_page")}
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" asChild className="rounded-xl">
            <Link to="/pricing">
              <ArrowRightLeft className="mr-1.5 size-4" />
              {t("settings.billing.upgrade_downgrade")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700/80 dark:bg-slate-900/90">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <FileText className="size-4 text-[#0066FF]" />
          {t("settings.billing.download_invoices")}
        </div>
        <div className="space-y-2">
          {MOCK_INVOICES.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-950"
            >
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{inv.id}</p>
                <p className="text-xs text-slate-500">{inv.period}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{inv.amount}</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  {t("settings.billing.invoice_paid")}
                </span>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg" asChild>
                  <Link to="/dashboard/settings?tab=billing">
                    <Download className="mr-1 size-3" />
                    {t("settings.billing.pdf")}
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {t("settings.billing.invoices_hint_prefix")}{" "}
          <Link to="/dashboard/settings?tab=billing" className="text-[#0066FF] hover:underline dark:text-cyan-400">
            {t("settings.billing.invoices_hint_link")}
          </Link>{" "}
          {t("settings.billing.invoices_hint_suffix")}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700/80 dark:bg-slate-900/90">
        <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t("settings.billing.license")}
        </p>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-950">
            <span className="text-slate-500">{t("settings.billing.product")}</span>
            <p className="font-medium text-slate-900 dark:text-white">
              {dashboardTypeLabel(restaurant.type, lang)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-950 sm:col-span-2">
            <span className="text-slate-500">{t("settings.billing.license_key")}</span>
            <p className="mt-1 flex items-center gap-2 font-mono text-xs tracking-wider text-slate-900 dark:text-white">
              <KeyRound className="size-3.5 text-[#0066FF]" />
              {restaurant.licenseKey}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
