import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import {
  Plus,
  MapPinned,
  Pencil,
  Trash2,
  LogOut,
  DoorOpen,
  Wallet,
  UtensilsCrossed,
} from "lucide-react";
import type { TableStatus, TableShape } from "../_lib/types.ts";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { useOfflineData } from "@/hooks/use-offline-data.ts";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { uuidOrNull, staffIdsEqual } from "@/lib/supabase-pos/uuid.ts";
import { posQueryKey } from "@/lib/supabase-pos/pos-router.ts";
import { posTablesIndexedDbKey } from "@/lib/supabase-pos/cache-keys.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { nextFloorTableSlot } from "@/lib/pos-floor-layout.ts";
import ExpenseDialog from "./expense-dialog.tsx";
import StaffConsumptionDialog from "./staff-consumption-dialog.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

type TableOrderSummary = {
  staffId: string;
  staffName: string;
  total: number;
};

type WaiterInfo = {
  name: string;
  businessName: string;
  staffId?: string;
  licenseKey?: string;
  onLogout: () => void;
  onLogoClick?: () => void;
  role?: "admin" | "manager" | "waiter";
  canLogStaffConsumption?: boolean;
};

type FloorPlanProps = {
  licenseKey: string;
  isEditor: boolean;
  onTableSelect?: (tableId: Id<"tables">) => void;
  waiter?: WaiterInfo;
};

const STATUS_COLORS: Record<
  TableStatus,
  { bg: string; border: string; text: string }
> = {
  available: {
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/50",
    text: "text-emerald-400",
  },
  occupied: {
    bg: "bg-red-500/20",
    border: "border-red-500/50",
    text: "text-red-400",
  },
  reserved: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/50",
    text: "text-amber-400",
  },
  "bill-printed": {
    bg: "bg-blue-500/20",
    border: "border-blue-500/50",
    text: "text-blue-400",
  },
};

const GRID_SIZE = 20;
const FLOOR_WIDTH = 1200;
const FLOOR_HEIGHT = 800;

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export default function FloorPlan({ licenseKey, isEditor, onTableSelect, waiter }: FloorPlanProps) {
  const isWaiterFullScreen = !!waiter;

  if (isEditor) {
    return <FloorPlanEditor licenseKey={licenseKey} />;
  }

  return (
    <WaiterFloorView
      licenseKey={licenseKey}
      onTableSelect={onTableSelect}
      waiter={waiter}
      isWaiterFullScreen={isWaiterFullScreen}
    />
  );
}

// ═══════════════════════════════════════════════════════
// ── Floor Plan Editor with Room Tabs + Canvas ─────────
// ═══════════════════════════════════════════════════════

