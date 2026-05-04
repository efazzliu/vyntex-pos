import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  BookOpen,
  Users,
  AlertTriangle,
  Search,
  Phone,
  ChevronRight,
  UserPlus,
  DollarSign,
} from "lucide-react";
import DebtCustomerDetail from "./debt-customer-detail.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";

type Props = {
  licenseKey: string;
  staffId: string;
  staffName: string;
};

export default function DebtLedgerView({
  licenseKey,
  staffId,
  staffName,
}: Props) {
  const { t, formatPrice } = usePosLocale();
  const [selectedCustomerId, setSelectedCustomerId] =
    useState<Id<"customers"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const ledger = useQuery('pos.customers.getDebtLedger', { licenseKey });

  // Compute summary from ledger data client-side
  const summary = useMemo(() => {
    if (!ledger) return null;
    let totalOutstanding = 0;
    let activeDebtors = 0;
    let overLimitCount = 0;
    for (const c of ledger) {
      if (c.balance > 0) {
        totalOutstanding += c.balance;
        activeDebtors++;
        if (c.creditLimit && c.balance > c.creditLimit) {
          overLimitCount++;
        }
      }
    }
    return { totalOutstanding, activeDebtors, overLimitCount };
  }, [ledger]);

  // Filter + sort debtors
  const filteredDebtors = useMemo(() => {
    if (!ledger) return [];
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? ledger.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.phone?.toLowerCase().includes(q)
        )
      : ledger;

    return [...filtered].sort((a, b) => {
      if (a.balance > 0 && b.balance <= 0) return -1;
      if (a.balance <= 0 && b.balance > 0) return 1;
      if (a.balance > 0 && b.balance > 0) return b.balance - a.balance;
      return a.name.localeCompare(b.name);
    });
  }, [ledger, searchQuery]);

  // Detail view
  if (selectedCustomerId) {
    return (
      <DebtCustomerDetail
        licenseKey={licenseKey}
        customerId={selectedCustomerId}
        staffId={staffId}
        staffName={staffName}
        onBack={() => setSelectedCustomerId(null)}
      />
    );
  }

  const isLoading = ledger === undefined;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="size-6" />
          {t("nav.debt_ledger")}
        </h1>
        <p className="text-[#8b93a7] text-sm mt-1">{t("debt.subtitle")}</p>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={DollarSign}
          label={t("debt.total_outstanding")}
          value={
            isLoading
              ? "..."
              : formatPrice(summary?.totalOutstanding ?? 0)
          }
          color="text-red-400"
          bgColor="bg-red-500/10"
        />
        <SummaryCard
          icon={Users}
          label={t("debt.active_debtors")}
          value={isLoading ? "..." : String(summary?.activeDebtors ?? 0)}
          color="text-blue-400"
          bgColor="bg-blue-500/10"
        />
        <SummaryCard
          icon={AlertTriangle}
          label={t("debt.over_limit")}
          value={isLoading ? "..." : String(summary?.overLimitCount ?? 0)}
          color={
            summary?.overLimitCount ? "text-amber-400" : "text-emerald-400"
          }
          bgColor={
            summary?.overLimitCount ? "bg-amber-500/10" : "bg-emerald-500/10"
          }
        />
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#5a6580]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("debt.search_ph")}
            className="pl-10 bg-[#0D1326] border-[#1e2a45] text-white"
          />
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="shrink-0">
          <UserPlus className="size-4 mr-2" />
          {t("debt.add_debtor")}
        </Button>
      </div>

      {/* Debtor list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-[#131A2E]" />
          ))}
        </div>
      ) : filteredDebtors.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>
              {searchQuery ? t("debt.empty_search") : t("debt.empty_none")}
            </EmptyTitle>
            <EmptyDescription>
              {searchQuery
                ? t("debt.empty_search_hint")
                : t("debt.empty_hint")}
            </EmptyDescription>
          </EmptyHeader>
          {!searchQuery && (
            <EmptyContent>
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <UserPlus className="size-4 mr-2" />
                {t("debt.add_debtor")}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-2">
          {filteredDebtors.map((debtor) => (
            <button
              key={debtor._id}
              onClick={() => setSelectedCustomerId(debtor._id)}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#0D1326] border border-[#1e2a45] hover:border-[#2a3a5a] transition-all cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-full bg-[#1e2a45] flex items-center justify-center text-white font-bold text-sm shrink-0">
                {debtor.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white truncate">
                    {debtor.name}
                  </p>
                  {debtor.creditLimit &&
                    debtor.balance > debtor.creditLimit && (
                      <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
                    )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {debtor.phone && (
                    <span className="flex items-center gap-1 text-[11px] text-[#5a6580]">
                      <Phone className="size-3" />
                      {debtor.phone}
                    </span>
                  )}
                  {debtor.orderCount > 0 && (
                    <span className="text-[11px] text-[#5a6580]">
                      {debtor.orderCount === 1
                        ? t("debt.orders_count", { count: debtor.orderCount })
                        : t("debt.orders_count_plural", {
                            count: debtor.orderCount,
                          })}
                    </span>
                  )}
                  {debtor.creditLimit !== undefined &&
                    debtor.creditLimit > 0 && (
                      <span className="text-[11px] text-[#5a6580]">
                        {t("debt.limit", {
                          amount: formatPrice(debtor.creditLimit),
                        })}
                      </span>
                    )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={cn(
                    "text-sm font-bold",
                    debtor.balance > 0 ? "text-red-400" : "text-emerald-400"
                  )}
                >
                  {formatPrice(debtor.balance)}
                </p>
                <p className="text-[10px] text-[#5a6580]">
                  {t("debt.balance_label")}
                </p>
              </div>
              <ChevronRight className="size-4 text-[#5a6580] shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Add debtor dialog */}
      <AddDebtorDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        licenseKey={licenseKey}
        onCreated={(id) => {
          setAddDialogOpen(false);
          setSelectedCustomerId(id);
        }}
      />
    </div>
  );
}

