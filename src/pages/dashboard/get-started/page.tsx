import SetupForm from "../_components/setup-form.tsx";
import { Navigate } from "react-router-dom";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";

export default function DashboardGetStartedPage() {
  const { restaurant } = useDashboardRestaurant();
  if (restaurant) return <Navigate to="/dashboard/restaurant-pos" replace />;
  return <SetupForm />;
}