function FloorPlanEditor({ licenseKey }: { licenseKey: string }) {
  const { t } = usePosLocale();
  const isOnline = useOnlineStatus();
  const tablesQuery = useQuery('pos.tables.getTables', { licenseKey });
  const { data: tables } = useOfflineData<Doc<"tables">[]>(
    posTablesIndexedDbKey(licenseKey),
    tablesQuery,
    isOnline,
  );
  const [localTables, setLocalTables] = useState<Doc<"tables">[]>([]);
  const createTable = useMutation('pos.tables.createTable');
  const deleteTable = useMutation('pos.tables.deleteTable');
  const updateTable = useMutation('pos.tables.updateTable');
  const moveTable = useMutation('pos.tables.moveTable');
  const renameZoneMut = useMutation('pos.tables.renameZone');
  const deleteZoneMut = useMutation('pos.tables.deleteZone');

  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<Id<"tables"> | null>(null);

  // Dialogs
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [renameRoomOpen, setRenameRoomOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Doc<"tables"> | null>(null);

  // Drag state
  const [dragging, setDragging] = useState<{
    tableId: Id<"tables">;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const floorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tables) {
      setLocalTables(tables);
    }
  }, [tables]);

  const resolvedTables = localTables;
  const isLoading = false;
  const zones = [...new Set(resolvedTables.map((t) => t.zone))].sort();

  // Helper: get canvas bounds from the DOM directly
  const getCanvasBounds = useCallback(() => {
    const rect = floorRef.current?.getBoundingClientRect();
    return { w: rect?.width ?? 2000, h: rect?.height ?? 800 };
  }, []);

  // Auto-select first zone
  useEffect(() => {
    if (zones.length > 0 && (activeZone === null || !zones.includes(activeZone))) {
      setActiveZone(zones[0]);
    }
  }, [zones.join(","), activeZone]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayTables = activeZone
    ? resolvedTables.filter((t) => t.zone === activeZone)
    : [];

  // ── Drag handlers ─────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, table: Doc<"tables">) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelectedTable(table._id);

      const rect = floorRef.current?.getBoundingClientRect();
      if (!rect) return;

      setDragging({
        tableId: table._id,
        startX: e.clientX,
        startY: e.clientY,
        origX: table.posX ?? 100,
        origY: table.posY ?? 100,
      });
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      e.preventDefault();

      const bounds = getCanvasBounds();
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;

      const newX = snapToGrid(Math.max(0, Math.min(bounds.w - 80, dragging.origX + dx)));
      const newY = snapToGrid(Math.max(0, Math.min(bounds.h - 80, dragging.origY + dy)));

      const el = document.getElementById(`table-${dragging.tableId}`);
      if (el) {
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
      }
    },
    [dragging, getCanvasBounds],
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (!dragging) return;

      const bounds = getCanvasBounds();
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;

      const newX = snapToGrid(Math.max(0, Math.min(bounds.w - 80, dragging.origX + dx)));
      const newY = snapToGrid(Math.max(0, Math.min(bounds.h - 80, dragging.origY + dy)));

      setDragging(null);

      if (newX !== dragging.origX || newY !== dragging.origY) {
        try {
          await moveTable({ licenseKey, tableId: dragging.tableId, posX: newX, posY: newY });
          setLocalTables((prev) =>
            prev.map((t) =>
              t._id === dragging.tableId ? { ...t, posX: newX, posY: newY } : t,
            ),
          );
          const cached = (await getDataCache<Doc<"tables">[]>(posTablesIndexedDbKey(licenseKey))) ?? [];
          await saveDataCache(
            posTablesIndexedDbKey(licenseKey),
            cached.map((t) =>
              t._id === dragging.tableId ? { ...t, posX: newX, posY: newY } : t,
            ),
          );
        } catch {
          toast.error("Failed to move table");
        }
      }
    },
    [dragging, getCanvasBounds, licenseKey, moveTable],
  );

  // ── Room actions ──────────────────────────────────────

  const handleAddRoom = () => {
    const roomName = newRoomName.trim();
    if (!roomName) {
      toast.error("Enter a room name");
      return;
    }
    if (zones.some((z) => z.toLowerCase() === roomName.toLowerCase())) {
      toast.error("Room already exists");
      return;
    }
    const firstSlot = nextFloorTableSlot(0);
    createTable({
      licenseKey,
      seats: 4,
      zone: roomName,
      posX: firstSlot.posX,
      posY: firstSlot.posY,
    })
      .then((newId) => {
        if (typeof newId !== "string" || !newId) {
          toast.error("Failed to create room");
          return;
        }
        const newTable: Doc<"tables"> = {
          _id: newId as Id<"tables">,
          _creationTime: Date.now(),
          licenseKey,
          name: "T1",
          seats: 4,
          zone: roomName,
          status: "available",
          posX: firstSlot.posX,
          posY: firstSlot.posY,
          shape: "square",
          tableScale: 1,
        };
        setLocalTables((prev) => [...prev, newTable]);
        void getDataCache<Doc<"tables">[]>(posTablesIndexedDbKey(licenseKey)).then((cached) =>
          saveDataCache(posTablesIndexedDbKey(licenseKey), [...(cached ?? []), newTable]),
        );
        toast.success(`Room "${roomName}" created`);
        setActiveZone(roomName);
        setNewRoomName("");
        setAddRoomOpen(false);
      })
      .catch((e: unknown) => {
        console.error("[POS] create room:", e);
        toast.error(errorMessageFromUnknown(e, "Failed to create room"));
      });
  };

  const handleRenameRoom = async () => {
    if (!activeZone || !renameValue.trim() || renameValue.trim() === activeZone) {
      setRenameRoomOpen(false);
      return;
    }
    try {
      await renameZoneMut({ licenseKey, oldName: activeZone, newName: renameValue.trim() });
      const previousZone = activeZone;
      const nextZone = renameValue.trim();
      setLocalTables((prev) =>
        prev.map((t) => (t.zone === previousZone ? { ...t, zone: nextZone } : t)),
      );
      const cached = (await getDataCache<Doc<"tables">[]>(posTablesIndexedDbKey(licenseKey))) ?? [];
      await saveDataCache(
        posTablesIndexedDbKey(licenseKey),
        cached.map((t) => (t.zone === previousZone ? { ...t, zone: nextZone } : t)),
      );
      setActiveZone(renameValue.trim());
      toast.success("Room renamed");
      setRenameRoomOpen(false);
    } catch {
      toast.error("Failed to rename room");
    }
  };

  const handleDeleteRoom = async () => {
    if (!activeZone) return;
    const count = displayTables.length;
    if (!window.confirm(`Delete room "${activeZone}" and its ${count} table${count !== 1 ? "s" : ""}?`)) return;
    try {
      await deleteZoneMut({ licenseKey, zone: activeZone });
      setLocalTables((prev) => prev.filter((t) => t.zone !== activeZone));
      const cached = (await getDataCache<Doc<"tables">[]>(posTablesIndexedDbKey(licenseKey))) ?? [];
      await saveDataCache(
        posTablesIndexedDbKey(licenseKey),
        cached.filter((t) => t.zone !== activeZone),
      );
      setActiveZone(null);
      toast.success("Room deleted");
    } catch {
      toast.error("Failed to delete room");
    }
  };

  // ── Table actions ─────────────────────────────────────

  const handleAddTable = async () => {
    if (!activeZone) return;
    const zoneName = activeZone;
    const tablesInZone = resolvedTables.filter((t) => t.zone === zoneName);
    const zoneCount = tablesInZone.length + 1;
    const slot = nextFloorTableSlot(tablesInZone.length);
    try {
      const newId = await createTable({
        licenseKey,
        seats: 4,
        zone: zoneName,
        posX: slot.posX,
        posY: slot.posY,
      });
      if (typeof newId !== "string" || !newId) {
        toast.error("Failed to add table");
        return;
      }
      const newTable: Doc<"tables"> = {
        _id: newId as Id<"tables">,
        _creationTime: Date.now(),
        licenseKey,
        name: `T${zoneCount}`,
        seats: 4,
        zone: zoneName,
        status: "available",
        posX: slot.posX,
        posY: slot.posY,
        shape: "square",
        tableScale: 1,
      };
      const nextTables = [...resolvedTables, newTable];
      setLocalTables(nextTables);
      await saveDataCache(posTablesIndexedDbKey(licenseKey), nextTables);
      toast.success("Table added");
    } catch (e: unknown) {
      console.error("[POS] add table:", e);
      toast.error(errorMessageFromUnknown(e, "Failed to add table"));
    }
  };

  const handleDeleteTable = async () => {
    if (!selectedTable) return;
    const t = displayTables.find((tbl) => tbl._id === selectedTable);
    if (!t) return;
    try {
      await deleteTable({ licenseKey, tableId: selectedTable });
      setLocalTables((prev) => prev.filter((tbl) => tbl._id !== selectedTable));
      const cached = (await getDataCache<Doc<"tables">[]>(posTablesIndexedDbKey(licenseKey))) ?? [];
      await saveDataCache(
        posTablesIndexedDbKey(licenseKey),
        cached.filter((tbl) => tbl._id !== selectedTable),
      );
      setSelectedTable(null);
      toast.success(`${t.name} removed`);
    } catch {
      toast.error("Failed to remove table");
    }
  };

  const handleEditTable = () => {
    if (!selectedTable) return;
    const t = resolvedTables.find((tbl) => tbl._id === selectedTable);
    if (t) {
      setEditingTable(t);
      setEditDialogOpen(true);
    }
  };

  const selectedTableData = selectedTable ? displayTables.find((t) => t._id === selectedTable) : null;

  // ── Loading ───────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <Skeleton className="h-10 w-64 bg-[#131A2E]" />
        <Skeleton className="h-[500px] rounded-xl bg-[#131A2E]" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col p-4 gap-3 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPinned className="size-6" />
            {t("floor.editor_title")}
          </h1>
          <p className="text-[#8b93a7] text-sm mt-1">
            {t("floor.editor_subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeZone && (
            <Button size="sm" onClick={handleAddTable}>
              <Plus className="size-4 mr-1" />
              {t("floor.add_table")}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setAddRoomOpen(true)}>
            <DoorOpen className="size-4 mr-1" />
            {t("floor.add_room")}
          </Button>
        </div>
      </div>

      {/* Room tabs */}
      {zones.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {zones.map((zone) => {
            const count = resolvedTables.filter((t) => t.zone === zone).length;
            const isActive = activeZone === zone;
            return (
              <button
                key={zone}
                onClick={() => { setActiveZone(zone); setSelectedTable(null); }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer",
                  isActive
                    ? "bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/25"
                    : "bg-[#131A2E] text-[#8b93a7] hover:bg-[#1e2a45] hover:text-white border border-[#1e2a45]",
                )}
              >
                {zone}
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                  isActive ? "bg-white/20" : "bg-[#1e2a45]",
                )}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* Room edit actions */}
          {activeZone && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[#1e2a45]">
              <button
                onClick={() => { setRenameValue(activeZone); setRenameRoomOpen(true); }}
                className="p-2 rounded-lg text-[#5a6580] hover:text-[#0066FF] hover:bg-[#0066FF]/10 transition-colors cursor-pointer"
                title={t("floor.rename_room")}
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={handleDeleteRoom}
                className="p-2 rounded-lg text-[#5a6580] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                title={t("floor.delete_room")}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty — no rooms */}
      {zones.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><DoorOpen /></EmptyMedia>
              <EmptyTitle>{t("floor.no_rooms_title")}</EmptyTitle>
              <EmptyDescription>{t("floor.no_rooms_desc")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={() => setAddRoomOpen(true)}>
                <Plus className="size-4 mr-1" />
                {t("floor.add_room")}
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      )}

      {/* Empty — room has no tables */}
      {activeZone && displayTables.length === 0 && zones.length > 0 && (
        <div className="flex-1 flex items-center justify-center">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><MapPinned /></EmptyMedia>
              <EmptyTitle>
                {t("floor.no_tables_in_zone", { zone: activeZone })}
              </EmptyTitle>
              <EmptyDescription>{t("floor.add_table_to_room")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={handleAddTable}>
                <Plus className="size-4 mr-1" />
                {t("floor.add_table")}
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      )}

      {/* Canvas */}
      {activeZone && displayTables.length > 0 && (
        <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-[#1e2a45] bg-[#0D1326]">
          <div
            ref={floorRef}
            className="relative select-none w-full h-full"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={() => setSelectedTable(null)}
          >
            {displayTables.map((table) => {
              const config = STATUS_COLORS[table.status as TableStatus] ?? STATUS_COLORS.available;
              const isSelected = selectedTable === table._id;
              const isDraggingThis = dragging?.tableId === table._id;

              const tableShape = table.shape ?? "square";
              const tablePosX = table.posX ?? 100;
              const tablePosY = table.posY ?? 100;
              const scale = table.tableScale ?? 1;
              const baseWidth = tableShape === "rectangle" ? 120 : 80;
              const baseHeight = 80;
              const tableWidth = baseWidth * scale;
              const tableHeight = baseHeight * scale;

              return (
                <div
                  key={table._id}
                  id={`table-${table._id}`}
                  className={cn(
                    "absolute flex flex-col items-center justify-center border-2 transition-shadow cursor-grab active:cursor-grabbing",
                    config.bg,
                    config.border,
                    tableShape === "circle" ? "rounded-full" : "rounded-xl",
                    isSelected && "ring-2 ring-white/40 shadow-lg",
                    isDraggingThis && "opacity-80 z-50",
                  )}
                  style={{
                    left: tablePosX,
                    top: tablePosY,
                    width: tableWidth,
                    height: tableHeight,
                  }}
                  onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, table); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="font-bold text-white text-sm">{table.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected table actions bar */}
      {selectedTableData && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#131A2E] border border-[#1e2a45]">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {selectedTableData.name}
            </p>
            <p className="text-xs text-[#5a6580]">
              {t("home.seats", { count: selectedTableData.seats })} ·{" "}
              {selectedTableData.zone}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleEditTable}>
              <Pencil className="size-3.5 mr-1" />
              {t("btn.edit")}
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDeleteTable}>
              <Trash2 className="size-3.5 mr-1" />
              {t("btn.delete")}
            </Button>
          </div>
        </div>
      )}

      {/* ── Dialogs ──────────────────────────────────────── */}

      {/* Add Room */}
      <Sheet open={addRoomOpen} onOpenChange={setAddRoomOpen}>
        <SheetContent
          side="right"
          className="w-full border-l border-slate-200 bg-white p-0 text-slate-900 sm:max-w-md"
        >
          <SheetHeader className="border-b border-slate-200 bg-slate-50 pb-4">
            <SheetTitle className="text-slate-900">New Room</SheetTitle>
            <SheetDescription className="text-slate-500">
              Create a new room/zone for floor tables.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 p-4">
            <Input
              autoFocus
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddRoom(); }}
              placeholder="e.g., Main Floor, VIP Room, Terrace"
              className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-500/70"
            />
            <p className="text-xs text-slate-500">
              A first table will be auto-created in the new room.
            </p>
          </div>
          <SheetFooter className="border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setAddRoomOpen(false)}
              className="rounded-xl text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddRoom}
              className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Create Room
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Rename Room */}
      <Dialog open={renameRoomOpen} onOpenChange={setRenameRoomOpen}>
        <DialogContent className="bg-[#131A2E] border-[#1e2a45] text-white max-w-sm [&>button]:text-[#8b93a7]">
          <DialogHeader>
            <DialogTitle className="text-white">Rename Room</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRenameRoom(); }}
              className="bg-[#0A0F1E] border-[#1e2a45] text-white"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameRoomOpen(false)} className="text-[#8b93a7]">
              Cancel
            </Button>
            <Button onClick={handleRenameRoom}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Table */}
      <EditTableDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        table={editingTable}
        zones={zones}
        licenseKey={licenseKey}
        onSave={updateTable}
      />
    </div>
  );
}

