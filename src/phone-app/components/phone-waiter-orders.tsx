import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { ClipboardList } from "lucide-react";
import { getWaiterSession } from "@/phone-app/lib/waiter-session.ts";
import { staffIdsEqual, uuidOrNull } from "@/lib/supabase-pos/uuid.ts";
import { useWaiterCanPay } from "@/phone-app/hooks/use-waiter-can-pay.ts";
import { usePhoneAccessBranding } from "@/phone-app/hooks/use-phone-access-branding.tsx";
import { phoneAccessHasBottomNav } from "@/lib/local-db.ts";

type TableOrderSummary = {
  staffId: string;
  staffName: string;
  total: number;
};

export default function PhoneWaiterOrders() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const session = getWaiterSession();
  const licenseKey = session?.licenseKey ?? "";
  const staffId = session?.staff.id;
  const waiterCanPay = useWaiterCanPay(licenseKey);
  const access = usePhoneAccessBranding();

  const tables = useQuery(
    "pos.tables.getTables",
    licenseKey ? { licenseKey } : "skip",
  ) as Doc<"tables">[] | undefined;
  const orderSummaries = useQuery(
    "pos.tables.getTableOrderSummaries",
    licenseKey ? { licenseKey } : "skip",
  ) as Record<string, TableOrderSummary> | undefined;

  const mine = useMemo(() => {
    if (!tables || !orderSummaries || !staffId) return [];
    return tables
      .filter((tb) => {
        const s = orderSummaries[tb._id];
        return s && uuidOrNull(s.staffId) && staffIdsEqual(s.staffId, staffId);
      })
      .map((tb) => ({ table: tb, summary: orderSummaries[tb._id]! }));
  }, [tables, orderSummaries, staffId]);

  return (
    <div
      className={
        phoneAccessHasBottomNav(access)
          ? "flex min-h-dvh flex-col bg-[#070b14] pb-[5.75rem] text-white"
          : "flex min-h-dvh flex-col bg-[#070b14] pb-6 text-white"
      }
    >
      {access.showOrdersHeader ? (
      <header className="px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          {t("phone.waiter.floorEyebrow")}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          {t("phone.waiter.navOrders")}
        </h1>
      </header>
      ) : (
        <div className="pt-[max(0.75rem,env(safe-area-inset-top))]" />
      )}

      <main className="flex-1 overflow-y-auto px-5">
        {mine.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardList className="size-8 text-white/25" />
            <p className="text-sm text-white/45">{t("phone.waiter.ordersEmpty")}</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {mine.map(({ table, summary }) => (
              <button
                key={table._id}
                type="button"
                onClick={() => navigate(`/waiter/table/${table._id}`)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-blue-400/40 bg-blue-500/10 px-3.5 py-3.5 text-left active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{table.name}</p>
                  <p className="text-[12px] text-white/45">{table.zone}</p>
                </div>
                {waiterCanPay ? (
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[#7eb6ff]">
                    {summary.total.toFixed(0)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
