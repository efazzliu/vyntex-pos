import { useState } from "react";
import type { ActivationData } from "@/lib/local-db.ts";
import type { ActiveStaff, PosView } from "../_lib/types.ts";
import PosSidebar from "./pos-sidebar.tsx";
import PosHomeView from "./pos-home-view.tsx";
import MenuManagement from "./menu-management.tsx";
import TableManagement from "./table-management.tsx";
import StaffManagement from "./staff-management.tsx";
import FloorPlan from "./floor-plan.tsx";
import { toast } from "sonner";

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
  const [activeView, setActiveView] = useState<PosView>("home");

  const handleViewChange = (view: PosView) => {
    setActiveView(view);
  };

  const handleTableSelect = () => {
    toast.info("Orders & checkout coming soon in a future milestone!");
  };

  return (
    <div className="flex h-screen bg-[#0A0F1E] overflow-hidden">
      <PosSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        businessName={activation.businessName}
        activeStaff={activeStaff}
        onLogout={onLogout}
      />
      <main className="flex-1 overflow-auto">
        {activeView === "home" && (
          <PosHomeView
            activation={activation}
            onNavigate={setActiveView}
            staffRole={activeStaff.role}
          />
        )}
        {activeView === "floor" && (
          <FloorPlan
            licenseKey={activation.licenseKey}
            isEditor={activeStaff.role === "admin"}
            onTableSelect={handleTableSelect}
          />
        )}
        {activeView === "menu" && activeStaff.role === "admin" && (
          <MenuManagement licenseKey={activation.licenseKey} />
        )}
        {activeView === "tables" && activeStaff.role === "admin" && (
          <TableManagement licenseKey={activation.licenseKey} />
        )}
        {activeView === "staff" && activeStaff.role === "admin" && (
          <StaffManagement licenseKey={activation.licenseKey} />
        )}
      </main>
    </div>
  );
}
