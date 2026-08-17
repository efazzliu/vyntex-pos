import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { DashboardLocaleProvider } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { AdminCenterProvider } from "@/pages/dashboard/_components/admin-center-context.tsx";
import { AdminSidebar } from "@/pages/dashboard/_components/admin-sidebar.tsx";
import { AdminTopbar } from "@/pages/dashboard/_components/admin-topbar.tsx";
import { RenewLicenseDialog } from "@/pages/dashboard/_components/renew-license-dialog.tsx";

function AdminCenterShell() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);
    setMobileOpen(false);
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F6F8FC] text-slate-900">
      <div className="hidden shrink-0 md:block">
        <AdminSidebar />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-[272px] shadow-2xl">
            <AdminSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopbar onMenu={() => setMobileOpen(true)} />
        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <RenewLicenseDialog />
    </div>
  );
}

export default function AdminCenterLayout() {
  return (
    <DashboardLocaleProvider>
      <AdminCenterProvider>
        <AdminCenterShell />
      </AdminCenterProvider>
    </DashboardLocaleProvider>
  );
}
