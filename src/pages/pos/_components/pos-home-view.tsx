import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { ActivationData } from "@/lib/local-db.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
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

type PosHomeViewProps = {
  activation: ActivationData;
  onNavigate: (view: PosView) => void;
  staffRole: StaffRole;
};

export default function PosHomeView({
  activation,
  onNavigate,
  staffRole,
}: PosHomeViewProps) {
  const categories = useQuery(api.pos.menu.getCategories, {
    licenseKey: activation.licenseKey,
  });
  const items = useQuery(api.pos.menu.getAllItems, {
    licenseKey: activation.licenseKey,
  });
  const tables = useQuery(api.pos.tables.getTables, {
    licenseKey: activation.licenseKey,
  });

  const isLoading =
    categories === undefined || items === undefined || tables === undefined;

  const availableTables =
    tables?.filter((t) => t.status === "available").length ?? 0;
  const availableItems = items?.filter((i) => i.available).length ?? 0;

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {activation.businessName}
        </h1>
        <p className="text-[#8b93a7] text-sm mt-1">POS Dashboard</p>
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
              label="Categories"
              value={categories?.length ?? 0}
              color="#0066FF"
            />
            <StatCard
              icon={Package}
              label="Menu Items"
              value={availableItems}
              color="#44CC00"
            />
            <StatCard
              icon={LayoutGrid}
              label="Total Tables"
              value={tables?.length ?? 0}
              color="#FF6B00"
            />
            <StatCard
              icon={Users}
              label="Available"
              value={availableTables}
              color="#00C2FF"
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffRole === "admin" && (
            <>
              <ActionCard
                icon={MapPinned}
                title="Floor Plan"
                description="View and arrange your table layout"
                color="#00C2FF"
                onClick={() => onNavigate("floor")}
              />
              <ActionCard
                icon={UtensilsCrossed}
                title="Manage Menu"
                description="Add or edit categories and items"
                color="#0066FF"
                onClick={() => onNavigate("menu")}
              />
              <ActionCard
                icon={LayoutGrid}
                title="Manage Tables"
                description="Set up zones and table layout"
                color="#44CC00"
                onClick={() => onNavigate("tables")}
              />
              <ActionCard
                icon={Users}
                title="Manage Staff"
                description="Add or edit team members"
                color="#FF6B00"
                onClick={() => onNavigate("staff")}
              />
            </>
          )}
          {staffRole === "waiter" && (
            <ActionCard
              icon={MapPinned}
              title="View Floor"
              description="See table status and select a table"
              color="#00C2FF"
              onClick={() => onNavigate("floor")}
            />
          )}
          <ActionCard
            icon={ShoppingCart}
            title="Start Orders"
            description="Coming soon in a future update"
            color="#5a6580"
            onClick={() =>
              toast.info(
                "Orders & checkout coming soon in a future milestone!"
              )
            }
            disabled
          />
        </div>
      </div>

      {/* Tables overview */}
      {!isLoading && tables && tables.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Table Status
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
                  {table.seats} seats
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
                  {table.status === "bill-printed" ? "Bill Printed" : table.status}
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
