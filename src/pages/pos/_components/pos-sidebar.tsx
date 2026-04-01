import { cn } from "@/lib/utils.ts";
import {
  Home,
  UtensilsCrossed,
  LayoutGrid,
  ShoppingCart,
  Settings,
  LogOut,
} from "lucide-react";
import { clearActivation } from "@/lib/local-db.ts";
import { toast } from "sonner";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

type PosView = "home" | "menu" | "tables";

type PosSidebarProps = {
  activeView: PosView;
  onViewChange: (view: PosView) => void;
  businessName: string;
};

const NAV_ITEMS = [
  { id: "home" as const, icon: Home, label: "Home" },
  { id: "menu" as const, icon: UtensilsCrossed, label: "Menu" },
  { id: "tables" as const, icon: LayoutGrid, label: "Tables" },
];

export default function PosSidebar({
  activeView,
  onViewChange,
  businessName,
}: PosSidebarProps) {
  const handleDeactivate = async () => {
    await clearActivation();
    toast.success("Device deactivated. Reloading...");
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="w-20 bg-[#0D1326] border-r border-[#1e2a45] flex flex-col items-center py-4 shrink-0">
      {/* Logo & business name */}
      <div className="mb-8 flex flex-col items-center">
        <img src={LOGO_URL} alt="VYNTEX" className="h-10 w-10" />
        <p className="text-[10px] text-[#5a6580] mt-2 text-center truncate max-w-full px-1">
          {businessName}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {NAV_ITEMS.map((item) => (
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
        <button
          className="flex flex-col items-center gap-1 w-16 py-2.5 rounded-xl text-[#3a4055] cursor-not-allowed"
          onClick={() =>
            toast.info("Orders & checkout coming soon in a future milestone!")
          }
        >
          <ShoppingCart className="size-5" />
          <span className="text-[10px] font-medium">Orders</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 w-16 py-2.5 rounded-xl text-[#3a4055] cursor-not-allowed"
          onClick={() =>
            toast.info("Settings coming soon in a future milestone!")
          }
        >
          <Settings className="size-5" />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </nav>

      {/* Exit */}
      <div className="mt-auto pt-4 border-t border-[#1e2a45]">
        <button
          onClick={handleDeactivate}
          className="flex flex-col items-center gap-1 w-16 py-2.5 rounded-xl text-[#5a6580] hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
        >
          <LogOut className="size-5" />
          <span className="text-[10px] font-medium">Exit</span>
        </button>
      </div>
    </div>
  );
}
