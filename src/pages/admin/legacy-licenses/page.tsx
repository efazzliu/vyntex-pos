import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { KeyRound, Search } from "lucide-react";
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

  return (
    <section className="space-y-5 p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f5f9ff_55%,#f8fff9_100%)] p-6 shadow-[0_26px_60px_-40px_rgba(2,6,23,0.35)] dark:border-slate-700/70 dark:bg-[linear-gradient(135deg,#070d1f_0%,#08122a_55%,#0a1620_100%)]">
        <div
          className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[#0066FF]/20 blur-3xl dark:bg-[#0066FF]/28"
          aria-hidden
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300/70">
            License Command
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">All Client Licenses</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300/80">
            Ketu i sheh te gjitha licensat e klienteve me status, plan dhe afat skadimi.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_46px_-38px_rgba(2,6,23,0.38)] dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="mb-4 rounded-xl border border-dashed border-slate-300/80 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="min-w-[130px] flex-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300/70">Plan</p>
              <select
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value as "starter" | "professional" | "enterprise")}
                className="h-9 w-full rounded-md border border-slate-200/80 bg-white px-2.5 text-xs dark:border-slate-700/70 dark:bg-slate-900"
              >
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div className="min-w-[130px] flex-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300/70">Duration (days)</p>
              <Input
                value={newDurationDays}
                onChange={(e) => setNewDurationDays(e.target.value)}
                type="number"
                min={1}
                className="h-9 text-xs"
              />
            </div>
            <Button
              className="h-9 rounded-full"
              disabled={creating}
              onClick={async () => {
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
              }}
            >
              {creating ? "Creating..." : "Create claimable license"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-300/70">
            Key is unassigned; first signed-in user that activates it will become the owner.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Licenses</h3>
            <p className="text-xs text-slate-500 dark:text-slate-300/70">Search sipas klientit, email-it ose license key.</p>
          </div>
          <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search licenses..."
              className="h-9 rounded-full border-slate-200/80 pl-8 text-xs dark:border-slate-700/70"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/70">
          <div className="grid grid-cols-[1.2fr_0.9fr_0.8fr_1fr_0.9fr_0.8fr] gap-2 bg-slate-100/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-300/80">
            <span>Client</span>
            <span>License Key</span>
            <span>Plan</span>
            <span>Type</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="max-h-[420px] overflow-auto">
            {licensesQuery.isLoading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            ) : rows.length ? (
              rows.map((row) => <LicenseRow key={row.id} row={row} />)
            ) : (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300/70">
                Nuk u gjet asnje license per kete kerkim.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function LicenseRow({ row }: { row: AdminLicenseRow }) {
  const status = effectiveLicenseStatus(row);
  const ownerEmail = (row.owner_email ?? "").trim();
  const statusClass =
    status === "active"
      ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : status === "expired"
        ? "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300"
        : "border-red-500/40 bg-red-500/12 text-red-700 dark:text-red-300";

  return (
    <div className="grid grid-cols-[1.2fr_0.9fr_0.8fr_1fr_0.9fr_0.8fr] items-center gap-2 border-t border-slate-200/70 px-3 py-2.5 text-xs dark:border-slate-700/60">
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
          {row.owner_name?.trim() || row.name || row.owner_email || "Unknown client"}
        </p>
        <p className="truncate text-[11px] text-slate-500 dark:text-slate-300/70">
          {row.owner_email || "(no email on file)"}
        </p>
      </div>
      <div className="min-w-0 inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
        <KeyRound className="size-3.5 shrink-0" />
        <span className="truncate">{row.license_key}</span>
      </div>
      <Badge variant="outline" className="w-fit text-[11px]">
        {planLabel(row.plan)}
      </Badge>
      <span className="truncate text-slate-600 dark:text-slate-300">{normalizePosLabel(row.type)}</span>
      <Badge className={`w-fit border ${statusClass}`}>{status}</Badge>
      <div className="flex justify-end">
        {ownerEmail ? (
          <Button asChild size="sm" variant="outline" className="h-7 rounded-full px-2.5 text-[11px]">
            <Link to={`/admin/licenses/${encodeURIComponent(ownerEmail)}`}>Manage</Link>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-full px-2.5 text-[11px]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(row.license_key);
                toast.success("License key copied");
              } catch {
                toast.error("Copy failed");
              }
            }}
          >
            Copy key
          </Button>
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
