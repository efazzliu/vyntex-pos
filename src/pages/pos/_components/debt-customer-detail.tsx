import { useState, useEffect } from "react";
import { useQuery as useTanQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { posQueryKey, runPosQuery } from "@/lib/supabase-pos/pos-router.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Wallet,
  Phone,
  Pencil,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

type Props = {
  licenseKey: string;
  customerId: Id<"customers">;
  staffId: string;
  staffName: string;
  onBack: () => void;
};

export default function DebtCustomerDetail({
  licenseKey,
  customerId,
  staffId,
  staffName,
  onBack,
}: Props) {
  const customerIdStr = String(customerId);
  const {
    data: statement,
    isPaused,
    isError,
    error,
    refetch,
  } = useTanQuery({
    queryKey: posQueryKey("pos.customers.getCustomerStatement", {
      licenseKey,
      customerId: customerIdStr,
    }),
    queryFn: () =>
      runPosQuery("pos.customers.getCustomerStatement", {
        licenseKey,
        customerId: customerIdStr,
      }),
    staleTime: 0,
    refetchOnWindowFocus: false,
    /** Run even when the browser reports offline — otherwise fetches stay paused (Electron often misreports `navigator.onLine`). */
    networkMode: "always",
  });
  const [settleOpen, setSettleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (isError) {
    const msg = (() => {
      if (error instanceof Error) return error.message;
      if (typeof error === "string") return error;
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message: unknown }).message === "string"
      ) {
        return (error as { message: string }).message;
      }
      return "Could not load this customer.";
    })();
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white cursor-pointer"
        >
          <ArrowLeft className="size-5" />
        </button>
        <p className="text-sm text-red-400">{msg}</p>
        <Button variant="secondary" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (isPaused && statement === undefined) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white cursor-pointer"
        >
          <ArrowLeft className="size-5" />
        </button>
        <p className="text-sm text-[#8b93a7]">
          Connection paused (offline). Check your network and try again.
        </p>
        <Button variant="secondary" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (statement === undefined) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-64 bg-[#131A2E]" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-[#131A2E]" />
          ))}
        </div>
        <Skeleton className="h-96 bg-[#131A2E]" />
      </div>
    );
  }

  const st = statement as {
    customer?: {
      _id: string;
      name: string;
      phone?: string;
      creditLimit?: number;
    };
    transactions?: unknown[];
    totalDebt?: number;
    totalPaid?: number;
    balance?: number;
  };
  if (!st.customer) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white cursor-pointer"
        >
          <ArrowLeft className="size-5" />
        </button>
        <p className="text-sm text-[#8b93a7]">
          Could not load this customer. Try again from the list.
        </p>
      </div>
    );
  }

  const customer = st.customer;
  const transactions = Array.isArray(st.transactions) ? st.transactions : [];
  const totalDebt = Number(st.totalDebt ?? 0);
  const totalPaid = Number(st.totalPaid ?? 0);
  const balance = Number(st.balance ?? 0);
  const isOverLimit = customer.creditLimit
    ? balance > customer.creditLimit
    : false;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white truncate">
              {customer.name}
            </h1>
            {isOverLimit && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-medium shrink-0">
                <AlertTriangle className="size-3" />
                Over Limit
              </span>
            )}
          </div>
          {customer.phone && (
            <p className="flex items-center gap-1 text-sm text-[#5a6580]">
              <Phone className="size-3" />
              {customer.phone}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5 mr-1.5" />
            Edit
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setSettleOpen(true)}
          >
            <Banknote className="size-3.5 mr-1.5" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#0D1326] border border-[#1e2a45]">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-red-400" />
            <p className="text-xs text-[#5a6580]">Total Charges</p>
          </div>
          <p className="text-lg font-bold text-red-400 mt-1">
            ${totalDebt.toFixed(2)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[#0D1326] border border-[#1e2a45]">
          <div className="flex items-center gap-2">
            <TrendingDown className="size-4 text-emerald-400" />
            <p className="text-xs text-[#5a6580]">Total Paid</p>
          </div>
          <p className="text-lg font-bold text-emerald-400 mt-1">
            ${totalPaid.toFixed(2)}
          </p>
        </div>
        <div
          className={cn(
            "p-4 rounded-xl border",
            balance > 0
              ? "bg-red-500/5 border-red-500/20"
              : "bg-emerald-500/5 border-emerald-500/20"
          )}
        >
          <p className="text-xs text-[#5a6580]">Outstanding Balance</p>
          <p
            className={cn(
              "text-2xl font-bold mt-1",
              balance > 0 ? "text-red-400" : "text-emerald-400"
            )}
          >
            ${balance.toFixed(2)}
          </p>
          {customer.creditLimit !== undefined && customer.creditLimit > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-[#5a6580] mb-1">
                <span>Credit limit</span>
                <span>${customer.creditLimit.toFixed(2)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1e2a45] overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isOverLimit ? "bg-amber-500" : "bg-[#0066FF]"
                  )}
                  style={{
                    width: `${Math.min(100, (balance / customer.creditLimit) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Statement of account */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">
          Statement of Account
        </h2>
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-[#5a6580] text-sm">
            No transactions yet
          </div>
        ) : (
          <div className="space-y-2">
            {/* Show newest first */}
            {[...transactions].reverse().map((t) => {
              const dateStr = format(
                new Date(t.date),
                "MMM d, yyyy · h:mm a"
              );

              if (t.type === "charge") {
                return (
                  <div
                    key={`charge-${t.id}`}
                    className="p-4 rounded-xl bg-[#0D1326] border border-[#1e2a45]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-[#5a6580]">{dateStr}</p>
                        <p className="text-sm font-medium text-white mt-0.5">
                          Order #{t.orderNumber} · {t.tableName}
                        </p>
                        <p className="text-xs text-[#8b93a7] mt-1 truncate">
                          {t.items
                            .map(
                              (i: { quantity: number; name: string }) =>
                                `${i.quantity}x ${i.name}`
                            )
                            .join(", ")}
                        </p>
                        <p className="text-[10px] text-[#5a6580] mt-0.5">
                          Staff: {t.staffName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-red-400">
                          +${t.amount.toFixed(2)}
                        </p>
                        <span className="text-[9px] uppercase font-medium text-red-400/60 bg-red-500/10 px-1.5 py-0.5 rounded">
                          Charge
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Payment transaction
              return (
                <div
                  key={`payment-${t.id}`}
                  className="p-4 rounded-xl bg-[#0D1326] border border-emerald-500/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-[#5a6580]">{dateStr}</p>
                      <p className="text-sm font-medium text-white mt-0.5">
                        Payment ·{" "}
                        {t.method.charAt(0).toUpperCase() + t.method.slice(1)}
                      </p>
                      {t.notes && (
                        <p className="text-xs text-[#8b93a7] mt-1 italic">
                          {t.notes}
                        </p>
                      )}
                      <p className="text-[10px] text-[#5a6580] mt-0.5">
                        Staff: {t.staffName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-400">
                        -${t.amount.toFixed(2)}
                      </p>
                      <span className="text-[9px] uppercase font-medium text-emerald-400/60 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        Payment
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settle Dialog */}
      <SettleDialog
        open={settleOpen}
        onOpenChange={setSettleOpen}
        licenseKey={licenseKey}
        customerId={customerId}
        customerName={customer.name}
        balance={balance}
        staffId={staffId}
        staffName={staffName}
        onRecorded={() => void refetch()}
      />

      {/* Edit Dialog */}
      <EditDebtorDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        licenseKey={licenseKey}
        customer={{
          _id: customer._id as Id<"customers">,
          name: customer.name,
          phone: customer.phone,
          creditLimit: customer.creditLimit,
        }}
        onSaved={() => void refetch()}
      />
    </div>
  );
}

// ── Settlement Dialog ──

function SettleDialog({
  open,
  onOpenChange,
  licenseKey,
  customerId,
  customerName,
  balance,
  staffId,
  staffName,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  customerId: Id<"customers">;
  customerName: string;
  balance: number;
  staffId: string;
  staffName: string;
  onRecorded: () => void | Promise<void>;
}) {
  const settleDebt = useMutation("pos.customers.settleDebt");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "card" | "other">("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const hasOutstanding = balance > 0.009;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const full = balance > 0.009;
      setAmount(full ? balance.toFixed(2) : "");
      setMethod("cash");
      setNotes("");
    }
  }, [open, balance]);

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (hasOutstanding && parsed > balance + 0.02) {
      toast.error("Amount exceeds outstanding balance");
      return;
    }
    setSaving(true);
    try {
      const result = await settleDebt({
        licenseKey,
        customerId,
        amount: parsed,
        method,
        staffId: staffId as Id<"staff">,
        staffName,
        notes: notes.trim() || undefined,
      });
      if (result == null) {
        toast.error(
          "Could not record payment (offline or server unavailable).",
        );
        return;
      }
      await Promise.resolve(onRecorded());
      toast.success(
        `Payment of $${parsed.toFixed(2)} recorded for ${customerName}`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        errorMessageFromUnknown(err, "Failed to record payment"),
      );
    } finally {
      setSaving(false);
    }
  };

  const methodOptions = [
    {
      value: "cash" as const,
      label: "Cash",
      icon: Banknote,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/30",
    },
    {
      value: "card" as const,
      label: "Card",
      icon: CreditCard,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/30",
    },
    {
      value: "other" as const,
      label: "Other",
      icon: Wallet,
      color: "text-[#8b93a7]",
      bg: "bg-[#1e2a45]/50 border-[#1e2a45]",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131A2E] border-[#1e2a45] max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Record Payment</DialogTitle>
          <DialogDescription className="text-[#8b93a7]">
            {hasOutstanding ? (
              <>
                Outstanding:{" "}
                <span className="text-white font-bold">
                  ${balance.toFixed(2)}
                </span>{" "}
                · {customerName}
              </>
            ) : (
              <>
                No open balance for {customerName}. Enter an amount to record a
                deposit or prepayment (credits the account for future debt
                orders).
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Amount */}
          <div>
            <label className="text-xs text-[#8b93a7] mb-1 block">Amount</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-[#0A0F1E] border-[#1e2a45] text-white text-lg font-bold"
              min={0}
              step={0.01}
              autoFocus
            />
            {hasOutstanding && (
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setAmount(balance.toFixed(2))}
                  className="text-[10px] px-2 py-1 rounded bg-[#0A0F1E] border border-[#1e2a45] text-[#8b93a7] hover:text-white cursor-pointer transition-colors"
                >
                  Full (${balance.toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => setAmount((balance / 2).toFixed(2))}
                  className="text-[10px] px-2 py-1 rounded bg-[#0A0F1E] border border-[#1e2a45] text-[#8b93a7] hover:text-white cursor-pointer transition-colors"
                >
                  Half (${(balance / 2).toFixed(2)})
                </button>
              </div>
            )}
          </div>

          {/* Method */}
          <div>
            <label className="text-xs text-[#8b93a7] mb-1.5 block">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {methodOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setMethod(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer",
                      method === opt.value
                        ? opt.bg + " ring-1 ring-white/20"
                        : "border-[#1e2a45] bg-[#0A0F1E] hover:border-[#2a3a5a]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-5",
                        method === opt.value ? opt.color : "text-[#5a6580]"
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-medium",
                        method === opt.value ? "text-white" : "text-[#5a6580]"
                      )}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-[#8b93a7] mb-1 block">
              Notes (optional)
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Weekly payment"
              className="bg-[#0A0F1E] border-[#1e2a45] text-white"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[#8b93a7]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? "Recording..." : "Confirm Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Debtor Dialog ──

function EditDebtorDialog({
  open,
  onOpenChange,
  licenseKey,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  customer: {
    _id: Id<"customers">;
    name: string;
    phone?: string;
    creditLimit?: number;
  };
  onSaved: () => void | Promise<void>;
}) {
  const updateCustomer = useMutation("pos.customers.updateCustomer");
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [creditLimit, setCreditLimit] = useState(
    customer.creditLimit?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);

  // Sync when dialog opens or customer changes
  useEffect(() => {
    if (open) {
      setName(customer.name);
      setPhone(customer.phone ?? "");
      setCreditLimit(customer.creditLimit?.toString() ?? "");
    }
  }, [open, customer]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await updateCustomer({
        licenseKey,
        customerId: customer._id,
        name: name.trim(),
        phone: phone.trim() || undefined,
        creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
      });
      await Promise.resolve(onSaved());
      toast.success("Debtor updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, "Failed to update debtor"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131A2E] border-[#1e2a45] max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Debtor</DialogTitle>
          <DialogDescription className="text-[#8b93a7]">
            Update customer account details
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-[#8b93a7] mb-1 block">
              Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#0A0F1E] border-[#1e2a45] text-white"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-[#8b93a7] mb-1 block">Phone</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-[#0A0F1E] border-[#1e2a45] text-white"
            />
          </div>
          <div>
            <label className="text-xs text-[#8b93a7] mb-1 block">
              Credit Limit
            </label>
            <Input
              type="number"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="No limit"
              className="bg-[#0A0F1E] border-[#1e2a45] text-white"
              min={0}
              step={0.01}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[#8b93a7]"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
