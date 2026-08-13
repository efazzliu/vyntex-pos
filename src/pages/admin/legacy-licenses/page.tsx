import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Copy, KeyRound, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  createClaimableLicense,
  effectiveLicenseStatus,
  listLicensesForAdmin,
  type AdminLicenseRow,
} from "@/lib/supabase-pos/admin-ops.ts";
import { AdminCard, AdminHero } from "@/pages/admin/_components/admin-card.tsx";
import { adminInputClass, adminPageSectionClass, adminTableShellClass } from "@/pages/admin/_lib/admin-ui.ts";
import { cn } from "@/lib/utils.ts";

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy");
}

function daysUntil(iso: string): number | null {
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return null;
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
}

async function copyLicenseKey(key: string) {
  try {
    await navigator.clipboard.writeText(key);
    toast.success("License key copied");
  } catch {
    toast.error("Copy failed");
  }
}

export default function AdminLegacyLicensesPage() {
  const [search, setSearch] = useState("");
  const [newPlan, setNewPlan] = useState<"starter" | "professional" | "enterprise">("professional");
  const [newDurationDays, setNewDurationDays] = useState("30");
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const licensesQuery = useQuery({
    queryKey: ["admin", "licenses-all"],
    queryFn: listLicensesForAdmin,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = licensesQuery.data ?? [];
    if (!q) return source;
    return source.filter((row) => {
      const haystack = `${row.name} ${row.owner_name ?? ""} ${row.owner_email ?? ""} ${row.license_key}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [licensesQuery.data, search]);

  const createLicense = async () => {
    const days = Math.max(1, Number(newDurationDays) || 30);
    try {
      setCreating(true);
      const created = await createClaimableLicense({
        plan: newPlan,
        durationDays: days,
        type: "restaurant",
        name: "Unassigned License",
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "licenses-all"] });
      try {
        await navigator.clipboard.writeText(created.licenseKey);
        toast.success(`License created: ${created.licenseKey} (copied)`);
      } catch {
        toast.success(`License created: ${created.licenseKey}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create license");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className={cn(adminPageSectionClass, "space-y-4 px-4 pt-2 sm:px-6 lg:space-y-5 lg:px-8 lg:pt-4")}>
      <AdminHero>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          License Command
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          All Client Licenses
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Shiko te gjitha licensat e klienteve me status, plan dhe afat skadimi.
        </p>
      </AdminHero>

      <AdminCard className="p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2 sm:mb-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0066FF]/10 text-[#0066FF] dark:bg-blue-500/15 dark:text-blue-300">
            <Plus className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Create claimable license</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Key starts unassigned — the customer links it from their account.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Plan
            </p>
            <select
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value as "starter" | "professional" | "enterprise")}
              className={cn(adminInputClass, "w-full px-2.5")}
            >
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Duration (days)
            </p>
            <Input
              value={newDurationDays}
              onChange={(e) => setNewDurationDays(e.target.value)}
              type="number"
              min={1}
              className={adminInputClass}
            />
          </div>
          <Button
            className="h-9 w-full rounded-lg bg-[#0066FF] text-white hover:bg-[#0058e0] sm:w-auto"
            disabled={creating}
            onClick={() => void createLicense()}
          >
            {creating ? "Creating…" : "Create license"}
          </Button>
        </div>

        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
          After the customer activates the Windows POS, they should log into this site with the same email, open{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">Dashboard → Settings</span>, and use{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">Link license to this account</span> with
          this key so the venue appears on their account.
        </p>
      </AdminCard>

      <AdminCard className="p-3 sm:p-4">
        <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Licenses</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {licensesQuery.isLoading ? "Loading…" : `${rows.length} license${rows.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client, email, or key…"
              className={cn(adminInputClass, "pl-8")}
            />
          </div>
        </div>

        {/* Mobile card list */}
        <div className="space-y-2.5 md:hidden">
          {licensesQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))
          ) : rows.length ? (
            rows.map((row) => <LicenseMobileCard key={row.id} row={row} />)
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300/70">
              {search ? "No licenses match this search." : "No licenses yet."}
            </p>
          )}
        </div>

        {/* Desktop table */}
        <div className={cn(adminTableShellClass, "hidden md:block")}>
          <div className="grid grid-cols-[1.3fr_1.1fr_0.8fr_1fr_0.8fr_0.9fr_4.5rem] gap-3 bg-slate-100/80 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-300/80">
            <span>Client</span>
            <span>License Key</span>
            <span>Plan</span>
            <span>Type</span>
            <span>Status</span>
            <span>Expires</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="max-h-[calc(100dvh-20rem)] overflow-auto">
            {licensesQuery.isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="m-2 h-12 rounded-lg" />
              ))
            ) : rows.length ? (
              rows.map((row) => <LicenseDesktopRow key={row.id} row={row} />)
            ) : (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300/70">
                {search ? "No licenses match this search." : "No licenses yet."}
              </p>
            )}
          </div>
        </div>
      </AdminCard>
    </section>
  );
}

function StatusBadge({ status }: { status: "active" | "expired" | "suspended" }) {
  const cls =
    status === "active"
      ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : status === "expired"
        ? "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300"
        : "border-red-500/40 bg-red-500/12 text-red-700 dark:text-red-300";
  return <Badge className={cn("w-fit border capitalize", cls)}>{status}</Badge>;
}

function LicenseKeyChip({ licenseKey, className }: { licenseKey: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => void copyLicenseKey(licenseKey)}
      className={cn(
        "group inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left transition-colors hover:border-[#0066FF]/40 hover:bg-[#0066FF]/5 dark:border-slate-700 dark:bg-slate-900/60",
        className,
      )}
      title="Copy license key"
    >
      <KeyRound className="size-3.5 shrink-0 text-slate-400 group-hover:text-[#0066FF]" />
      <span className="truncate font-mono text-[12px] font-medium text-slate-700 dark:text-slate-200">
        {licenseKey}
      </span>
      <Copy className="ml-auto size-3 shrink-0 text-slate-300 group-hover:text-[#0066FF]" />
    </button>
  );
}

function LicenseMobileCard({ row }: { row: AdminLicenseRow }) {
  const status = effectiveLicenseStatus(row);
  const ownerEmail = (row.owner_email ?? "").trim();
  const clientName = row.owner_name?.trim() || row.name || row.owner_email || "Unknown client";
  const remaining = daysUntil(row.license_expiry);

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{clientName}</p>
          <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">
            {row.owner_email || "(no email on file)"}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <LicenseKeyChip licenseKey={row.license_key} className="mt-3 w-full" />

      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-white/80 px-3 py-2.5 text-[11px] dark:bg-slate-950/50">
        <div>
          <dt className="font-medium uppercase tracking-wide text-slate-400">Plan · Type</dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px]">
              {planLabel(row.plan)}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {normalizePosLabel(row.type)}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="font-medium uppercase tracking-wide text-slate-400">Expires</dt>
          <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
            {formatExpiry(row.license_expiry)}
            {status === "active" && remaining !== null && remaining >= 0 ? (
              <span className="ml-1 text-slate-400">({remaining}d)</span>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex justify-end">
        {ownerEmail ? (
          <Button asChild size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
            <Link to={`/admin/licenses/${encodeURIComponent(ownerEmail)}`}>Manage</Link>
          </Button>
        ) : (
          <span className="text-[11px] text-slate-400">Unassigned — tap key to copy</span>
        )}
      </div>
    </article>
  );
}

function LicenseDesktopRow({ row }: { row: AdminLicenseRow }) {
  const status = effectiveLicenseStatus(row);
  const ownerEmail = (row.owner_email ?? "").trim();

  return (
    <div className="grid grid-cols-[1.3fr_1.1fr_0.8fr_1fr_0.8fr_0.9fr_4.5rem] items-center gap-3 border-t border-slate-200/70 px-3 py-2.5 text-xs dark:border-slate-700/60">
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
          {row.owner_name?.trim() || row.name || row.owner_email || "Unknown client"}
        </p>
        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
          {row.owner_email || "(no email on file)"}
        </p>
      </div>
      <LicenseKeyChip licenseKey={row.license_key} className="w-fit max-w-full" />
      <Badge variant="outline" className="w-fit text-[11px]">
        {planLabel(row.plan)}
      </Badge>
      <span className="truncate text-slate-600 dark:text-slate-300">{normalizePosLabel(row.type)}</span>
      <StatusBadge status={status} />
      <span className="truncate text-slate-600 dark:text-slate-300">{formatExpiry(row.license_expiry)}</span>
      <div className="flex justify-end">
        {ownerEmail ? (
          <Button asChild size="sm" variant="outline" className="h-7 rounded-full px-2.5 text-[11px]">
            <Link to={`/admin/licenses/${encodeURIComponent(ownerEmail)}`}>Manage</Link>
          </Button>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        )}
      </div>
    </div>
  );
}

function planLabel(plan: string): string {
  if (plan === "starter") return "Starter";
  if (plan === "professional") return "Professional";
  if (plan === "enterprise") return "Enterprise";
  return plan;
}

function normalizePosLabel(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return "Restaurant POS";
  if (v.includes("restaurant")) return "Restaurant POS";
  if (v.includes("coffee")) return "Coffee POS";
  if (v.includes("fitness")) return "Fitness POS";
  if (v.includes("hotel")) return "Hotel POS";
  return value;
}
