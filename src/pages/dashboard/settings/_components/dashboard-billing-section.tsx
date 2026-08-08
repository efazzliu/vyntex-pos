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

const vynTypeLabels: Record<string, string> = {
  restaurant: "Restaurant POS",
  cafe: "Coffee POS",
  bar: "Bar POS",
  hotel: "Hotel POS",
  fitness: "Fitness POS",
};

const planLabels = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
} as const;

const MOCK_INVOICES = [
  { id: "INV-2026-003", period: "Mar 2026", amount: "€39.00", status: "Paid" },
  { id: "INV-2026-002", period: "Feb 2026", amount: "€39.00", status: "Paid" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

type Props = {
  restaurant: DashboardRestaurant;
  billingCheckoutUrl: string | null;
};

export function DashboardBillingSection({ restaurant, billingCheckoutUrl }: Props) {
  const trialDaysLeft = daysUntil(restaurant.licenseExpiry);
  const planLabel = planLabels[restaurant.plan as keyof typeof planLabels] ?? restaurant.plan;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.28)] dark:border-slate-700/80 dark:bg-slate-900/90">
        <div className="mb-5 flex items-start gap-3 border-b border-slate-200 pb-4 dark:border-slate-700/80">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#0066FF]/10 to-[#00AACC]/10 p-2.5 text-[#0066FF] dark:border-slate-600 dark:text-cyan-400">
            <CreditCard className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Subscription & billing
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Plan, renewal, payment method, and invoices.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-950/80">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current plan</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <BadgeEuro className="size-5 text-[#0066FF]" />
              {planLabel}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <Calendar className="mr-1.5 inline size-4" />
              Renewal date{" "}
              <span className="font-medium">{formatDate(restaurant.licenseExpiry)}</span>
              <span className="text-slate-500"> ({trialDaysLeft} days left)</span>
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Status: <span className="font-medium capitalize">{restaurant.licenseStatus}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-950/80">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment method</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Managed through checkout (Paddle). Update card details in the billing portal when available.
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
                {billingCheckoutUrl ? "Update payment method" : "Checkout unavailable"}
              </Button>
              <Button type="button" size="sm" variant="outline" asChild className="rounded-xl">
                <Link to="/dashboard/settings?tab=billing">
                  <FileText className="mr-1.5 size-3.5" />
                  Full billing page
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" asChild className="rounded-xl">
            <Link to="/pricing">
              <ArrowRightLeft className="mr-1.5 size-4" />
              Upgrade / downgrade plan
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700/80 dark:bg-slate-900/90">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <FileText className="size-4 text-[#0066FF]" />
          Download invoices
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
                <span className="text-xs text-emerald-600 dark:text-emerald-400">{inv.status}</span>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg" asChild>
                  <Link to="/dashboard/settings?tab=billing">
                    <Download className="mr-1 size-3" />
                    PDF
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Live Paddle invoices appear on the{" "}
          <Link to="/dashboard/settings?tab=billing" className="text-[#0066FF] hover:underline dark:text-cyan-400">
            billing page
          </Link>{" "}
          when connected.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700/80 dark:bg-slate-900/90">
        <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">License</p>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-950">
            <span className="text-slate-500">Product</span>
            <p className="font-medium text-slate-900 dark:text-white">
              {vynTypeLabels[restaurant.type] ?? restaurant.type}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-950 sm:col-span-2">
            <span className="text-slate-500">License key</span>
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
