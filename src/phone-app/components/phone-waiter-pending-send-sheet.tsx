import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { Send, X } from "lucide-react";
import { toast } from "sonner";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import { formatCustomizationsForDisplay, cartLineKey } from "@/lib/menu-customizations.ts";
import type { PhoneAccessThemeTokens } from "@/lib/phone-access-theme.ts";
import {
  clearWaiterMenuSelection,
  waiterMenuSelectionQty,
  type WaiterMenuSelectionLine,
} from "@/phone-app/lib/waiter-menu-selection.ts";

type FloorTable = {
  _id: string;
  name: string;
  zone: string;
};

type Props = {
  table: FloorTable;
  lines: WaiterMenuSelectionLine[];
  licenseKey: string;
  staffId?: string;
  staffName?: string;
  tokens: PhoneAccessThemeTokens;
  accent: string;
  waiterCanPay: boolean;
  formatPrice: (n: number) => string;
  onClose: () => void;
  onSent: () => void;
};

export default function PhoneWaiterPendingSendSheet({
  table,
  lines,
  licenseKey,
  staffId,
  staffName,
  tokens,
  accent,
  waiterCanPay,
  formatPrice,
  onClose,
  onSent,
}: Props) {
  const { t } = useTranslation("site");
  const [busy, setBusy] = useState(false);
  const submitCartOrder = useMutation("pos.orders.submitCartOrder");
  const activeOrders = useQuery(
    "pos.orders.getOrdersByTable",
    licenseKey && table._id ? { licenseKey, tableId: table._id } : "skip",
  ) as Doc<"orders">[] | undefined;
  const existingOrder = (activeOrders ?? [])[0];
  const count = waiterMenuSelectionQty(lines);
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const send = async () => {
    if (busy || lines.length === 0) return;
    setBusy(true);
    try {
      const result = await submitCartOrder({
        licenseKey,
        tableId: table._id,
        staffId,
        staffName,
        existingOrderId: existingOrder?._id ?? null,
        lines: lines.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          name: line.name,
          price: line.price,
          station: line.station,
          vatRate: line.vatRate,
          notes: line.notes,
          selectedCustomizations: line.selectedCustomizations,
        })),
      });
      if (result === undefined) {
        toast.error(t("phone.waiter.order.sendFailed"));
        return;
      }
      clearWaiterMenuSelection();
      toast.success(t("phone.waiter.order.sent"));
      onSent();
    } catch {
      toast.error(t("phone.waiter.order.sendFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[70] bg-black/45"
        aria-label={t("btn.cancel")}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[80] flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] pb-[max(1rem,env(safe-area-inset-bottom))]"
        style={{ background: tokens.sheet, color: tokens.fg }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: tokens.muted }}>
              {table.zone}
            </p>
            <h2 className="truncate text-[16px] font-semibold">
              {table.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl"
            style={{ background: tokens.card, color: tokens.muted }}
            aria-label={t("btn.cancel")}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <p className="mb-2 text-[12px]" style={{ color: tokens.muted }}>
            {t("phone.waiter.menuSelectedCount", { count })}
          </p>
          <div className="divide-y" style={{ borderColor: tokens.border }}>
            {lines.map((line) => {
              const extras = formatCustomizationsForDisplay(line.selectedCustomizations);
              return (
                <div
                  key={cartLineKey(line)}
                  className="flex items-start justify-between gap-3 py-2.5"
                  style={{ borderColor: tokens.border }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">
                      {line.quantity}× {line.name}
                    </p>
                    {extras ? (
                      <p className="truncate text-[11px]" style={{ color: tokens.muted }}>
                        {extras}
                      </p>
                    ) : null}
                    {line.notes ? (
                      <p className="truncate text-[11px] italic" style={{ color: tokens.muted }}>
                        {line.notes}
                      </p>
                    ) : null}
                  </div>
                  {waiterCanPay ? (
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                      {formatPrice(line.price * line.quantity)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t px-4 pt-3" style={{ borderColor: tokens.border }}>
          {waiterCanPay ? (
            <div className="mb-3 flex items-center justify-between text-[14px]">
              <span style={{ color: tokens.muted }}>{t("phone.waiter.order.total")}</span>
              <span className="font-bold">{formatPrice(total)}</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || lines.length === 0}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white active:scale-[0.99] disabled:opacity-50",
            )}
            style={{ backgroundColor: accent }}
          >
            <Send className="size-4" />
            {busy ? t("phone.waiter.order.sending") : t("phone.waiter.order.sendToKitchen")}
          </button>
        </div>
      </div>
    </>
  );
}
