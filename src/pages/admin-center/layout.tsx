import { Outlet } from "react-router-dom";
import { DashboardLocaleProvider } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { AdminCenterProvider } from "@/pages/dashboard/_components/admin-center-context.tsx";
import { AdminSidebar } from "@/pages/dashboard/_components/admin-sidebar.tsx";
import { AdminTopbar } from "@/pages/dashboard/_components/admin-topbar.tsx";
import { AdminCenterBottomNav } from "@/pages/dashboard/_components/admin-center-bottom-nav.tsx";
import { RenewLicenseDialog } from "@/pages/dashboard/_components/renew-license-dialog.tsx";

function AdminCenterShell() {
  return (
    <div className="flex h-dvh overflow-hidden bg-[#F6F8FC] text-slate-900">
      <div className="hidden shrink-0 md:block">
        <AdminSidebar />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopbar />
        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto pb-[5.75rem] md:pb-0">
          <Outlet />
        </main>
        <AdminCenterBottomNav />
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
