import { cn } from "@/lib/utils.ts";
import {
  Home,
  UtensilsCrossed,
  LayoutGrid,
  Users,
  ShoppingCart,
  Settings,
  MapPinned,
  ChefHat,
  LogOut,
  PieChart,
  FileText,
  Package,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { ActiveStaff, PosView } from "../_lib/types.ts";
import {
  canAccessView,
  hasPrioritySupportChat,
  kitchenDisplayNavState,
} from "../_lib/plan-features.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import PosPrioritySupportNav from "./pos-priority-support-nav.tsx";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

type PosSidebarProps = {
  activeView: PosView;
  onViewChange: (view: PosView) => void;
  businessName: string;
  activeStaff: ActiveStaff;
  /** License plan from activation — gates which sidebar entries are shown */
  plan: string;
  onLogout: () => void;
  /** Staff permission + plan: show audit log in sidebar (accountant, etc.). */
  canViewAuditLog?: boolean;
};

type NavItem = {
  id: PosView;
  icon: typeof Home;
};

type ComingSoonItem = {
  icon: typeof Home;
  labelKey: string;
  messageKey: string;
};

function navLabelKey(id: PosView): string {
  const map: Partial<Record<PosView, string>> = {
    home: "nav.home",
    floor: "nav.floor_plan",
    dashboard: "nav.dashboard",
    menu: "nav.menu",
    stock: "nav.stock",
    tables: "nav.tables",
    staff: "nav.staff",
    "z-report": "nav.z_report",
    "kitchen-display": "nav.kitchen_display",
    "audit-log": "nav.audit_log",
  };
  return map[id] ?? "nav.home";
}

function getNavItems(
  role: ActiveStaff["role"],
  plan: string,
  canViewAuditLog: boolean,
): NavItem[] {
  let items: NavItem[];
  if (role === "admin" || role === "manager") {
    items = [
      { id: "home", icon: Home },
      { id: "floor", icon: MapPinned },
      { id: "dashboard", icon: PieChart },
      { id: "menu", icon: UtensilsCrossed },
      { id: "stock", icon: Package },
      { id: "order-history", icon: ShoppingCart },
      { id: "tables", icon: LayoutGrid },
      { id: "staff", icon: Users },
      { id: "z-report", icon: FileText },
    ];
  } else if (role === "waiter") {
    items = [
      { id: "home", icon: Home },
      { id: "floor", icon: MapPinned },
    ];
  } else if (role === "inventory") {
    items = [{ id: "stock", icon: Package }];
  } else if (role === "accountant") {
    items = [
      { id: "home", icon: Home },
      { id: "dashboard", icon: PieChart },
      { id: "z-report", icon: FileText },
    ];
    if (canViewAuditLog && canAccessView(plan, "audit-log")) {
      items.push({ id: "audit-log", icon: ShieldCheck });
    }
  } else if (role === "auditor") {
    items = [
      { id: "home", icon: Home },
      { id: "dashboard", icon: PieChart },
      { id: "z-report", icon: FileText },
    ];
    if (canViewAuditLog && canAccessView(plan, "audit-log")) {
      items.push({ id: "audit-log", icon: ShieldCheck });
    }
  } else if (role === "kitchen") {
    items =
      kitchenDisplayNavState(plan) === "live"
        ? [{ id: "kitchen-display", icon: ChefHat }]
        : [{ id: "home", icon: Home }];
  } else {
    items = [{ id: "home", icon: Home }];
  }
  return items.filter((item) => {
    if (item.id === "audit-log" && !canViewAuditLog) return false;
    return canAccessView(plan, item.id);
  });
}

function getComingSoonItems(role: ActiveStaff["role"], plan: string): ComingSoonItem[] {
  if (role === "admin" || role === "manager") {
    const out: ComingSoonItem[] = [];
    if (kitchenDisplayNavState(plan) === "coming_soon") {
      out.push({
        icon: ChefHat,
        labelKey: "nav.kitchen_display",
        messageKey: "msg.kitchen_coming_soon",
      });
    }
    out.push({
      icon: Settings,
      labelKey: "nav.settings",
      messageKey: "msg.settings_coming_soon",
    });
    return out;
  }

  if (
    role === "waiter" ||
    role === "inventory" ||
    role === "accountant" ||
    role === "auditor" ||
    role === "kitchen"
  ) {
    return [];
  }

  return [];
}

const ROLE_COLORS: Record<string, string> = {
  admin: "#0066FF",
  manager: "#8B5CF6",
  waiter: "#44CC00",
  inventory: "#F59E0B",
  accountant: "#06B6D4",
  auditor: "#EC4899",
  kitchen: "#FF6B00",
};

function roleLabelKey(role: string): string {
  const k = `staff.role_${role}` as const;
  return k;
}

export default function PosSidebar({
  activeView,
  onViewChange,
  businessName,
  activeStaff,
  plan,
  onLogout,
  canViewAuditLog = false,
}: PosSidebarProps) {
  const { t } = usePosLocale();
  const navItems = getNavItems(activeStaff.role, plan, canViewAuditLog);
  const comingSoonItems = getComingSoonItems(activeStaff.role, plan);
  const roleColor = ROLE_COLORS[activeStaff.role] ?? "#5a6580";
  const roleKey = roleLabelKey(activeStaff.role);
  const roleDisplay =
    t(roleKey) !== roleKey ? t(roleKey) : activeStaff.role;

  return (
    <div className="w-20 bg-[#0D1326] border-r border-[#1e2a45] flex flex-col items-center py-4 shrink-0">
      {/* Logo & business name */}
      <div className="mb-4 flex flex-col items-center">
        <img src={LOGO_URL} alt="Vyntex POS" className="h-10 w-10" />
        <p className="text-[10px] text-[#5a6580] mt-2 text-center truncate max-w-full px-1">
          {businessName}
        </p>
      </div>

      {/* Logged-in staff */}
      <div className="mb-6 flex flex-col items-center px-1">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: roleColor }}
        >
          {activeStaff.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <p className="text-[9px] text-white mt-1 text-center truncate max-w-full">
          {activeStaff.name.split(" ")[0]}
        </p>
        <span
          className="text-[8px] font-medium uppercase tracking-wider mt-0.5 px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: `${roleColor}20`,
            color: roleColor,
          }}
        >
          {roleDisplay}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "flex flex-col items-center gap-1 w-16 py-2.5 rounded-xl transition-all cursor-pointer",
              activeView === item.id
                ? "bg-[#0066FF]/15 text-[#0066FF]"
                : "text-[#5a6580] hover:text-[#8b93a7] hover:bg-[#1e2a45]/50",
            )}
          >
            <item.icon className="size-5" />
            <span className="text-[10px] font-medium leading-tight text-center px-0.5">
              {t(navLabelKey(item.id))}
            </span>
          </button>
        ))}

        {/* Coming-soon items */}
        {comingSoonItems.map((item) => (
          <button
            key={item.labelKey}
            className="flex flex-col items-center gap-1 w-16 py-2.5 rounded-xl text-[#3a4055] cursor-not-allowed"
            onClick={() => toast.info(t(item.messageKey))}
          >
            <item.icon className="size-5" />
            <span className="text-[10px] font-medium leading-tight text-center px-0.5">
              {t(item.labelKey)}
            </span>
          </button>
        ))}
        {hasPrioritySupportChat(plan) ? (
          <div className="mt-1">
            <PosPrioritySupportNav variant="sidebar" />
          </div>
        ) : null}
      </nav>

      {/* Logout */}
      <div className="mt-auto pt-4 border-t border-[#1e2a45]">
        <button
          onClick={onLogout}
          className="flex flex-col items-center gap-1 w-16 py-2.5 rounded-xl text-[#5a6580] hover:text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer"
        >
          <LogOut className="size-5" />
          <span className="text-[10px] font-medium leading-tight text-center px-0.5">
            {t("nav.logout")}
          </span>
        </button>
      </div>
    </div>
  );
}
