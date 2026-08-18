import type { ReactNode } from "react";
import { useCallback } from "react";
import {
  useQuery as useTanQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  posQueryKey,
  runPosQuery,
  runPosMutation,
} from "@/lib/supabase-pos/pos-router.ts";
import { queryClient } from "@/components/providers/query-client.tsx";
import { enqueueMutation } from "@/lib/local-db.ts";
import posI18n from "@/pages/pos/_lib/pos-i18n.ts";
import { toast } from "sonner";

/** Mutations that cannot be replayed offline (need live URL or immediate network). */
const OFFLINE_POS_MUTATION_DENYLIST = new Set<string>(["pos.menu.generateUploadUrl"]);

export function ConvexProvider({ children }: { client?: unknown; children: ReactNode }) {
  return <>{children}</>;
}

export function ConvexProviderWithAuth({
  children,
}: {
  client?: unknown;
  useAuth?: unknown;
  children: ReactNode;
}) {
  return <>{children}</>;
}

export function ConvexProviderWithHerculesAuth({
  children,
}: {
  client?: unknown;
  children: ReactNode;
}) {
  return <>{children}</>;
}

export function Authenticated({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function Unauthenticated(_: { children: ReactNode }) {
  return null;
}

export function AuthLoading(_: { children: ReactNode }) {
  return null;
}

export function useConvexAuth() {
  return { isLoading: false, isAuthenticated: true };
}

const POS_MENU_STALE_MS = 120_000;
const POS_STAFF_STALE_MS = 60_000;
const POS_TABLES_STALE_MS = 20_000;

function posQueryStaleTime(queryId: string): number {
  if (queryId.startsWith("pos.menu.")) return POS_MENU_STALE_MS;
  if (queryId === "pos.staff.getStaff") return POS_STAFF_STALE_MS;
  if (queryId === "pos.tables.getTables") return POS_TABLES_STALE_MS;
  return 0;
}

/** Drop cached POS reads after license activation / deactivation so another venue's data cannot linger. */
export function invalidateAllPosQueries(): void {
  void queryClient.removeQueries({
    predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "pos",
  });
}

/**
 * Calendar date in the device timezone (YYYY-MM-DD). Used in TanStack query keys so
 * "today" dashboards refetch after midnight instead of showing yesterday's cache.
 */
function localCalendarDayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function invalidatePosPrefix(qc: QueryClient, prefix: string) {
  void qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey;
      return (
        Array.isArray(k) &&
        k[0] === "pos" &&
        typeof k[1] === "string" &&
        k[1].startsWith(prefix)
      );
    },
  });
}

function invalidatePosAuditLogs(qc: QueryClient) {
  void qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey;
      return (
        Array.isArray(k) &&
        k[0] === "pos" &&
        k[1] === "pos.dashboard.getAuditLogs"
      );
    },
  });
}

