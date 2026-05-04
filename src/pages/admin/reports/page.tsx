import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarRange, CreditCard, Package, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils.ts";

type RangeKey = "today" | "7d" | "30d";

const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

const REVENUE_SERIES: Record<RangeKey, Array<{ label: string; value: number }>> = {
  today: [
    { label: "09:00", value: 180 },
    { label: "11:00", value: 260 },
    { label: "13:00", value: 390 },
    { label: "15:00", value: 350 },
    { label: "17:00", value: 470 },
    { label: "19:00", value: 520 },
    { label: "21:00", value: 430 },
  ],
  "7d": [
    { label: "Mon", value: 950 },
    { label: "Tue", value: 1170 },
    { label: "Wed", value: 1090 },
    { label: "Thu", value: 1340 },
    { label: "Fri", value: 1590 },
    { label: "Sat", value: 1710 },
    { label: "Sun", value: 1480 },
  ],
  "30d": [
    { label: "W1", value: 6200 },
    { label: "W2", value: 6890 },
    { label: "W3", value: 7350 },
    { label: "W4", value: 8120 },
  ],
};

const PRODUCT_SERIES: Record<RangeKey, Array<{ name: string; sales: number }>> = {
  today: [
    { name: "Pizza Classic", sales: 82 },
    { name: "Chicken Wrap", sales: 54 },
    { name: "Greek Salad", sales: 43 },
    { name: "Pasta Alfredo", sales: 38 },
    { name: "Cheesecake", sales: 29 },
  ],
  "7d": [
    { name: "Pizza Classic", sales: 496 },
    { name: "Chicken Wrap", sales: 344 },
    { name: "Greek Salad", sales: 267 },
    { name: "Pasta Alfredo", sales: 228 },
    { name: "Cheesecake", sales: 190 },
  ],
  "30d": [
    { name: "Pizza Classic", sales: 1880 },
    { name: "Chicken Wrap", sales: 1320 },
    { name: "Greek Salad", sales: 1098 },
    { name: "Pasta Alfredo", sales: 960 },
    { name: "Cheesecake", sales: 810 },
  ],
};

const PAYMENT_SPLIT = [
  { name: "Cash", value: 42, color: "#7C3AED" },
  { name: "Card", value: 48, color: "#2563EB" },
  { name: "Bank", value: 10, color: "#14B8A6" },
];

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export default function AdminReportsPage() {
  const [range, setRange] = useState<RangeKey>("7d");

  const revenueData = REVENUE_SERIES[range];
  const productData = PRODUCT_SERIES[range];

  const metrics = useMemo(() => {
    const revenue = revenueData.reduce((sum, row) => sum + row.value, 0);
    const orders = Math.round(revenue * 0.64);
    const avgTicket = orders > 0 ? revenue / orders : 0;
    const grossProfit = revenue * 0.31;
    return { revenue, orders, avgTicket, grossProfit };
  }, [revenueData]);

  return (
    <section className="space-y-5 p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-[#0f172a] via-[#132347] to-[#0a1b38] p-6 text-white shadow-[0_36px_80px_-40px_rgba(37,99,235,0.65)]"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-8 size-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Reports & Analytics</h2>
            <p className="mt-1 text-sm text-blue-100/80">
              Modern analytics cockpit with live-style visual feedback.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 p-1 backdrop-blur-md">
            {(["today", "7d", "30d"] as RangeKey[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  range === item ? "bg-white text-slate-900" : "text-white/75 hover:text-white",
                )}
              >
                {RANGE_LABELS[item]}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric3DCard
          delay={0.05}
          title="Revenue"
          value={moneyFmt.format(metrics.revenue)}
          note={`${RANGE_LABELS[range]} total`}
          icon={<Wallet className="size-4" />}
        />
        <Metric3DCard
          delay={0.1}
          title="Orders"
          value={metrics.orders.toLocaleString()}
          note="Processed orders"
          icon={<CreditCard className="size-4" />}
        />
        <Metric3DCard
          delay={0.15}
          title="Avg Ticket"
          value={moneyFmt.format(metrics.avgTicket)}
          note="Per order"
          icon={<CalendarRange className="size-4" />}
        />
        <Metric3DCard
          delay={0.2}
          title="Gross Profit"
          value={moneyFmt.format(metrics.grossProfit)}
          note="Estimated margin"
          icon={<TrendingUp className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <motion.article
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_30px_60px_-44px_rgba(15,23,42,0.5)] dark:border-slate-700/70 dark:bg-slate-900/85"
        >
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Revenue Trend</h3>
            <p className="text-xs text-slate-500 dark:text-slate-300/70">Animated performance curve</p>
          </div>
          <div className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" vertical={false} className="stroke-slate-200/80 dark:stroke-slate-700/70" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-[11px] fill-slate-500 dark:fill-slate-300/70" />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  className="text-[11px] fill-slate-500 dark:fill-slate-300/70"
                  tickFormatter={(v) => `€${Math.round(v)}`}
                  width={42}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,.35)",
                    background: "rgba(15,23,42,.92)",
                    color: "#fff",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="url(#lineGlow)"
                  strokeWidth={3}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6, fill: "#2563EB", stroke: "#fff", strokeWidth: 2 }}
                  isAnimationActive
                  animationDuration={850}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.article>

        <div className="grid gap-4">
          <motion.article
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_30px_60px_-44px_rgba(15,23,42,0.5)] dark:border-slate-700/70 dark:bg-slate-900/85"
          >
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Payment Split</h3>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-300/70">Cash, card and transfer ratio</p>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={PAYMENT_SPLIT} dataKey="value" innerRadius={48} outerRadius={78} paddingAngle={4}>
                    {PAYMENT_SPLIT.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {PAYMENT_SPLIT.map((item) => (
                <span
                  key={item.name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700/70 dark:text-slate-200"
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name} {item.value}%
                </span>
              ))}
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.28 }}
            className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_30px_60px_-44px_rgba(15,23,42,0.5)] dark:border-slate-700/70 dark:bg-slate-900/85"
          >
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Top Products</h3>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-300/70">Best sellers by volume</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productData} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 6" horizontal={false} className="stroke-slate-200/80 dark:stroke-slate-700/70" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={96}
                    className="text-[11px] fill-slate-600 dark:fill-slate-300/80"
                  />
                  <Tooltip />
                  <Bar dataKey="sales" radius={[0, 10, 10, 0]} fill="#2563EB" isAnimationActive animationDuration={780} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              <Package className="size-3.5" />
              Trend updates with selected range
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  );
}

function Metric3DCard({
  title,
  value,
  note,
  icon,
  delay,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay }}
      whileHover={{ y: -6, rotateX: 4, rotateY: -2 }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 [transform-style:preserve-3d] shadow-[0_24px_55px_-42px_rgba(15,23,42,0.65)] transition dark:border-slate-700/70 dark:bg-slate-900/85"
    >
      <div className="pointer-events-none absolute inset-x-3 top-0 h-12 rounded-b-[100%] bg-gradient-to-b from-blue-400/20 to-transparent blur-md" />
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-300">
        {icon}
        {title}
      </div>
      <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300/70">{note}</p>
      <div className="pointer-events-none absolute -bottom-14 right-0 size-32 rounded-full bg-blue-500/10 blur-2xl transition group-hover:bg-blue-500/20" />
    </motion.article>
  );
}
