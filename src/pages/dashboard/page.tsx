import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { useLiveBuildMeta } from "@/hooks/use-live-build-meta.ts";
import {
  triggerInstallerDownload,
  windowsInstallerArm64Href,
  windowsInstallerX64Href,
} from "@/lib/installer-download-urls.ts";
import { APP_VERSION_LABEL } from "@/lib/site-constants.ts";
import {
  ArrowRight,
  Calendar,
  Check,
  Copy,
  CreditCard,
  Download,
  HardDriveDownload,
  KeyRound,
  Monitor,
  Shield,
} from "lucide-react";

const VYN_TYPE_LABELS: Record<string, string> = {
  restaurant: "Restaurant POS",
  cafe: "Coffee POS",
  bar: "Bar POS",
  hotel: "Hotel POS",
  fitness: "Fitness POS",
};

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

function formatInstallerUpdatedAt(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "violet";
}) {
  const accent =
    tone === "blue"
      ? "border-l-blue-500 shadow-[inset_0_1px_0_0_rgba(59,130,246,0.08)]"
      : tone === "green"
        ? "border-l-emerald-500 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.08)]"
        : "border-l-violet-500 shadow-[inset_0_1px_0_0_rgba(139,92,246,0.08)]";

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800/80 border-l-2 bg-zinc-950/60 p-5 backdrop-blur-sm",
        accent,
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-50">{value}</p>
    </div>
  );
}

export default function DashboardOverview() {
  const { restaurant } = useDashboardRestaurant();
  const [copied, setCopied] = useState(false);
  const live = useLiveBuildMeta();
  const installerIso =
    live?.installerUpdatedAt ??
    (import.meta.env.VITE_INSTALLER_UPDATED_AT as string | undefined);
  const installerUpdatedAt = formatInstallerUpdatedAt(installerIso);
  const appVersionLabel = live?.appVersion ?? APP_VERSION_LABEL;
  const installerUrlX64 = windowsInstallerX64Href(appVersionLabel);
  const installerUrlArm64 = windowsInstallerArm64Href(appVersionLabel);

  if (restaurant === undefined) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-8 p-6 pb-12 lg:p-10">
        <Skeleton className="h-36 rounded-2xl bg-zinc-900/80" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24 rounded-xl bg-zinc-900/80" />
          <Skeleton className="h-24 rounded-xl bg-zinc-900/80" />
          <Skeleton className="h-24 rounded-xl bg-zinc-900/80" />
        </div>
        <Skeleton className="h-52 rounded-2xl bg-zinc-900/80" />
      </div>
    );
  }

  if (!restaurant) return null;

  const daysLeft = daysUntil(restaurant.licenseExpiry);
  const isExpiringSoon = daysLeft <= 7;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(restaurant.licenseKey);
      setCopied(true);
      toast.success("License key copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy. Please copy manually.");
    }
  };

  const openInstallerDownload = (
    url: string,
    arch: "x64" | "arm64",
  ) => {
    triggerInstallerDownload(url, arch, appVersionLabel);
    toast.success("Download started");
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-6 pb-12 text-zinc-200 lg:p-10">
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-6 shadow-2xl shadow-black/40 lg:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-40%,rgba(59,130,246,0.12),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_50%_at_100%_100%,rgba(16,185,129,0.06),transparent_50%)]" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            License overview
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Vyntex POS Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Manage your active plan, copy your key, and install the right Windows build in one
            place.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="License Type"
          value={VYN_TYPE_LABELS[restaurant.type] ?? restaurant.type}
          tone="blue"
        />
        <StatCard label="Plan" value={PLAN_LABELS[restaurant.plan]} tone="violet" />
        <StatCard label="Days Remaining" value={`${daysLeft} days`} tone="green" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-6 shadow-xl shadow-black/20 lg:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                Active venue
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
                {restaurant.name}
              </h2>
            </div>
            <div className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              Active
            </div>
          </div>

          <div
            className={cn(
              "mt-5 rounded-xl border p-3.5 text-sm",
              isExpiringSoon
                ? "border-amber-500/25 bg-amber-500/5 text-amber-100"
                : "border-zinc-800/80 bg-black/35 text-zinc-300",
            )}
          >
            <div className="flex items-center gap-2">
              <Calendar className="size-4" />
              <span>
                Expires on <span className="font-semibold">{formatDate(restaurant.licenseExpiry)}</span>
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-zinc-800/80 bg-black/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200">
              <KeyRound className="size-4 text-blue-400" />
              License key
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm tracking-[0.14em] text-zinc-100">
                {restaurant.licenseKey}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                {copied ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-6 shadow-xl shadow-black/20 lg:p-7">
          <div className="mb-5 flex items-center gap-2 text-sm font-medium text-zinc-200">
            <HardDriveDownload className="size-4 text-blue-400" />
            Install software
          </div>

          <Button
            size="lg"
            onClick={() => openInstallerDownload(installerUrlX64, "x64")}
            className="h-auto w-full flex-col gap-1 rounded-xl border-0 bg-gradient-to-r from-blue-600 to-blue-500 py-3.5 text-white shadow-lg shadow-blue-950/50 transition hover:from-blue-500 hover:to-blue-400"
          >
            <span className="flex items-center gap-2">
              <Download className="size-4" />
              Windows — 64-bit (Intel/AMD)
            </span>
            <span className="text-xs opacity-90">Recommended for most PCs</span>
          </Button>

          {installerUrlArm64 ? (
            <Button
              size="lg"
              variant="outline"
              onClick={() => openInstallerDownload(installerUrlArm64, "arm64")}
              className="mt-3 h-auto w-full flex-col gap-1 rounded-xl border-zinc-700/90 bg-zinc-900/80 py-3 text-zinc-100 hover:bg-zinc-800/90"
            >
              <span className="flex items-center gap-2">
                <Monitor className="size-4" />
                Windows — ARM64
              </span>
              <span className="text-xs opacity-80">Surface / Snapdragon devices</span>
            </Button>
          ) : null}

          <p className="mt-4 text-xs text-zinc-500">
            App v<span className="font-medium text-zinc-400">{appVersionLabel}</span>
            {installerUpdatedAt ? (
              <>
                <span className="text-zinc-600"> · </span>
                Latest build:{" "}
                <span className="font-medium text-zinc-400">{installerUpdatedAt}</span>
              </>
            ) : null}
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/dashboard/settings"
          className="group flex items-center gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4 transition-all hover:border-zinc-600/80 hover:bg-zinc-900/40"
        >
          <div className="rounded-lg bg-violet-500/10 p-2.5 ring-1 ring-violet-500/20">
            <CreditCard className="size-4 text-violet-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-50">Business settings</p>
            <p className="text-xs text-zinc-500">Profile, billing and preferences</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
        </Link>

        <Link
          to="/contact"
          className="group flex items-center gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4 transition-all hover:border-zinc-600/80 hover:bg-zinc-900/40"
        >
          <div className="rounded-lg bg-emerald-500/10 p-2.5 ring-1 ring-emerald-500/20">
            <Shield className="size-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-50">Support</p>
            <p className="text-xs text-zinc-500">Need help with activation or installer?</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
        </Link>
      </section>
    </div>
  );
}