/** Avoid refetching the entire floor plan after every line item — only when the table list can change. */
function invalidateAfterOrderMutation(
  qc: QueryClient,
  mutationId: string,
  args: Record<string, unknown>,
  licenseKey: string,
) {
  const tableId = args.tableId as string | undefined;
  const orderId = args.orderId as string | undefined;

  if (tableId) {
    void qc.invalidateQueries({
      queryKey: posQueryKey("pos.orders.getOrdersByTable", { licenseKey, tableId }),
    });
  } else {
    invalidatePosPrefix(qc, "pos.orders.getOrdersByTable");
  }

  if (orderId) {
    void qc.invalidateQueries({
      queryKey: posQueryKey("pos.orders.getOrderWithItems", { licenseKey, orderId }),
    });
  } else if (
    mutationId === "pos.orders.voidItem" ||
    mutationId === "pos.orders.addItemsToOrderBulk" ||
    mutationId === "pos.orders.sendOrder" ||
    mutationId === "pos.orders.submitCartOrder"
  ) {
    invalidatePosPrefix(qc, "pos.orders.getOrderWithItems");
  }

  void qc.invalidateQueries({
    queryKey: posQueryKey("pos.tables.getTableOrderSummaries", { licenseKey }),
  });

  if (
    mutationId === "pos.orders.sendOrder" ||
    mutationId === "pos.orders.submitCartOrder" ||
    mutationId === "pos.orders.payOrder" ||
    mutationId === "pos.orders.voidItem" ||
    mutationId === "pos.orders.fiscalizeOrderBulk" ||
    mutationId === "pos.orders.logBulkFiscalization" ||
    mutationId === "pos.orders.transferOrdersToTable" ||
    mutationId === "pos.orders.mergeTableOrders" ||
    mutationId === "pos.orders.bumpKitchenTicketItem" ||
    mutationId === "pos.orders.markWaiterLineDelivered"
  ) {
    invalidatePosAuditLogs(qc);
  }

  if (
    mutationId === "pos.orders.sendOrder" ||
    mutationId === "pos.orders.submitCartOrder" ||
    mutationId === "pos.orders.payOrder" ||
    mutationId === "pos.orders.bumpKitchenTicketItem" ||
    mutationId === "pos.orders.markWaiterLineDelivered"
  ) {
    void qc.invalidateQueries({
      queryKey: posQueryKey("pos.orders.getKitchenQueue", { licenseKey }),
    });
    invalidatePosPrefix(qc, "pos.orders.getWaiterKitchenNotifications");
  }

  if (
    mutationId === "pos.orders.createOrder" ||
    mutationId === "pos.orders.submitCartOrder" ||
    mutationId === "pos.orders.payOrder" ||
    mutationId === "pos.orders.printBill"
  ) {
    void qc.invalidateQueries({
      queryKey: posQueryKey("pos.tables.getTables", { licenseKey }),
    });
  }

  if (
    mutationId === "pos.orders.transferOrdersToTable" ||
    mutationId === "pos.orders.mergeTableOrders"
  ) {
    const fromTableId = args.fromTableId as string | undefined;
    const toTableId = args.toTableId as string | undefined;
    if (fromTableId) {
      void qc.invalidateQueries({
        queryKey: posQueryKey("pos.orders.getOrdersByTable", {
          licenseKey,
          tableId: fromTableId,
        }),
      });
    }
    if (toTableId) {
      void qc.invalidateQueries({
        queryKey: posQueryKey("pos.orders.getOrdersByTable", {
          licenseKey,
          tableId: toTableId,
        }),
      });
    }
    void qc.invalidateQueries({
      queryKey: posQueryKey("pos.tables.getTables", { licenseKey }),
    });
  }

  invalidatePosPrefix(qc, "pos.orders.getClosedOrders");
  invalidatePosPrefix(qc, "pos.orders.getNonFiscalOrders");
}

/** Instant UI: same shape as `getOrderWithItems` / `getOrdersByTable` cache entries. */
function patchTanStackCacheAfterSubmitCartOrder(
  qc: QueryClient,
  licenseKey: string,
  tableId: string,
  orderWithItems: Record<string, unknown>,
) {
  const orderId = String(orderWithItems._id ?? "");
  if (!orderId) return;

  qc.setQueryData(
    posQueryKey("pos.orders.getOrderWithItems", { licenseKey, orderId }),
    orderWithItems,
  );

  const { items: _i, tableName: _t, staffName: _s, ...orderDoc } =
    orderWithItems as Record<string, unknown> & {
      items?: unknown;
      tableName?: unknown;
      staffName?: unknown;
    };

  const key = posQueryKey("pos.orders.getOrdersByTable", {
    licenseKey,
    tableId,
  });
  const prev = qc.getQueryData(key) as unknown[] | undefined;
  const next = (() => {
    if (!prev || prev.length === 0) return [orderDoc];
    const idx = prev.findIndex(
      (o) => String((o as { _id?: string })._id) === orderId,
    );
    if (idx < 0) return [...prev, orderDoc];
    const copy = [...prev];
    copy[idx] = orderDoc;
    return copy;
  })();
  qc.setQueryData(key, next);
}

