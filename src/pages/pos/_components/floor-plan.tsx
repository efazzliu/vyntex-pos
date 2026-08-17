import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Slider } from "@/components/ui/slider.tsx";
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
  UtensilsCrossed,
  Menu,
} from "lucide-react";
import type { TableStatus, TableShape } from "../_lib/types.ts";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { useOfflineData } from "@/hooks/use-offline-data.ts";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { uuidOrNull, staffIdsEqual } from "@/lib/supabase-pos/uuid.ts";
import { posQueryKey } from "@/lib/supabase-pos/pos-router.ts";
import { posTablesIndexedDbKey } from "@/lib/supabase-pos/cache-keys.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { nextFloorTableSlot, tableFootprint, zoneContentBox, clampTableScale, tableScaleXY, TABLE_SCALE_MIN, TABLE_SCALE_MAX } from "@/lib/pos-floor-layout.ts";
import ExpenseDialog from "./expense-dialog.tsx";
import StaffConsumptionDialog from "./staff-consumption-dialog.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
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
  const editBackupRef = useRef<Doc<"tables"> | null>(null);

  // Drag state
  const [dragging, setDragging] = useState<{
    tableId: Id<"tables">;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [resizing, setResizing] = useState<{
    tableId: Id<"tables">;
    startX: number;
    startY: number;
    origScaleX: number;
    origScaleY: number;
    shape: string;
  } | null>(null);

  const floorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editDialogOpen) return;
    if (tables) {
      setLocalTables(tables);
    }
    // Skip while Edit Table is open so a refetch does not wipe live size preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables]);

  const resolvedTables = localTables;
  const isLoading = false;
  const zones = [...new Set(resolvedTables.map((t) => t.zone))].sort();

  // Auto-select first zone
  useEffect(() => {
    if (zones.length > 0 && (activeZone === null || !zones.includes(activeZone))) {
      setActiveZone(zones[0]);
    }
  }, [zones.join(","), activeZone]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayTables = activeZone
    ? resolvedTables.filter((t) => t.zone === activeZone)
    : [];

  const zoneBox = zoneContentBox(displayTables);

  // ── Drag handlers ─────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, table: Doc<"tables">) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelectedTable(table._id);
      setResizing(null);

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

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, table: Doc<"tables">) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelectedTable(table._id);
      setDragging(null);
      const { x, y } = tableScaleXY(table);
      setResizing({
        tableId: table._id,
        startX: e.clientX,
        startY: e.clientY,
        origScaleX: x,
        origScaleY: y,
        shape: table.shape ?? "square",
      });
    },
    [],
  );

  const applyLiveScale = (
    tableId: Id<"tables">,
    shape: string,
    nextScaleX: number,
    nextScaleY: number,
  ) => {
    const el = document.getElementById(`table-${tableId}`);
    if (!el) return;
    const { w, h } = tableFootprint(shape, nextScaleX, nextScaleY);
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (resizing) {
        e.preventDefault();
        const { w: baseW, h: baseH } = tableFootprint(resizing.shape, 1, 1);
        const origW = baseW * resizing.origScaleX;
        const origH = baseH * resizing.origScaleY;
        const dx = e.clientX - resizing.startX;
        const dy = e.clientY - resizing.startY;
        const nextX = clampTableScale((origW + dx) / baseW);
        const nextY = clampTableScale((origH + dy) / baseH);
        applyLiveScale(resizing.tableId, resizing.shape, nextX, nextY);
        return;
      }
      if (!dragging) return;
      e.preventDefault();

      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;

      const newX = snapToGrid(
        Math.max(0, Math.min(zoneBox.width - 80, dragging.origX - zoneBox.minX + dx)),
      );
      const newY = snapToGrid(
        Math.max(0, Math.min(zoneBox.height - 80, dragging.origY - zoneBox.minY + dy)),
      );

      const el = document.getElementById(`table-${dragging.tableId}`);
      if (el) {
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
      }
    },
    [dragging, resizing, zoneBox.height, zoneBox.minX, zoneBox.minY, zoneBox.width],
  );

  const persistTablePatch = useCallback(
    async (tableId: Id<"tables">, patch: Partial<Doc<"tables">>) => {
      setLocalTables((prev) =>
        prev.map((t) => (t._id === tableId ? { ...t, ...patch } : t)),
      );
      const cached =
        (await getDataCache<Doc<"tables">[]>(posTablesIndexedDbKey(licenseKey))) ?? [];
      await saveDataCache(
        posTablesIndexedDbKey(licenseKey),
        cached.map((t) => (t._id === tableId ? { ...t, ...patch } : t)),
      );
    },
    [licenseKey],
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (resizing) {
        const { w: baseW, h: baseH } = tableFootprint(resizing.shape, 1, 1);
        const origW = baseW * resizing.origScaleX;
        const origH = baseH * resizing.origScaleY;
        const dx = e.clientX - resizing.startX;
        const dy = e.clientY - resizing.startY;
        const nextX = clampTableScale((origW + dx) / baseW);
        const nextY = clampTableScale((origH + dy) / baseH);
        const tableId = resizing.tableId;
        const origX = resizing.origScaleX;
        const origY = resizing.origScaleY;
        const shape = resizing.shape;
        setResizing(null);
        if (nextX === origX && nextY === origY) return;
        try {
          await updateTable({
            licenseKey,
            tableId,
            tableScale: nextX,
            tableScaleY: nextY,
          });
          await persistTablePatch(tableId, { tableScale: nextX, tableScaleY: nextY });
        } catch {
          applyLiveScale(tableId, shape, origX, origY);
          toast.error("Failed to resize table");
        }
        return;
      }

      if (!dragging) return;

      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;

      const newX = snapToGrid(
        Math.max(0, Math.min(zoneBox.width - 80, dragging.origX - zoneBox.minX + dx)),
      );
      const newY = snapToGrid(
        Math.max(0, Math.min(zoneBox.height - 80, dragging.origY - zoneBox.minY + dy)),
      );

      const newAbsX = newX + zoneBox.minX;
      const newAbsY = newY + zoneBox.minY;

      setDragging(null);

      if (newAbsX !== dragging.origX || newAbsY !== dragging.origY) {
        try {
          await moveTable({
            licenseKey,
            tableId: dragging.tableId,
            posX: newAbsX,
            posY: newAbsY,
          });
          await persistTablePatch(dragging.tableId, { posX: newAbsX, posY: newAbsY });
        } catch {
          toast.error("Failed to move table");
        }
      }
    },
    [
      dragging,
      licenseKey,
      moveTable,
      persistTablePatch,
      resizing,
      updateTable,
      zoneBox.height,
      zoneBox.minX,
      zoneBox.minY,
      zoneBox.width,
    ],
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
          tableScaleY: 1,
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
        tableScaleY: 1,
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
      editBackupRef.current = { ...t };
      setEditingTable(t);
      setEditDialogOpen(true);
    }
  };

  const handleEditOpenChange = (open: boolean) => {
    if (!open && editBackupRef.current) {
      const snap = editBackupRef.current;
      setLocalTables((prev) => prev.map((x) => (x._id === snap._id ? snap : x)));
      editBackupRef.current = null;
    }
    if (!open) setEditingTable(null);
    setEditDialogOpen(open);
  };

  const handleEditLiveChange = useCallback(
    (tableId: Id<"tables">, patch: Partial<Doc<"tables">>) => {
      setLocalTables((prev) =>
        prev.map((x) => (x._id === tableId ? { ...x, ...patch } : x)),
      );
    },
    [],
  );

  const handleEditSaved = useCallback(
    async (tableId: Id<"tables">, patch: Partial<Doc<"tables">>) => {
      editBackupRef.current = null;
      await persistTablePatch(tableId, patch);
    },
    [persistTablePatch],
  );

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
        <div
          ref={floorRef}
          className="flex-1 min-h-0 overflow-hidden rounded-xl border border-[#1e2a45] bg-[#0D1326] relative select-none w-full"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => setSelectedTable(null)}
        >
          <div
            className="relative"
            style={{ width: zoneBox.width, height: zoneBox.height }}
          >
            {displayTables.map((table) => {
              const config = STATUS_COLORS[table.status as TableStatus] ?? STATUS_COLORS.available;
              const isSelected = selectedTable === table._id;
              const isDraggingThis = dragging?.tableId === table._id;
              const isResizingThis = resizing?.tableId === table._id;

              const tableShape = table.shape ?? "square";
              const { x: scaleX, y: scaleY } = tableScaleXY(table);
              const { w: tableWidth, h: tableHeight } = tableFootprint(
                tableShape,
                scaleX,
                scaleY,
              );
              const tablePosX = (table.posX ?? 100) - zoneBox.minX;
              const tablePosY = (table.posY ?? 100) - zoneBox.minY;

              return (
                <div
                  key={table._id}
                  id={`table-${table._id}`}
                  className={cn(
                    "absolute flex flex-col items-center justify-center border-2 transition-shadow cursor-grab active:cursor-grabbing",
                    config.bg,
                    config.border,
                    tableShape === "circle" ? "rounded-full" : "rounded-xl",
                    isSelected && "ring-2 ring-[#0066FF]/50 shadow-lg",
                    (isDraggingThis || isResizingThis) && "opacity-90 z-50",
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
                  {isSelected ? (
                    <button
                      type="button"
                      aria-label="Resize table"
                      className="absolute -right-1.5 -bottom-1.5 size-4 rounded-sm border-2 border-white bg-[#0066FF] shadow cursor-nwse-resize touch-none"
                      onPointerDown={(e) => handleResizePointerDown(e, table)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : null}
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
        onOpenChange={handleEditOpenChange}
        table={editingTable}
        zones={zones}
        licenseKey={licenseKey}
        onSave={updateTable}
        onLiveChange={handleEditLiveChange}
        onSaved={handleEditSaved}
      />
    </div>
  );
}

function ScaleAxisRow({
  label,
  scale,
  onChange,
  isLight,
}: {
  label: string;
  scale: number;
  onChange: (n: number) => void;
  isLight: boolean;
}) {
  const pct = Math.round(scale * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[11px] font-medium uppercase tracking-wider",
            isLight ? "text-slate-500" : "text-[#8b93a7]",
          )}
        >
          {label}
        </span>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={Math.round(TABLE_SCALE_MIN * 100)}
            max={Math.round(TABLE_SCALE_MAX * 100)}
            step={5}
            value={pct}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onChange(clampTableScale(n / 100));
            }}
            className={cn(
              "h-8 w-16 text-center tabular-nums",
              isLight
                ? "border-slate-300 bg-white text-slate-900"
                : "border-[#1e2a45] bg-[#0A0F1E] text-white",
            )}
          />
          <span
            className={cn(
              "text-xs",
              isLight ? "text-slate-500" : "text-[#8b93a7]",
            )}
          >
            %
          </span>
        </div>
      </div>
      <Slider
        min={TABLE_SCALE_MIN}
        max={TABLE_SCALE_MAX}
        step={0.05}
        value={[scale]}
        onValueChange={(v) => onChange(clampTableScale(v[0] ?? 1))}
      />
    </div>
  );
}

// ── Edit Table (right side panel) ────────────────────

function EditTableDialog({
  open,
  onOpenChange,
  table,
  zones,
  licenseKey,
  onSave,
  onLiveChange,
  onSaved,
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
    tableScaleY: number;
  }) => Promise<null | void>;
  onLiveChange: (tableId: Id<"tables">, patch: Partial<Doc<"tables">>) => void;
  onSaved: (tableId: Id<"tables">, patch: Partial<Doc<"tables">>) => Promise<void>;
}) {
  const { t } = usePosLocale();
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("4");
  const [shape, setShape] = useState<TableShape>("square");
  const [zone, setZone] = useState("");
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const [saving, setSaving] = useState(false);
  const { theme: posTheme } = usePosTheme();
  const isLight = posTheme === "light";

  useEffect(() => {
    if (!open || !table) return;
    setName(table.name);
    setSeats(table.seats.toString());
    setShape((table.shape ?? "square") as TableShape);
    setZone(table.zone);
    const { x, y } = tableScaleXY(table);
    setScaleX(x);
    setScaleY(y);
    // Snapshot fields when the sheet opens, not on every live canvas patch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, table?._id]);

  const previewSize = (nextX: number, nextY: number, nextShape: TableShape) => {
    if (!table) return;
    onLiveChange(table._id, {
      shape: nextShape,
      tableScale: clampTableScale(nextX),
      tableScaleY: clampTableScale(nextY),
    });
  };

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
      const nextScaleX = clampTableScale(scaleX);
      const nextScaleY = clampTableScale(scaleY);
      await onSave({
        licenseKey,
        tableId: table._id,
        name: nextName,
        seats: seatsNum,
        zone,
        status: table.status as "available" | "occupied" | "reserved" | "bill-printed",
        shape,
        tableScale: nextScaleX,
        tableScaleY: nextScaleY,
      });
      await onSaved(table._id, {
        name: nextName,
        seats: seatsNum,
        zone,
        shape,
        tableScale: nextScaleX,
        tableScaleY: nextScaleY,
      });
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

  const SCALE_PRESETS = [
    { value: 0.75, label: "S" },
    { value: 1, label: "M" },
    { value: 1.25, label: "L" },
    { value: 1.5, label: "XL" },
  ];
  const uniformPreset =
    Math.abs(scaleX - scaleY) < 0.001
      ? SCALE_PRESETS.find((opt) => Math.abs(scaleX - opt.value) < 0.001)?.value
      : undefined;

  const chipIdle = isLight
    ? "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
    : "border-[#1e2a45] bg-[#0A0F1E] text-[#8b93a7] hover:text-white";
  const chipActive = "border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full flex-col p-0 sm:max-w-md",
          isLight
            ? "border-l border-slate-200 bg-white text-slate-900 [&>button]:text-slate-500"
            : "border-l border-[#1e2a45] bg-[#131A2E] text-white [&>button]:text-[#8b93a7]",
        )}
      >
        <SheetHeader
          className={cn(
            "border-b px-4 pb-4 pt-6 text-left",
            isLight ? "border-slate-200 bg-slate-50" : "border-[#1e2a45]",
          )}
        >
          <SheetTitle className={isLight ? "text-slate-900" : "text-white"}>
            Edit Table
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <label
              className={cn(
                "text-xs uppercase tracking-wider",
                isLight ? "text-slate-500" : "text-[#8b93a7]",
              )}
            >
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={
                isLight
                  ? "border-slate-300 bg-white text-slate-900"
                  : "border-[#1e2a45] bg-[#0A0F1E] text-white"
              }
            />
          </div>

          <div className="space-y-1.5">
            <label
              className={cn(
                "text-xs uppercase tracking-wider",
                isLight ? "text-slate-500" : "text-[#8b93a7]",
              )}
            >
              Seats
            </label>
            <Input
              type="number"
              min="1"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className={
                isLight
                  ? "border-slate-300 bg-white text-slate-900"
                  : "border-[#1e2a45] bg-[#0A0F1E] text-white"
              }
            />
          </div>

          <div className="space-y-1.5">
            <label
              className={cn(
                "text-xs uppercase tracking-wider",
                isLight ? "text-slate-500" : "text-[#8b93a7]",
              )}
            >
              Shape
            </label>
            <div className="flex gap-2">
              {SHAPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setShape(opt.value);
                    previewSize(scaleX, scaleY, opt.value);
                  }}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer",
                    shape === opt.value ? chipActive : chipIdle,
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label
              className={cn(
                "text-xs uppercase tracking-wider",
                isLight ? "text-slate-500" : "text-[#8b93a7]",
              )}
            >
              Size
            </label>
            <ScaleAxisRow
              label={t("floor.size_width")}
              scale={scaleX}
              onChange={(n) => {
                setScaleX(n);
                previewSize(n, scaleY, shape);
              }}
              isLight={isLight}
            />
            <ScaleAxisRow
              label={t("floor.size_height")}
              scale={scaleY}
              onChange={(n) => {
                setScaleY(n);
                previewSize(scaleX, n, shape);
              }}
              isLight={isLight}
            />
            <div className="flex gap-2">
              {SCALE_PRESETS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setScaleX(opt.value);
                    setScaleY(opt.value);
                    previewSize(opt.value, opt.value, shape);
                  }}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                    uniformPreset === opt.value ? chipActive : chipIdle,
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {zones.length > 1 && (
            <div className="space-y-1.5">
              <label
                className={cn(
                  "text-xs uppercase tracking-wider",
                  isLight ? "text-slate-500" : "text-[#8b93a7]",
                )}
              >
                Room
              </label>
              <div className="flex flex-wrap gap-2">
                {zones.map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZone(z)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                      zone === z ? chipActive : chipIdle,
                    )}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter
          className={cn(
            "mt-auto border-t p-4 sm:flex-row sm:justify-end gap-2",
            isLight ? "border-slate-200 bg-slate-50" : "border-[#1e2a45]",
          )}
        >
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className={isLight ? "text-slate-600 hover:bg-slate-200 hover:text-slate-900" : "text-[#8b93a7]"}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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

  const zoneBox = zoneContentBox(displayTables);

  const currentStaffId = waiter?.staffId;
  const isAdminOrManager = waiter?.role === "admin" || waiter?.role === "manager";

  // Color config based on ownership
  const getTableColors = (table: Doc<"tables">) => {
    const status = table.status as TableStatus;
    const summary = orderSummaries?.[table._id];
    const hasOpenTicket = Boolean(summary);

    if (status === "bill-printed") {
      return {
        bg: "bg-blue-950/60",
        border: "border-blue-500",
        text: "text-blue-400",
      };
    }

    if (
      hasOpenTicket ||
      status === "occupied"
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
      <div className="h-full flex flex-col">
        {waiter && <WaiterTopBar waiter={waiter} />}
        <div className="flex-1 flex items-center justify-center p-3">
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
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {isWaiterFullScreen && waiter ? <WaiterTopBar waiter={waiter} /> : null}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          isWaiterFullScreen ? "gap-3 p-3" : "gap-4 p-6 lg:p-8",
        )}
      >
      {isWaiterFullScreen && waiter && zones.length > 0 ? (
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
      ) : null}

      <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-[#1e2a45] bg-[#0D1326]">
        <div
          className="relative select-none"
          style={{ width: zoneBox.width, height: zoneBox.height }}
        >
            {displayTables.map((table) => {
              const colors = getTableColors(table);
              const tableShape = table.shape ?? "square";
              const { x: scaleX, y: scaleY } = tableScaleXY(table);
              const { w: tableWidth, h: tableHeight } = tableFootprint(
                tableShape,
                scaleX,
                scaleY,
              );
              const tablePosX = (table.posX ?? 100) - zoneBox.minX;
              const tablePosY = (table.posY ?? 100) - zoneBox.minY;
              const summary = orderSummaries?.[table._id];
              const billRequested = table.status === "bill-printed";
              const isBusyByStatus =
                table.status === "occupied" || billRequested;
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
                    left: tablePosX,
                    top: tablePosY,
                    width: tableWidth,
                    height: tableHeight,
                  }}
                  onClick={handleClick}
                >
                  <div className="flex flex-col items-center justify-center text-center w-full min-h-0 gap-0.5">
                    <span className="text-sm font-bold text-white leading-tight tracking-tight truncate max-w-full">
                      {table.name}
                    </span>
                    {summary ? (
                      <>
                        <span
                          className={cn(
                            "text-xs font-semibold tabular-nums",
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
                        <span
                          className={cn(
                            "text-[10px] font-medium truncate max-w-full px-0.5",
                            billRequested ? colors.text : "text-white",
                          )}
                        >
                          {billRequested
                            ? t("floor.pending_payment")
                            : showMine
                              ? t("floor.mine")
                              : showOtherWaiter
                                ? summary.staffName
                                : t("floor.open_status")}
                        </span>
                      </>
                    ) : isBusyByStatus ? (
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          billRequested ? colors.text : "text-red-400",
                        )}
                      >
                        {billRequested
                          ? t("floor.pending_payment")
                          : t("floor.in_use_short")}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "text-xs font-semibold",
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
            })}
        </div>
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
  const showConsumption = isAdmin || !!waiter.canLogStaffConsumption;
  const roleKey = waiter.role ? `staff.role_${waiter.role}` : "";
  const roleLabel = roleKey ? t(roleKey) : "";
  const roleText = roleLabel && roleLabel !== roleKey ? roleLabel : waiter.role;
  const showName =
    !roleText || waiter.name.trim().toLowerCase() !== String(roleText).trim().toLowerCase();

  const logoButton = (
    <button
      type="button"
      onClick={waiter.onLogoClick}
      className="flex shrink-0 items-center gap-2 rounded-md py-1 pr-1.5 -ml-1 hover:bg-[#1e2a45] transition-colors cursor-pointer"
      aria-label={t("nav.menu")}
    >
      <img src={VYNTEX_APP_LOGO_SRC} alt="" className="h-7 w-7" />
      {waiter.onLogoClick ? <Menu className="size-4 text-[#8b93a7]" /> : null}
    </button>
  );

  const logoStatic = (
    <img src={VYNTEX_APP_LOGO_SRC} alt="" className="h-7 w-7 shrink-0" />
  );

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[#1e2a45] bg-[#0A0F1E] px-4">
        {waiter.onLogoClick ? logoButton : logoStatic}
        <div className="h-5 w-px shrink-0 bg-[#1e2a45]" />
        <div className="min-w-0 flex items-center gap-2">
          <p className="truncate text-[13px] font-semibold tracking-tight text-white">
            {waiter.businessName}
          </p>
          {roleText ? (
            <span className="shrink-0 rounded-md bg-[#0066FF]/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0066FF]">
              {roleText}
            </span>
          ) : null}
        </div>
        <div className="flex-1" />
        {showName ? (
          <p className="hidden sm:block max-w-[10rem] truncate text-[12px] text-[#8b93a7]">
            {waiter.name}
          </p>
        ) : null}
        {showConsumption && waiter.staffId && waiter.licenseKey && (
          <button
            type="button"
            onClick={() => setConsumptionOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#8b93a7] hover:bg-[#1e2a45] hover:text-white transition-colors cursor-pointer"
          >
            <UtensilsCrossed className="size-3.5" />
            <span className="hidden md:inline">{t("floor.toolbar_staff_meal")}</span>
          </button>
        )}
        {waiter.staffId && waiter.licenseKey && waiter.role !== "admin" && waiter.role !== "manager" && (
          <button
            type="button"
            onClick={() => setExpenseOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#8b93a7] hover:bg-[#1e2a45] hover:text-white transition-colors cursor-pointer"
          >
            <Wallet className="size-3.5" />
            <span className="hidden md:inline">{t("floor.toolbar_expenses")}</span>
          </button>
        )}
        <button
          type="button"
          onClick={waiter.onLogout}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#8b93a7] hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">{t("nav.logout")}</span>
        </button>
      </header>

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