// ── Edit Table Dialog ────────────────────────────────

function EditTableDialog({
  open,
  onOpenChange,
  table,
  zones,
  licenseKey,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: Doc<"tables"> | null;
  zones: string[];
  licenseKey: string;
  onSave: (args: {
    licenseKey: string;
    tableId: Id<"tables">;
    name: string;
    seats: number;
    zone: string;
    status: "available" | "occupied" | "reserved" | "bill-printed";
    shape: "square" | "circle" | "rectangle" | undefined;
    tableScale: number;
  }) => Promise<null | void>;
}) {
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("4");
  const [shape, setShape] = useState<TableShape>("square");
  const [zone, setZone] = useState("");
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && table) {
      setName(table.name);
      setSeats(table.seats.toString());
      setShape((table.shape ?? "square") as TableShape);
      setZone(table.zone);
      setScale(table.tableScale ?? 1);
    }
  }, [open, table]);

  const handleSubmit = async () => {
    if (!table) return;
    const seatsNum = parseInt(seats);
    if (isNaN(seatsNum) || seatsNum < 1) {
      toast.error("Enter a valid number of seats");
      return;
    }
    setSaving(true);
    try {
      const nextName = name.trim() || table.name;
      await onSave({
        licenseKey,
        tableId: table._id,
        name: nextName,
        seats: seatsNum,
        zone,
        status: table.status as "available" | "occupied" | "reserved" | "bill-printed",
        shape,
        tableScale: scale,
      });
      const cached = (await getDataCache<Doc<"tables">[]>(posTablesIndexedDbKey(licenseKey))) ?? [];
      await saveDataCache(
        posTablesIndexedDbKey(licenseKey),
        cached.map((t) =>
          t._id === table._id
            ? {
                ...t,
                name: nextName,
                seats: seatsNum,
                zone,
                shape,
                tableScale: scale,
              }
            : t,
        ),
      );
      toast.success("Table updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update table");
    } finally {
      setSaving(false);
    }
  };

  const SHAPE_OPTIONS: { value: TableShape; label: string }[] = [
    { value: "square", label: "Square" },
    { value: "circle", label: "Circle" },
    { value: "rectangle", label: "Rectangle" },
  ];

  const SCALE_OPTIONS = [
    { value: 0.75, label: "S" },
    { value: 1, label: "M" },
    { value: 1.25, label: "L" },
    { value: 1.5, label: "XL" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131A2E] border-[#1e2a45] text-white max-w-sm [&>button]:text-[#8b93a7]">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Table</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-[#8b93a7] text-xs uppercase tracking-wider">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-[#0A0F1E] border-[#1e2a45] text-white" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[#8b93a7] text-xs uppercase tracking-wider">Seats</label>
            <Input type="number" min="1" value={seats} onChange={(e) => setSeats(e.target.value)} className="bg-[#0A0F1E] border-[#1e2a45] text-white" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[#8b93a7] text-xs uppercase tracking-wider">Shape</label>
            <div className="flex gap-2">
              {SHAPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setShape(opt.value)}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer",
                    shape === opt.value
                      ? "border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]"
                      : "border-[#1e2a45] bg-[#0A0F1E] text-[#8b93a7] hover:text-white",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[#8b93a7] text-xs uppercase tracking-wider">Size</label>
            <div className="flex gap-2">
              {SCALE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setScale(opt.value)}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer",
                    scale === opt.value
                      ? "border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]"
                      : "border-[#1e2a45] bg-[#0A0F1E] text-[#8b93a7] hover:text-white",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {zones.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-[#8b93a7] text-xs uppercase tracking-wider">Room</label>
              <div className="flex flex-wrap gap-2">
                {zones.map((z) => (
                  <button
                    key={z}
                    onClick={() => setZone(z)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                      zone === z
                        ? "border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]"
                        : "border-[#1e2a45] bg-[#0A0F1E] text-[#8b93a7] hover:text-white",
                    )}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-[#8b93a7]">Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════
// ── Waiter Floor View ─────────────────────────────────
// ═══════════════════════════════════════════════════════

function WaiterFloorView({
  licenseKey,
  onTableSelect,
  waiter,
  isWaiterFullScreen,
}: {
  licenseKey: string;
  onTableSelect?: (tableId: Id<"tables">) => void;
  waiter?: WaiterInfo;
  isWaiterFullScreen: boolean;
}) {
  const { t, formatPrice } = usePosLocale();
  const isOnline = useOnlineStatus();
  const tablesQuery = useQuery('pos.tables.getTables', { licenseKey });
  const { data: tables } = useOfflineData<Doc<"tables">[]>(
    posTablesIndexedDbKey(licenseKey),
    tablesQuery,
    isOnline,
  );
  // Do not cache summaries in IndexedDB — an empty `{}` was sticking and kept all tables "Free"
  // while `getOrdersByTable` still saw open orders.
  const orderSummaries = useQuery("pos.tables.getTableOrderSummaries", {
    licenseKey,
  }) as Record<string, TableOrderSummary> | undefined;

  const [activeZone, setActiveZone] = useState<string | null>(null);

  const resolvedTables = tables ?? [];
  const isLoading = false;
  const zones = [...new Set(resolvedTables.map((t) => t.zone))].sort();

  useEffect(() => {
    if (isWaiterFullScreen && zones.length > 0 && activeZone === null) {
      setActiveZone(zones[0]);
    }
  }, [isWaiterFullScreen, zones, activeZone]);

  const displayTables = resolvedTables
    ? isWaiterFullScreen && activeZone
      ? resolvedTables.filter((t) => t.zone === activeZone)
      : resolvedTables
    : [];

  const currentStaffId = waiter?.staffId;
  const isAdminOrManager = waiter?.role === "admin" || waiter?.role === "manager";

  // Color config based on ownership
  const getTableColors = (table: Doc<"tables">) => {
    const status = table.status as TableStatus;
    const summary = orderSummaries?.[table._id];
    const hasOpenTicket = Boolean(summary);

    if (
      hasOpenTicket ||
      status === "occupied" ||
      status === "bill-printed"
    ) {
      if (summary && currentStaffId && staffIdsEqual(summary.staffId, currentStaffId)) {
        // My table — blue
        return {
          bg: "bg-blue-950/60",
          border: "border-blue-500",
          text: "text-blue-400",
        };
      }
      if (summary && !uuidOrNull(summary.staffId)) {
        // Order exists but no waiter on file (e.g. device admin) — any staff can open
        return {
          bg: "bg-amber-950/40",
          border: "border-amber-500/80",
          text: "text-amber-400",
        };
      }
      if (isAdminOrManager) {
        // Admin/manager can access any table — amber
        return {
          bg: "bg-amber-950/40",
          border: "border-amber-500/80",
          text: "text-amber-400",
        };
      }
      // Other waiter's table — red (blocked)
      return {
        bg: "bg-red-950/60",
        border: "border-red-500",
        text: "text-red-500",
      };
    }

    if (status === "reserved") {
      return {
        bg: "bg-amber-950/40",
        border: "border-amber-500/80",
        text: "text-amber-400",
      };
    }

    // Available — green (visible on dark floor)
    return {
      bg: "bg-emerald-500/15",
      border: "border-emerald-400",
      text: "text-emerald-400",
    };
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64 bg-[#131A2E]" />
        <Skeleton className="h-[500px] rounded-xl bg-[#131A2E]" />
      </div>
    );
  }

  if (resolvedTables.length === 0 && isWaiterFullScreen) {
    return (
      <div className="h-full flex flex-col p-3">
        {waiter && <WaiterTopBar waiter={waiter} />}
        <div className="flex-1 flex items-center justify-center">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><MapPinned /></EmptyMedia>
              <EmptyTitle>{t("floor.empty_waiter_title")}</EmptyTitle>
              <EmptyDescription>{t("floor.empty_waiter_desc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", isWaiterFullScreen ? "p-3 gap-3" : "p-6 lg:p-8 gap-4")}>
      {isWaiterFullScreen && waiter && (
        <>
          <WaiterTopBar waiter={waiter} />
          {zones.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {zones.map((zone) => {
                    const count = resolvedTables.filter((t) => t.zone === zone)
                      .length;
                const isActive = activeZone === zone;
                return (
                  <button
                    key={zone}
                    onClick={() => setActiveZone(zone)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer",
                      isActive
                        ? "bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/25"
                        : "bg-[#131A2E] text-[#8b93a7] hover:bg-[#1e2a45] hover:text-white border border-[#1e2a45]",
                    )}
                  >
                    {zone}
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center", isActive ? "bg-white/20" : "bg-[#1e2a45]")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="flex-1 overflow-hidden rounded-xl border border-[#1e2a45] bg-[#0D1326]">
        <div
          className="relative select-none w-full h-full"
        >
          {(() => {
            // Calculate the actual extent of all tables so percentages cover the full range
            let maxRight = FLOOR_WIDTH;
            let maxBottom = FLOOR_HEIGHT;
            for (const t of displayTables) {
              const px = t.posX ?? 100;
              const py = t.posY ?? 100;
              const s = t.tableScale ?? 1;
              const bw = (t.shape ?? "square") === "rectangle" ? 120 : 80;
              maxRight = Math.max(maxRight, px + bw * s + 20);
              maxBottom = Math.max(maxBottom, py + 80 * s + 20);
            }

            return displayTables.map((table) => {
              const colors = getTableColors(table);
              const tableShape = table.shape ?? "square";
              const tablePosX = table.posX ?? 100;
              const tablePosY = table.posY ?? 100;
              const scale = table.tableScale ?? 1;
              const leftPct = (tablePosX / maxRight) * 100;
              const topPct = (tablePosY / maxBottom) * 100;
              const baseWidth = tableShape === "rectangle" ? 120 : 80;
              const widthPct = ((baseWidth * scale) / maxRight) * 100;
              const heightPct = ((80 * scale) / maxBottom) * 100;
              const summary = orderSummaries?.[table._id];
              const hasOpenTicket = Boolean(summary);
              const isBusyByStatus =
                table.status === "occupied" ||
                table.status === "bill-printed";
              const isOccupied =
                hasOpenTicket || isBusyByStatus;
              const hasAssignedWaiter = Boolean(uuidOrNull(summary?.staffId));
              const isMyTable =
                Boolean(summary) &&
                Boolean(currentStaffId) &&
                hasAssignedWaiter &&
                staffIdsEqual(summary!.staffId, currentStaffId);
              const isOtherWaiterTable =
                Boolean(summary) &&
                hasAssignedWaiter &&
                Boolean(uuidOrNull(currentStaffId)) &&
                !staffIdsEqual(summary!.staffId, currentStaffId);
              const isBlockedTable = isOtherWaiterTable && !isAdminOrManager;

              const handleClick = () => {
                if (isBlockedTable) {
                  toast.error(
                    t("floor.table_taken_by", {
                      name:
                        summary?.staffName ?? t("floor.another_waiter"),
                    }),
                  );
                  return;
                }
                onTableSelect?.(table._id);
              };

              const showMine = isMyTable;
              const showOtherWaiter =
                Boolean(summary) && hasAssignedWaiter && !isMyTable;
              const showOpenUnassigned =
                Boolean(summary) && !hasAssignedWaiter;

              return (
                <div
                  key={table._id}
                  className={cn(
                    "absolute flex flex-col items-center justify-center border-2 transition-shadow px-1.5 py-2",
                    colors.bg,
                    colors.border,
                    tableShape === "circle" ? "rounded-full" : "rounded-xl",
                    isBlockedTable ? "cursor-not-allowed" : "cursor-pointer",
                  )}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                  onClick={handleClick}
                >
                  {/* Layout: table name (large white) → $ or Free (themed) → waiter / Mine (small white) */}
                  <div className="flex flex-col items-center justify-center text-center w-full min-h-0 gap-1">
                    <span className="text-base font-bold text-white leading-tight tracking-tight truncate max-w-full">
                      {table.name}
                    </span>
                    {summary ? (
                      <>
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            showMine && "text-blue-400",
                            showOtherWaiter &&
                              (isAdminOrManager
                                ? "text-amber-400"
                                : "text-red-500"),
                            showOpenUnassigned && "text-amber-400",
                          )}
                        >
                          {formatPrice(summary.total)}
                        </span>
                        <span className="text-[10px] font-medium text-white truncate max-w-full px-0.5">
                          {showMine
                            ? t("floor.mine")
                            : showOtherWaiter
                              ? summary.staffName
                              : t("floor.open_status")}
                        </span>
                      </>
                    ) : isBusyByStatus ? (
                      <span className="text-sm font-semibold text-red-400">
                        {t("floor.in_use_short")}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          colors.text,
                        )}
                      >
                        {(table.status as TableStatus) === "reserved"
                          ? t("floor.reserved")
                          : t("floor.available")}
                      </span>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}

// ── Waiter top bar ────────────────────────────────────

function WaiterTopBar({ waiter }: { waiter: WaiterInfo }) {
  const { t } = usePosLocale();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const isAdmin = waiter.role === "admin" || waiter.role === "manager";
  const nameColor = isAdmin ? "text-[#0066FF]" : "text-[#44CC00]";

  // Show consumption button for admins/managers or waiters with permission
  const showConsumption = isAdmin || !!waiter.canLogStaffConsumption;

  const logoElement = waiter.onLogoClick ? (
    <button onClick={waiter.onLogoClick} className="cursor-pointer shrink-0 hover:opacity-80 transition-opacity">
      <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-8 w-8" />
    </button>
  ) : (
    <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-8 w-8 shrink-0" />
  );

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#131A2E] border border-[#1e2a45]">
        {logoElement}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{waiter.businessName}</p>
          <p className={cn("text-[10px] font-medium", nameColor)}>{waiter.name}</p>
        </div>
        {showConsumption && waiter.staffId && waiter.licenseKey && (
          <button
            onClick={() => setConsumptionOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors text-xs font-medium cursor-pointer"
          >
            <UtensilsCrossed className="size-3.5" />
            {t("floor.toolbar_staff_meal")}
          </button>
        )}
        {waiter.staffId && waiter.licenseKey && waiter.role !== "admin" && waiter.role !== "manager" && (
          <button
            onClick={() => setExpenseOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors text-xs font-medium cursor-pointer"
          >
            <Wallet className="size-3.5" />
            {t("floor.toolbar_expenses")}
          </button>
        )}
        <button
          onClick={waiter.onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors text-xs font-medium cursor-pointer"
        >
          <LogOut className="size-3.5" />
          {t("nav.logout")}
        </button>
      </div>

      {waiter.staffId && waiter.licenseKey && waiter.role !== "admin" && waiter.role !== "manager" && (
        <ExpenseDialog
          open={expenseOpen}
          onOpenChange={setExpenseOpen}
          licenseKey={waiter.licenseKey}
          staffId={waiter.staffId as Id<"staff">}
          staffName={waiter.name}
        />
      )}

      {showConsumption && waiter.staffId && waiter.licenseKey && (
        <StaffConsumptionDialog
          open={consumptionOpen}
          onOpenChange={setConsumptionOpen}
          licenseKey={waiter.licenseKey}
          loggedByStaffId={waiter.staffId as Id<"staff">}
          loggedByStaffName={waiter.name}
          targetStaffId={
            isAdmin ? undefined : (waiter.staffId as Id<"staff">)
          }
          targetStaffName={isAdmin ? undefined : waiter.name}
          selfServiceStaffMeal={!isAdmin}
        />
      )}
    </>
  );
}