function invalidatePosQueriesAfterMutation(
  qc: QueryClient,
  mutationId: string,
  args: Record<string, unknown>,
) {
  const licenseKey = args.licenseKey as string | undefined;
  if (!licenseKey) return;

  const parts = mutationId.split(".");
  const ns = parts.length >= 2 ? parts[1] : "";

  if (ns === "orders") {
    invalidateAfterOrderMutation(qc, mutationId, args, licenseKey);
    return;
  }

  if (ns === "tables") {
    void qc.invalidateQueries({
      queryKey: posQueryKey("pos.tables.getTables", { licenseKey }),
    });
    void qc.invalidateQueries({
      queryKey: posQueryKey("pos.tables.getTableOrderSummaries", { licenseKey }),
    });
    return;
  }

  if (ns === "menu") {
    invalidatePosPrefix(qc, "pos.menu.");
    return;
  }

  if (ns === "staff") {
    invalidatePosPrefix(qc, "pos.staff.");
    if (mutationId === "pos.staff.closeStaffShift" || mutationId === "pos.staff.clockIn") {
      invalidatePosPrefix(qc, "pos.dashboard.getZReport");
      invalidatePosPrefix(qc, "pos.dashboard.getZReportHistory");
    }
    if (mutationId === "pos.staff.closeStaffShift") {
      invalidatePosPrefix(qc, "pos.tables.");
      invalidatePosPrefix(qc, "pos.orders.");
      invalidatePosPrefix(qc, "pos.menu.");
      invalidatePosPrefix(qc, "pos.stock.");
    }
    return;
  }

  if (ns === "settings") {
    invalidatePosPrefix(qc, "pos.settings.");
    return;
  }

  if (ns === "customers") {
    invalidatePosPrefix(qc, "pos.customers.");
    if (mutationId === "pos.customers.settleDebt") {
      invalidatePosAuditLogs(qc);
    }
    return;
  }

  if (ns === "expenses") {
    invalidatePosPrefix(qc, "pos.expenses.");
    if (
      mutationId === "pos.expenses.addExpense" ||
      mutationId === "pos.expenses.clearAllExpenses"
    ) {
      invalidatePosAuditLogs(qc);
    }
    return;
  }

  if (ns === "templates") {
    invalidatePosPrefix(qc, "pos.templates.");
    return;
  }

  if (ns === "stock") {
    invalidatePosPrefix(qc, "pos.stock.");
    invalidatePosPrefix(qc, "pos.menu.");
    return;
  }

  if (ns === "staffConsumption") {
    invalidatePosPrefix(qc, "pos.staffConsumption.");
    if (mutationId === "pos.staffConsumption.addConsumption") {
      invalidatePosAuditLogs(qc);
      invalidatePosPrefix(qc, "pos.menu.");
      invalidatePosPrefix(qc, "pos.stock.");
    }
    return;
  }

  if (ns === "dashboard") {
    invalidatePosPrefix(qc, "pos.dashboard.");
    return;
  }
}

/**
 * POS: `useQuery('pos.staff.getStaff', { licenseKey })` — backed by Supabase + TanStack Query.
 * Non-POS: pass a non-string ref → undefined (admin/dashboard still need Convex or separate work).
 */
