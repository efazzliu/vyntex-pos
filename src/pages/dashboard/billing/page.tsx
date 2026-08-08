import { Navigate } from "react-router-dom";

/** Legacy route — billing lives under Settings. */
export default function DashboardBillingPage() {
  return <Navigate to="/dashboard/settings?tab=billing" replace />;
}