// ── Summary Card ──

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-[#0D1326] border border-[#1e2a45]">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", bgColor)}>
          <Icon className={cn("size-4", color)} />
        </div>
        <div>
          <p className="text-xs text-[#5a6580]">{label}</p>
          <p className={cn("text-lg font-bold", color)}>{value}</p>
        </div>
      </div>
    </div>
  );
}

// ── Add Debtor Dialog ──

function AddDebtorDialog({
  open,
  onOpenChange,
  licenseKey,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  onCreated: (id: Id<"customers">) => void;
}) {
  const createCustomer = useMutation('pos.customers.createCustomer');
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const id = await createCustomer({
        licenseKey,
        name: name.trim(),
        phone: phone.trim() || undefined,
        creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
      });
      toast.success("Debtor added");
      setName("");
      setPhone("");
      setCreditLimit("");
      onCreated(id);
    } catch {
      toast.error("Failed to create debtor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-l border-slate-200 bg-white p-0 text-slate-900 sm:max-w-md"
      >
        <SheetHeader className="border-b border-slate-200 bg-slate-50 pb-4">
          <SheetTitle className="text-xl font-semibold tracking-tight text-slate-900">Add New Debtor</SheetTitle>
          <SheetDescription className="text-sm text-slate-500">
            Create a customer account for debt tracking
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">
              Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[#2a7fff] focus-visible:ring-2 focus-visible:ring-[#2a7fff]/45"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Phone</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 890"
              className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[#2a7fff] focus-visible:ring-2 focus-visible:ring-[#2a7fff]/45"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">
              Credit Limit (optional)
            </label>
            <Input
              type="number"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="No limit"
              className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[#2a7fff] focus-visible:ring-2 focus-visible:ring-[#2a7fff]/45"
              min={0}
              step={0.01}
            />
          </div>
        </div>
        <SheetFooter className="border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            className="rounded-xl bg-[#1170d8] px-4 text-white hover:bg-[#1f86f5] disabled:bg-[#1f3e69] disabled:text-slate-300"
          >
            {saving ? "Saving..." : "Add Debtor"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
