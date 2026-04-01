import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { PwaInstallProvider } from "./components/providers/pwa-install-provider.tsx";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";
import InstallPrompt from "@/components/install-prompt.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
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
import DashboardOverview from "./pages/dashboard/page.tsx";
import DashboardSettings from "./pages/dashboard/settings/page.tsx";
import AdminLayout from "./pages/admin/_components/admin-layout.tsx";
import AdminOverview from "./pages/admin/page.tsx";
import AdminLicenses from "./pages/admin/licenses/page.tsx";
import AdminUsers from "./pages/admin/users/page.tsx";
import AdminContacts from "./pages/admin/contacts/page.tsx";
import PosLauncher from "./pages/pos/page.tsx";

export default function App() {
  useServiceWorker();

  return (
    <DefaultProviders>
      <PwaInstallProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/vyn-types" element={<VynTypes />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/legal/terms" element={<LegalTerms />} />
            <Route path="/legal/privacy" element={<LegalPrivacy />} />
          </Route>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardOverview />} />
            <Route path="/dashboard/settings" element={<DashboardSettings />} />
          </Route>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/licenses" element={<AdminLicenses />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/contacts" element={<AdminContacts />} />
          </Route>
          <Route path="/pos" element={<PosLauncher />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
          <InstallPrompt />
        </BrowserRouter>
      </PwaInstallProvider>
    </DefaultProviders>
  );
}
