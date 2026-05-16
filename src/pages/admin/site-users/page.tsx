import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, KeyRound, LogIn, Search, Store, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { listSiteUsers, type SiteUserRow } from "@/lib/supabase-pos/admin-ops.ts";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy · HH:mm");
}

export default function AdminSiteUsersPage() {
  const [search, setSearch] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin", "site-users"],
    queryFn: listSiteUsers,
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    const source = usersQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter((row) => {
      const hay = `${row.email} ${row.fullName ?? ""} ${row.userId}`.toLowerCase();
      return hay.includes(q);
    });
  }, [usersQuery.data, search]);

  const total = usersQuery.data?.length ?? 0;
  const withVenues = usersQuery.data?.filter((u) => u.venueCount > 0).length ?? 0;
  const withActive = usersQuery.data?.filter((u) => u.activeLicenseCount > 0).length ?? 0;
  const recent30d =
    usersQuery.data?.filter((u) => {
      const t = new Date(u.registeredAt).getTime();
      return Number.isFinite(t) && Date.now() - t <= 30 * 24 * 60 * 60 * 1000;
    }).length ?? 0;

  return (
    <section className="space-y-5 p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f4f9ff_55%,#f4fff6_100%)] p-6 shadow-[0_26px_60px_-40px_rgba(2,6,23,0.35)] dark:border-slate-700/70 dark:bg-[linear-gradient(135deg,#070d1f_0%,#08122a_55%,#0a1620_100%)]">
        <div
          className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[#0066FF]/20 blur-3xl dark:bg-[#0066FF]/28"
          aria-hidden
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300/70">
            Accounts
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Users</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300/80">
            Të gjithë personat që regjistrohen në site përmes Supabase Auth — data e regjistrimit, hyrja e fundit
            dhe licencat e lidhura.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Users className="size-4" />}
          title="Registered"
          value={usersQuery.isLoading ? "…" : String(total)}
          hint="Supabase Auth accounts"
          loading={usersQuery.isLoading}
        />
        <MetricCard
          icon={<Store className="size-4" />}
          title="With venues"
          value={usersQuery.isLoading ? "…" : String(withVenues)}
          hint="Own at least one restaurant"
          loading={usersQuery.isLoading}
        />
        <MetricCard
          icon={<KeyRound className="size-4" />}
          title="Active licenses"
          value={usersQuery.isLoading ? "…" : String(withActive)}
          hint="Linked active licenses"
          loading={usersQuery.isLoading}
        />
        <MetricCard
          icon={<CalendarDays className="size-4" />}
          title="Last 30 days"
          value={usersQuery.isLoading ? "…" : String(recent30d)}
          hint="New sign-ups"
          loading={usersQuery.isLoading}
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_46px_-38px_rgba(2,6,23,0.38)] dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">All registrations</h3>
            <p className="text-xs text-slate-500 dark:text-slate-300/70">
              Kërko sipas emrit, email-it ose ID-së.
            </p>
          </div>
          <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="h-9 rounded-full border-slate-200/80 pl-8 text-xs dark:border-slate-700/70"
            />
          </div>
        </div>

        {usersQuery.error ? (
          <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {usersQuery.error.message}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/70">
          <div className="grid grid-cols-[1.2fr_1fr_0.9fr_0.9fr_0.7fr] gap-2 bg-slate-100/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-300/80">
            <span>User</span>
            <span>Registered</span>
            <span>Last sign-in</span>
            <span>Venues</span>
            <span className="text-right">Client</span>
          </div>
          <div className="max-h-[480px] overflow-auto">
            {usersQuery.isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="m-2 h-12 rounded-lg" />
              ))
            ) : rows.length ? (
              rows.map((row) => <UserRow key={row.userId} row={row} />)
            ) : (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300/70">
                {search ? "No users match this search." : "No registered users yet."}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function UserRow({ row }: { row: SiteUserRow }) {
  const displayName = row.fullName || row.email.split("@")[0] || row.email;
  const clientHref =
    row.email && row.venueCount > 0
      ? `/admin/businesses/${encodeURIComponent(row.email)}`
      : null;

  return (
    <div className="grid grid-cols-[1.2fr_1fr_0.9fr_0.9fr_0.7fr] items-center gap-2 border-t border-slate-200/70 px-3 py-2.5 text-xs dark:border-slate-700/60">
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{displayName}</p>
        <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">{row.email}</p>
      </div>
      <span className="text-slate-600 dark:text-slate-300">{formatWhen(row.registeredAt)}</span>
      <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
        <LogIn className="size-3 shrink-0 opacity-60" />
        {formatWhen(row.lastSignInAt)}
      </span>
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" className="text-[11px]">
          {row.venueCount} venue{row.venueCount === 1 ? "" : "s"}
        </Badge>
        {row.activeLicenseCount > 0 ? (
          <Badge className="border border-emerald-500/40 bg-emerald-500/12 text-[11px] text-emerald-700 dark:text-emerald-300">
            {row.activeLicenseCount} active
          </Badge>
        ) : null}
      </div>
      <div className="flex justify-end">
        {clientHref ? (
          <Link
            to={clientHref}
            className="text-[11px] font-medium text-[#0f4cb8] hover:underline dark:text-blue-300"
          >
            View
          </Link>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  hint,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint: string;
  loading?: boolean;
}) {
  return (
    <div className="group relative">
      <div
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 blur-xl"
        aria-hidden
      />
      <div className="relative rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_16px_36px_-30px_rgba(2,6,23,0.35)] dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 dark:border-slate-600/80 dark:bg-slate-800 dark:text-slate-200">
          {icon}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300/70">
          {title}
        </p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-16" />
        ) : (
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
        )}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300/70">{hint}</p>
      </div>
    </div>
  );
}
