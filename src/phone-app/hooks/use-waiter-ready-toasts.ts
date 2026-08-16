import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type KitchenLine = {
  lineId: string;
  tableName: string;
  name: string;
  quantity: number;
  status: string;
  station?: "kitchen" | "bar";
};

/** Toast when kitchen marks a line ready — runs while waiter shell is open. */
export function useWaiterReadyToasts(licenseKey: string) {
  const { t } = useTranslation("site");
  const seenReadyIds = useRef<Set<string> | null>(null);
  const primed = useRef(false);

  const queue = useQuery(
    "pos.orders.getWaiterKitchenNotifications",
    licenseKey ? { licenseKey } : "skip",
  ) as KitchenLine[] | undefined;

  useEffect(() => {
    if (!queue) return;
    const readyLines = queue.filter(
      (l) =>
        l.station !== "bar" && String(l.status).toLowerCase() === "ready",
    );
    const readyIds = readyLines.map((l) => l.lineId);
    if (!primed.current) {
      seenReadyIds.current = new Set(readyIds);
      primed.current = true;
      return;
    }
    const seen = seenReadyIds.current ?? new Set<string>();
    const fresh = readyLines.filter((l) => !seen.has(l.lineId));
    for (const line of fresh) {
      toast.success(t("phone.waiter.notifReadyToastTitle"), {
        description: t("phone.waiter.notifReadyToastBody", {
          table: line.tableName,
          item: `${line.quantity}× ${line.name}`,
        }),
        duration: 6_000,
      });
    }
    seenReadyIds.current = new Set(readyIds);
  }, [queue, t]);
}
