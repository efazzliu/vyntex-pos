import { CreditCard, Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { useAdminCenter } from "@/pages/dashboard/_components/admin-center-context.tsx";
import { AdminPage, acCard } from "@/pages/dashboard/_components/admin-center-ui.tsx";
import { formatEur } from "@/pages/dashboard/_lib/admin-center-format.ts";
import { cn } from "@/lib/utils.ts";

const INVOICES = [
  { id: "INV-2026-008", date: "2026-08-01", venue: "Marios Italian Restaurant", amount: 290, status: "paid" },
  { id: "INV-2026-007", date: "2026-08-01", venue: "Professional Test Venue", amount: 290, status: "paid" },
  { id: "INV-2026-006", date: "2026-07-04", venue: "Enterprise Test Venue", amount: 520, status: "paid" },
  { id: "INV-2026-005", date: "2026-07-01", venue: "Starter Test Venue", amount: 29, status: "pending" },
  { id: "INV-2026-004", date: "2026-06-12", venue: "Professional Test Venue", amount: 290, status: "failed" },
] as const;

export default function DashboardBillingPage() {
  const { t, lang } = useDashboardLocale();
  const { venues, openRenew } = useAdminCenter();
  const locale = lang === "sq" ? "sq-AL" : "en-US";
  const primary = venues[0];
  const checkout = (import.meta.env.VITE_BILLING_CHECKOUT_URL as string | undefined)?.trim();

  return (
    <AdminPage className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">
          {t("ac.nav.admin_center")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("ac.nav.billing")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("ac.billing.subtitle")}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={cn(acCard, "p-5")}>
          <h2 className="text-sm font-semibold">{t("ac.billing.current")}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label={t("ac.renew.plan")} value={primary?.planLabel ?? "—"} />
            <Row
              label={t("ac.billing.next")}
              value={
                primary?.license_expiry
                  ? new Date(primary.license_expiry).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"
              }
            />
            <Row label={t("ac.billing.amount")} value={formatEur(290)} />
            <Row label={t("ac.billing.method")} value="Visa •••• 4242" />
          </dl>
          {primary ? (
            <Button
              className="mt-5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() =>
                openRenew({
                  venueId: primary.id,
                  venueName: primary.name,
                  plan: primary.planLabel,
                  expiry: primary.license_expiry,
                })
              }
            >
              {t("ac.renew.cta")}
            </Button>
          ) : null}
        </section>

        <section className={cn(acCard, "p-5")}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("ac.billing.methods")}</h2>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => {
                if (checkout && !checkout.includes("...")) window.open(checkout, "_blank");
                else toast.message(t("ac.billing.add_method_soon"));
              }}
            >
              <Plus className="size-4" />
              {t("ac.billing.add_method")}
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <CreditCard className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Visa / Mastercard</p>
                <p className="text-xs text-slate-500">•••• 4242 · {t("ac.billing.default")}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className={cn(acCard, "overflow-hidden")}>
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold">{t("ac.billing.history")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-y border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3">{t("ac.billing.invoice")}</th>
                <th className="px-3 py-3">{t("ac.billing.date")}</th>
                <th className="px-3 py-3">{t("ac.table.venue")}</th>
                <th className="px-3 py-3">{t("ac.billing.amount")}</th>
                <th className="px-3 py-3">{t("ac.table.status")}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {INVOICES.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold">{row.id}</td>
                  <td className="px-3 py-3.5 text-slate-600">
                    {new Date(row.date).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-3 py-3.5">{row.venue}</td>
                  <td className="px-3 py-3.5 tabular-nums">{formatEur(row.amount)}</td>
                  <td className="px-3 py-3.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        row.status === "paid" && "bg-emerald-50 text-emerald-700",
                        row.status === "pending" && "bg-amber-50 text-amber-700",
                        row.status === "failed" && "bg-rose-50 text-rose-700",
                      )}
                    >
                      {t(`ac.billing.${row.status}`)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600"
                      onClick={() => toast.success(t("ac.billing.download_started"))}
                    >
                      <Download className="size-3.5" />
                      {t("ac.billing.download")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
