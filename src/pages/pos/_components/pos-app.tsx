import { useState } from "react";
import type { ActivationData } from "@/lib/local-db.ts";
import PosSidebar from "./pos-sidebar.tsx";
import PosHomeView from "./pos-home-view.tsx";
import MenuManagement from "./menu-management.tsx";
import TableManagement from "./table-management.tsx";

type PosView = "home" | "menu" | "tables";

type PosAppProps = {
  activation: ActivationData;
};

export default function PosApp({ activation }: PosAppProps) {
  const [activeView, setActiveView] = useState<PosView>("home");

  return (
    <div className="flex h-screen bg-[#0A0F1E] overflow-hidden">
      <PosSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        businessName={activation.businessName}
      />
      <main className="flex-1 overflow-auto">
        {activeView === "home" && (
          <PosHomeView activation={activation} onNavigate={setActiveView} />
        )}
        {activeView === "menu" && (
          <MenuManagement licenseKey={activation.licenseKey} />
        )}
        {activeView === "tables" && (
          <TableManagement licenseKey={activation.licenseKey} />
        )}
      </main>
    </div>
  );
}
