import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  Gauge,
  KeyRound,
  Layers3,
  LifeBuoy,
  MessageSquare,
  Radio,
  Settings2,
  Shield,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { getAdminStats } from "@/lib/supabase-pos/admin-ops.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { canSeeAdminNavItem, type PlatformAdminRole } from "@/lib/platform-admin.ts";
import { isSupabaseConfigured } from "@/lib/supabase.ts";
import { AdminAccountProfileSection } from "./admin-account-profile-section.tsx";

type HubTile = {
  href: string;
  title: string;
  description: string;
  icon: typeof Users;
  accent: string;
};

const TILES: HubTile[] = [
  {
    href: "/admin/users",
    title: "Users",
    description: "Everyone who registered on the site (Supabase Auth).",
    icon: Users,
    accent: "from-blue-500/25 to-cyan-500/10",
  },
  {
    href: "/admin/team",
    title: "Team & access",
    description: "Platform operators and admin roles.",
    icon: Shield,
    accent: "from-violet-500/25 to-fuchsia-500/10",
  },
  {
    href: "/admin/staff-roles",
    title: "Staff roles",
    description: "Templates for permissions across internal tools.",
    icon: Shield,
    accent: "from-slate-500/20 to-slate-600/10",
  },
  {
    href: "/admin/businesses",
    title: "Clients",
    description: "Tenant accounts, owners, and fleet-wide context.",
    icon: Building2,
    accent: "from-blue-500/25 to-cyan-500/10",
  },
  {
    href: "/admin/licenses",
    title: "Licenses",
    description: "Keys, devices, expiry, and compliance posture.",
    icon: KeyRound,
    accent: "from-emerald-500/25 to-teal-500/10",
  },
  {
    href: "/admin/branches",
    title: "Branches",
    description: "Locations, terminals, and rollout coverage.",
    icon: Layers3,
    accent: "from-amber-500/25 to-orange-500/10",
  },
  {
    href: "/admin/subscriptions",
    title: "Revenue",
    description: "Plans, MRR signals, and subscription health.",
    icon: Wallet,
    accent: "from-cyan-500/25 to-blue-600/10",
  },
  {
    href: "/admin/invoices",
    title: "Invoices",
    description: "Billing documents and payment alignment.",
    icon: CreditCard,
    accent: "from-rose-500/20 to-pink-500/10",
  },
  {
    href: "/admin/reports",
    title: "Analytics",
    description: "Exports, trends, and operational reporting.",
    icon: BarChart3,
    accent: "from-indigo-500/25 to-violet-500/10",
  },
  {
    href: "/admin/support",
    title: "Client inbox",
    description: "Live chat and contact-form threads in one queue.",
    icon: MessageSquare,
    accent: "from-sky-500/25 to-cyan-500/10",
  },
  {
    href: "/admin/contacts",
    title: "Contact center",
    description: "Leads, handoffs, and CRM-style touchpoints.",
    icon: LifeBuoy,
    accent: "from-teal-500/25 to-emerald-500/10",
  },
  {
    href: "/admin/modules",
    title: "Modules",
    description: "Feature flags and surface area by segment.",
    icon: Settings2,
    accent: "from-purple-500/25 to-blue-500/10",
  },
  {
    href: "/admin/system-monitor",
    title: "System monitor",
    description: "Signals, latency, and infrastructure visibility.",
    icon: Activity,
    accent: "from-red-500/20 to-orange-500/10",
  },
  {
    href: "/admin/marketing",
    title: "Marketing",
    description: "Campaigns, messaging, and growth experiments.",
    icon: Radio,
    accent: "from-pink-500/20 to-rose-500/10",
  },
  {
    href: "/admin/bookings",
    title: "Bookings",
    description: "Scheduled work and onboarding throughput.",
    icon: CalendarDays,
    accent: "from-lime-500/20 to-green-500/10",
  },
  {
    href: "/admin/finance",
    title: "Finance (legacy)",
    description: "Historical finance tools and ledger views.",
    icon: Gauge,
    accent: "from-neutral-500/20 to-stone-500/10",
  },
];

function roleLabel(role: PlatformAdminRole | null): string {
  if (!role) return "—";
  if (role === "full") return "Full administrator";
  if (role === "operations") return "Operations";
  if (role === "support") return "Support";
  if (role === "finance") return "Finance";
  if (role === "viewer") return "Viewer";
  return role;
}

