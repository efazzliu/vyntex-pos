import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
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
  Plus,
  MapPinned,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Lock,
  Unlock,
  Pencil,
  Trash2,
  Users,
  LogOut,
} from "lucide-react";
import type { TableStatus } from "../_lib/types.ts";
import TableDialog from "./table-dialog.tsx";

type WaiterInfo = {
  name: string;
  onLogout: () => void;
};

type FloorPlanProps = {
  licenseKey: string;
  isEditor: boolean; // true for admin, false for waiter
  onTableSelect?: (tableId: Id<"tables">) => void;
  waiter?: WaiterInfo; // present when rendered full-screen for a waiter
};

const STATUS_COLORS: Record<TableStatus, { bg: string; border: string; text: string; label: string }> = {
  available: { bg: "bg-emerald-500/20", border: "border-emerald-500/50", text: "text-emerald-400", label: "Available" },
  occupied: { bg: "bg-red-500/20", border: "border-red-500/50", text: "text-red-400", label: "Active" },
  reserved: { bg: "bg-amber-500/20", border: "border-amber-500/50", text: "text-amber-400", label: "Reserved" },
  "bill-printed": { bg: "bg-blue-500/20", border: "border-blue-500/50", text: "text-blue-400", label: "Bill Printed" },
};

const GRID_SIZE = 20; // snap-to-grid increment
const FLOOR_WIDTH = 1200;
const FLOOR_HEIGHT = 800;

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export default function FloorPlan({ licenseKey, isEditor, onTableSelect, waiter }: FloorPlanProps) {
  const isWaiterFullScreen = !!waiter;
  const tables = useQuery(api.pos.tables.getTables, { licenseKey });
  const moveTable = useMutation(api.pos.tables.moveTable);
  const deleteTable = useMutation(api.pos.tables.deleteTable);

  const [zoom, setZoom] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Id<"tables"> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const isLoading = tables === undefined;
  const zones = tables ? [...new Set(tables.map((t) => t.zone))].sort() : [];

  // Keyboard shortcut for delete
  useEffect(() => {
    if (!isEditor || !editMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedTable) {
        handleDelete(selectedTable);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isEditor, editMode, selectedTable]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, table: Doc<"tables">) => {
      if (!isEditor || !editMode) {
        setSelectedTable(table._id);
        if (!isEditor && onTableSelect) {
          onTableSelect(table._id);
        }
        return;
      }

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
    [isEditor, editMode, onTableSelect]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      e.preventDefault();

      const dx = (e.clientX - dragging.startX) / zoom;
      const dy = (e.clientY - dragging.startY) / zoom;

      const newX = snapToGrid(Math.max(0, Math.min(FLOOR_WIDTH - 80, dragging.origX + dx)));
      const newY = snapToGrid(Math.max(0, Math.min(FLOOR_HEIGHT - 80, dragging.origY + dy)));

      // Optimistic local update via DOM
      const el = document.getElementById(`table-${dragging.tableId}`);
      if (el) {
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
      }
    },
    [dragging, zoom]
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (!dragging) return;

      const dx = (e.clientX - dragging.startX) / zoom;
      const dy = (e.clientY - dragging.startY) / zoom;

      const newX = snapToGrid(Math.max(0, Math.min(FLOOR_WIDTH - 80, dragging.origX + dx)));
      const newY = snapToGrid(Math.max(0, Math.min(FLOOR_HEIGHT - 80, dragging.origY + dy)));

      setDragging(null);

      // Only save if position actually changed
      if (newX !== dragging.origX || newY !== dragging.origY) {
        try {
          await moveTable({
            licenseKey,
            tableId: dragging.tableId,
            posX: newX,
            posY: newY,
          });
        } catch {
          toast.error("Failed to move table");
        }
      }
    },
    [dragging, zoom, licenseKey, moveTable]
  );

  const handleDelete = async (tableId: Id<"tables">) => {
    try {
      await deleteTable({ licenseKey, tableId });
      setSelectedTable(null);
      toast.success("Table removed from floor plan");
    } catch {
      toast.error("Failed to delete table");
    }
  };

  const handleAddTable = () => {
    setEditingTable(null);
    setDialogOpen(true);
  };

  const handleEditTable = () => {
    if (!selectedTable || !tables) return;
    const t = tables.find((t) => t._id === selectedTable);
    if (t) {
      setEditingTable(t);
      setDialogOpen(true);
    }
  };

  const zoomIn = () => setZoom((z) => Math.min(2, z + 0.15));
  const zoomOut = () => setZoom((z) => Math.max(0.4, z - 0.15));
  const resetZoom = () => setZoom(1);

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-64 bg-[#131A2E]" />
        <Skeleton className="h-[500px] rounded-xl bg-[#131A2E]" />
      </div>
    );
  }

  if (tables.length === 0 && isEditor) {
    return (
      <div className="p-6 lg:p-8">
        <FloorPlanHeader
          isEditor={isEditor}
          editMode={editMode}
          onToggleEdit={() => setEditMode(!editMode)}
          onAddTable={handleAddTable}
        />
        <div className="mt-16">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><MapPinned /></EmptyMedia>
              <EmptyTitle>No tables on the floor plan</EmptyTitle>
              <EmptyDescription>
                Add tables and arrange them to match your restaurant layout
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={handleAddTable}>
                <Plus className="size-4 mr-1" />
                Add First Table
              </Button>
            </EmptyContent>
          </Empty>
        </div>
        <TableDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          licenseKey={licenseKey}
          zones={zones}
          editing={null}
        />
      </div>
    );
  }

  const selectedTableData = selectedTable ? tables.find((t) => t._id === selectedTable) : null;

  return (
    <div className={cn(
      "space-y-4 h-full flex flex-col",
      isWaiterFullScreen ? "p-3" : "p-6 lg:p-8",
    )}>
      {/* Waiter floating bar (full-screen mode) */}
      {isWaiterFullScreen && waiter && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#131A2E] border border-[#1e2a45]">
          <div className="w-8 h-8 rounded-full bg-[#44CC00] flex items-center justify-center text-xs font-bold text-white shrink-0">
            {waiter.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{waiter.name}</p>
            <p className="text-[10px] text-[#44CC00] uppercase tracking-wider font-medium">Waiter</p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 ml-4 flex-wrap">
            {Object.entries(STATUS_COLORS).map(([status, config]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs">
                <div className={cn("w-2.5 h-2.5 rounded-sm", config.bg, "border", config.border)} />
                <span className="text-[#8b93a7] text-[11px]">{config.label}</span>
              </div>
            ))}
          </div>

          {/* Zoom controls */}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={zoomOut} className="p-1.5 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white transition-colors cursor-pointer">
              <ZoomOut className="size-4" />
            </button>
            <span className="text-xs text-[#5a6580] w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} className="p-1.5 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white transition-colors cursor-pointer">
              <ZoomIn className="size-4" />
            </button>
            <button onClick={resetZoom} className="p-1.5 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white transition-colors cursor-pointer">
              <Maximize2 className="size-4" />
            </button>
          </div>

          {/* Logout */}
          <button
            onClick={waiter.onLogout}
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors text-xs font-medium cursor-pointer"
          >
            <LogOut className="size-3.5" />
            Logout
          </button>
        </div>
      )}

      {/* Admin header + legend (non-waiter mode) */}
      {!isWaiterFullScreen && (
        <>
          <FloorPlanHeader
            isEditor={isEditor}
            editMode={editMode}
            onToggleEdit={() => setEditMode(!editMode)}
            onAddTable={handleAddTable}
          />

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap">
            {Object.entries(STATUS_COLORS).map(([status, config]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs">
                <div className={cn("w-3 h-3 rounded-sm", config.bg, "border", config.border)} />
                <span className="text-[#8b93a7]">{config.label}</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-1">
              <button onClick={zoomOut} className="p-1.5 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white transition-colors cursor-pointer">
                <ZoomOut className="size-4" />
              </button>
              <span className="text-xs text-[#5a6580] w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={zoomIn} className="p-1.5 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white transition-colors cursor-pointer">
                <ZoomIn className="size-4" />
              </button>
              <button onClick={resetZoom} className="p-1.5 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white transition-colors cursor-pointer">
                <Maximize2 className="size-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Floor plan canvas */}
      <div className="flex-1 overflow-auto rounded-xl border border-[#1e2a45] bg-[#0D1326] min-h-[500px]">
        <div
          ref={floorRef}
          className="relative select-none"
          style={{
            width: FLOOR_WIDTH * zoom,
            height: FLOOR_HEIGHT * zoom,
            backgroundImage: `radial-gradient(circle, #1e2a45 1px, transparent 1px)`,
            backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => setSelectedTable(null)}
        >
          {tables.map((table) => {
            const config = STATUS_COLORS[table.status as TableStatus] ?? STATUS_COLORS.available;
            const isSelected = selectedTable === table._id;
            const isDraggingThis = dragging?.tableId === table._id;

            const tableShape = table.shape ?? "square";
            const tablePosX = table.posX ?? 100;
            const tablePosY = table.posY ?? 100;
            const tableWidth = tableShape === "rectangle" ? 120 : 80;
            const tableHeight = 80;

            return (
              <div
                key={table._id}
                id={`table-${table._id}`}
                className={cn(
                  "absolute flex flex-col items-center justify-center border-2 transition-shadow",
                  config.bg,
                  config.border,
                  tableShape === "circle" ? "rounded-full" : "rounded-xl",
                  isSelected && "ring-2 ring-white/40 shadow-lg",
                  isDraggingThis && "opacity-80 z-50",
                  isEditor && editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                )}
                style={{
                  left: tablePosX * zoom,
                  top: tablePosY * zoom,
                  width: tableWidth * zoom,
                  height: tableHeight * zoom,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handlePointerDown(e, table);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className={cn("font-bold text-white", zoom < 0.6 ? "text-[9px]" : "text-sm")}>
                  {table.name}
                </span>
                <span className={cn("flex items-center gap-0.5", config.text, zoom < 0.6 ? "text-[7px]" : "text-[10px]")}>
                  <Users className="size-2.5" />
                  {table.seats}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected table actions (waiter: tap to order, admin: edit/remove) */}
      {selectedTableData && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#131A2E] border border-[#1e2a45]">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {selectedTableData.name}
            </p>
            <p className="text-xs text-[#5a6580]">
              {selectedTableData.seats} seats · {selectedTableData.zone} · {STATUS_COLORS[selectedTableData.status as TableStatus]?.label ?? selectedTableData.status}
            </p>
          </div>
          {isWaiterFullScreen && (
            <Button
              size="sm"
              onClick={() => onTableSelect?.(selectedTableData._id)}
            >
              Open Table
            </Button>
          )}
          {isEditor && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleEditTable}>
                <Pencil className="size-3.5 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(selectedTableData._id)}
              >
                <Trash2 className="size-3.5 mr-1" />
                Remove
              </Button>
            </div>
          )}
        </div>
      )}

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

// ── Header ──────────────────────────────────────────

function FloorPlanHeader({
  isEditor,
  editMode,
  onToggleEdit,
  onAddTable,
}: {
  isEditor: boolean;
  editMode: boolean;
  onToggleEdit: () => void;
  onAddTable: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <MapPinned className="size-6" />
          Floor Plan
        </h1>
        <p className="text-[#8b93a7] text-sm mt-1">
          {isEditor
            ? editMode
              ? "Drag tables to arrange your layout"
              : "Click a table to view details"
            : "Tap a table to start an order"}
        </p>
      </div>
      {isEditor && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={editMode ? "default" : "secondary"}
            onClick={onToggleEdit}
          >
            {editMode ? (
              <>
                <Lock className="size-3.5 mr-1" />
                Lock Layout
              </>
            ) : (
              <>
                <Unlock className="size-3.5 mr-1" />
                Edit Layout
              </>
            )}
          </Button>
          {editMode && (
            <Button size="sm" onClick={onAddTable}>
              <Plus className="size-4 mr-1" />
              Add Table
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
