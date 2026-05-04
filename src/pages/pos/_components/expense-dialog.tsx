import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Wallet, Receipt } from "lucide-react";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";

type ExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  staffId: Id<"staff">;
  staffName: string;
};

export default function ExpenseDialog({
  open,
  onOpenChange,
  licenseKey,
  staffId,
  staffName,
}: ExpenseDialogProps) {
  const { formatPrice, t } = usePosLocale();
  const { theme: posTheme } = usePosTheme();
  const addExpense = useMutation("pos.expenses.addExpense");
  const todayData = useQuery("pos.expenses.getTodayExpenses", {
    licenseKey,
    staffId,
  });

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error(t("expense_invalid_amount") || "Enter a valid amount");
      return;
    }
    if (!note.trim()) {
      toast.error(t("expense_invalid_note") || "Enter a description");
      return;
    }

    setSaving(true);
    try {
      await addExpense({
        licenseKey,
        staffId,
        staffName,
        amount: numAmount,
        note: note.trim(),
      });
      toast.success(t("expense_saved") || "Expense saved");
      setAmount("");
      setNote("");
    } catch (err) {
      const fallback = t("expense_error") || "Failed to save expense";
      toast.error(errorMessageFromUnknown(err, fallback));
      console.error("[POS] addExpense", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-pos-theme={posTheme}
        side="right"
        className="flex h-full w-full flex-col gap-0 border-[#1e2a45] bg-[#131A2E] p-0 text-white sm:max-w-md [&>button]:text-[#8b93a7]"
      >
        <SheetHeader className="space-y-1 border-b border-[#1e2a45] p-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-white">
            <Wallet className="size-5 text-emerald-400" />
            {t("daily_expenses") || "Shift expenses"}
          </SheetTitle>
          <SheetDescription className="text-xs text-[#8b93a7]">
            {t("expense_shift_hint") ||
              "Costs you pay for the business during your shift. They clear when a manager closes your shift and appear on the printed shift report."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {(() => {
            const td = todayData as
              | {
                  entries?: Array<{
                    _id: string;
                    amount: number;
                    note: string;
                  }>;
                  expenses?: Array<{
                    _id: string;
                    amount: number;
                    note: string;
                  }>;
                  total?: number;
                }
              | undefined;
            const shiftEntries = td?.entries ?? td?.expenses ?? [];
            const shiftTotal = td?.total ?? 0;
            return td && shiftEntries.length > 0 ? (
              <div className="space-y-2 pr-1">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  {t("expense_shift_total") || "This shift"} &mdash;{" "}
                  {formatPrice(shiftTotal)}
                </p>
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {shiftEntries.map((exp) => (
                    <div
                      key={exp._id}
                      className="flex items-center gap-2 rounded-lg border border-[#1e2a45]/50 bg-[#0A0F1E] px-2 py-1.5 text-sm"
                    >
                      <Receipt className="size-3.5 shrink-0 text-slate-500" />
                      <span className="flex-1 truncate text-slate-300">
                        {exp.note}
                      </span>
                      <span className="shrink-0 font-medium text-amber-400">
                        {formatPrice(exp.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">
                {t("amount") || "Amount"}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-[#1e2a45] bg-[#0A0F1E] text-white placeholder:text-slate-600"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">
                {t("note") || "Note / Description"}
              </Label>
              <Input
                placeholder={
                  t("expense_placeholder") ||
                  "e.g. Buy something for bar, Food, Ice Tea..."
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="border-[#1e2a45] bg-[#0A0F1E] text-white placeholder:text-slate-600"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !saving) {
                    void handleSubmit();
                  }
                }}
              />
            </div>
          </div>
        </div>

        <SheetFooter className="border-t border-[#1e2a45] p-4 sm:flex-col">
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-amber-500 font-semibold text-black hover:bg-amber-600"
          >
            {saving
              ? t("saving") || "Saving..."
              : t("save_expense") || "Save expense"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
