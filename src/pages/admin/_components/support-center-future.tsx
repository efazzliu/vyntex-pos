import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  Headset,
  Layers3,
  Rocket,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

type FilterKey = "all" | "critical" | "sla-risk" | "resolved";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All Tickets" },
  { key: "critical", label: "Critical" },
  { key: "sla-risk", label: "SLA Risk" },
  { key: "resolved", label: "Resolved" },
];

const TICKETS = [
  { id: "SP-2381", client: "Urban Grill", issue: "POS sync failed on 2 terminals", priority: "Critical", eta: "07m", status: "Escalated" },
  { id: "SP-2379", client: "Kafe Lumi", issue: "Invoice print delay after checkout", priority: "High", eta: "18m", status: "In progress" },
  { id: "SP-2374", client: "Nori Sushi", issue: "Card reader reconnect loop", priority: "Medium", eta: "42m", status: "Monitoring" },
  { id: "SP-2368", client: "Prime Burger", issue: "Staff PIN reset request", priority: "Low", eta: "--", status: "Resolved" },
];

const PRIORITY_STYLES: Record<string, string> = {
  Critical: "bg-red-500/15 text-red-300 border-red-500/35",
  High: "bg-amber-500/15 text-amber-300 border-amber-500/35",
  Medium: "bg-blue-500/15 text-blue-300 border-blue-500/35",
  Low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
};

export function SupportCenterFuture() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const metrics = useMemo(
    () => [
      { title: "Active Queue", value: "24", note: "+6 in last hour", icon: <Headset className="size-4" />, glow: "from-cyan-400/40 to-blue-500/10" },
      { title: "Critical", value: "3", note: "Need immediate action", icon: <ShieldAlert className="size-4" />, glow: "from-red-400/40 to-red-600/10" },
      { title: "SLA Health", value: "94%", note: "Stable this shift", icon: <Activity className="size-4" />, glow: "from-violet-400/40 to-fuchsia-500/10" },
      { title: "Resolved Today", value: "67", note: "Avg 14 min", icon: <CheckCircle2 className="size-4" />, glow: "from-emerald-400/40 to-emerald-600/10" },
    ],
    [],
  );

  const filteredTickets = useMemo(() => {
    if (activeFilter === "all") return TICKETS;
    if (activeFilter === "critical") return TICKETS.filter((x) => x.priority === "Critical");
    if (activeFilter === "sla-risk") return TICKETS.filter((x) => x.status === "Escalated" || x.status === "In progress");
    return TICKETS.filter((x) => x.status === "Resolved");
  }, [activeFilter]);

  return (
    <section className="space-y-5 p-5 lg:p-7">
      <motion.header
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-3xl border border-cyan-200/20 bg-[#070d1f] p-6 text-white shadow-[0_45px_90px_-48px_rgba(37,99,235,0.8)]"
      >
        <div className="pointer-events-none absolute -top-24 -right-12 h-64 w-64 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
              <Sparkles className="size-3.5" />
              Future Support Hub
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight lg:text-3xl">Support Center</h1>
            <p className="mt-1 text-sm text-cyan-100/80">3D inspired mission control for tickets, escalations and SLA velocity.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-xl">
            <BellRing className="size-4 text-cyan-200" />
            <span className="text-sm text-cyan-50">2 critical alerts live</span>
          </div>
        </div>
      </motion.header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <motion.article
            key={metric.title}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.42, delay: index * 0.08 }}
            whileHover={{ y: -6, rotateX: 3, rotateY: -3 }}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/65 bg-white/[0.88] p-4 [transform-style:preserve-3d] shadow-[0_28px_56px_-40px_rgba(15,23,42,0.65)] backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/85"
          >
            <div className={cn("pointer-events-none absolute inset-x-4 top-0 h-14 rounded-b-[100%] bg-gradient-to-b blur-lg", metric.glow)} />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700/70 dark:bg-slate-800/85 dark:text-slate-300">
                {metric.icon}
                {metric.title}
              </span>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{metric.value}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300/70">{metric.note}</p>
            </div>
            <div className="pointer-events-none absolute -bottom-14 right-0 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl transition group-hover:bg-blue-500/20" />
          </motion.article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <motion.article
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.18 }}
          className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_32px_62px_-46px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/85"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Smart Queue</h2>
              <p className="text-xs text-slate-500 dark:text-slate-300/70">Live triage with SLA aware prioritization</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-300">
              <Search className="size-3.5" />
              Search client / ticket / issue
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const active = filter.key === activeFilter;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "border-blue-400/60 bg-blue-500/15 text-blue-700 dark:text-blue-300"
                      : "border-slate-200/70 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700/70 dark:bg-slate-800/85 dark:text-slate-300 dark:hover:text-white",
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5">
            {filteredTickets.map((ticket, i) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * i }}
                className="group flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_22px_45px_-35px_rgba(37,99,235,0.5)] dark:border-slate-700/70 dark:bg-slate-800/70"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{ticket.issue}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300/70">
                    {ticket.id} • {ticket.client}
                  </p>
                </div>
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", PRIORITY_STYLES[ticket.priority])}>
                  {ticket.priority}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700/70 dark:bg-slate-700/60 dark:text-slate-200">
                  <Clock3 className="size-3.5" />
                  {ticket.eta}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-300/70">{ticket.status}</span>
              </motion.div>
            ))}
          </div>
        </motion.article>

        <div className="grid gap-4">
          <motion.article
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_32px_62px_-46px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/85"
          >
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Escalation Pulse</h3>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-300/70">Neural-like flow for critical incidents</p>
            <div className="space-y-3">
              {[
                { label: "Ticket opened", icon: <AlertTriangle className="size-3.5" />, state: "done" },
                { label: "Tier 2 review", icon: <Layers3 className="size-3.5" />, state: "active" },
                { label: "SLA mitigation", icon: <Rocket className="size-3.5" />, state: "pending" },
              ].map((step) => (
                <div key={step.label} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-full border",
                      step.state === "done" && "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
                      step.state === "active" && "border-blue-400/50 bg-blue-500/15 text-blue-300 animate-pulse",
                      step.state === "pending" && "border-slate-300/60 bg-slate-100 text-slate-500 dark:border-slate-700/70 dark:bg-slate-800 dark:text-slate-300/70",
                    )}
                  >
                    {step.icon}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-200">{step.label}</span>
                </div>
              ))}
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-3xl border border-cyan-300/25 bg-gradient-to-br from-[#06132c] via-[#091a3a] to-[#0a1d3f] p-5 text-white shadow-[0_35px_70px_-48px_rgba(34,197,246,0.75)]"
          >
            <h3 className="text-base font-semibold">AI Suggested Actions</h3>
            <p className="mt-1 text-xs text-cyan-100/80">Generated next-best moves for your agents</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">Assign SP-2381 to infrastructure specialist</li>
              <li className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">Trigger proactive message to affected clients</li>
              <li className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">Launch POS health-check script remotely</li>
            </ul>
          </motion.article>
        </div>
      </div>
    </section>
  );
}
