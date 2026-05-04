import { useMemo, useState } from "react";
import { Mail, Search, ShieldCheck, UserCog, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  getAllPlatformAdmins,
  type PlatformAdminEntry,
  type PlatformAdminRole,
} from "@/lib/platform-admin.ts";
import { usePlatformAdmin } from "@/hooks/use-platform-admin.ts";

export default function AdminUsersHubPage() {
  const [search, setSearch] = useState("");
  const { profile } = usePlatformAdmin();

  const admins = useMemo(() => getAllPlatformAdmins(), []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = admins;
    if (!q) return source;
    return source.filter((row) => {
      const haystack = `${row.email} ${row.role} ${row.source}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [admins, search]);

  const total = admins.length;
  const full = admins.filter((x) => x.role === "full").length;
  const limited = admins.filter((x) => x.role !== "full").length;
  const custom = admins.filter((x) => x.source === "custom").length;

  return (
    <section className="space-y-5 p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f4f9ff_55%,#f4fff6_100%)] p-6 shadow-[0_26px_60px_-40px_rgba(2,6,23,0.35)] dark:border-slate-700/70 dark:bg-[linear-gradient(135deg,#070d1f_0%,#08122a_55%,#0a1620_100%)]">
        <div
          className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[#0066FF]/20 blur-3xl dark:bg-[#0066FF]/28"
          aria-hidden
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300/70">
            Users Hub
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Users</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300/80">
            Ketu shfaqet vetem team-i i programit: platform adminat (jo klientat).
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Users className="size-4" />}
          title="Team Members"
          value={String(total)}
          hint="All platform admins"
        />
        <MetricCard
          icon={<ShieldCheck className="size-4" />}
          title="Full Admins"
          value={String(full)}
          hint="Global access"
        />
        <MetricCard
          icon={<UserCog className="size-4" />}
          title="Limited Roles"
          value={String(limited)}
          hint="Operations / Support / Finance / Viewer"
        />
        <MetricCard
          icon={<Mail className="size-4" />}
          title="Custom Admins"
          value={String(custom)}
          hint="Managed from local custom list"
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_46px_-38px_rgba(2,6,23,0.38)] dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Platform Team</h3>
            <p className="text-xs text-slate-500 dark:text-slate-300/70">
              Kerkim sipas email-it, rolit ose sources.
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

        <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/70">
          <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_0.8fr] gap-2 bg-slate-100/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-300/80">
            <span>Email</span>
            <span>Role</span>
            <span>Source</span>
            <span className="text-right">Current</span>
          </div>
          <div className="max-h-[420px] overflow-auto">
            {rows.length ? (
              rows.map((row) => (
                <AdminRow key={row.email} row={row} isCurrentUser={sameEmail(profile.email, row.email)} />
              ))
            ) : (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300/70">No users found for this search.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AdminRow({
  row,
  isCurrentUser,
}: {
  row: PlatformAdminEntry;
  isCurrentUser: boolean;
}) {
  return (
    <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_0.8fr] items-center gap-2 border-t border-slate-200/70 px-3 py-2.5 text-xs dark:border-slate-700/60">
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{row.email}</p>
      </div>
      <Badge className={roleBadgeClass(row.role)}>{row.role}</Badge>
      <Badge variant="outline" className="w-fit text-[11px]">
        {row.source}
      </Badge>
      <div className="flex justify-end">
        {isCurrentUser ? (
          <Badge className="w-fit border border-blue-500/40 bg-blue-500/12 text-blue-700 dark:text-blue-300">You</Badge>
        ) : (
          <span className="text-[11px] text-slate-500 dark:text-slate-300/70">-</span>
        )}
      </div>
    </div>
  );
}

function roleBadgeClass(role: PlatformAdminRole): string {
  if (role === "full") return "w-fit border border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (role === "operations") return "w-fit border border-blue-500/40 bg-blue-500/12 text-blue-700 dark:text-blue-300";
  if (role === "support") return "w-fit border border-cyan-500/40 bg-cyan-500/12 text-cyan-700 dark:text-cyan-300";
  if (role === "finance") return "w-fit border border-violet-500/40 bg-violet-500/12 text-violet-700 dark:text-violet-300";
  return "w-fit border border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300";
}

function MetricCard({
  icon,
  title,
  value,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="group relative [transform-style:preserve-3d] [transform:perspective(1000px)_rotateX(0deg)_translateY(0)] transition-transform duration-300 hover:[transform:perspective(1000px)_rotateX(5deg)_translateY(-4px)]">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 blur-xl" aria-hidden />
      <div className="relative rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_16px_36px_-30px_rgba(2,6,23,0.35)] dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 dark:border-slate-600/80 dark:bg-slate-800 dark:text-slate-200">
          {icon}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300/70">{title}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300/70">{hint}</p>
      </div>
    </div>
  );
}

function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}
