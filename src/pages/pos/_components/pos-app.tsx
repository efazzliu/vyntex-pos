import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";
import type { ActivationData } from "@/lib/local-db.ts";
import type { ActiveStaff, PosView } from "../_lib/types.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
import PosLocaleProvider from "./pos-locale-provider.tsx";
import PosSidebar from "./pos-sidebar.tsx";
import PosHomeView from "./pos-home-view.tsx";
import MenuManagement from "./menu-management.tsx";
import StaffManagement from "./staff-management.tsx";
import FloorPlan from "./floor-plan.tsx";
import OrderScreen from "./order-screen.tsx";
import PosDashboard from "./pos-dashboard.tsx";
import ZReport from "./z-report.tsx";
import StockManagement from "./stock-management.tsx";
import OrderHistory from "./order-history.tsx";
import PosSettings from "./pos-settings.tsx";
import DebtLedgerView from "./debt-ledger-view.tsx";
import AuditLogView from "./audit-log-view.tsx";
import OfflineSyncManager from "./offline-sync-manager.tsx";
import OfflineBanner from "./offline-banner.tsx";
import AdminDrawer from "./admin-drawer.tsx";
import KitchenDisplayView from "./kitchen-display-view.tsx";
import { PosViewErrorBoundary } from "./pos-view-error-boundary.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { initPrintQueueOnStartup } from "@/lib/print-queue.ts";
import { persistPosTheme } from "@/lib/supabase-pos/license-sync.ts";
import {
  POS_DEFAULT_CURRENCY_DECIMALS,
  POS_DEFAULT_CURRENCY_POSITION,
  POS_DEFAULT_CURRENCY_SYMBOL,
  POS_DEFAULT_LANGUAGE,
} from "@/lib/pos-locale-defaults.ts";
import { LogOut, Menu } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import {
  canAccessView,
  defaultAdminManagerLandingView,
  hasAdvancedAnalytics,
  hasEnterpriseSupplyMall,
  hasEnterpriseSupplyRecipe,
  kitchenDisplayNavState,
} from "../_lib/plan-features.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

type PosAppProps = {
  activation: ActivationData;
  activeStaff: ActiveStaff;
  onLogout: () => void;
};

export default function PosApp({
  activation,
  activeStaff,
  onLogout,
}: PosAppProps) {
  // Fetch locale/currency settings from the database
  const company = useQuery('pos.settings.getCompanyDetails', {
    licenseKey: activation.licenseKey,
  });

  return (
    <PosLocaleProvider
      language={(company?.language as "en" | "sq") ?? POS_DEFAULT_LANGUAGE}
      currencySymbol={company?.currencySymbol ?? POS_DEFAULT_CURRENCY_SYMBOL}
      currencyPosition={
        (company?.currencyPosition as "prefix" | "suffix") ??
        POS_DEFAULT_CURRENCY_POSITION
      }
      currencyDecimals={company?.currencyDecimals ?? POS_DEFAULT_CURRENCY_DECIMALS}
    >
      <PosAppInner
        activation={activation}
        activeStaff={activeStaff}
        onLogout={onLogout}
      />
    </PosLocaleProvider>
  );
}

