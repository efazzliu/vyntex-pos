import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "@/components/providers/default.tsx";
import { RedirectIfAuthed } from "@/components/redirect-if-authed.tsx";
import { RequireSupabaseAuth } from "@/components/require-supabase-auth.tsx";
import AuthCallback from "@/pages/auth/Callback.tsx";
import LoginPage from "@/pages/auth/login/page-modern.tsx";
import RegisterPage from "@/pages/auth/register/page-modern.tsx";
import NotFound from "@/pages/NotFound.tsx";
import PhoneDashboard from "@/phone-app/components/phone-dashboard.tsx";
import PhoneVenueHome from "@/phone-app/components/phone-venue-home.tsx";
import PhoneOrdersPage from "@/phone-app/components/phone-orders-page.tsx";
import PhoneShellLayout from "@/phone-app/components/phone-shell-layout.tsx";
import PhoneStockPage from "@/phone-app/components/phone-stock-page.tsx";
import PhoneStaffPage from "@/phone-app/components/phone-staff-page.tsx";
import PhoneProfilePage from "@/phone-app/components/phone-profile-page.tsx";
import PhoneNotificationsPage from "@/phone-app/components/phone-notifications-page.tsx";
import PhoneTeamPage from "@/phone-app/components/phone-team-page.tsx";
import { PhoneAuthUrlGate } from "@/phone-app/components/phone-auth-url-gate.tsx";
import PhoneMobileAccessGate from "@/phone-app/components/phone-mobile-access-gate.tsx";
import PhoneRedeemCodePage from "@/phone-app/components/phone-redeem-code-page.tsx";
import PhoneProfilePersonalPage from "@/phone-app/components/phone-profile-personal-page.tsx";
import PhoneProfileLicensesPage from "@/phone-app/components/phone-profile-licenses-page.tsx";
import PhoneProfilePreferencesPage from "@/phone-app/components/phone-profile-preferences-page.tsx";
import PhoneProfileSecurityPage from "@/phone-app/components/phone-profile-security-page.tsx";
import PhoneProfileDisplayPage from "@/phone-app/components/phone-profile-display-page.tsx";

/**
 * Rrugë vetëm për shell-in mobil (phone.html).
 * HashRouter: URL mbetet `/phone.html#/login` etj., sepse rruga e skedarit nuk është `/`.
 */
export default function PhoneApp() {
  return (
    <DefaultProviders>
      <HashRouter>
        <PhoneAuthUrlGate>
          <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* Managers: invite code; anonymous session or magic-link email if Anonymous is disabled. */}
          <Route path="/redeem-code" element={<PhoneRedeemCodePage />} />
          <Route
            path="/app/redeem-code"
            element={<Navigate to="/redeem-code" replace />}
          />
          <Route element={<RedirectIfAuthed redirectTo="/app" />}>
            <Route
              path="/login"
              element={
                <LoginPage defaultAfterLogin="/app" showManagerCodeLink />
              }
            />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route element={<RequireSupabaseAuth />}>
            <Route element={<PhoneMobileAccessGate />}>
              <Route element={<PhoneShellLayout />}>
                <Route path="/app/venue" element={<PhoneVenueHome />} />
                <Route path="/app/orders" element={<PhoneOrdersPage />} />
                <Route path="/app/stock" element={<PhoneStockPage />} />
                <Route path="/app/staff" element={<PhoneStaffPage />} />
                <Route path="/app/profile/personal" element={<PhoneProfilePersonalPage />} />
                <Route path="/app/profile/licenses" element={<PhoneProfileLicensesPage />} />
                <Route path="/app/profile/preferences" element={<PhoneProfilePreferencesPage />} />
                <Route path="/app/profile/display" element={<PhoneProfileDisplayPage />} />
                <Route path="/app/profile/security" element={<PhoneProfileSecurityPage />} />
                <Route path="/app/phone-team" element={<PhoneTeamPage />} />
                <Route path="/app/profile" element={<PhoneProfilePage />} />
                <Route path="/app/notifications" element={<PhoneNotificationsPage />} />
              </Route>
              <Route path="/app" element={<PhoneDashboard />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
          </Routes>
        </PhoneAuthUrlGate>
      </HashRouter>
    </DefaultProviders>
  );
}
