import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { CreditCard, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { DEMO_WEEKLY_SALES } from "../_data.ts";

const KPIS = [
  { label: "Today's Sales", value: "$1,684", icon: TrendingUp },
  { label: "Orders", value: "42", icon: ShoppingBag },
  { label: "Avg. Ticket", value: "$40.10", icon: CreditCard },
  { label: "Tables Turned", value: "18", icon: Users },
];

export default function DemoAnalytics() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[#1e2a45] bg-[#131A2E] p-4">
            <kpi.icon className="mb-2 size-4 text-[#0066FF]" />
            <p className="text-lg font-bold text-white">{kpi.value}</p>
            <p className="text-[11px] text-[#8b93a7]">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8b93a7]">
          This week's sales
        </p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={DEMO_WEEKLY_SALES}>
              <XAxis
                dataKey="day"
                stroke="#5a6580"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,102,255,0.08)" }}
                contentStyle={{
                  background: "#0D1326",
                  border: "1px solid #1e2a45",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#fff",
                }}
              />
              <Bar dataKey="sales" fill="#0066FF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
