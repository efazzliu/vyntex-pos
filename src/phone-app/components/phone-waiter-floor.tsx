import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { motion } from "motion/react";
import { LogOut, MapPinned, Users } from "lucide-react";
import { toast } from "sonner";
import {
  clearWaiterSession,
  getWaiterSession,
} from "@/phone-app/lib/waiter-session.ts";
import { uuidOrNull, staffIdsEqual } from "@/lib/supabase-pos/uuid.ts";
import { cn } from "@/lib/utils.ts";

type TableOrderSummary = {
  staffId: string;
  staffName: string;
  total: number;
};

type TableColors = {
  bg: string;
  border: string;
  text: string;
};

function tableColors(
  table: Doc<"tables">,
  summary: TableOrderSummary | undefined,
  currentStaffId: string | undefined,
  isAdminOrManager: boolean,
): TableColors {
  const status = table.status as string;
  const hasOpenTicket = Boolean(summary);

  if (hasOpenTicket || status === "occupied" || status === "bill-printed") {
    if (summary && currentStaffId && staffIdsEqual(summary.staffId, currentStaffId)) {
      return { bg: "bg-blue-500/15", border: "border-blue-400", text: "text-blue-300" };
    }
    if (summary && !uuidOrNull(summary.staffId)) {
      return { bg: "bg-amber-500/15", border: "border-amber-400/80", text: "text-amber-300" };
    }
    if (isAdminOrManager) {
      return { bg: "bg-amber-500/15", border: "border-amber-400/80", text: "text-amber-300" };
    }
    return { bg: "bg-red-500/15", border: "border-red-400", text: "text-red-300" };
  }

  if (status === "reserved") {
    return { bg: "bg-amber-500/15", border: "border-amber-400/80", text: "text-amber-300" };
  }

  return { bg: "bg-emerald-500/12", border: "border-emerald-400/70", text: "text-emerald-300" };
}

export default function PhoneWaiterFloor() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const session = getWaiterSession();
  const [activeZone, setActiveZone] = useState<string | null>(null);

  const licenseKey = session?.licenseKey ?? "";
  const tables = useQuery(
    "pos.tables.getTables",
    licenseKey ? { licenseKey } : "skip",
  ) as Doc<"tables">[] | undefined;
  const orderSummaries = useQuery(
    "pos.tables.getTableOrderSummaries",
    licenseKey ? { licenseKey } : "skip",
  ) as Record<string, TableOrderSummary> | undefined;

  useEffect(() => {
    if (!session) {
      navigate("/waiter", { replace: true });
    }
  }, [session, navigate]);

  const resolvedTables = tables ?? [];
  const zones = useMemo(
    () => [...new Set(resolvedTables.map((tb) => tb.zone))].sort(),
    [resolvedTables],
  );

  useEffect(() => {
    if (zones.length > 0 && (activeZone === null || !zones.includes(activeZone))) {
      setActiveZone(zones[0]);
    }
  }, [zones, activeZone]);

  if (!session) return null;

  const staff = session.staff;
  const isAdminOrManager = staff.role === "admin" || staff.role === "manager";
  const displayTables = activeZone
    ? resolvedTables.filter((tb) => tb.zone === activeZone)
    : resolvedTables;

  const signOut = () => {
    // Ends the waiter shift only — phone stays paired until admin disconnects Device ID.
    clearWaiterSession();
    navigate("/waiter", { replace: true });
  };

  const handleTableTap = (table: Doc<"tables">) => {
    const summary = orderSummaries?.[table._id];
    const hasAssignedWaiter = Boolean(uuidOrNull(summary?.staffId));
    const isMine =
      Boolean(summary) &&
      hasAssignedWaiter &&
      staffIdsEqual(summary!.staffId, staff.id);
    const isOtherWaiter =
      Boolean(summary) && hasAssignedWaiter && !isMine;
    const isBlocked = isOtherWaiter && !isAdminOrManager;

    if (isBlocked) {
      toast.error(
        t("phone.waiter.tableTakenBy", {
          name: summary?.staffName ?? t("phone.waiter.anotherWaiter"),
        }),
      );
      return;
    }

    navigate(`/waiter/table/${table._id}`);
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#070b14] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 50% at 20% 0%, rgba(0,102,255,0.28) 0%, transparent 55%), linear-gradient(180deg, #0a1224 0%, #070b14 100%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            {t("phone.waiter.floorEyebrow")}
          </p>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ fontFamily: '"Space Grotesk", Geist, system-ui, sans-serif' }}
          >
            {staff.name}
          </h1>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] font-medium text-white/70 transition active:scale-95"
        >
          <LogOut className="size-3.5" />
          {t("phone.waiter.signOut")}
        </button>
      </header>

      {zones.length > 0 ? (
        <div className="relative z-10 flex gap-2 overflow-x-auto px-5 pb-3">
          {zones.map((zone) => {
            const count = resolvedTables.filter((tb) => tb.zone === zone).length;
            const isActive = activeZone === zone;
            return (
              <button
                key={zone}
                type="button"
                onClick={() => setActiveZone(zone)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all",
                  isActive
                    ? "bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/25"
                    : "border border-white/10 bg-white/[0.05] text-white/60",
                )}
              >
                {zone}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px]",
                    isActive ? "bg-white/20" : "bg-white/10",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex-1 overflow-y-auto px-5 pb-10"
      >
        {resolvedTables.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex size-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.06]">
              <MapPinned className="size-7 text-[#7eb6ff]" />
            </div>
            <p className="text-lg font-semibold">
              {t("phone.waiter.noTablesTitle")}
            </p>
            <p className="max-w-[18rem] text-[13px] leading-relaxed text-white/45">
              {t("phone.waiter.noTablesBody")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {displayTables.map((table) => {
              const summary = orderSummaries?.[table._id];
              const colors = tableColors(table, summary, staff.id, isAdminOrManager);
              return (
                <button
                  key={table._id}
                  type="button"
                  onClick={() => handleTableTap(table)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-5 transition active:scale-[0.97]",
                    colors.bg,
                    colors.border,
                  )}
                >
                  <span className="text-base font-bold text-white">
                    {table.name}
                  </span>
                  {summary ? (
                    <span className={cn("text-[11px] font-semibold tabular-nums", colors.text)}>
                      {summary.total.toFixed(0)}
                    </span>
                  ) : (
                    <span className={cn("text-[11px] font-medium", colors.text)}>
                      {t("phone.waiter.tableFree")}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-white/35">
                    <Users className="size-2.5" />
                    {table.seats}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </motion.main>
    </div>
  );
}
