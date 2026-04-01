import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";
import {
  KeyRound,
  Copy,
  Check,
  Download,
  Shield,
  Calendar,
  CreditCard,
  ArrowRight,
  Monitor,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils.ts";
import { Link } from "react-router-dom";

const VYN_TYPE_LABELS: Record<string, string> = {
  restaurant: "Restaurant POS",
  cafe: "Coffee POS",
  bar: "Bar POS",
  hotel: "Hotel POS",
  fitness: "Fitness POS",
};

const VYN_TYPE_ICONS: Record<string, string> = {
  restaurant: "\uD83C\uDF7D\uFE0F",
  cafe: "\u2615",
  bar: "\uD83C\uDF7A",
  hotel: "\uD83C\uDFE8",
  fitness: "\uD83C\uDFCB\uFE0F",
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

export default function DashboardOverview() {
  const restaurant = useQuery(api.dashboard.restaurants.getMyRestaurant);
  const [copied, setCopied] = useState(false);

  if (restaurant === undefined) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
        <div className="space-y-4 mt-6">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!restaurant) return null; // Layout handles null state

  const daysLeft = daysUntil(restaurant.licenseExpiry);
  const isExpiringSoon = daysLeft <= 7;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(restaurant.licenseKey);
      setCopied(true);
      toast.success("License key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy. Please select and copy manually.");
    }
  };

  const handleInstall = () => {
    toast.info(
      "The VYNTEX POS software will be available for download when PWA support is enabled."
    );
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          License & Software
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your VYNTEX POS license and install the software.
        </p>
      </div>

      {/* ── License Status Card ────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Gradient top strip */}
        <div className="h-1.5 bg-gradient-to-r from-[#0066FF] to-[#44CC00]" />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center text-2xl shrink-0">
                {VYN_TYPE_ICONS[restaurant.type] ?? "\uD83C\uDF7D\uFE0F"}
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Active License
                </p>
                <h2 className="text-xl font-bold text-foreground">
                  {VYN_TYPE_LABELS[restaurant.type] ?? restaurant.type}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {restaurant.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Status badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                <Shield className="size-3.5" />
                Active
              </div>
              {/* Plan badge */}
              <div className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {PLAN_LABELS[restaurant.plan]}
              </div>
            </div>
          </div>

          {/* Expiry info */}
          <div
            className={cn(
              "mt-5 flex items-center gap-2 px-4 py-3 rounded-lg text-sm",
              isExpiringSoon
                ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-400"
                : "bg-muted/50 text-muted-foreground"
            )}
          >
            <Calendar className="size-4 shrink-0" />
            <span>
              <span className="font-medium">Expires:</span>{" "}
              {formatDate(restaurant.licenseExpiry)}
              {isExpiringSoon
                ? ` \u2014 ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining!`
                : ` (${daysLeft} days remaining)`}
            </span>
          </div>
        </div>
      </div>

      {/* ── License Key Card ───────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="size-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            Your License Key
          </h2>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-lg bg-[#0a0f1e] dark:bg-black/40">
          <code className="flex-1 text-lg sm:text-xl font-mono tracking-[0.2em] text-white select-all">
            {restaurant.licenseKey}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-white/60 hover:text-white hover:bg-white/10 shrink-0"
          >
            {copied ? (
              <Check className="size-4 text-emerald-400" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Use this key to activate your VYNTEX POS software after installation.
          Keep it safe and do not share it publicly.
        </p>
      </div>

      {/* ── Install Software Card ──────────────────────────── */}
      <div className="rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0066FF] to-[#44CC00] flex items-center justify-center shrink-0">
            <Monitor className="size-7 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground mb-1">
              Install VYNTEX POS Software
            </h2>
            <p className="text-sm text-muted-foreground">
              Download and install the VYNTEX POS application on your device.
              Manage orders, menus, tables, and more directly from the app.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          className="w-full mt-6 h-12 text-base bg-gradient-to-r from-[#0066FF] to-[#0055DD] hover:from-[#0055DD] hover:to-[#0044CC] text-white"
          onClick={handleInstall}
        >
          <Download className="size-5 mr-2" />
          Install VYNTEX POS Software
          <ArrowRight className="size-4 ml-2" />
        </Button>
      </div>

      {/* ── Quick links ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/dashboard/settings"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow group"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
            <CreditCard className="size-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Business Settings
            </p>
            <p className="text-xs text-muted-foreground">
              Update profile & billing info
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
        <Link
          to="/contact"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <Shield className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Support
            </p>
            <p className="text-xs text-muted-foreground">
              Get help with your license
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
      </div>
    </div>
  );
}
