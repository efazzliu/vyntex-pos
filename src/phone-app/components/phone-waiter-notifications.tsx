import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { getWaiterSession } from "@/phone-app/lib/waiter-session.ts";

type KitchenLine = {
  lineId: string;
  saleId: string;
  orderNumber: number;
  tableId?: string;
  tableName: string;
  name: string;
  quantity: number;
  station?: "kitchen" | "bar";
  status: string;
};

type TableGroup = {
  tableId?: string;
  tableName: string;
  lines: KitchenLine[];
  readyCount: number;
  cookingCount: number;
};

function isReadyStatus(status: string): boolean {
  return String(status).toLowerCase() === "ready";
}

/** Notifications list is kitchen-only (exclude bar). Missing station → kitchen. */
function isKitchenStation(station: KitchenLine["station"]): boolean {
  return station !== "bar";
}

function groupByTable(lines: KitchenLine[]): TableGroup[] {
  const map = new Map<string, KitchenLine[]>();
  for (const line of lines) {
    if (!isKitchenStation(line.station)) continue;
    const key = line.tableId?.trim() || line.tableName.trim() || "—";
    const list = map.get(key) ?? [];
    list.push(line);
    map.set(key, list);
  }

  const groups: TableGroup[] = [...map.entries()].map(([key, groupLines]) => {
    const sorted = [...groupLines].sort((a, b) => {
      const aReady = isReadyStatus(a.status) ? 0 : 1;
      const bReady = isReadyStatus(b.status) ? 0 : 1;
      if (aReady !== bReady) return aReady - bReady;
      return a.orderNumber - b.orderNumber || a.name.localeCompare(b.name);
    });
    const tableName = sorted[0]?.tableName?.trim() || key;
    const tableId = sorted.find((l) => l.tableId)?.tableId;
    return {
      tableId,
      tableName,
      lines: sorted,
      readyCount: sorted.filter((l) => isReadyStatus(l.status)).length,
      cookingCount: sorted.filter((l) => !isReadyStatus(l.status)).length,
    };
  });

  groups.sort((a, b) => {
    if (a.readyCount > 0 && b.readyCount === 0) return -1;
    if (b.readyCount > 0 && a.readyCount === 0) return 1;
    return a.tableName.localeCompare(b.tableName, undefined, { numeric: true });
  });
  return groups;
}

export default function PhoneWaiterNotifications() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const session = getWaiterSession();
  const licenseKey = session?.licenseKey ?? "";
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  const queue = useQuery(
    "pos.orders.getWaiterKitchenNotifications",
    licenseKey ? { licenseKey } : "skip",
  ) as KitchenLine[] | undefined;

  const lines = queue ?? [];
  const groups = useMemo(() => groupByTable(lines), [lines]);
  const readyCount = useMemo(
    () =>
      lines.filter(
        (l) => isKitchenStation(l.station) && isReadyStatus(l.status),
      ).length,
    [lines],
  );

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openTableOrder = (tableId: string | undefined) => {
    const id = tableId?.trim();
    if (!id) {
      toast.error(t("phone.waiter.notifOpenOrderMissing"));
      return;
    }
    navigate(`/waiter/table/${id}`, {
      state: { from: "/waiter/notifications", openOrderSheet: true },
    });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#070b14] pb-[5.75rem] text-white">
      <header className="px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          {t("phone.waiter.floorEyebrow")}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          {t("phone.waiter.navNotifications")}
        </h1>
        {readyCount > 0 ? (
          <p className="mt-1 text-[13px] text-emerald-400/90">
            {t("phone.waiter.notifReadyCount", { count: readyCount })}
          </p>
        ) : null}
      </header>

      <main className="flex-1 overflow-y-auto px-5">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Bell className="size-8 text-white/25" />
            <p className="text-sm text-white/45">{t("phone.waiter.notifEmpty")}</p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {groups.map((group) => {
              const key = group.tableId || group.tableName;
              const expanded = expandedKeys.has(key);
              return (
                <section
                  key={key}
                  className={cn(
                    "overflow-hidden rounded-2xl border",
                    group.readyCount > 0
                      ? "border-emerald-400/35 bg-emerald-500/[0.06]"
                      : "border-white/10 bg-white/[0.03]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(key)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3.5 py-3.5 text-left transition active:bg-white/[0.04]",
                      expanded && "border-b border-white/10",
                    )}
                  >
                    <h2 className="text-[15px] font-semibold tracking-tight">
                      {t("phone.waiter.notifTableHeading", {
                        table: group.tableName,
                      })}
                    </h2>
                    <span className="flex items-center gap-1.5">
                      {group.readyCount > 0 ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                          {t("phone.waiter.notifReadyBadge", {
                            count: group.readyCount,
                          })}
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium uppercase tracking-wide text-amber-300/90">
                          {t("phone.waiter.notifKitchen")}
                        </span>
                      )}
                      {expanded ? (
                        <ChevronDown className="size-4 text-white/45" />
                      ) : (
                        <ChevronRight className="size-4 text-white/35" />
                      )}
                    </span>
                  </button>

                  {expanded ? (
                    <ul className="divide-y divide-white/8">
                      {group.lines.map((line) => {
                        const ready = isReadyStatus(line.status);
                        return (
                          <li key={line.lineId}>
                            <button
                              type="button"
                              onClick={() =>
                                openTableOrder(line.tableId || group.tableId)
                              }
                              className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition active:bg-white/[0.04]"
                            >
                              {ready ? (
                                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                              ) : (
                                <ChefHat className="mt-0.5 size-4 shrink-0 text-amber-300/80" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-medium">
                                  {line.quantity}× {line.name}
                                </p>
                                <p className="mt-0.5 text-[11px] text-white/40">
                                  #{line.orderNumber}
                                </p>
                                <p
                                  className={cn(
                                    "mt-0.5 text-[12px] font-medium",
                                    ready
                                      ? "text-emerald-300"
                                      : "text-amber-300/90",
                                  )}
                                >
                                  {ready
                                    ? t("phone.waiter.notifReady")
                                    : t("phone.waiter.notifKitchen")}
                                </p>
                              </div>
                              <ChevronRight className="mt-1 size-4 shrink-0 text-white/25" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
