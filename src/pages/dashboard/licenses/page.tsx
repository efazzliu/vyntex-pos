import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { dashboardUrlWithTrial, FREE_TRIAL_QUERY_VALUE } from "@/lib/free-trial.ts";
import { Check, Copy, CreditCard, KeyRound, RefreshCw, Shield, Sparkles } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

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

export default function DashboardLicensesPage() {
  const { restaurant } = useDashboardRestaurant();
  const [copied, setCopied] = useState(false);
  const [searchParams] = useSearchParams();
  const trialBanner = searchParams.get("trial") === FREE_TRIAL_QUERY_VALUE;

  if (restaurant === undefined) {
    return (
      <div className="min-h-full w-full bg-[#05070a]">
        <div className="mx-auto w-full max-w-6xl space-y-6 p-6 pb-10 lg:p-8 lg:pb-12">
          <Skeleton className="h-36 rounded-2xl bg-white/5" />
          <Skeleton className="h-56 rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return <Navigate to={dashboardUrlWithTrial("get-started")} replace />;
  }

  const daysLeft = daysUntil(restaurant.licenseExpiry);
  const isExpiringSoon = daysLeft <= 7;
  const isExpired = daysLeft === 0;
  const statusText = isExpired ? "Expired" : "Active";

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(restaurant.licenseKey);
      setCopied(true);
      toast.success("License key copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy. Please copy manually.");
    }
  };

  return (
    <div className="min-h-full w-full bg-[#05070a]">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6 pb-10 lg:p-8 lg:pb-12">
      <section className="relative overflow-hidden rounded-2xl border border-[#315084] bg-gradient-to-br from-[#162746] via-[#10213f] to-[#0e1a31] p-6 lg:p-7">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          <Sparkles className="size-3.5" />
          Licenses
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">Manage License Key, Plan and Expiry</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#a7b5d1]">
          View your current license key, track expiry date, and manage renew or upgrade actions
          from one place.
        </p>
      </section>

      {trialBanner ? (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <strong className="font-semibold text-emerald-50">Free month active</strong> — your
          Professional trial runs until the expiry date below. Renew from Billing any time before it
          ends.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/60">Current License</p>
              <h2 className="mt-1 text-xl font-semibold text-white">{restaurant.name}</h2>
              <p className="mt-1 text-sm text-[#98aac8]">
                Plan: {PLAN_LABELS[restaurant.plan] ?? restaurant.plan}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                isExpired
                  ? "bg-red-500/15 text-red-300 border border-red-500/35"
                  : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35",
              )}
            >
              <Shield className="size-3.5" />
              {statusText}
            </span>
          </div>

          <div
            className={cn(
              "mt-5 rounded-xl border p-3 text-sm",
              isExpiringSoon
                ? "border-amber-400/35 bg-amber-500/10 text-amber-200"
                : "border-[#2c4673] bg-[#0b162b] text-[#c6d1e7]",
            )}
          >
            <p>
              Expires on <span className="font-semibold">{formatDate(restaurant.licenseExpiry)}</span>
              {isExpired ? " - renew now to continue using POS." : ` (${daysLeft} days remaining)`}
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-[#2c4673] bg-[#0b162b] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <KeyRound className="size-4 text-[#66b3ff]" />
              License Key
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-[#243a63] bg-[#081225] px-3 py-2 text-sm tracking-[0.12em] text-white">
                {restaurant.licenseKey}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyKey}
                className="text-white/70 hover:bg-white/10 hover:text-white"
              >
                {copied ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <h3 className="text-base font-semibold text-white">Actions</h3>
          <p className="mt-2 text-sm text-[#98aac8]">
            Renew your plan, upgrade for more features, or open billing for invoice history.
          </p>

          <div className="mt-5 space-y-3">
            <Button asChild className="w-full justify-start gap-2 rounded-xl">
              <Link to="/dashboard/billing">
                <RefreshCw className="size-4" />
                Renew License
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full justify-start gap-2 rounded-xl border-[#2c4673] bg-[#0b162b] text-white hover:bg-[#142646]"
            >
              <Link to="/pricing">
                <Sparkles className="size-4" />
                Upgrade Plan
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full justify-start gap-2 rounded-xl border-[#2c4673] bg-[#0b162b] text-white hover:bg-[#142646]"
            >
              <Link to="/dashboard/billing">
                <CreditCard className="size-4" />
                Open Billing
              </Link>
            </Button>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
