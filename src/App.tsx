import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { Toaster } from "./components/ui/sonner.tsx";
import { RedirectIfAuthed } from "./components/redirect-if-authed.tsx";
import { RequireSupabaseAuth } from "./components/require-supabase-auth.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import LoginPage from "./pages/auth/login/page-modern.tsx";
import RegisterPage from "./pages/auth/register/page-modern.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import PublicLayout from "./components/public-layout.tsx";
import VynTypes from "./pages/vyn-types/page.tsx";
import Pricing from "./pages/pricing/page.tsx";
import About from "./pages/about/page.tsx";
import Contact from "./pages/contact/page.tsx";
import LegalTerms from "./pages/legal/terms/page.tsx";
import LegalPrivacy from "./pages/legal/privacy/page.tsx";
import DashboardLayout from "./pages/dashboard/_components/dashboard-layout.tsx";
import DashboardOverview from "./pages/dashboard/page-modern.tsx";
import DashboardSettings from "./pages/dashboard/settings/page-modern.tsx";
import DashboardGetStartedPage from "./pages/dashboard/get-started/page.tsx";
import DashboardLicensesPage from "./pages/dashboard/licenses/page.tsx";
import DashboardDownloadsPage from "./pages/dashboard/downloads/page.tsx";
import DashboardBillingPage from "./pages/dashboard/billing/page.tsx";
import DashboardTeamAccessPage from "./pages/dashboard/team-access/page.tsx";
import DashboardBusinessSettingsPage from "./pages/dashboard/business-settings/page.tsx";
import DashboardSecurityPage from "./pages/dashboard/security/page.tsx";
import DashboardSupportPage from "./pages/dashboard/support/page.tsx";
import AdminLayout from "./pages/admin/_components/admin-layout.tsx";
import AdminOverview from "./pages/admin/dashboard/page.tsx";
import AdminBusinesses from "./pages/admin/businesses/page.tsx";
import AdminClientDetails from "./pages/admin/businesses/client-details-page.tsx";
import AdminBranches from "./pages/admin/branches/page.tsx";
import AdminSubscriptions from "./pages/admin/subscriptions/page.tsx";
import AdminInvoices from "./pages/admin/invoices/page.tsx";
import AdminLicenses from "./pages/admin/legacy-licenses/page.tsx";
import AdminUsers from "./pages/admin/users-hub/page.tsx";
import AdminStaffRoles from "./pages/admin/staff-roles/page.tsx";
import AdminModules from "./pages/admin/modules/page.tsx";
import AdminBookings from "./pages/admin/bookings/page.tsx";
import AdminReports from "./pages/admin/reports/page.tsx";
import AdminSupport from "./pages/admin/support/page.tsx";
import AdminSystemMonitor from "./pages/admin/system-monitor/page.tsx";
import AdminMarketing from "./pages/admin/marketing/page.tsx";
import AdminContacts from "./pages/admin/support-center/page.tsx";
import AdminFinance from "./pages/admin/finance-legacy/page.tsx";
import AdminSettings from "./pages/admin/settings-hub/page.tsx";
import PosLauncher from "./pages/pos/page.tsx";

function DesktopHomeRoute() {
  const isElectron =
    typeof window !== "undefined" &&
    Boolean((window as Window & { desktop?: { isElectron?: boolean } }).desktop?.isElectron);

  if (isElectron) {
    return <Navigate to="/pos" replace />;
  }

  return <Index />;
}

/** POS shell: no on-screen toasts (Sonner). Web dashboard / auth keep toasts. */
function AppToaster() {
  const { pathname } = useLocation();
  const isPos = pathname === "/pos" || pathname.startsWith("/pos/");
  if (isPos) return null;
  return <Toaster richColors position="top-right" />;
}

export default function App() {
  const isElectron =
    typeof window !== "undefined" &&
    Boolean((window as Window & { desktop?: { isElectron?: boolean } }).desktop?.isElectron);
  const Router = isElectron ? HashRouter : BrowserRouter;

  return (
    <DefaultProviders>
      <Router>
        <AppToaster />
        <Routes>
          {isElectron ? (
            <>
              <Route path="/" element={<Navigate to="/pos" replace />} />
              <Route path="/pos" element={<PosLauncher />} />
              <Route path="*" element={<Navigate to="/pos" replace />} />
            </>
          ) : (
            <>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route element={<RedirectIfAuthed />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<DesktopHomeRoute />} />
            <Route path="/vyn-types" element={<VynTypes />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/legal/terms" element={<LegalTerms />} />
            <Route path="/legal/privacy" element={<LegalPrivacy />} />
          </Route>
          <Route element={<RequireSupabaseAuth />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Navigate to="restaurant-pos" replace />} />
              <Route path="restaurant-pos" element={<DashboardOverview />} />
              <Route path="get-started" element={<DashboardGetStartedPage />} />
              <Route path="settings" element={<DashboardSettings />} />
              <Route path="licenses" element={<DashboardLicensesPage />} />
              <Route path="downloads" element={<DashboardDownloadsPage />} />
              <Route path="billing" element={<DashboardBillingPage />} />
              <Route path="team-access" element={<DashboardTeamAccessPage />} />
              <Route path="business-settings" element={<DashboardBusinessSettingsPage />} />
              <Route path="security" element={<DashboardSecurityPage />} />
              <Route path="support" element={<DashboardSupportPage />} />
            </Route>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="businesses" element={<AdminBusinesses />} />
              <Route path="businesses/:ownerEmail" element={<AdminClientDetails />} />
              <Route path="branches" element={<AdminBranches />} />
              <Route path="subscriptions" element={<AdminSubscriptions />} />
              <Route path="invoices" element={<AdminInvoices />} />
              <Route path="finance" element={<AdminFinance />} />
              <Route path="licenses" element={<AdminLicenses />} />
              <Route path="licenses/:ownerEmail" element={<AdminClientDetails />} />
              <Route path="licenses/:ownerEmail/*" element={<Navigate to="/admin/licenses" replace />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="staff-roles" element={<AdminStaffRoles />} />
              <Route path="modules" element={<AdminModules />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="support" element={<AdminSupport />} />
              <Route path="system-monitor" element={<AdminSystemMonitor />} />
              <Route path="marketing" element={<AdminMarketing />} />
              <Route path="contacts" element={<AdminContacts />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>
          <Route path="/pos" element={<PosLauncher />} />
          <Route path="*" element={<NotFound />} />
            </>
          )}
        </Routes>
      </Router>
    </DefaultProviders>
  );
}