export function AdminSettingsHub() {
  const { user, adminAccess } = useUserRole();
  const displayName = user?.name?.trim() || user?.email || "Operator";
  const email = user?.email ?? "";

  const visibleTiles = useMemo(
    () => TILES.filter((t) => canSeeAdminNavItem(t.href, adminAccess)),
    [adminAccess],
  );

  const statsQuery = useQuery({
    queryKey: ["admin", "settings-hub-stats"],
    queryFn: getAdminStats,
  });

  const statCards = useMemo(
    () => [
      {
        title: "Active clients",
        value: statsQuery.data?.totalClients,
        note: "Distinct owner emails",
        glow: "from-cyan-400/35 to-blue-600/10",
      },
      {
        title: "Licenses",
        value: statsQuery.data?.totalLicenses,
        note: `${statsQuery.data?.activeLicenses ?? "—"} active · ${statsQuery.data?.expiredLicenses ?? "—"} expired`,
        glow: "from-emerald-400/35 to-teal-600/10",
      },
      {
        title: "New inbox",
        value: statsQuery.data?.newContacts,
        note: "Unread contact / chat rows",
        glow: "from-violet-400/35 to-fuchsia-600/10",
      },
      {
        title: "Suspended",
        value: statsQuery.data?.suspendedLicenses,
        note: "Manually suspended seats",
        glow: "from-amber-400/35 to-orange-600/10",
      },
    ],
    [statsQuery.data],
  );

  return (
    <section className="space-y-6 px-6 pb-12 pt-0 lg:px-8">
      <motion.header
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-3xl border border-cyan-500/15 bg-[#040814] p-7 text-white shadow-[0_48px_120px_-56px_rgba(34,211,238,0.45)] lg:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-cyan-400/18 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-[#0066FF]/20 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 top-12 h-40 w-40 rounded-full bg-violet-500/15 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/90">
              <Sparkles className="size-3.5 text-cyan-300" />
              Control plane
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight lg:text-4xl">Settings</h1>
            <p className="mt-3 text-sm leading-relaxed text-cyan-100/75 lg:text-base">
              Your profile, theme, and sign-out live in <strong className="text-cyan-50">Account</strong> below. Use the
              grid for shortcuts to every admin area you{"'"}re allowed to open.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-200/80">Signed in</p>
              <p className="mt-1 max-w-[220px] truncate text-sm font-medium text-white">{displayName}</p>
              <p className="truncate font-mono text-xs text-cyan-100/55">{email}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-200/80">Access scope</p>
              <p className="mt-1 text-sm font-medium text-white">{roleLabel(adminAccess)}</p>
              <p className="text-xs text-cyan-100/55">Scoped navigation below</p>
            </div>
          </div>
        </div>
      </motion.header>

      <AdminAccountProfileSection />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s, i) => (
          <motion.article
            key={s.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.05 * i }}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_28px_60px_-44px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/85"
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-x-8 top-0 h-16 rounded-b-[100%] bg-gradient-to-b opacity-90 blur-xl transition group-hover:opacity-100",
                s.glow,
              )}
            />
            <div className="relative z-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                {s.title}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
                {statsQuery.isLoading ? (
                  <Skeleton className="h-9 w-16 rounded-md" />
                ) : statsQuery.isError ? (
                  "—"
                ) : (
                  String(s.value ?? 0)
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.note}</p>
            </div>
          </motion.article>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white/95 via-slate-50/40 to-cyan-50/20 p-5 shadow-[0_32px_70px_-50px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-700/60 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-slate-950/80 lg:p-6"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Navigate the stack</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
              Jump to the area you need — tiles respect your platform role. This hub stays visual; real toggles live on
              each destination.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 font-medium",
                isSupabaseConfigured
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
              )}
            >
              Supabase {isSupabaseConfigured ? "connected" : "not configured"}
            </span>
            <span className="rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
              PKCE auth · Edge-ready
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleTiles.map((tile, index) => (
            <motion.div
              key={tile.href}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.02 * index }}
            >
              <Link
                to={tile.href}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-500/25 hover:shadow-[0_24px_48px_-28px_rgba(0,102,255,0.35)] dark:border-slate-700/70 dark:bg-slate-900/75 dark:hover:border-cyan-500/30"
              >
                <div
                  className={cn(
                    "pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-70 blur-2xl transition group-hover:opacity-100",
                    tile.accent,
                  )}
                />
                <div className="relative z-10 flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/90 text-[#0066FF] dark:border-slate-600 dark:bg-slate-800/90 dark:text-cyan-300">
                    <tile.icon className="size-5" />
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-slate-400 transition group-hover:text-cyan-600 dark:group-hover:text-cyan-400" />
                </div>
                <p className="relative z-10 mt-3 font-semibold text-slate-900 dark:text-white">{tile.title}</p>
                <p className="relative z-10 mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {tile.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>

        {visibleTiles.length === 0 ? (
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No navigation tiles for your current role. Contact a full administrator.
          </p>
        ) : null}
      </motion.div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/50 px-5 py-4 text-center text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400"
      >
        Environment-backed behaviour (billing URLs, admin allowlists) lives in{" "}
        <code className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-800">.env</code> and
        Supabase policies — keep secrets out of the browser and rotate keys on a schedule you trust.
      </motion.footer>
    </section>
  );
}
