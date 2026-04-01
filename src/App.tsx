import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
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
import DashboardOrders from "./pages/dashboard/orders/page.tsx";
import DashboardMenu from "./pages/dashboard/menu/page.tsx";
import DashboardSettings from "./pages/dashboard/settings/page.tsx";

export default function App() {
  return (
    <DefaultProviders>
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
            <Route path="/dashboard/orders" element={<DashboardOrders />} />
            <Route path="/dashboard/menu" element={<DashboardMenu />} />
            <Route path="/dashboard/settings" element={<DashboardSettings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