export function useQuery(
  ref: unknown,
  args?: unknown,
): unknown {
  const id = typeof ref === "string" ? ref : null;
  const enabled = id !== null && args !== "skip";
  const norm: Record<string, unknown> =
    args === "skip" || args === undefined || typeof args !== "object" || args === null
      ? {}
      : { ...(args as Record<string, unknown>) };

  if (id === "pos.dashboard.getDashboardStats") {
    norm._localDay = localCalendarDayKey();
  }
  if (id === "pos.dashboard.getZReport") {
    const hasExplicitDate =
      typeof norm.date === "string" && String(norm.date).trim() !== "";
    if (!hasExplicitDate) {
      norm._localDay = localCalendarDayKey();
    }
  }

  const refetchSummaries = id === "pos.tables.getTableOrderSummaries";
  const refetchTables = id === "pos.tables.getTables";
  const refetchMenuItems = id === "pos.menu.getAllItems";
  const refetchCompanyDetails = id === "pos.settings.getCompanyDetails";
  const refetchKitchenQueue =
    id === "pos.orders.getKitchenQueue" ||
    id === "pos.orders.getWaiterKitchenNotifications";
  const refetchDailyDashboard =
    id === "pos.dashboard.getDashboardStats" ||
    (id === "pos.dashboard.getZReport" &&
      !(typeof norm.date === "string" && String(norm.date).trim() !== ""));
  const refetchAuditLog = id === "pos.dashboard.getAuditLogs";

  const { data } = useTanQuery({
    queryKey: id ? posQueryKey(id, norm) : ["pos", "noop"],
    queryFn: () => runPosQuery(id!, norm),
    enabled,
    staleTime: id ? posQueryStaleTime(id) : 0,
    refetchOnWindowFocus: false,
    /** Desktop / Electron often reports offline while Supabase still works; don't pause POS reads. */
    networkMode: "always",
    refetchInterval: refetchSummaries || refetchTables
      ? 3500
      : refetchMenuItems || refetchCompanyDetails
        ? 8000
        : refetchKitchenQueue
        ? 4000
        : refetchDailyDashboard
          ? 120_000
          : refetchAuditLog
            ? 12_000
            : false,
  });

  return data;
}

export function useMutation(ref: unknown) {
  const qc = useQueryClient();
  const id = typeof ref === "string" ? ref : null;

  return useCallback(
    async (mutationArgs: Record<string, unknown>) => {
      if (!id) return null;

      if (!navigator.onLine && id.startsWith("pos.")) {
        if (OFFLINE_POS_MUTATION_DENYLIST.has(id)) {
          const msg = posI18n.t("common.need_online_for_upload");
          toast.error(msg);
          throw new Error(msg);
        }
        await enqueueMutation(id, mutationArgs);
        toast.info(posI18n.t("common.offline_action_queued"), { duration: 2500 });
        return null;
      }

      const out = await runPosMutation(id, mutationArgs);

      if (id === "pos.orders.submitCartOrder" && out && typeof out === "object") {
        const snap = (out as { orderSnapshot?: unknown }).orderSnapshot;
        const lk = mutationArgs.licenseKey as string | undefined;
        const tid = mutationArgs.tableId as string | undefined;
        if (
          snap &&
          typeof snap === "object" &&
          lk &&
          tid
        ) {
          patchTanStackCacheAfterSubmitCartOrder(
            qc,
            lk,
            tid,
            snap as Record<string, unknown>,
          );
        }
      }

      /** Defer cache invalidation so the UI can unlock (e.g. stop spinner) before refetch work. */
      queueMicrotask(() => {
        invalidatePosQueriesAfterMutation(qc, id, mutationArgs);

        if (
          id === "pos.orders.payOrder" ||
          id === "pos.orders.voidItem" ||
          id === "pos.orders.fiscalizeOrderBulk" ||
          id === "pos.expenses.addExpense" ||
          id === "pos.expenses.clearAllExpenses" ||
          id === "pos.staffConsumption.clearAllConsumption" ||
          id === "pos.settings.syncDeviceClosePinHash" ||
          id === "pos.dashboard.closeDay" ||
          id === "pos.staff.closeStaffShift" ||
          id === "pos.stock.addStock" ||
          id === "pos.stock.removeStock" ||
          id === "pos.stock.setStock"
        ) {
          void qc.invalidateQueries({
            queryKey: ["pos", "pos.dashboard.getDashboardStats"],
            exact: false,
          });
        }
      });

      return out ?? null;
    },
    [id, qc],
  );
}
