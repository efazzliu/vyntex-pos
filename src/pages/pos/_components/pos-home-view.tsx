import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { ActivationData } from "@/lib/local-db.ts";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { useOfflineData } from "@/hooks/use-offline-data.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import type { LucideIcon } from "lucide-react";
import {
  UtensilsCrossed,
  LayoutGrid,
  ShoppingCart,
  FolderOpen,
  Package,
  Users,
  MapPinned,
} from "lucide-react";
import type { PosView, StaffRole } from "../_lib/types.ts";
import { canAccessView } from "../_lib/plan-features.ts";
import { posTablesIndexedDbKey } from "@/lib/supabase-pos/cache-keys.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";

type PosHomeViewProps = {
  activation: ActivationData;
  plan: string;
  onNavigate: (view: PosView) => void;
  staffRole: StaffRole;
};

export default function PosHomeView({
  activation,
  plan,
  onNavigate,
  staffRole,
}: PosHomeViewProps) {
  const { t } = usePosLocale();
  const isOnline = useOnlineStatus();
  const categoriesQuery = useQuery('pos.menu.getCategories', {
    licenseKey: activation.licenseKey,
  });
  const itemsQuery = useQuery('pos.menu.getAllItems', {
    licenseKey: activation.licenseKey,
  });
  const tablesQuery = useQuery('pos.tables.getTables', {
    licenseKey: activation.licenseKey,
  });

  const { data: categoriesRaw, isHydrated: catH } = useOfflineData<
    Doc<"menuCategories">[]
  >(`categories:${activation.licenseKey}`, categoriesQuery, isOnline);
  const { data: itemsRaw, isHydrated: itemsH } = useOfflineData<
    Doc<"menuItems">[]
  >(`menuItems:${activation.licenseKey}`, itemsQuery, isOnline);
  const { data: tablesRaw, isHydrated: tablesH } = useOfflineData<
    Doc<"tables">[]
  >(posTablesIndexedDbKey(activation.licenseKey), tablesQuery, isOnline);

  const categories = categoriesRaw ?? [];
  const items = itemsRaw ?? [];
  const tables = tablesRaw ?? [];

  const isLoading = !catH || !itemsH || !tablesH;

  const availableTables = tables.filter((t) => t.status === "available").length;
  const availableItems = items.filter((i) => i.available).length;

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {activation.businessName}
        </h1>
        <p className="text-[#8b93a7] text-sm mt-1">{t("home.subtitle")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-[#131A2E]" />
          ))
        ) : (
          <>
            <StatCard
              icon={FolderOpen}
              label={t("home.categories")}
              value={categories.length}
              color="#0066FF"
            />
            <StatCard
              icon={Package}
              label={t("home.menu_items")}
              value={availableItems}
              color="#44CC00"
            />
            <StatCard
              icon={LayoutGrid}
              label={t("home.total_tables")}
              value={tables.length}
              color="#FF6B00"
            />
            <StatCard
              icon={Users}
              label={t("home.available_tables")}
              value={availableTables}
              color="#00C2FF"
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          {t("home.quick_actions")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(staffRole === "admin" || staffRole === "manager") && (
            <>
              {canAccessView(plan, "floor") && (
                <ActionCard
                  icon={MapPinned}
                  title={t("home.action_floor")}
                  description={t("home.action_floor_desc")}
                  color="#00C2FF"
                  onClick={() => onNavigate("floor")}
                />
              )}
              {canAccessView(plan, "menu") && (
                <ActionCard
                  icon={UtensilsCrossed}
                  title={t("home.action_menu")}
                  description={t("home.action_menu_desc")}
                  color="#0066FF"
                  onClick={() => onNavigate("menu")}
                />
              )}
              {canAccessView(plan, "tables") && (
                <ActionCard
                  icon={LayoutGrid}
                  title={t("home.action_tables")}
                  description={t("home.action_tables_desc")}
                  color="#44CC00"
                  onClick={() => onNavigate("tables")}
                />
              )}
              {canAccessView(plan, "staff") && (
                <ActionCard
                  icon={Users}
                  title={t("home.action_staff")}
                  description={t("home.action_staff_desc")}
                  color="#FF6B00"
                  onClick={() => onNavigate("staff")}
                />
              )}
            </>
          )}
          {staffRole === "waiter" && canAccessView(plan, "floor") && (
            <ActionCard
              icon={MapPinned}
              title={t("home.action_floor_waiter")}
              description={t("home.action_floor_waiter_desc")}
              color="#00C2FF"
              onClick={() => onNavigate("floor")}
            />
          )}
          {staffRole !== "inventory" && canAccessView(plan, "floor") && (
            <ActionCard
              icon={ShoppingCart}
              title={t("home.action_orders")}
              description={t("home.action_orders_desc")}
              color="#FF6B00"
              onClick={() => onNavigate("floor")}
            />
          )}
        </div>
      </div>

      {/* Tables overview */}
      {!isLoading && tables.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            {t("home.table_status")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {tables.map((table) => (
              <div
                key={table._id}
                className={cn(
                  "rounded-xl border p-4 text-center",
                  table.status === "available"
                    ? "border-emerald-800/40 bg-emerald-950/20"
                    : table.status === "occupied"
                      ? "border-red-800/40 bg-red-950/20"
                      : table.status === "bill-printed"
                        ? "border-blue-800/40 bg-blue-950/20"
                        : "border-amber-800/40 bg-amber-950/20"
                )}
              >
                <p className="text-white font-semibold text-lg">{table.name}</p>
                <p className="text-[#8b93a7] text-xs mt-1">
                  {t("home.seats", { count: table.seats })}
                </p>
                <span
                  className={cn(
                    "inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider",
                    table.status === "available"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : table.status === "occupied"
                        ? "bg-red-500/20 text-red-400"
                        : table.status === "bill-printed"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-amber-500/20 text-amber-400"
                  )}
                >
                  {table.status === "available"
                    ? t("floor.available")
                    : table.status === "occupied"
                      ? t("floor.occupied")
                      : table.status === "bill-printed"
                        ? t("floor.bill_printed")
                        : table.status === "reserved"
                          ? t("floor.reserved")
                          : table.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper Components ────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] p-4">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="size-5" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-[#5a6580]">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  color,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "text-left rounded-xl border border-[#1e2a45] bg-[#131A2E] p-5 transition-all group",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:border-[#2a3a5a] hover:shadow-lg cursor-pointer"
      )}
    >
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="size-5" style={{ color }} />
      </div>
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-[#5a6580]">{description}</p>
    </button>
  );
}