function PosAppInner({
  activation,
  activeStaff,
  onLogout,
}: PosAppProps) {
  const { t } = usePosLocale();
  const { theme, setTheme } = usePosTheme();

  const handleThemeChange = useCallback(
    (next: "dark" | "light") => {
      setTheme(next);
      void persistPosTheme(activation.licenseKey, next);
    },
    [activation.licenseKey, setTheme],
  );

  // Drop stale offline print queue on open; no background OS print polling (Windows dialogs).
  useEffect(() => {
    void initPrintQueueOnStartup();
  }, []);

  // Fetch staff permissions for consumption access
  const staffList = useQuery('pos.staff.getStaff', { licenseKey: activation.licenseKey });
  const currentStaffDoc = staffList?.find((s) => s._id === activeStaff.id);
  const canLogStaffConsumption = currentStaffDoc?.permissions?.canLogStaffConsumption ?? false;
  const canTransferTables =
    activeStaff.role === "admin" ||
    activeStaff.role === "manager" ||
    (currentStaffDoc?.permissions?.canTransferTables ?? false);

  const staffPerms = currentStaffDoc?.permissions;
  const canMergeTables =
    activeStaff.role === "admin" ||
    activeStaff.role === "manager" ||
    staffPerms?.canMergeTables === true ||
    (staffPerms?.canMergeTables !== false &&
      Boolean(staffPerms?.canTransferTables));
  const canSplitBillsQuick =
    activeStaff.role === "admin" ||
    activeStaff.role === "manager" ||
    staffPerms?.canSplitBills === true;

  const canChargeDebtQuick =
    canAccessView(activation.plan, "debt-ledger") &&
    (activeStaff.role === "admin" ||
      activeStaff.role === "manager" ||
      currentStaffDoc?.permissions?.canChargeDebt === true);

  const canMarkComplimentaryQuick =
    canAccessView(activation.plan, "debt-ledger") &&
    (activeStaff.role === "admin" ||
      activeStaff.role === "manager" ||
      currentStaffDoc?.permissions?.canMarkComplimentary === true);

  const canViewAuditLog =
    activeStaff.role === "admin" ||
    activeStaff.role === "manager" ||
    activeStaff.role === "auditor" ||
    currentStaffDoc?.permissions?.canViewAuditLog === true;

  const defaultView: PosView = useMemo(() => {
    if (activeStaff.role === "waiter") return "floor";
    if (activeStaff.role === "admin" || activeStaff.role === "manager") {
      return defaultAdminManagerLandingView(activation.plan);
    }
    if (activeStaff.role === "inventory") {
      return canAccessView(activation.plan, "stock") ? "stock" : "home";
    }
    if (activeStaff.role === "accountant" || activeStaff.role === "auditor") {
      if (canAccessView(activation.plan, "dashboard")) return "dashboard";
      if (canAccessView(activation.plan, "z-report")) return "z-report";
      return "home";
    }
    if (activeStaff.role === "kitchen") {
      return kitchenDisplayNavState(activation.plan) === "live" ? "kitchen-display" : "home";
    }
    return "home";
  }, [activeStaff.role, activation.plan]);

  const [activeView, setActiveView] = useState<PosView>(defaultView);
  const [selectedTableId, setSelectedTableId] = useState<Id<"tables"> | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      if (drawerOpen) {
        setDrawerOpen(false);
        e.preventDefault();
        return;
      }

      const ae = document.activeElement;
      if (
        ae instanceof HTMLInputElement ||
        ae instanceof HTMLTextAreaElement ||
        ae instanceof HTMLSelectElement
      ) {
        return;
      }
      if (ae instanceof HTMLElement && ae.isContentEditable) return;

      if (
        document.querySelector('[data-state="open"][data-slot="dialog-content"]') ||
        document.querySelector('[data-state="open"][data-slot="sheet-content"]') ||
        document.querySelector('[data-state="open"][data-slot="select-content"]') ||
        document.querySelector('[data-state="open"][data-slot="dropdown-menu-content"]') ||
        document.querySelector('[data-state="open"][data-slot="dropdown-menu-sub-content"]') ||
        document.querySelector('[data-state="open"][data-slot="popover-content"]') ||
        document.querySelector('[data-state="open"][role="alertdialog"]')
      ) {
        return;
      }

      e.preventDefault();
      onLogout();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [drawerOpen, onLogout]);

  const setActiveViewForRole = useCallback(
    (view: PosView) => {
      if (activeStaff.role === "inventory") {
        if (view === "stock" && canAccessView(activation.plan, "stock")) {
          setActiveView("stock");
        }
        return;
      }
      if (view === "kitchen-display" && kitchenDisplayNavState(activation.plan) !== "live") {
        toast.info(t("msg.kitchen_coming_soon"));
        return;
      }
      if (!canAccessView(activation.plan, view)) return;
      if (view === "audit-log" && !canViewAuditLog) return;
      setActiveView(view);
    },
    [activeStaff.role, activation.plan, canViewAuditLog, t],
  );

  useEffect(() => {
    if (activeStaff.role !== "inventory") return;
    if (!canAccessView(activation.plan, "stock")) return;
    if (activeView !== "stock") setActiveView("stock");
  }, [activeStaff.role, activation.plan, activeView]);

  useEffect(() => {
    if (activeStaff.role !== "kitchen") return;
    if (kitchenDisplayNavState(activation.plan) !== "live") {
      if (activeView === "kitchen-display") setActiveView("home");
      return;
    }
    if (activeView !== "kitchen-display") setActiveView("kitchen-display");
  }, [activeStaff.role, activation.plan, activeView]);

  /** Keep admin/manager on an allowed view if plan or navigation left them on a locked screen. */
  useEffect(() => {
    if (activeStaff.role !== "admin" && activeStaff.role !== "manager") return;
    if (activeView === "order" && selectedTableId) return;
    if (activeView === "order" && !selectedTableId) {
      setActiveView("floor");
      return;
    }
    if (
      activeView === "audit-log" &&
      (!canViewAuditLog || !canAccessView(activation.plan, "audit-log"))
    ) {
      setActiveView(defaultAdminManagerLandingView(activation.plan));
      return;
    }
    if (activeView === "kitchen-display" && kitchenDisplayNavState(activation.plan) !== "live") {
      setActiveView(defaultAdminManagerLandingView(activation.plan));
      return;
    }
    if (!canAccessView(activation.plan, activeView)) {
      setActiveView(defaultAdminManagerLandingView(activation.plan));
    }
  }, [
    activeStaff.role,
    activation.plan,
    activeView,
    selectedTableId,
    canViewAuditLog,
  ]);

  /** Accountant / auditor / other sidebar roles: drop back to home if the current view is not on their plan. */
  useEffect(() => {
    const r = activeStaff.role;
    if (r === "admin" || r === "manager" || r === "waiter" || r === "inventory") return;
    if (
      activeView === "audit-log" &&
      (!canViewAuditLog || !canAccessView(activation.plan, "audit-log"))
    ) {
      setActiveView("home");
      return;
    }
    if (canAccessView(activation.plan, activeView)) return;
    setActiveView("home");
  }, [activeStaff.role, activation.plan, activeView, canViewAuditLog]);

  useEffect(() => {
    if (
      activeView !== "floor" &&
      activeView !== "order" &&
      activeView !== "tables"
    ) {
      setDrawerOpen(false);
    }
  }, [activeView]);

  const setActiveViewFromPlan = useCallback(
    (view: PosView) => {
      if (view === "kitchen-display" && kitchenDisplayNavState(activation.plan) !== "live") {
        toast.info(t("msg.kitchen_coming_soon"));
        return;
      }
      if (!canAccessView(activation.plan, view)) return;
      if (view === "audit-log" && !canViewAuditLog) return;
      setActiveView(view);
    },
    [activation.plan, canViewAuditLog, t],
  );

  const handleTableSelect = (tableId: Id<"tables">) => {
    setSelectedTableId(tableId);
    setActiveView("order");
  };

  const handleBackFromOrder = () => {
    setSelectedTableId(null);
    setActiveView("floor");
  };

  // ── Waiter: full-screen floor plan ──────────────────────
  if (activeStaff.role === "waiter") {
    if (activeView === "order" && selectedTableId) {
      return (
        <OfflineSyncManager>
          <div className="h-screen bg-[#0A0F1E] overflow-hidden" data-pos-theme={theme}>
            <OfflineBanner />
            <OrderScreen
              licenseKey={activation.licenseKey}
              plan={activation.plan}
              tableId={selectedTableId}
              staffId={activeStaff.id}
              staffName={activeStaff.name}
              staffRole={activeStaff.role}
              canTransferTables={canTransferTables}
              canMergeTables={canMergeTables}
              canSplitBillsQuick={canSplitBillsQuick}
              canChargeDebtQuick={canChargeDebtQuick}
              canMarkComplimentaryQuick={canMarkComplimentaryQuick}
              onOrderMovedToTable={setSelectedTableId}
              onBack={handleBackFromOrder}
              onLogout={onLogout}
            />
          </div>
        </OfflineSyncManager>
      );
    }

    return (
      <OfflineSyncManager>
        <div className="h-screen bg-[#0A0F1E] overflow-hidden" data-pos-theme={theme}>
          <OfflineBanner />
          <FloorPlan
            licenseKey={activation.licenseKey}
            isEditor={false}
            onTableSelect={handleTableSelect}
            waiter={{
              name: activeStaff.name,
              businessName: activation.businessName,
              staffId: activeStaff.id,
              licenseKey: activation.licenseKey,
              onLogout,
              canLogStaffConsumption,
              role: "waiter",
            }}
          />
        </div>
      </OfflineSyncManager>
    );
  }

  // ── Admin & Manager: pinned nav, hidden only on table workspace ───────
  if (activeStaff.role === "admin" || activeStaff.role === "manager") {
    const isFloorOrOrder =
      activeView === "floor" || activeView === "order";
    const isTableWorkspace =
      activeView === "floor" ||
      activeView === "order" ||
      activeView === "tables";

    // Helper: only render a gated view if the plan allows it (and staff permission for audit log)
    const gated = (view: PosView, node: ReactNode) =>
      activeView === view &&
      canAccessView(activation.plan, view) &&
      (view !== "audit-log" || canViewAuditLog) &&
      (view !== "kitchen-display" || kitchenDisplayNavState(activation.plan) === "live")
        ? node
        : null;

    const adminDrawer = (
      <AdminDrawer
        pinned={!isTableWorkspace}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        activeView={activeView}
        onViewChange={setActiveViewFromPlan}
        businessName={activation.businessName}
        staffName={activeStaff.name}
        staffRole={activeStaff.role}
        plan={activation.plan}
        onLogout={onLogout}
        theme={theme}
        canViewAuditLog={canViewAuditLog}
      />
    );

    return (
      <OfflineSyncManager>
        <div className="h-screen bg-[#0A0F1E] overflow-hidden flex flex-col" data-pos-theme={theme}>
          <OfflineBanner />

          <div className="flex min-h-0 flex-1">
            {!isTableWorkspace ? adminDrawer : null}

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {activeView === "tables" ? (
                <AdminTopBar
                  businessName={activation.businessName}
                  staffName={activeStaff.name}
                  staffRole={activeStaff.role}
                  onLogoClick={() => setDrawerOpen(true)}
                  onLogout={onLogout}
                />
              ) : null}

              <div className={cn("flex-1 min-h-0", isFloorOrOrder || activeView === "tables" ? "overflow-hidden" : "overflow-auto")}>
            <PosViewErrorBoundary key={activeView}>
            {/* Floor — same as waiter, logo opens drawer */}
            {activeView === "floor" && (
              <FloorPlan
                licenseKey={activation.licenseKey}
                isEditor={false}
                onTableSelect={handleTableSelect}
                waiter={{
                  name: activeStaff.name,
                  businessName: activation.businessName,
                  staffId: activeStaff.id,
                  licenseKey: activation.licenseKey,
                  onLogout,
                  onLogoClick: () => setDrawerOpen(true),
                  role: activeStaff.role === "admin" ? "admin" : "manager",
                  canLogStaffConsumption: true,
                }}
              />
            )}

            {/* Order — has its own header */}
            {activeView === "order" && selectedTableId && (
              <OrderScreen
                licenseKey={activation.licenseKey}
                plan={activation.plan}
                tableId={selectedTableId}
                staffId={activeStaff.id}
                staffName={activeStaff.name}
                staffRole={activeStaff.role}
                canTransferTables={canTransferTables}
                canMergeTables={canMergeTables}
                canSplitBillsQuick={canSplitBillsQuick}
                canChargeDebtQuick={canChargeDebtQuick}
                canMarkComplimentaryQuick={canMarkComplimentaryQuick}
                onOrderMovedToTable={setSelectedTableId}
                onBack={handleBackFromOrder}
                onLogout={onLogout}
              />
            )}

            {/* Dashboard */}
            {gated("dashboard", (
              <div className="h-full overflow-auto">
                <PosDashboard
                  licenseKey={activation.licenseKey}
                  staffId={activeStaff.id}
                  staffName={activeStaff.name}
                  staffRole={activeStaff.role}
                  showAdvancedAnalytics={hasAdvancedAnalytics(activation.plan)}
                  onOpenSalesDetail={
                    canAccessView(activation.plan, "order-history")
                      ? () => setActiveViewFromPlan("order-history")
                      : undefined
                  }
                />
              </div>
            ))}

            {/* Kitchen display (KDS) */}
            {gated("kitchen-display", (
              <div className="h-full overflow-auto">
                <KitchenDisplayView licenseKey={activation.licenseKey} />
              </div>
            ))}

            {/* Menu management */}
            {gated("menu", (
              <div className="h-full overflow-auto">
                <MenuManagement
                  licenseKey={activation.licenseKey}
                  stockActorName={activeStaff.name}
                  enterpriseSupplyMall={hasEnterpriseSupplyMall(activation.plan)}
                  enterpriseSupplyRecipe={hasEnterpriseSupplyRecipe(activation.plan)}
                  staffRole={activeStaff.role}
                />
              </div>
            ))}

            {/* Floor Plan editor (Tables) */}
            {gated("tables", (
              <div className="h-full overflow-hidden">
                <FloorPlan
                  licenseKey={activation.licenseKey}
                  isEditor={true}
                />
              </div>
            ))}

            {/* Staff */}
            {gated("staff", (
              <div className="h-full overflow-auto">
                <StaffManagement licenseKey={activation.licenseKey} plan={activation.plan} />
              </div>
            ))}

            {/* Stock / Inventory */}
            {gated("stock", (
              <div className="h-full overflow-auto">
                <StockManagement
                  licenseKey={activation.licenseKey}
                  staffName={activeStaff.name}
                  enterpriseSupplyMall={hasEnterpriseSupplyMall(activation.plan)}
                />
              </div>
            ))}

            {/* Order History */}
            {gated("order-history", (
              <div className="h-full overflow-auto">
                <OrderHistory
                  licenseKey={activation.licenseKey}
                  staffId={activeStaff.id}
                  staffName={activeStaff.name}
                  staffRole={activeStaff.role}
                />
              </div>
            ))}

            {/* Z-Report / Reports */}
            {gated("z-report", (
              <div className="h-full overflow-auto">
                <ZReport
                  licenseKey={activation.licenseKey}
                  staffId={activeStaff.id}
                  staffName={activeStaff.name}
                />
              </div>
            ))}

            {/* Debt Ledger */}
            {gated("debt-ledger", (
              <div className="h-full overflow-auto">
                <DebtLedgerView
                  licenseKey={activation.licenseKey}
                  staffId={activeStaff.id}
                  staffName={activeStaff.name}
                />
              </div>
            ))}

            {/* Audit Log */}
            {gated("audit-log", (
              <div className="h-full overflow-auto">
                <AuditLogView licenseKey={activation.licenseKey} />
              </div>
            ))}

            {/* Settings */}
            {gated("settings", (
              <div className="h-full overflow-auto">
                <PosSettings
                  licenseKey={activation.licenseKey}
                  plan={activation.plan}
                  theme={theme}
                  onThemeChange={handleThemeChange}
                  onNavigate={setActiveViewFromPlan}
                  staffRole={activeStaff.role}
                />
              </div>
            ))}
            </PosViewErrorBoundary>
              </div>
            </div>
          </div>

          {isTableWorkspace ? adminDrawer : null}
        </div>
      </OfflineSyncManager>
    );
  }

  // ── Kitchen / Inventory / Accountant / Auditor: sidebar layout ───────────────
  return (
    <OfflineSyncManager>
      <div className="flex h-screen bg-[#0A0F1E] overflow-hidden" data-pos-theme={theme}>
        <OfflineBanner />
        <PosSidebar
          activeView={activeView}
          onViewChange={setActiveViewForRole}
          businessName={activation.businessName}
          activeStaff={activeStaff}
          plan={activation.plan}
          onLogout={onLogout}
          canViewAuditLog={canViewAuditLog}
        />
        <main className="flex-1 overflow-auto">
          <PosViewErrorBoundary key={activeView}>
          {activeView === "stock" && canAccessView(activation.plan, "stock") && (
            <div className="h-full overflow-auto">
              <StockManagement
                licenseKey={activation.licenseKey}
                staffName={activeStaff.name}
                enterpriseSupplyMall={hasEnterpriseSupplyMall(activation.plan)}
              />
            </div>
          )}
          {activeStaff.role !== "inventory" && activeView === "home" && (
            <PosHomeView
              activation={activation}
              plan={activation.plan}
              onNavigate={setActiveViewForRole}
              staffRole={activeStaff.role}
            />
          )}
          {activeView === "kitchen-display" &&
            kitchenDisplayNavState(activation.plan) === "live" && (
              <KitchenDisplayView licenseKey={activation.licenseKey} />
            )}
          {activeView === "dashboard" &&
            canAccessView(activation.plan, "dashboard") && (
              <div className="h-full overflow-auto">
                <PosDashboard
                  licenseKey={activation.licenseKey}
                  staffId={activeStaff.id}
                  staffName={activeStaff.name}
                  staffRole={activeStaff.role}
                  showAdvancedAnalytics={hasAdvancedAnalytics(activation.plan)}
                  onOpenSalesDetail={
                    canAccessView(activation.plan, "order-history")
                      ? () => setActiveViewForRole("order-history")
                      : undefined
                  }
                />
              </div>
            )}
          {activeView === "z-report" &&
            canAccessView(activation.plan, "z-report") && (
              <div className="h-full overflow-auto">
                <ZReport
                  licenseKey={activation.licenseKey}
                  staffId={activeStaff.id}
                  staffName={activeStaff.name}
                />
              </div>
            )}
          {activeView === "audit-log" &&
            canViewAuditLog &&
            canAccessView(activation.plan, "audit-log") && (
              <div className="h-full overflow-auto">
                <AuditLogView licenseKey={activation.licenseKey} />
              </div>
            )}
          </PosViewErrorBoundary>
        </main>
      </div>
    </OfflineSyncManager>
  );
}

