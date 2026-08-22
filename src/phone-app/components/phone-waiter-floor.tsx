import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { motion } from "motion/react";
import { Bell, ChevronRight, LogOut, MapPinned, Users } from "lucide-react";
import { toast } from "sonner";
import {
  clearWaiterSession,
  getWaiterSession,
  isWaiterDesignPreviewLicense,
} from "@/phone-app/lib/waiter-session.ts";
import { uuidOrNull, staffIdsEqual } from "@/lib/supabase-pos/uuid.ts";
import { cn } from "@/lib/utils.ts";
import { useWaiterCanPay } from "@/phone-app/hooks/use-waiter-can-pay.ts";
import { usePhoneAccessBranding } from "@/phone-app/hooks/use-phone-access-branding.tsx";
import { phoneAccessTableGridClass, phoneAccessHasBottomNav } from "@/lib/local-db.ts";
import { phoneAccessThemeTokens, waiterThemeGlow, waiterIdleChipClass, waiterPageTextClass } from "@/lib/phone-access-theme.ts";

type TableOrderSummary = {
  staffId: string;
  staffName: string;
  total: number;
};

type FloorTable = {
  _id: string;
  name: string;
  seats: number;
  zone: string;
  status: "available" | "occupied" | "reserved" | "bill-printed";
};

const DEMO_FLOOR_TABLES: FloorTable[] = [
  { _id: "demo-t1", name: "T1", seats: 2, zone: "Sala", status: "available" },
  { _id: "demo-t2", name: "T2", seats: 4, zone: "Sala", status: "occupied" },
  { _id: "demo-t3", name: "T3", seats: 4, zone: "Sala", status: "available" },
  { _id: "demo-t4", name: "T4", seats: 6, zone: "Sala", status: "reserved" },
  { _id: "demo-t5", name: "T5", seats: 2, zone: "Terasë", status: "available" },
  { _id: "demo-t6", name: "T6", seats: 4, zone: "Terasë", status: "bill-printed" },
  { _id: "demo-t7", name: "T7", seats: 8, zone: "Terasë", status: "occupied" },
  { _id: "demo-t8", name: "T8", seats: 2, zone: "Bar", status: "available" },
];

const DEMO_ORDER_SUMMARIES: Record<string, TableOrderSummary> = {
  "demo-t2": {
    staffId: "00000000-0000-4000-8000-000000000001",
    staffName: "Artes",
    total: 1850,
  },
  "demo-t6": {
    staffId: "00000000-0000-4000-8000-000000000001",
    staffName: "Artes",
    total: 920,
  },
  "demo-t7": {
    staffId: "00000000-0000-4000-8000-000000000099",
    staffName: "Ana",
    total: 2400,
  },
};

type TableColors = {
  bg: string;
  border: string;
  text: string;
};

