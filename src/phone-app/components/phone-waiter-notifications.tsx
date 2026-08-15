import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { Bell, ChefHat } from "lucide-react";
import { getWaiterSession } from "@/phone-app/lib/waiter-session.ts";

type KitchenLine = {
  lineId: string;
  saleId: string;
  orderNumber: number;
  tableName: string;
  name: string;
  quantity: number;
  station?: "kitchen" | "bar";
  status: string;
};

export default function PhoneWaiterNotifications() {
  const { t } = useTranslation("site");
  const session = getWaiterSession();
  const licenseKey = session?.licenseKey ?? "";

  const queue = useQuery(
    "pos.orders.getKitchenQueue",
    licenseKey ? { licenseKey } : "skip",
  ) as KitchenLine[] | undefined;

  const lines = queue ?? [];

  return (
    <div className="flex min-h-dvh flex-col bg-[#070b14] pb-[5.75rem] text-white">
      <header className="px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          {t("phone.waiter.floorEyebrow")}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          {t("phone.waiter.navNotifications")}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-5">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Bell className="size-8 text-white/25" />
            <p className="text-sm text-white/45">{t("phone.waiter.notifEmpty")}</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {lines.map((line) => (
              <div
                key={line.lineId}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3"
              >
                <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/40">
                  <ChefHat className="size-3.5" />
                  {line.tableName} · #{line.orderNumber}
                </div>
                <p className="text-[14px] font-medium">
                  {line.quantity}× {line.name}
                </p>
                <p className="mt-0.5 text-[12px] text-amber-300/90">
                  {t("phone.waiter.notifKitchen")}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
