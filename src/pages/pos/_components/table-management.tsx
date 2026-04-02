import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  LayoutGrid,
  Users,
  MapPin,
} from "lucide-react";
import TableDialog from "./table-dialog.tsx";

type TableManagementProps = {
  licenseKey: string;
};

const STATUS_CONFIG = {
  available: {
    label: "Available",
    borderClass: "border-emerald-800/40",
    bgClass: "bg-emerald-950/20",
    badgeBg: "bg-emerald-500/20",
    badgeText: "text-emerald-400",
    dotColor: "#34d399",
  },
  occupied: {
    label: "Occupied",
    borderClass: "border-amber-800/40",
    bgClass: "bg-amber-950/20",
    badgeBg: "bg-amber-500/20",
    badgeText: "text-amber-400",
    dotColor: "#fbbf24",
  },
  reserved: {
    label: "Reserved",
    borderClass: "border-purple-800/40",
    bgClass: "bg-purple-950/20",
    badgeBg: "bg-purple-500/20",
    badgeText: "text-purple-400",
    dotColor: "#a78bfa",
  },
} as const;

export default function TableManagement({ licenseKey }: TableManagementProps) {
  const tables = useQuery(api.pos.tables.getTables, { licenseKey });
  const deleteTable = useMutation(api.pos.tables.deleteTable);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Doc<"tables"> | null>(null);
  const [activeZone, setActiveZone] = useState<string | null>(null);

  const isLoading = tables === undefined;

  // Derive zones and grouped tables
  const { zones, grouped, stats } = useMemo(() => {
    if (!tables) return { zones: [] as string[], grouped: {} as Record<string, Doc<"tables">[]>, stats: { total: 0, available: 0, occupied: 0, reserved: 0 } };

    const zoneSet = new Set<string>();
    const groupMap: Record<string, Doc<"tables">[]> = {};
    let available = 0;
    let occupied = 0;
    let reserved = 0;

    for (const t of tables) {
      zoneSet.add(t.zone);
      if (!groupMap[t.zone]) groupMap[t.zone] = [];
      groupMap[t.zone].push(t);
      if (t.status === "available") available++;
      else if (t.status === "occupied") occupied++;
      else reserved++;
    }

    const sortedZones = Array.from(zoneSet).sort();

    return {
      zones: sortedZones,
      grouped: groupMap,
      stats: { total: tables.length, available, occupied, reserved },
    };
  }, [tables]);

  const visibleZones = activeZone ? [activeZone] : zones;

  const handleDelete = async (tableId: Id<"tables">) => {
    if (!window.confirm("Delete this table?")) return;
    try {
      await deleteTable({ licenseKey, tableId });
      toast.success("Table deleted");
    } catch {
      toast.error("Failed to delete table");
    }
  };

  // ── Loading ───────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-64 bg-[#131A2E]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-[#131A2E]" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl bg-[#131A2E]" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────
  if (tables.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <Header
          onAdd={() => {
            setEditingTable(null);
            setDialogOpen(true);
          }}
        />
        <div className="mt-16">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayoutGrid />
              </EmptyMedia>
              <EmptyTitle>No tables yet</EmptyTitle>
              <EmptyDescription>
                Add your first table to start managing your floor layout
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                size="sm"
                onClick={() => {
                  setEditingTable(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4 mr-1" />
                Add Table
              </Button>
            </EmptyContent>
          </Empty>
        </div>

        <TableDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          licenseKey={licenseKey}
          zones={zones}
          editing={editingTable}
        />
      </div>
    );
  }

  // ── Main View ─────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Header
        onAdd={() => {
          setEditingTable(null);
          setDialogOpen(true);
        }}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Total" value={stats.total} color="#0066FF" />
        <MiniStat label="Available" value={stats.available} color="#34d399" />
        <MiniStat label="Occupied" value={stats.occupied} color="#fbbf24" />
        <MiniStat label="Reserved" value={stats.reserved} color="#a78bfa" />
      </div>

      {/* Zone Filters */}
      {zones.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveZone(null)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer",
              activeZone === null
                ? "bg-[#0066FF] text-white"
                : "bg-[#131A2E] text-[#8b93a7] hover:text-white border border-[#1e2a45]"
            )}
          >
            All Zones
          </button>
          {zones.map((z) => (
            <button
              key={z}
              onClick={() => setActiveZone(z)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer",
                activeZone === z
                  ? "bg-[#0066FF] text-white"
                  : "bg-[#131A2E] text-[#8b93a7] hover:text-white border border-[#1e2a45]"
              )}
            >
              <MapPin className="size-3 inline mr-1" />
              {z}
            </button>
          ))}
        </div>
      )}

      {/* Tables by Zone */}
      {visibleZones.map((zoneName) => {
        const zoneTables = grouped[zoneName] ?? [];
        return (
          <div key={zoneName}>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="size-4 text-[#5a6580]" />
              <h2 className="text-base font-semibold text-white">
                {zoneName}
              </h2>
              <span className="text-xs text-[#5a6580]">
                ({zoneTables.length} table{zoneTables.length !== 1 ? "s" : ""})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {zoneTables.map((table) => {
                const config = STATUS_CONFIG[table.status];
                return (
                  <div
                    key={table._id}
                    className={cn(
                      "rounded-xl border p-4 transition-all group hover:shadow-lg",
                      config.borderClass,
                      config.bgClass
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-white font-bold text-lg">
                        {table.name}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider",
                          config.badgeBg,
                          config.badgeText
                        )}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: config.dotColor }}
                        />
                        {config.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[#8b93a7] text-xs mt-2">
                      <Users className="size-3" />
                      {table.seats} seat{table.seats !== 1 ? "s" : ""}
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingTable(table);
                          setDialogOpen(true);
                        }}
                        className="flex items-center gap-1 text-xs text-[#5a6580] hover:text-white transition-colors cursor-pointer"
                      >
                        <Pencil className="size-3" />
                        Edit
                      </button>
                      <span className="text-white/10">|</span>
                      <button
                        onClick={() => handleDelete(table._id)}
                        className="flex items-center gap-1 text-xs text-[#5a6580] hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Dialog */}
      <TableDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        licenseKey={licenseKey}
        zones={zones}
        editing={editingTable}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function Header({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <LayoutGrid className="size-6" />
          Table Management
        </h1>
        <p className="text-[#8b93a7] text-sm mt-1">
          Manage your floor plan and seating
        </p>
      </div>
      <Button size="sm" onClick={onAdd}>
        <Plus className="size-4 mr-1" />
        New Table
      </Button>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] p-3 flex items-center gap-3">
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-[10px] text-[#5a6580] uppercase tracking-wider">
          {label}
        </p>
      </div>
    </div>
  );
}
