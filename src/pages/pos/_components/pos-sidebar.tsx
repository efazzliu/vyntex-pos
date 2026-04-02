import { cn } from "@/lib/utils.ts";
import {
  Home,
  UtensilsCrossed,
  LayoutGrid,
  Users,
  ShoppingCart,
  Settings,
  BarChart3,
  MapPinned,
  ChefHat,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import type { ActiveStaff, PosView } from "../_lib/types.ts";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

type PosSidebarProps = {
  activeView: PosView;
  onViewChange: (view: PosView) => void;
  businessName: string;
  activeStaff: ActiveStaff;
  onLogout: () => void;
};

type NavItem = {
  id: PosView;
  icon: typeof Home;
  label: string;
};

type ComingSoonItem = {
  icon: typeof Home;
  label: string;
  message: string;
};

function getNavItems(role: ActiveStaff["role"]): NavItem[] {
  if (role === "admin") {
    return [
      { id: "home", icon: Home, label: "Home" },
      { id: "floor", icon: MapPinned, label: "Floor" },
      { id: "menu", icon: UtensilsCrossed, label: "Menu" },
      { id: "tables", icon: LayoutGrid, label: "Tables" },
      { id: "staff", icon: Users, label: "Staff" },
    ];
  }

  if (role === "waiter") {
    return [
      { id: "home", icon: Home, label: "Home" },
      { id: "floor", icon: MapPinned, label: "Floor" },
    ];
  }

  // kitchen
  return [{ id: "home", icon: Home, label: "Home" }];
}

function getComingSoonItems(role: ActiveStaff["role"]): ComingSoonItem[] {
  if (role === "admin") {
    return [
      {
        icon: ShoppingCart,
        label: "Orders",
        message: "Orders & checkout coming soon!",
      },
      {
        icon: BarChart3,
        label: "Reports",
        message: "Reports & analytics coming soon!",
      },
      {
        icon: Settings,
        label: "Settings",
        message: "Settings coming soon!",
      },
    ];
  }

  if (role === "waiter") {
    return [
      {
        icon: ShoppingCart,
        label: "Orders",
        message: "Orders & checkout coming soon!",
      },
    ];
  }

  // kitchen
  return [
    {
      icon: ChefHat,
      label: "Kitchen",
      message: "Kitchen display coming soon!",
    },
  ];
}

const ROLE_COLORS = {
  admin: "#0066FF",
  waiter: "#44CC00",
  kitchen: "#FF6B00",
} as const;

export default function PosSidebar({
  activeView,
  onViewChange,
  businessName,
  activeStaff,
  onLogout,
}: PosSidebarProps) {
  const navItems = getNavItems(activeStaff.role);
  const comingSoonItems = getComingSoonItems(activeStaff.role);
  const roleColor = ROLE_COLORS[activeStaff.role];

  return (
    <div className="w-20 bg-[#0D1326] border-r border-[#1e2a45] flex flex-col items-center py-4 shrink-0">
      {/* Logo & business name */}
      <div className="mb-4 flex flex-col items-center">
        <img src={LOGO_URL} alt="VYNTEX" className="h-10 w-10" />
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
          {activeStaff.role}
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
                : "text-[#5a6580] hover:text-[#8b93a7] hover:bg-[#1e2a45]/50"
            )}
          >
            <item.icon className="size-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}

        {/* Coming-soon items */}
        {comingSoonItems.map((item) => (
          <button
            key={item.label}
            className="flex flex-col items-center gap-1 w-16 py-2.5 rounded-xl text-[#3a4055] cursor-not-allowed"
            onClick={() => toast.info(item.message)}
          >
            <item.icon className="size-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="mt-auto pt-4 border-t border-[#1e2a45]">
        <button
          onClick={onLogout}
          className="flex flex-col items-center gap-1 w-16 py-2.5 rounded-xl text-[#5a6580] hover:text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer"
        >
          <LogOut className="size-5" />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
