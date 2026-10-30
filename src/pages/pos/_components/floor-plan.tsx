import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import {
  Plus,
  MapPinned,
  Pencil,
  Trash2,
  LogOut,
  DoorOpen,
  UtensilsCrossed,
  Menu,
  Wallet,
} from "lucide-react";
import type { TableStatus, TableShape } from "../_lib/types.ts";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { useOfflineData } from "@/hooks/use-offline-data.ts";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { uuidOrNull, staffIdsEqual } from "@/lib/supabase-pos/uuid.ts";
import { posQueryKey } from "@/lib/supabase-pos/pos-router.ts";
import { posTablesIndexedDbKey } from "@/lib/supabase-pos/cache-keys.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { floorCanvasBox, tableFootprint, tableScaleXY } from "@/lib/pos-floor-layout.ts";
import FloorPlanEditor from "./floor-plan-editor.tsx";
import ExpenseDialog from "./expense-dialog.tsx";
import StaffConsumptionDialog from "./staff-consumption-dialog.tsx";
import DailyCirculationDialog from "./daily-circulation-dialog.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

type TableOrderSummary = {
  staffId: string;
  staffName: string;
  total: number;
};

type WaiterInfo = {
  name: string;
  businessName: string;
  staffId?: string;
  licenseKey?: string;
  onLogout: () => void;
  onLogoClick?: () => void;
  role?: "admin" | "manager" | "waiter" | "cashier";
  canLogStaffConsumption?: boolean;
};

type FloorPlanProps = {
  licenseKey: string;
  isEditor: boolean;
  onTableSelect?: (tableId: Id<"tables">) => void;
  waiter?: WaiterInfo;
};

export default function FloorPlan({ licenseKey, isEditor, onTableSelect, waiter }: FloorPlanProps) {
  const isWaiterFullScreen = !!waiter;

  if (isEditor) {
    return <FloorPlanEditor licenseKey={licenseKey} />;
  }

  return (
    <WaiterFloorView
      licenseKey={licenseKey}
      onTableSelect={onTableSelect}
      waiter={waiter}
      isWaiterFullScreen={isWaiterFullScreen}
    />
  );
}


// ═══════════════════════════════════════════════════════
// ── Waiter Floor View ─────────────────────────────────
// ═══════════════════════════════════════════════════════

