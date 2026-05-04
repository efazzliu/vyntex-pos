import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Mail, Search, Store, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { getAdminStats, listClientAccounts } from "@/lib/supabase-pos/admin-ops.ts";

export default function AdminBusinessesPage() {
  const [search, setSearch] = useState("");

  const statsQuery = useQuery({
    queryKey: ["admin", "clients-kpi"],
    queryFn: getAdminStats,
  });

  const clientsQuery = useQuery({
    queryKey: ["admin", "clients-list"],
    queryFn: listClientAccounts,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientsQuery.data ?? [];
    return (clientsQuery.data ?? []).filter((c) => {
      const hay = `${c.owner_email} ${c.owner_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [clientsQuery.data, search]);

  return (
    <section className="space-y-5 p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f4f9ff_55%,#f4fff6_100%)] p-6 shadow-[0_26px_60px_-40px_rgba(2,6,23,0.35)] dark:border-slate-700/70 dark:bg-[linear-gradient(135deg,#070d1f_0%,#08122a_55%,#0a1620_100%)]">
        <div
          className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[#0066FF]/20 blur-3xl dark:bg-[#0066FF]/28"
          aria-hidden
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300/70">
            Clients Command
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Clients</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300/80">
            Te gjitha account-et e klienteve me licenses, ownership dhe overview te shpejte.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Users className="size-4" />}
          title="Active Clients"
          value={statsQuery.isLoading ? "..." : String(statsQuery.data?.totalClients ?? 0)}
          hint="Distinct owner emails"
          loading={statsQuery.isLoading}
        />
        <MetricCard
          icon={<Store className="size-4" />}
          title="Total Licenses"
          value={statsQuery.isLoading ? "..." : String(statsQuery.data?.totalLicenses ?? 0)}
          hint="Across all venues"
          loading={statsQuery.isLoading}
        />
        <MetricCard
          icon={<Building2 className="size-4" />}
          title="Active Licenses"
          value={statsQuery.isLoading ? "..." : String(statsQuery.data?.activeLicenses ?? 0)}
          hint="Currently active"
          loading={statsQuery.isLoading}
        />
        <MetricCard
          icon={<Mail className="size-4" />}
          title="New Contacts"
          value={statsQuery.isLoading ? "..." : String(statsQuery.data?.newContacts ?? 0)}
          hint="Waiting for reply"
          loading={statsQuery.isLoading}
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_46px_-38px_rgba(2,6,23,0.38)] dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Client Accounts</h3>
            <p className="text-xs text-slate-500 dark:text-slate-300/70">
              Kerko shpejt sipas emrit ose email-it te klientit.
            </p>
          </div>
          <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="h-9 rounded-full border-slate-200/80 pl-8 text-xs dark:border-slate-700/70"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/70">
          <div className="grid grid-cols-[1.2fr_0.65fr_1.1fr_1.4fr_0.9fr] gap-2 bg-slate-100/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-300/80">
            <span>Owner</span>
            <span className="text-center">Licenses</span>
            <span>POS</span>
            <span>Plans</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="max-h-[380px] overflow-auto">
            {clientsQuery.isLoading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : rows.length ? (
              rows.map((row) => (
                <div
                  key={row.owner_email}
                  className="grid grid-cols-[1.2fr_0.65fr_1.1fr_1.4fr_0.9fr] items-center gap-2 border-t border-slate-200/70 px-3 py-2.5 text-xs dark:border-slate-700/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                      {row.owner_name?.trim() || row.owner_email}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-300/70">
                      {row.owner_email}
                    </p>
                  </div>
                  <div className="text-center font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {row.license_count}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set(row.licenses.map((l) => normalizePosLabel(l.type)))).map((pos) => (
                      <Badge key={`${row.owner_email}-${pos}`} variant="outline" className="text-[11px]">
                        {pos}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set(row.licenses.map((l) => l.plan))).map((plan) => (
                      <Badge key={`${row.owner_email}-${plan}`} variant="outline" className="text-[11px]">
                        {planLabel(plan)}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <div className="inline-flex items-center gap-1.5">
                      <Button asChild size="sm" variant="outline" className="h-7 rounded-full px-2.5 text-[11px]">
                        <Link to={`/admin/licenses/${encodeURIComponent(row.owner_email)}`}>Manage</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-7 rounded-full px-2.5 text-[11px]">
                        <a
                          href={`mailto:${row.owner_email}?subject=${encodeURIComponent("Vyntex POS Support")}`}
                        >
                          Contact
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300/70">
                No clients found for this search.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
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

function MetricCard({
  icon,
  title,
  value,
  hint,
  loading,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  hint: string;
  loading: boolean;
}) {
  return (
    <div className="group relative [transform-style:preserve-3d] [transform:perspective(1000px)_rotateX(0deg)_translateY(0)] transition-transform duration-300 hover:[transform:perspective(1000px)_rotateX(5deg)_translateY(-4px)]">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 blur-xl" aria-hidden />
      <div className="relative rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_16px_36px_-30px_rgba(2,6,23,0.35)] dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 dark:border-slate-600/80 dark:bg-slate-800 dark:text-slate-200">
          {icon}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300/70">
          {title}
        </p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-20 rounded-lg" />
        ) : (
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
        )}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300/70">{hint}</p>
      </div>
    </div>
  );
}
