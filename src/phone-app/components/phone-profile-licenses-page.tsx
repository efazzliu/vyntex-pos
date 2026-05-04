import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, CreditCard, Mail } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { SUPPORT_MAILTO_HREF } from "@/lib/site-constants.ts";
import { cn } from "@/lib/utils.ts";

const billingCheckoutUrl = import.meta.env.VITE_BILLING_CHECKOUT_URL as string | undefined;

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function planLabel(plan: string): string {
  const p = plan.toLowerCase();
  if (p === "starter") return "Starter";
  if (p === "professional") return "Professional";
  if (p === "enterprise") return "Enterprise";
  return plan;
}

export default function PhoneProfileLicensesPage() {
  const { t } = useTranslation("site");
  const { restaurant } = useDashboardRestaurant();

  const billingHref =
    billingCheckoutUrl?.trim() && !billingCheckoutUrl.includes("...")
      ? billingCheckoutUrl.trim()
      : null;

  const openBilling = () => {
    if (!billingHref) return;
    window.open(billingHref, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex min-h-full flex-col bg-transparent">
      <header
        className={cn(
          "sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3",
          "pt-[max(0.5rem,env(safe-area-inset-top))]",
        )}
      >
        <Link
          to="/app/profile"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-[#0066FF]/10"
          aria-label={t("phone.profile.backToProfile")}
        >
          <ChevronLeft className="size-6" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-900">{t("phone.profile.licenses")}</h1>
          <p className="text-xs text-slate-500">{t("phone.profile.licensesSubtitle")}</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        {restaurant === undefined ? (
          <p className="text-center text-sm text-slate-500">{t("phone.venues.loading")}</p>
        ) : restaurant === null ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-600">{t("phone.profile.noVenueSelected")}</p>
            <Button className="mt-4 rounded-xl bg-[#0066FF]" asChild>
              <Link to="/app">{t("phone.profile.myVenues")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">{t("phone.profile.labelPlan")}</dt>
                  <dd className="font-semibold text-slate-900">{planLabel(restaurant.plan)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">{t("phone.profile.labelLicenseStatus")}</dt>
                  <dd className="font-medium capitalize text-slate-900">{restaurant.licenseStatus}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">{t("phone.profile.labelLicenseExpires")}</dt>
                  <dd className="font-medium text-slate-900">{formatDate(restaurant.licenseExpiry)}</dd>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <dt className="text-slate-500">{t("phone.profile.labelLicenseKey")}</dt>
                  <dd className="mt-1 font-mono text-xs font-medium tracking-wide text-slate-800 break-all">
                    {restaurant.licenseKey}
                  </dd>
                </div>
              </dl>
            </section>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                  <CreditCard className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{t("phone.profile.billingContact")}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {t("phone.profile.billingContactBody")}
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    {billingHref ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={openBilling}
                      >
                        {t("phone.profile.openBillingPortal")}
                      </Button>
                    ) : null}
                    <Button variant="outline" className="rounded-xl" asChild>
                      <a href={SUPPORT_MAILTO_HREF}>
                        <Mail className="mr-2 size-4" />
                        {t("phone.profile.help")}
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
