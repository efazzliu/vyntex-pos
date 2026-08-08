import { Navigate } from "react-router-dom";

/** Legacy route — security lives under Settings. */
export default function DashboardSecurityPage() {
  return <Navigate to="/dashboard/settings?tab=security" replace />;
}