function WaiterFloorView({
  licenseKey,
  onTableSelect,
  waiter,
  isWaiterFullScreen,
}: {
  licenseKey: string;
  onTableSelect?: (tableId: Id<"tables">) => void;
  waiter?: WaiterInfo;
  isWaiterFullScreen: boolean;
}) {
  const { t, formatPrice } = usePosLocale();
  const isOnline = useOnlineStatus();
  const tablesQuery = useQuery('pos.tables.getTables', { licenseKey });
  const { data: tables } = useOfflineData<Doc<"tables">[]>(
    posTablesIndexedDbKey(licenseKey),
    tablesQuery,
    isOnline,
  );
  // Do not cache summaries in IndexedDB — an empty `{}` was sticking and kept all tables "Free"
  // while `getOrdersByTable` still saw open orders.
  const orderSummaries = useQuery("pos.tables.getTableOrderSummaries", {
    licenseKey,
  }) as Record<string, TableOrderSummary> | undefined;

  const [activeZone, setActiveZone] = useState<string | null>(null);

  const resolvedTables = tables ?? [];
  const isLoading = false;
  const zones = [...new Set(resolvedTables.map((t) => t.zone))].sort();

  useEffect(() => {
    if (isWaiterFullScreen && zones.length > 0 && activeZone === null) {
      setActiveZone(zones[0]);
    }
  }, [isWaiterFullScreen, zones, activeZone]);

  const displayTables = resolvedTables
    ? isWaiterFullScreen && activeZone
      ? resolvedTables.filter((t) => t.zone === activeZone)
      : resolvedTables
    : [];

  const zoneBox = floorCanvasBox(displayTables);

  const currentStaffId = waiter?.staffId;
  const isAdminOrManager = waiter?.role === "admin" || waiter?.role === "manager";

  // Color config based on ownership
  const getTableColors = (table: Doc<"tables">) => {
    const status = table.status as TableStatus;
    const summary = orderSummaries?.[table._id];
    const hasOpenTicket = Boolean(summary);

    if (status === "bill-printed") {
      return {
        bg: "bg-brand-active/60",
        border: "border-brand",
        text: "text-brand-soft",
      };
    }

    if (
      hasOpenTicket ||
      status === "occupied"
    ) {
      if (summary && currentStaffId && staffIdsEqual(summary.staffId, currentStaffId)) {
        // My table — blue
        return {
          bg: "bg-brand-active/60",
          border: "border-brand",
          text: "text-brand-soft",
        };
      }
      if (summary && !uuidOrNull(summary.staffId)) {
        // Order exists but no waiter on file (e.g. device admin) — any staff can open
        return {
          bg: "bg-amber-950/40",
          border: "border-amber-500/80",
          text: "text-amber-400",
        };
      }
      if (isAdminOrManager) {
        // Admin/manager can access any table — amber
        return {
          bg: "bg-amber-950/40",
          border: "border-amber-500/80",
          text: "text-amber-400",
        };
      }
      // Other waiter's table — red (blocked)
      return {
        bg: "bg-red-950/60",
        border: "border-red-500",
        text: "text-red-500",
      };
    }

    if (status === "reserved") {
      return {
        bg: "bg-amber-950/40",
        border: "border-amber-500/80",
        text: "text-amber-400",
      };
    }

    // Available — green (visible on dark floor)
    return {
      bg: "bg-emerald-500/15",
      border: "border-emerald-400",
      text: "text-emerald-400",
    };
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64 bg-[#131A2E]" />
        <Skeleton className="h-[500px] rounded-xl bg-[#131A2E]" />
      </div>
    );
  }

  if (resolvedTables.length === 0 && isWaiterFullScreen) {
    return (
      <div className="h-full flex flex-col">
        {waiter && <WaiterTopBar waiter={waiter} />}
        <div className="flex-1 flex items-center justify-center p-3">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><MapPinned /></EmptyMedia>
              <EmptyTitle>{t("floor.empty_waiter_title")}</EmptyTitle>
              <EmptyDescription>{t("floor.empty_waiter_desc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {isWaiterFullScreen && waiter ? <WaiterTopBar waiter={waiter} /> : null}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          isWaiterFullScreen ? "gap-3 p-3" : "gap-4 p-6 lg:p-8",
        )}
      >
      {isWaiterFullScreen && waiter && zones.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {zones.map((zone) => {
                    const count = resolvedTables.filter((t) => t.zone === zone)
                      .length;
                const isActive = activeZone === zone;
                return (
                  <button
                    key={zone}
                    onClick={() => setActiveZone(zone)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer",
                      isActive
                        ? "bg-brand text-white"
                        : "bg-[#131A2E] text-[#8b93a7] hover:bg-[#1e2a45] hover:text-white border border-[#1e2a45]",
                    )}
                  >
                    {zone}
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center", isActive ? "bg-white/20" : "bg-[#1e2a45]")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-[#1e2a45] bg-[#0D1326]">
        <div
          className="relative select-none"
          style={{ width: zoneBox.width, height: zoneBox.height }}
        >
            {displayTables.map((table) => {
              const colors = getTableColors(table);
              const tableShape = table.shape ?? "square";
              const { x: scaleX, y: scaleY } = tableScaleXY(table);
              const { w: tableWidth, h: tableHeight } = tableFootprint(
                tableShape,
                scaleX,
                scaleY,
              );
              const tablePosX = (table.posX ?? 100) - zoneBox.minX;
              const tablePosY = (table.posY ?? 100) - zoneBox.minY;
              const summary = orderSummaries?.[table._id];
              const billRequested = table.status === "bill-printed";
              const isBusyByStatus =
                table.status === "occupied" || billRequested;
              const hasAssignedWaiter = Boolean(uuidOrNull(summary?.staffId));
              const isMyTable =
                Boolean(summary) &&
                Boolean(currentStaffId) &&
                hasAssignedWaiter &&
                staffIdsEqual(summary!.staffId, currentStaffId);
              const isOtherWaiterTable =
                Boolean(summary) &&
                hasAssignedWaiter &&
                Boolean(uuidOrNull(currentStaffId)) &&
                !staffIdsEqual(summary!.staffId, currentStaffId);
              const isBlockedTable = isOtherWaiterTable && !isAdminOrManager;

              const handleClick = () => {
                if (isBlockedTable) {
                  toast.error(
                    t("floor.table_taken_by", {
                      name:
                        summary?.staffName ?? t("floor.another_waiter"),
                    }),
                  );
                  return;
                }
                onTableSelect?.(table._id);
              };

              const showMine = isMyTable;
              const showOtherWaiter =
                Boolean(summary) && hasAssignedWaiter && !isMyTable;
              const showOpenUnassigned =
                Boolean(summary) && !hasAssignedWaiter;

              return (
                <div
                  key={table._id}
                  className={cn(
                    "absolute flex flex-col items-center justify-center border-2 transition-shadow px-1.5 py-2",
                    colors.bg,
                    colors.border,
                    tableShape === "circle" ? "rounded-full" : "rounded-xl",
                    isBlockedTable ? "cursor-not-allowed" : "cursor-pointer",
                  )}
                  style={{
                    left: tablePosX,
                    top: tablePosY,
                    width: tableWidth,
                    height: tableHeight,
                  }}
                  onClick={handleClick}
                >
                  <div className="flex flex-col items-center justify-center text-center w-full min-h-0 gap-0.5">
                    <span className="text-sm font-bold text-white leading-tight tracking-tight truncate max-w-full">
                      {table.name}
                    </span>
                    {summary ? (
                      <>
                        <span
                          className={cn(
                            "text-xs font-semibold tabular-nums",
                            showMine && "text-brand-soft",
                            showOtherWaiter &&
                              (isAdminOrManager
                                ? "text-amber-400"
                                : "text-red-500"),
                            showOpenUnassigned && "text-amber-400",
                          )}
                        >
                          {formatPrice(summary.total)}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-medium truncate max-w-full px-0.5",
                            billRequested ? colors.text : "text-white",
                          )}
                        >
                          {billRequested
                            ? t("floor.pending_payment")
                            : showMine
                              ? t("floor.mine")
                              : showOtherWaiter
                                ? summary.staffName
                                : t("floor.open_status")}
                        </span>
                      </>
                    ) : isBusyByStatus ? (
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          billRequested ? colors.text : "text-red-400",
                        )}
                      >
                        {billRequested
                          ? t("floor.pending_payment")
                          : t("floor.in_use_short")}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          colors.text,
                        )}
                      >
                        {(table.status as TableStatus) === "reserved"
                          ? t("floor.reserved")
                          : t("floor.available")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
      </div>
    </div>
  );
}

// ── Waiter top bar ────────────────────────────────────

function WaiterTopBar({ waiter }: { waiter: WaiterInfo }) {
  const { t } = usePosLocale();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const [circulationOpen, setCirculationOpen] = useState(false);
  const isAdmin = waiter.role === "admin" || waiter.role === "manager";
  const showConsumption = isAdmin || !!waiter.canLogStaffConsumption;
  const roleKey = waiter.role ? `staff.role_${waiter.role}` : "";
  const roleLabel = roleKey ? t(roleKey) : "";
  const roleText = roleLabel && roleLabel !== roleKey ? roleLabel : waiter.role;
  const showName =
    !roleText || waiter.name.trim().toLowerCase() !== String(roleText).trim().toLowerCase();

  const logoButton = (
    <button
      type="button"
      onClick={waiter.onLogoClick}
      className="flex shrink-0 items-center gap-2 rounded-md py-1 pr-1.5 -ml-1 hover:bg-[#1e2a45] transition-colors cursor-pointer"
      aria-label={t("nav.menu")}
    >
      <img src={VYNTEX_APP_LOGO_SRC} alt="" className="h-7 w-7" />
      {waiter.onLogoClick ? <Menu className="size-4 text-[#8b93a7]" /> : null}
    </button>
  );

  const logoStatic = (
    <img src={VYNTEX_APP_LOGO_SRC} alt="" className="h-7 w-7 shrink-0" />
  );

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[#1e2a45] bg-[#0A0F1E] px-4">
        {waiter.onLogoClick ? logoButton : logoStatic}
        <div className="h-5 w-px shrink-0 bg-[#1e2a45]" />
        <div className="min-w-0 flex items-center gap-2">
          <p className="truncate text-[13px] font-semibold tracking-tight text-white">
            {waiter.businessName}
          </p>
          {roleText ? (
            <span className="shrink-0 rounded-md bg-brand/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
              {roleText}
            </span>
          ) : null}
        </div>
        <div className="flex-1" />
        {showName ? (
          <p className="hidden sm:block max-w-[10rem] truncate text-[12px] text-[#8b93a7]">
            {waiter.name}
          </p>
        ) : null}
        {isAdmin && waiter.licenseKey && (
          <button
            type="button"
            onClick={() => setCirculationOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#8b93a7] transition-colors hover:bg-[#1e2a45] hover:text-white cursor-pointer"
          >
            <Wallet className="size-3.5" />
            <span className="hidden md:inline">
              {t("floor.toolbar_daily_circulation")}
            </span>
          </button>
        )}
        {showConsumption && waiter.staffId && waiter.licenseKey && (
          <button
            type="button"
            onClick={() => setConsumptionOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#8b93a7] hover:bg-[#1e2a45] hover:text-white transition-colors cursor-pointer"
          >
            <UtensilsCrossed className="size-3.5" />
            <span className="hidden md:inline">{t("floor.toolbar_staff_meal")}</span>
          </button>
        )}
        {waiter.staffId && waiter.licenseKey && waiter.role !== "admin" && waiter.role !== "manager" && (
          <button
            type="button"
            onClick={() => setExpenseOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#8b93a7] hover:bg-[#1e2a45] hover:text-white transition-colors cursor-pointer"
          >
            <Wallet className="size-3.5" />
            <span className="hidden md:inline">{t("floor.toolbar_expenses")}</span>
          </button>
        )}
        <button
          type="button"
          onClick={waiter.onLogout}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#8b93a7] hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">{t("nav.logout")}</span>
        </button>
      </header>

      {waiter.staffId && waiter.licenseKey && waiter.role !== "admin" && waiter.role !== "manager" && (
        <ExpenseDialog
          open={expenseOpen}
          onOpenChange={setExpenseOpen}
          licenseKey={waiter.licenseKey}
          staffId={waiter.staffId as Id<"staff">}
          staffName={waiter.name}
        />
      )}

      {showConsumption && waiter.staffId && waiter.licenseKey && (
        <StaffConsumptionDialog
          open={consumptionOpen}
          onOpenChange={setConsumptionOpen}
          licenseKey={waiter.licenseKey}
          loggedByStaffId={waiter.staffId as Id<"staff">}
          loggedByStaffName={waiter.name}
          targetStaffId={
            isAdmin ? undefined : (waiter.staffId as Id<"staff">)
          }
          targetStaffName={isAdmin ? undefined : waiter.name}
          selfServiceStaffMeal={!isAdmin}
        />
      )}

      {isAdmin && waiter.licenseKey && (
        <DailyCirculationDialog
          open={circulationOpen}
          onOpenChange={setCirculationOpen}
          licenseKey={waiter.licenseKey}
        />
      )}
    </>
  );
}
