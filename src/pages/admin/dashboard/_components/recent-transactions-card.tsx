import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  getAdminRecentTransactions,
  type AdminRecentTransaction,
  type AdminTransactionCategory,
  type AdminTransactionCycle,
  type AdminTransactionMethod,
  type AdminTransactionStatus,
} from "@/lib/supabase-pos/admin-ops.ts";
import { cn } from "@/lib/utils.ts";

const amountFmt = new Intl.NumberFormat("en-EU", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function categoryLabel(value: AdminTransactionCategory): string {
  if (value === "restaurant_pos") return "Restaurant POS";
  return "Restaurant POS";
}

function statusLabel(value: AdminTransactionStatus): string {
  if (value === "paid") return "Paid";
  if (value === "pending") return "Pending";
  if (value === "failed") return "Failed";
  return "Refunded";
}

function cycleLabel(value: AdminTransactionCycle): string {
  return value === "monthly" ? "Monthly" : "Yearly";
}

function methodLabel(value: AdminTransactionMethod): string {
  if (value === "card") return "Card";
  if (value === "bank_transfer") return "Bank";
  return "PayPal";
}

function planLabel(value: AdminRecentTransaction["plan"]): string {
  if (value === "starter") return "Starter";
  if (value === "professional") return "Professional";
  return "Enterprise";
}

function statusBadgeClass(status: AdminTransactionStatus): string {
  if (status === "paid") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (status === "pending") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  if (status === "failed") return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400";
  return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400";
}

export function RecentTransactionsCard() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminTransactionStatus | "all">("all");
  const [cycleFilter, setCycleFilter] = useState<AdminTransactionCycle | "all">("all");

  const transactionsQuery = useQuery({
    queryKey: ["admin", "recent-transactions"],
    queryFn: () => getAdminRecentTransactions(10),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (transactionsQuery.data ?? []).filter((tx) => {
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      if (cycleFilter !== "all" && tx.cycle !== cycleFilter) return false;
      if (!q) return true;
      const haystack = `${tx.customerName} ${tx.customerEmail}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [transactionsQuery.data, search, statusFilter, cycleFilter]);

  return (
    <div className="rounded-3xl border border-border/70 bg-gradient-to-b from-card via-card to-muted/25 p-5 shadow-[0_24px_56px_-28px_rgba(0,102,255,0.18)] dark:border-slate-700/70 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/50 dark:shadow-[0_24px_56px_-32px_rgba(0,0,0,0.65)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Recent Transactions</h3>
          <p className="text-xs text-muted-foreground">Latest charges recorded from Paddle webhooks.</p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <a href="/admin/invoices">View all</a>
        </Button>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_140px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer or email"
            className="h-8 rounded-full pl-8 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AdminTransactionStatus | "all")}>
          <SelectTrigger size="sm" className="h-8 rounded-full text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cycleFilter} onValueChange={(v) => setCycleFilter(v as AdminTransactionCycle | "all")}>
          <SelectTrigger size="sm" className="h-8 rounded-full text-xs">
            <SelectValue placeholder="Cycle" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">All cycles</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70">
        <div className="grid grid-cols-[0.8fr_1.5fr_1.05fr_0.8fr_0.85fr_0.75fr_0.85fr_0.9fr] gap-2 border-b border-border/70 bg-muted/35 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>ID</span>
          <span>Customer</span>
          <span>Category</span>
          <span>Plan</span>
          <span>Cycle</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Method / Date</span>
        </div>

        <div className="max-h-[320px] overflow-auto">
          {transactionsQuery.isLoading ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : transactionsQuery.isError ? (
            <p className="px-4 py-6 text-sm text-destructive">Could not load recent transactions.</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {(transactionsQuery.data?.length ?? 0) === 0
                ? "No Paddle transactions yet. Configure the Paddle webhook to populate this list."
                : "No transactions match current filters."}
            </p>
          ) : (
            rows.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-[0.8fr_1.5fr_1.05fr_0.8fr_0.85fr_0.75fr_0.85fr_0.9fr] gap-2 border-b border-border/60 px-3 py-2.5 text-xs last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-[11px] text-foreground">{tx.id}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{tx.customerName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{tx.customerEmail}</p>
                </div>
                <div className="flex items-center">
                  <Badge variant="outline" className="text-[11px]">
                    {categoryLabel(tx.category)}
                  </Badge>
                </div>
                <span className="font-medium text-foreground">{planLabel(tx.plan)}</span>
                <span className="text-muted-foreground">{cycleLabel(tx.cycle)}</span>
                <span className={cn("font-semibold tabular-nums", tx.amountEur < 0 ? "text-rose-500" : "text-foreground")}>
                  {amountFmt.format(tx.amountEur)}
                </span>
                <div className="flex items-center">
                  <Badge variant="outline" className={cn("text-[11px]", statusBadgeClass(tx.status))}>
                    {statusLabel(tx.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-foreground">{methodLabel(tx.method)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString("en-GB")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
