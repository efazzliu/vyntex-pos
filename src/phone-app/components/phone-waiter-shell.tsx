import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { getWaiterSession } from "@/phone-app/lib/waiter-session.ts";
import { useWaiterReadyToasts } from "@/phone-app/hooks/use-waiter-ready-toasts.ts";
import { PhoneWaiterBottomNav } from "./phone-waiter-bottom-nav.tsx";

export default function PhoneWaiterShell() {
  const navigate = useNavigate();
  const session = getWaiterSession();
  useWaiterReadyToasts(session?.licenseKey ?? "");

  useEffect(() => {
    if (!session) navigate("/waiter", { replace: true });
  }, [session, navigate]);

  if (!session) return null;

  return (
    <div className="relative min-h-dvh bg-[#070b14] text-white">
      <Outlet />
      <PhoneWaiterBottomNav />
    </div>
  );
}