// ── Admin top bar (shown for non-floor views) ─────────────

function AdminTopBar({
  businessName,
  staffName,
  staffRole,
  onLogoClick,
  onLogout,
}: {
  businessName: string;
  staffName: string;
  staffRole: string;
  onLogoClick: () => void;
  onLogout: () => void;
}) {
  const { t } = usePosLocale();
  const roleKey = `staff.role_${staffRole}`;
  const roleLabel = t(roleKey);
  const roleText = roleLabel === roleKey ? staffRole : roleLabel;
  const showName = staffName.trim().toLowerCase() !== roleText.trim().toLowerCase();

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[#1e2a45] bg-[#0A0F1E] px-4">
      <button
        type="button"
        onClick={onLogoClick}
        className="flex shrink-0 items-center gap-2 rounded-md py-1 pr-1.5 -ml-1 hover:bg-[#1e2a45] transition-colors cursor-pointer"
        aria-label={t("nav.menu")}
      >
        <img src={VYNTEX_APP_LOGO_SRC} alt="" className="h-7 w-7" />
        <Menu className="size-4 text-[#8b93a7]" />
      </button>
      <div className="h-5 w-px shrink-0 bg-[#1e2a45]" />
      <div className="min-w-0 flex items-center gap-2">
        <p className="truncate text-[13px] font-semibold tracking-tight text-white">
          {businessName}
        </p>
        <span className="shrink-0 rounded-md bg-[#0066FF]/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0066FF]">
          {roleText}
        </span>
      </div>
      <div className="flex-1" />
      {showName ? (
        <p className="hidden sm:block max-w-[10rem] truncate text-[12px] text-[#8b93a7]">
          {staffName}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onLogout}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#8b93a7] hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
      >
        <LogOut className="size-3.5" />
        <span className="hidden sm:inline">{t("nav.logout")}</span>
      </button>
    </header>
  );
}
