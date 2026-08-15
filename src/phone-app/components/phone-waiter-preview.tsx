import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { enterWaiterDesignPreview } from "@/phone-app/lib/waiter-session.ts";

/**
 * Phone-only design entry: skips QR/code pairing and opens the waiter floor.
 * Use: /phone.html#/waiter/preview
 */
export default function PhoneWaiterPreview() {
  const navigate = useNavigate();

  useEffect(() => {
    enterWaiterDesignPreview();
    navigate("/waiter/floor", { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#070b14] px-6 text-center text-white">
      <p className="text-sm text-white/60">Opening waiter…</p>
    </div>
  );
}