function tableColors(
  table: FloorTable,
  summary: TableOrderSummary | undefined,
  currentStaffId: string | undefined,
  isAdminOrManager: boolean,
  isLight: boolean,
): TableColors {
  const status = table.status as string;
  const hasOpenTicket = Boolean(summary);

  if (hasOpenTicket || status === "occupied" || status === "bill-printed") {
    if (summary && currentStaffId && staffIdsEqual(summary.staffId, currentStaffId)) {
      return isLight
        ? { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-700" }
        : { bg: "bg-blue-500/20", border: "border-blue-400", text: "text-blue-200" };
    }
    if (summary && !uuidOrNull(summary.staffId)) {
      return isLight
        ? { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-800" }
        : { bg: "bg-amber-500/20", border: "border-amber-400", text: "text-amber-200" };
    }
    if (isAdminOrManager) {
      return isLight
        ? { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-800" }
        : { bg: "bg-amber-500/20", border: "border-amber-400", text: "text-amber-200" };
    }
    return isLight
      ? { bg: "bg-red-50", border: "border-red-400", text: "text-red-700" }
      : { bg: "bg-red-500/20", border: "border-red-400", text: "text-red-200" };
  }

  if (status === "reserved") {
    return isLight
      ? { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-800" }
      : { bg: "bg-amber-500/20", border: "border-amber-400", text: "text-amber-200" };
  }

  return isLight
    ? { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-700" }
    : { bg: "bg-emerald-500/20", border: "border-emerald-400", text: "text-emerald-200" };
}

export default function PhoneWaiterFloor() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const session = getWaiterSession();
  const [activeZone, setActiveZone] = useState<string | null>(null);

  const licenseKey = session?.licenseKey ?? "";
  const designPreview = isWaiterDesignPreviewLicense(licenseKey);
  const liveCanPay = useWaiterCanPay(designPreview ? "" : licenseKey);
  const waiterCanPay = designPreview || liveCanPay;
  const access = usePhoneAccessBranding();
  const liveTables = useQuery(
    "pos.tables.getTables",
    licenseKey && !designPreview ? { licenseKey } : "skip",
  ) as FloorTable[] | undefined;
  const liveOrderSummaries = useQuery(
    "pos.tables.getTableOrderSummaries",
    licenseKey && !designPreview ? { licenseKey } : "skip",
  ) as Record<string, TableOrderSummary> | undefined;
  const kitchenNotifs = useQuery(
    "pos.orders.getWaiterKitchenNotifications",
    licenseKey && !designPreview ? { licenseKey } : "skip",
  ) as
    | { tableId?: string; status?: string; station?: string }[]
    | undefined;

  const readyCountByTableId = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of kitchenNotifs ?? []) {
      if (line.station !== "kitchen") continue;
      if (String(line.status ?? "").toLowerCase() !== "ready") continue;
      const tid = String(line.tableId ?? "").trim();
      if (!tid) continue;
      map.set(tid, (map.get(tid) ?? 0) + 1);
    }
    return map;
  }, [kitchenNotifs]);

  useEffect(() => {
    if (!session) {
      navigate("/waiter", { replace: true });
    }
  }, [session, navigate]);

  const resolvedTables = designPreview ? DEMO_FLOOR_TABLES : (liveTables ?? []);
  const orderSummaries = designPreview ? DEMO_ORDER_SUMMARIES : liveOrderSummaries;
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
    navigate(designPreview ? "/waiter/preview" : "/waiter", { replace: true });
  };

  const handleTableTap = (table: FloorTable) => {
    if (designPreview) {
      toast.message(t("phone.waiter.subtitle"), {
        description: table.name,
      });
      return;
    }
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
      <div
        className={cn(
          "relative flex min-h-dvh flex-col overflow-hidden",
          waiterPageTextClass(tokens.isLight),
        )}
      >
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
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--waiter-muted)" }}
              >
                {t("phone.waiter.floorEyebrowNamed", { name: staff.name })}
              </p>
              <h1 className="truncate text-[17px] font-semibold tracking-tight">
                {t("phone.waiter.navTables")}
              </h1>
            </div>
            <button
              type="button"
              onClick={signOut}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full active:scale-95",
                tokens.isLight ? "bg-slate-200 text-slate-700" : "bg-white/[0.08] text-white/75",
              )}
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
              <MapPinned className="size-7" style={{ color: "var(--waiter-faint)" }} />
              <p className="text-lg font-semibold">{t("phone.waiter.noTablesTitle")}</p>
              <p
                className="max-w-[18rem] text-[13px] leading-relaxed"
                style={{ color: "var(--waiter-muted)" }}
              >
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
                const colors = tableColors(table, summary, staff.id, isAdminOrManager, tokens.isLight);
                const busy =
                  Boolean(summary) ||
                  table.status === "occupied" ||
                  table.status === "bill-printed";
                return (
                  <button
                    key={table._id}
                    type="button"
                    onClick={() => handleTableTap(table)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:scale-[0.99]",
                      tokens.isLight
                        ? "border border-slate-200 bg-white shadow-sm"
                        : "bg-white/[0.06] ring-1 ring-white/15",
                    )}
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
                      <span
                        className="mt-0.5 flex items-center gap-1 text-[11px]"
                        style={{ color: "var(--waiter-muted)" }}
                      >
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
                    <ChevronRight
                      className="size-4 shrink-0"
                      style={{ color: "var(--waiter-faint)" }}
                    />
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
      <div
        className={cn(
          "relative flex min-h-dvh flex-col overflow-hidden",
          waiterPageTextClass(tokens.isLight),
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: tilesGlow }}
        />

        {access.showHomeHeader ? (
          <header className="relative z-10 flex items-center gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="min-w-0 flex-1">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--waiter-muted)" }}
              >
                {t("phone.waiter.floorEyebrowNamed", { name: staff.name })}
              </p>
              <h1 className="truncate text-[18px] font-semibold tracking-tight">
                {t("phone.waiter.navTables")}
              </h1>
            </div>
            <button
              type="button"
              onClick={signOut}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full active:scale-95",
                tokens.isLight ? "bg-slate-200 text-slate-700" : "bg-white/[0.08] text-white/75",
              )}
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
                    isActive ? "text-white" : waiterIdleChipClass(tokens.isLight),
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
              <MapPinned className="size-7" style={{ color: "var(--waiter-faint)" }} />
              <p className="text-lg font-semibold">{t("phone.waiter.noTablesTitle")}</p>
              <p
                className="max-w-[18rem] text-[13px] leading-relaxed"
                style={{ color: "var(--waiter-muted)" }}
              >
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
                const colors = tableColors(table, summary, staff.id, isAdminOrManager, tokens.isLight);
                const busy =
                  Boolean(summary) ||
                  table.status === "occupied" ||
                  table.status === "bill-printed";
                return (
                  <button
                    key={table._id}
                    type="button"
                    onClick={() => handleTableTap(table)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-center transition active:scale-[0.98]",
                      colors.bg,
                      colors.border,
                    )}
                  >
                    <span
                      className={cn("size-2 rounded-full", colors.border.replace("border-", "bg-"))}
                    />
                    <span className="text-[14px] font-semibold tracking-tight">{table.name}</span>
                    <span className={cn("text-[10px] font-semibold", colors.text)}>
                      {summary && waiterCanPay
                        ? summary.total.toFixed(0)
                        : table.status === "bill-printed"
                          ? t("phone.waiter.order.billRequested")
                          : busy
                            ? "—"
                            : t("phone.waiter.tableFree")}
                    </span>
                    <span
                      className="flex items-center gap-0.5 text-[10px]"
                      style={{ color: "var(--waiter-muted)" }}
                    >
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
    <div
      className={cn(
        "relative flex min-h-dvh flex-col overflow-hidden",
        waiterPageTextClass(tokens.isLight),
      )}
    >
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
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--waiter-muted)" }}
          >
            {t("phone.waiter.floorEyebrowNamed", { name: staff.name })}
          </p>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ fontFamily: '"Space Grotesk", Geist, system-ui, sans-serif' }}
          >
            {t("phone.waiter.navTables")}
          </h1>
        </div>
        <button
          type="button"
          onClick={signOut}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition active:scale-95",
            tokens.isLight
              ? "border-slate-200 bg-white text-slate-700"
              : "border-white/10 bg-white/[0.05] text-white/75",
          )}
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
                  isActive ? "text-white shadow-lg" : waiterIdleChipClass(tokens.isLight),
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
                    isActive
                      ? "bg-white/25 text-white"
                      : tokens.isLight
                        ? "bg-slate-300/80 text-slate-800"
                        : "bg-white/15 text-white",
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
            <div
              className={cn(
                "flex size-16 items-center justify-center rounded-3xl border",
                tokens.isLight
                  ? "border-slate-200 bg-white"
                  : "border-white/10 bg-white/[0.06]",
              )}
            >
              <MapPinned className="size-7 text-[#7eb6ff]" />
            </div>
            <p className="text-lg font-semibold">
              {t("phone.waiter.noTablesTitle")}
            </p>
            <p
              className="max-w-[18rem] text-[13px] leading-relaxed"
              style={{ color: "var(--waiter-muted)" }}
            >
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
              const colors = tableColors(table, summary, staff.id, isAdminOrManager, tokens.isLight);
              const statusLine = summary
                ? waiterCanPay
                  ? summary.total.toFixed(0)
                  : t("phone.waiter.tableOpen")
                : t("phone.waiter.tableFree");
              const readyCount = readyCountByTableId.get(table._id) ?? 0;
              return (
                <button
                  key={table._id}
                  type="button"
                  onClick={() => handleTableTap(table)}
                  className={cn(
                    // Fixed phone tile size — never grows with content or viewport columns.
                    "relative box-border flex h-[7.25rem] w-full shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border-2 px-2 transition active:scale-[0.97]",
                    colors.bg,
                    colors.border,
                    readyCount > 0 && "border-red-500/80",
                  )}
                >
                  {readyCount > 0 ? (
                    <span
                      className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-full bg-red-500 px-1.5 py-0.5 shadow-[0_0_0_2px_rgba(7,11,20,0.85)]"
                      aria-label={t("phone.waiter.tableReadyBell", {
                        count: readyCount,
                      })}
                    >
                      <Bell className="size-3 text-white" strokeWidth={2.5} />
                      <span className="text-[10px] font-bold tabular-nums text-white">
                        {readyCount > 9 ? "9+" : readyCount}
                      </span>
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "max-w-full truncate text-base font-bold leading-none",
                      tokens.isLight ? "text-slate-900" : "text-white",
                    )}
                  >
                    {table.name}
                  </span>
                  <span
                    className={cn(
                      "max-w-full truncate text-[11px] font-semibold leading-none tabular-nums",
                      colors.text,
                    )}
                  >
                    {statusLine}
                  </span>
                  <span
                    className={cn(
                      "h-3 max-w-full truncate text-[10px] font-medium leading-none",
                      tokens.isLight ? "text-blue-700" : "text-blue-200",
                    )}
                  >
                    {table.status === "bill-printed"
                      ? t("phone.waiter.order.billRequested")
                      : "\u00a0"}
                  </span>
                  <span
                    className="flex h-3 items-center gap-1 text-[10px] leading-none"
                    style={{ color: "var(--waiter-muted)" }}
                  >
                    <Users className="size-2.5 shrink-0" />
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
