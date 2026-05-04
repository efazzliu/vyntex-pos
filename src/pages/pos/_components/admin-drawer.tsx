import { cn } from "@/lib/utils.ts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet.tsx";
import {
  BarChart3,
  Map,
  UtensilsCrossed,
  Package,
  BookOpen,
  Users,
  ShieldCheck,
  FileText,
  Settings,
  LogOut,
  ClipboardList,
  ChefHat,
} from "lucide-react";
import { toast } from "sonner";
import type { PosView } from "../_lib/types.ts";
import {
  canAccessView,
  getRequiredPlan,
  hasPrioritySupportChat,
  kitchenDisplayNavState,
  planLabel,
} from "../_lib/plan-features.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import PosPrioritySupportNav from "./pos-priority-support-nav.tsx";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

type AdminDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeView: PosView;
  onViewChange: (view: PosView) => void;
  businessName: string;
  staffName: string;
  staffRole: string;
  plan: string;
  onLogout: () => void;
  /** Radix Sheet portals to `body`, so light styles must be explicit (not only `data-pos-theme` on POS root). */
  theme: "dark" | "light";
  /** Staff permission: hide audit log from this menu when false. */
  canViewAuditLog?: boolean;
};

type NavItem = {
  id: PosView;
  icon: typeof BarChart3;
  labelKey: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", icon: BarChart3, labelKey: "nav.dashboard" },
  { id: "kitchen-display", icon: ChefHat, labelKey: "nav.kitchen_display" },
  { id: "tables", icon: Map, labelKey: "nav.floor_plan" },
  { id: "menu", icon: UtensilsCrossed, labelKey: "nav.menu" },
  { id: "stock", icon: Package, labelKey: "nav.stock" },
  { id: "order-history", icon: ClipboardList, labelKey: "nav.order_history" },
  { id: "debt-ledger", icon: BookOpen, labelKey: "nav.debt_ledger" },
  { id: "staff", icon: Users, labelKey: "nav.staff" },
  { id: "audit-log", icon: ShieldCheck, labelKey: "nav.audit_log" },
  { id: "z-report", icon: FileText, labelKey: "nav.shift_closing" },
  { id: "settings", icon: Settings, labelKey: "nav.settings" },
];

export default function AdminDrawer({
  open,
  onOpenChange,
  activeView,
  onViewChange,
  businessName,
  staffName,
  staffRole,
  plan,
  onLogout,
  theme,
  canViewAuditLog = true,
}: AdminDrawerProps) {
  const { t } = usePosLocale();
  const light = theme === "light";

  const handleNav = (view: PosView) => {
    if (view === "kitchen-display" && kitchenDisplayNavState(plan) !== "live") {
      toast.info(t("msg.kitchen_coming_soon"));
      return;
    }
    if (view === "audit-log" && !canViewAuditLog) return;
    if (!canAccessView(plan, view)) {
      const required = getRequiredPlan(view);
      toast.error(
        t("msg.plan_required", { plan: planLabel(required ?? "professional") }),
      );
      return;
    }
    onViewChange(view);
    onOpenChange(false);
  };

  const handleLogoClick = () => {
    onViewChange("floor");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        data-pos-theme={theme}
        className={cn(
          "w-72 p-0",
          light
            ? "border-slate-200 bg-white [&>button:last-of-type]:text-slate-500 [&>button:last-of-type]:hover:text-slate-800"
            : "border-[#1e2a45] bg-[#0D1326] [&>button:last-of-type]:text-[#8b93a7]",
        )}
      >
        {/* Header */}
        <SheetHeader
          className={cn(
            "p-5 pb-4 border-b",
            light ? "border-slate-200" : "border-[#1e2a45]",
          )}
        >
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img src={LOGO_URL} alt="Vyntex POS" className="h-10 w-10 shrink-0" />
            <div className="min-w-0 text-left">
              <SheetTitle
                className={cn("text-base truncate", light ? "text-slate-900" : "text-white")}
              >
                {businessName}
              </SheetTitle>
              <SheetDescription className="text-[#0066FF] text-xs font-medium">
                {staffName} &middot;{" "}
                {staffRole === "manager"
                  ? t("staff.role_manager")
                  : t("staff.role_admin")}
              </SheetDescription>
            </div>
          </button>
        </SheetHeader>

        {/* Navigation items */}
        <nav className="flex-1 overflow-auto p-3 space-y-1">
          {NAV_ITEMS.filter(
            (item) =>
              (item.id !== "audit-log" || canViewAuditLog) &&
              (item.id !== "kitchen-display" || kitchenDisplayNavState(plan) !== "hidden") &&
              (item.id === "kitchen-display" || canAccessView(plan, item.id)),
          ).map((item) => {
            const kds = item.id === "kitchen-display" ? kitchenDisplayNavState(plan) : "live";
            if (item.id === "kitchen-display" && kds === "coming_soon") {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toast.info(t("msg.kitchen_coming_soon"))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors",
                    light
                      ? "cursor-default text-slate-400 hover:bg-slate-50"
                      : "cursor-default text-[#5a6580] hover:bg-[#1e2a45]/40",
                  )}
                >
                  <item.icon className="size-5 shrink-0 opacity-60" />
                  <span className="min-w-0 flex-1 text-left">{t(item.labelKey)}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      light ? "bg-slate-200/80 text-slate-600" : "bg-[#1e2a45] text-[#8b93a7]",
                    )}
                  >
                    {t("nav.coming_soon_badge")}
                  </span>
                </button>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer",
                  activeView === item.id
                      ? "bg-[#0066FF]/15 text-[#0066FF]"
                      : light
                        ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        : "text-[#8b93a7] hover:bg-[#1e2a45]/60 hover:text-white",
                )}
              >
                <item.icon className="size-5" />
                <span className="flex-1 text-left">{t(item.labelKey)}</span>
              </button>
            );
          })}
          {hasPrioritySupportChat(plan) ? (
            <div className="pt-1">
              <PosPrioritySupportNav variant="drawer" theme={theme} />
            </div>
          ) : null}
        </nav>

        {/* Logout */}
        <div
          className={cn(
            "p-3 border-t",
            light ? "border-slate-200" : "border-[#1e2a45]",
          )}
        >
          <button
            onClick={() => {
              onOpenChange(false);
              onLogout();
            }}
            className={cn(
              "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer",
              light
                ? "text-amber-600 hover:bg-amber-500/10"
                : "text-amber-400 hover:bg-amber-500/10",
            )}
          >
            <LogOut className="size-5" />
            {t("nav.logout")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
