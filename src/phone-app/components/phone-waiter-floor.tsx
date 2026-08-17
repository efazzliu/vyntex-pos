import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { motion } from "motion/react";
import { LogOut, MapPinned, Users, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  clearWaiterSession,
  getWaiterSession,
} from "@/phone-app/lib/waiter-session.ts";
import { uuidOrNull, staffIdsEqual } from "@/lib/supabase-pos/uuid.ts";
import { cn } from "@/lib/utils.ts";
import { useWaiterCanPay } from "@/phone-app/hooks/use-waiter-can-pay.ts";
import { usePhoneAccessBranding } from "@/phone-app/hooks/use-phone-access-branding.tsx";
import { phoneAccessTableGridClass, phoneAccessHasBottomNav } from "@/lib/local-db.ts";
import { phoneAccessThemeTokens, waiterThemeGlow } from "@/lib/phone-access-theme.ts";

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

  const advanced = access.floorDesign === "advanced";
  const modern = access.floorDesign === "modern";
  const initial = staff.name.trim().charAt(0).toUpperCase() || "W";
  const tokens = phoneAccessThemeTokens(access.theme);
  const pageGlow = waiterThemeGlow(tokens);
  const tilesGlow = waiterThemeGlow(tokens);

  if (advanced) {
    return (
      <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#08090c] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: pageGlow,
          }}
        />

        {access.showHomeHeader ? (
          <header className="relative z-10 flex items-center gap-3 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
              style={{
                background: `linear-gradient(145deg, ${access.accentColor}, #d4af37)`,
                color: "#0a0a0a",
              }}
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium tracking-wide text-white/40">
                {t("phone.waiter.floorEyebrow")}
              </p>
              <h1 className="truncate text-[17px] font-semibold tracking-tight">
                {staff.name}
              </h1>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/70 active:scale-95"
              aria-label={t("phone.waiter.signOut")}
            >
              <LogOut className="size-4" />
            </button>
          </header>
        ) : (
          <div className="pt-[max(0.75rem,env(safe-area-inset-top))]" />
        )}

        {zones.length > 0 ? (
          <div className="relative z-10 flex gap-5 overflow-x-auto px-5 pb-3">
            {zones.map((zone) => {
              const isActive = activeZone === zone;
              return (
                <button
                  key={zone}
                  type="button"
                  onClick={() => setActiveZone(zone)}
                  className="shrink-0 pb-2 text-[13px] font-medium tracking-tight"
                  style={{
                    color: isActive ? "var(--waiter-fg)" : "var(--waiter-muted)",
                    borderBottom: isActive
                      ? `2px solid ${access.accentColor}`
                      : "2px solid transparent",
                  }}
                >
                  {zone}
                </button>
              );
            })}
          </div>
        ) : null}

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-4",
            phoneAccessHasBottomNav(access) ? "pb-24" : "pb-6",
          )}
        >
          {resolvedTables.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
              <MapPinned className="size-7 text-white/30" />
              <p className="text-lg font-semibold">{t("phone.waiter.noTablesTitle")}</p>
              <p className="max-w-[18rem] text-[13px] leading-relaxed text-white/45">
                {t("phone.waiter.noTablesBody")}
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-2",
                phoneAccessTableGridClass(access.homeTableCols),
              )}
            >
              {displayTables.map((table) => {
                const summary = orderSummaries?.[table._id];
                const colors = tableColors(table, summary, staff.id, isAdminOrManager);
                const busy =
                  Boolean(summary) ||
                  table.status === "occupied" ||
                  table.status === "bill-printed";
                return (
                  <button
                    key={table._id}
                    type="button"
                    onClick={() => handleTableTap(table)}
                    className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3 text-left ring-1 ring-white/[0.08] transition active:scale-[0.99]"
                  >
                    <span
                      className={cn(
                        "h-10 w-1.5 shrink-0 rounded-full",
                        colors.border.replace("border-", "bg-"),
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold tracking-tight">
                        {table.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-white/40">
                        <Users className="size-3" />
                        {table.seats}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        colors.bg,
                        colors.text,
                      )}
                    >
                      {summary && waiterCanPay
                        ? summary.total.toFixed(0)
                        : table.status === "bill-printed"
                          ? t("phone.waiter.order.billRequested")
                          : busy
                            ? "—"
                            : t("phone.waiter.tableFree")}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-white/25" />
                  </button>
                );
              })}
            </div>
          )}
        </motion.main>
      </div>
    );
  }

  if (modern) {
    return (
      <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#070b14] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: tilesGlow }}
        />

        {access.showHomeHeader ? (
          <header className="relative z-10 flex items-center gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
            <h1 className="min-w-0 flex-1 truncate text-[18px] font-semibold tracking-tight">
              {staff.name}
            </h1>
            <button
              type="button"
              onClick={signOut}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/70 active:scale-95"
              aria-label={t("phone.waiter.signOut")}
            >
              <LogOut className="size-4" />
            </button>
          </header>
        ) : (
          <div className="pt-[max(0.75rem,env(safe-area-inset-top))]" />
        )}

        {zones.length > 0 ? (
          <div className="relative z-10 flex gap-2 overflow-x-auto px-5 pb-3">
            {zones.map((zone) => {
              const isActive = activeZone === zone;
              return (
                <button
                  key={zone}
                  type="button"
                  onClick={() => setActiveZone(zone)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
                    isActive ? "text-white" : "bg-white/[0.08] text-white/55",
                  )}
                  style={
                    isActive ? { backgroundColor: access.accentColor } : undefined
                  }
                >
                  {zone}
                </button>
              );
            })}
          </div>
        ) : null}

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-5",
            phoneAccessHasBottomNav(access) ? "pb-24" : "pb-6",
          )}
        >
          {resolvedTables.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
              <MapPinned className="size-7 text-white/30" />
              <p className="text-lg font-semibold">{t("phone.waiter.noTablesTitle")}</p>
              <p className="max-w-[18rem] text-[13px] leading-relaxed text-white/45">
                {t("phone.waiter.noTablesBody")}
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-2",
                phoneAccessTableGridClass(access.homeTableCols),
              )}
            >
              {displayTables.map((table) => {
                const summary = orderSummaries?.[table._id];
                const colors = tableColors(table, summary, staff.id, isAdminOrManager);
                const busy =
                  Boolean(summary) ||
                  table.status === "occupied" ||
                  table.status === "bill-printed";
                return (
                  <button
                    key={table._id}
                    type="button"
                    onClick={() => handleTableTap(table)}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-white/[0.05] px-2 py-3 text-center transition active:scale-[0.98]"
                  >
                    <span
                      className={cn("size-2 rounded-full", colors.border.replace("border-", "bg-"))}
                    />
                    <span className="text-[14px] font-semibold tracking-tight">{table.name}</span>
                    <span className={cn("text-[10px] font-medium", colors.text)}>
                      {summary && waiterCanPay
                        ? summary.total.toFixed(0)
                        : table.status === "bill-printed"
                          ? t("phone.waiter.order.billRequested")
                          : busy
                            ? "—"
                            : t("phone.waiter.tableFree")}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-white/35">
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

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#070b14] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: tilesGlow,
        }}
      />

      {access.showHomeHeader ? (
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
      ) : (
        <div className="pt-[max(0.75rem,env(safe-area-inset-top))]" />
      )}

      {zones.length > 0 ? (
        <div className="relative z-10 grid grid-cols-3 gap-2 overflow-x-hidden px-5 pb-3">
          {zones.map((zone) => {
            const count = resolvedTables.filter((tb) => tb.zone === zone).length;
            const isActive = activeZone === zone;
            return (
              <button
                key={zone}
                type="button"
                onClick={() => setActiveZone(zone)}
                className={cn(
                  "flex h-11 min-w-0 items-center justify-between gap-1.5 rounded-xl px-2.5 text-[13px] font-medium transition-all",
                  isActive
                    ? "text-white shadow-lg"
                    : "border border-white/10 bg-white/[0.05] text-white/60",
                )}
                style={
                  isActive
                    ? {
                        backgroundColor: access.accentColor,
                        boxShadow: `0 10px 20px -8px ${access.accentColor}80`,
                      }
                    : undefined
                }
              >
                <span className="min-w-0 truncate">{zone}</span>
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]",
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
        className={cn(
          "relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-5",
          phoneAccessHasBottomNav(access) ? "pb-24" : "pb-6",
        )}
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
          <div
            className={cn(
              "grid gap-3",
              phoneAccessTableGridClass(access.homeTableCols),
            )}
          >
            {displayTables.map((table) => {
              const summary = orderSummaries?.[table._id];
              const colors = tableColors(table, summary, staff.id, isAdminOrManager);
              return (
                <button
                  key={table._id}
                  type="button"
                  onClick={() => handleTableTap(table)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 transition active:scale-[0.97]",
                    access.homeTableCols === 4
                      ? "py-2"
                      : access.homeTableCols === 3
                        ? "py-3"
                        : "py-5",
                    colors.bg,
                    colors.border,
                  )}
                >
                  <span className="text-base font-bold text-white">
                    {table.name}
                  </span>
                  {summary ? (
                    waiterCanPay ? (
                      <span className={cn("text-[11px] font-semibold tabular-nums", colors.text)}>
                        {summary.total.toFixed(0)}
                      </span>
                    ) : null
                  ) : (
                    <span className={cn("text-[11px] font-medium", colors.text)}>
                      {t("phone.waiter.tableFree")}
                    </span>
                  )}
                  {table.status === "bill-printed" ? (
                    <span className="text-[10px] font-medium text-blue-300">
                      {t("phone.waiter.order.billRequested")}
                    </span>
                  ) : null}
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
