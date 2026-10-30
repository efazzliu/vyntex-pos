import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  BrickWall,
  Check,
  ChevronDown,
  Clock,
  Copy,
  DoorOpen,
  Info,
  LayoutGrid,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Pencil,
  Plus,
  Redo2,
  Shapes,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import type { TableShape, TableStatus } from "../_lib/types.ts";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { useOfflineData } from "@/hooks/use-offline-data.ts";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { posTablesIndexedDbKey } from "@/lib/supabase-pos/cache-keys.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import {
  TABLE_SCALE_MAX,
  TABLE_SCALE_MIN,
  clampTableScale,
  firstFreeFloorSlot,
  floorCanvasBox,
  nextFloorTableSlot,
  tableFootprint,
  tableScaleXY,
} from "@/lib/pos-floor-layout.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";

/** Floor scale: a 1.0 m square table is 80 px at 100 % zoom. */
const PX_PER_M = 80;
const GRID_SIZE = 20;
/** Extra room right/below the last table so it can be dragged outward (the room then grows and the view refits). */
const EDITOR_GROW_PX = 160;
/** Ruler band above/left of the room. */
const RULER = 34;
/** Wall line inset inside the canvas. */
const WALL_INSET = 8;
/** Closest a table may get to the wall line. */
const MIN_REL = 16;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.1;
/** Mouse-wheel resize: one notch (~100 px of delta) grows / shrinks the table by 0.1 m. */
const WHEEL_PX_PER_STEP = 100;
const WHEEL_STEP_M = 0.1;
/** After this, a refetch wins even if it never echoed the local change (e.g. another device). */
const PENDING_PATCH_MAX_MS = 15_000;

type TableSummary = { staffId: string; staffName: string; total: number; openedAt?: string | null };
type Patch = Partial<Doc<"tables">>;
type HistoryEntry = { tableId: Id<"tables">; before: Patch; after: Patch };
type Tool = "tables" | "zones";
type Draft = { name: string; seats: number; shape: TableShape; widthM: string; heightM: string; zone: string };

const STATUS_STYLE: Record<
  TableStatus,
  { border: string; fill: string; chair: string; badge: string; labelKey: string }
> = {
  available: { border: "#22c55e", fill: "#f6fdf8", chair: "#c9a27c", badge: "#16a34a", labelKey: "floor.available" },
  occupied: { border: "#3b82f6", fill: "#f3f8ff", chair: "#9aa7b8", badge: "#2563eb", labelKey: "floor.occupied" },
  reserved: { border: "#a855f7", fill: "#faf6ff", chair: "#c9a27c", badge: "#9333ea", labelKey: "floor.reserved" },
  "bill-printed": { border: "#f97316", fill: "#fff8f1", chair: "#c9a27c", badge: "#ea580c", labelKey: "floor.bill_printed" },
};

/** Recommended sizes (metres) — clicking applies to the selected table or adds a new one. */
const SIZE_PRESETS: {
  id: string;
  seats: number;
  shape: TableShape;
  widthM: number;
  heightM: number;
  space: string;
  round?: boolean;
}[] = [
  { id: "s2", seats: 2, shape: "square", widthM: 0.8, heightM: 0.8, space: "1.5 × 1.5 m" },
  { id: "s4", seats: 4, shape: "square", widthM: 1.0, heightM: 1.0, space: "2.0 × 2.0 m" },
  { id: "r6", seats: 6, shape: "rectangle", widthM: 1.2, heightM: 0.8, space: "2.5 × 2.0 m" },
  { id: "r8", seats: 8, shape: "rectangle", widthM: 1.6, heightM: 0.8, space: "3.5 × 2.0 m" },
  { id: "c4", seats: 4, shape: "circle", widthM: 1.0, heightM: 1.0, space: "2.0 × 2.0 m", round: true },
  { id: "c6", seats: 6, shape: "circle", widthM: 1.2, heightM: 1.2, space: "2.5 × 2.5 m", round: true },
];

function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function baseSize(shape: string | undefined | null) {
  return tableFootprint(shape ?? "square", 1, 1);
}

function metresToScale(shape: TableShape, widthM: number, heightM: number) {
  const base = baseSize(shape);
  return {
    x: clampTableScale((widthM * PX_PER_M) / base.w),
    y: clampTableScale((heightM * PX_PER_M) / base.h),
  };
}

function tableMetres(t: Doc<"tables">) {
  const { x, y } = tableScaleXY(t);
  const { w, h } = tableFootprint(t.shape ?? "square", x, y);
  return { widthM: w / PX_PER_M, heightM: h / PX_PER_M };
}

function fmtM(n: number) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function parseM(raw: string) {
  return Number.parseFloat(raw.replace(",", ".").trim());
}

function minutesSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 60000));
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** Chair rectangles around a table (relative to its top-left). */
function chairLayout(shape: TableShape, seats: number, w: number, h: number) {
  const chairs: { x: number; y: number; w: number; h: number }[] = [];
  const along = 22;
  const depth = 12;
  const gap = 3;
  const n = Math.max(0, Math.min(16, seats));
  if (n === 0) return chairs;
  if (shape === "circle") {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(w, h) / 2 + gap + depth / 2;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      chairs.push({ x: px - 9, y: py - 9, w: 18, h: 18 });
    }
    return chairs;
  }
  // [top, right, bottom, left]
  const counts = [0, 0, 0, 0];
  if (shape === "rectangle") {
    const ends = n >= 6 ? 1 : 0;
    counts[1] = ends;
    counts[3] = ends;
    const rest = n - ends * 2;
    counts[0] = Math.ceil(rest / 2);
    counts[2] = Math.floor(rest / 2);
  } else {
    const order = [3, 1, 0, 2];
    for (let i = 0; i < n; i++) counts[order[i % 4]] += 1;
  }
  const place = (side: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const horizontal = side === 0 || side === 2;
      const span = horizontal ? w : h;
      const step = span / count;
      const center = step * i + step / 2;
      if (horizontal) {
        chairs.push({
          x: center - along / 2,
          y: side === 0 ? -gap - depth : h + gap,
          w: along,
          h: depth,
        });
      } else {
        chairs.push({
          x: side === 3 ? -gap - depth : w + gap,
          y: center - along / 2,
          w: depth,
          h: along,
        });
      }
    }
  };
  counts.forEach((c, side) => place(side, c));
  return chairs;
}

function draftFrom(t: Doc<"tables">): Draft {
  const m = tableMetres(t);
  return {
    name: t.name,
    seats: t.seats,
    shape: (t.shape ?? "square") as TableShape,
    widthM: fmtM(m.widthM),
    heightM: fmtM(m.heightM),
    zone: t.zone,
  };
}

/** Patch a draft describes (only fields that differ from the saved table). */
function draftPatch(t: Doc<"tables">, d: Draft): Patch | null {
  const w = parseM(d.widthM);
  const h = parseM(d.heightM);
  if (!d.name.trim() || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const scale = metresToScale(d.shape, w, h);
  const patch: Patch = {};
  if (d.name.trim() !== t.name) patch.name = d.name.trim();
  if (d.seats !== t.seats) patch.seats = d.seats;
  if (d.shape !== (t.shape ?? "square")) patch.shape = d.shape;
  if (d.zone !== t.zone) patch.zone = d.zone;
  const saved = tableScaleXY(t);
  if (Math.abs(scale.x - saved.x) > 0.001) patch.tableScale = scale.x;
  if (Math.abs(scale.y - saved.y) > 0.001) patch.tableScaleY = scale.y;
  return patch;
}

const MENU_CONTENT =
  "min-w-[200px] rounded-xl border border-[#e6edf5] bg-white p-1 text-[#0f172a] shadow-[0_12px_32px_-12px_rgba(15,23,42,0.22)]";
const MENU_ITEM =
  "rounded-lg px-2.5 py-2 text-[13px] font-medium text-[#0f172a] focus:bg-[#f1f5f9] focus:text-[#0f172a]";
const FIELD =
  "h-10 w-full rounded-[10px] border border-[#e2e8f0] bg-white px-3 text-sm text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[#005bd6] focus:ring-2 focus:ring-[#005bd6]/15";

export default function FloorPlanEditor({ licenseKey }: { licenseKey: string }) {
  const { t } = usePosLocale();
  const isOnline = useOnlineStatus();
  const tablesQuery = useQuery("pos.tables.getTables", { licenseKey });
  const summariesQuery = useQuery("pos.tables.getTableOrderSummaries", { licenseKey });
  const { data: tables } = useOfflineData<Doc<"tables">[]>(
    posTablesIndexedDbKey(licenseKey),
    tablesQuery,
    isOnline,
  );
  const summaries = (summariesQuery ?? {}) as Record<string, TableSummary>;

  const createTable = useMutation("pos.tables.createTable");
  const deleteTable = useMutation("pos.tables.deleteTable");
  const updateTable = useMutation("pos.tables.updateTable");
  const moveTable = useMutation("pos.tables.moveTable");
  const renameZoneMut = useMutation("pos.tables.renameZone");
  const deleteZoneMut = useMutation("pos.tables.deleteZone");

  const [localTables, setLocalTables] = useState<Doc<"tables">[]>([]);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<Id<"tables"> | null>(null);
  const [tool, setTool] = useState<Tool>("tables");
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [newZone, setNewZone] = useState("");
  const [creatingZone, setCreatingZone] = useState(false);
  const [renameFor, setRenameFor] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(new Map<string, { patch: Patch; at: number }>());

  // ── Server sync (keep local moves until the server confirms them) ──
  useEffect(() => {
    if (!tables) return;
    const pending = pendingRef.current;
    const ts = Date.now();
    setLocalTables(
      tables.map((row) => {
        const entry = pending.get(row._id);
        if (!entry) return row;
        const keys = Object.keys(entry.patch) as (keyof Doc<"tables">)[];
        if (keys.every((k) => row[k] === entry.patch[k]) || ts - entry.at > PENDING_PATCH_MAX_MS) {
          pending.delete(row._id);
          return row;
        }
        return { ...row, ...entry.patch };
      }),
    );
  }, [tables]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const zones = useMemo(() => [...new Set(localTables.map((x) => x.zone))].sort(), [localTables]);

  useEffect(() => {
    if (zones.length > 0 && (activeZone === null || !zones.includes(activeZone))) {
      setActiveZone(zones[0]);
    }
  }, [zones, activeZone]);

  const zoneTables = useMemo(
    () => (activeZone ? localTables.filter((x) => x.zone === activeZone) : []),
    [localTables, activeZone],
  );
  const selected = selectedId ? (localTables.find((x) => x._id === selectedId) ?? null) : null;

  useEffect(() => {
    setDraft(selected ? draftFrom(selected) : null);
    // Re-seed only when another table is picked; edits of the same table keep the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const pendingDraftPatch = selected && draft ? draftPatch(selected, draft) : null;
  const dirty = Boolean(pendingDraftPatch && Object.keys(pendingDraftPatch).length > 0);

  /** Table as drawn: the selected one shows its unsaved draft live. */
  const drawn = (row: Doc<"tables">): Doc<"tables"> => {
    if (row._id !== selectedId || !draft) return row;
    const w = parseM(draft.widthM);
    const h = parseM(draft.heightM);
    const scale = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? metresToScale(draft.shape, w, h) : null;
    return {
      ...row,
      name: draft.name || row.name,
      seats: draft.seats,
      shape: draft.shape,
      ...(scale ? { tableScale: scale.x, tableScaleY: scale.y } : {}),
    };
  };

  // ── Canvas geometry ──
  const box = floorCanvasBox(zoneTables.map(drawn), EDITOR_GROW_PX);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const hasZone = Boolean(activeZone);
  useEffect(() => {
    const el = floorRef.current;
    if (!el) return;
    const measure = () => setViewport({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasZone]);
  // 100 % zoom = the whole room fits the viewport (never scrolls); only zooming in past fit scrolls.
  const naturalW = RULER + box.width + 8;
  const naturalH = RULER + box.height + 8;
  const fitScale =
    viewport.w > 0 && viewport.h > 0
      ? Math.min(1, viewport.w / naturalW, viewport.h / naturalH)
      : 1;
  const scale = fitScale * zoom;
  const canvasW = Math.max(box.width, viewport.w / scale - RULER - 8);
  const canvasH = Math.max(box.height, viewport.h / scale - RULER - 8);
  const totalW = RULER + canvasW + 8;
  const totalH = RULER + canvasH + 8;
  const roomW = canvasW - WALL_INSET * 2;
  const roomH = canvasH - WALL_INSET * 2;

  // ── Pending / history helpers ──
  const writeCache = useCallback(
    async (mutate: (rows: Doc<"tables">[]) => Doc<"tables">[]) => {
      const key = posTablesIndexedDbKey(licenseKey);
      const cached = (await getDataCache<Doc<"tables">[]>(key)) ?? [];
      await saveDataCache(key, mutate(cached));
    },
    [licenseKey],
  );

  const saveToServer = useCallback(
    async (tableId: Id<"tables">, patch: Patch) => {
      const { posX, posY, ...rest } = patch;
      if (posX != null && posY != null) {
        await moveTable({ licenseKey, tableId, posX, posY });
      }
      if (Object.keys(rest).length > 0) {
        await updateTable({ licenseKey, tableId, ...rest });
      }
    },
    [licenseKey, moveTable, updateTable],
  );

  const applyPatch = useCallback(
    async (tableId: Id<"tables">, patch: Patch, previous: Patch, record: boolean) => {
      pendingRef.current.set(tableId, { patch, at: Date.now() });
      setLocalTables((rows) => rows.map((x) => (x._id === tableId ? { ...x, ...patch } : x)));
      if (record) {
        setHistory((h) => [...h.slice(-49), { tableId, before: previous, after: patch }]);
        setFuture([]);
      }
      try {
        await saveToServer(tableId, patch);
        await writeCache((rows) => rows.map((x) => (x._id === tableId ? { ...x, ...patch } : x)));
        return true;
      } catch (e) {
        pendingRef.current.delete(tableId);
        setLocalTables((rows) => rows.map((x) => (x._id === tableId ? { ...x, ...previous } : x)));
        toast.error(errorMessageFromUnknown(e, t("floor.save_failed")));
        return false;
      }
    },
    [saveToServer, t, writeCache],
  );

  const pickPrevious = (row: Doc<"tables">, patch: Patch): Patch => {
    const prev: Patch = {};
    for (const k of Object.keys(patch) as (keyof Doc<"tables">)[]) {
      (prev as Record<string, unknown>)[k] = row[k];
    }
    return prev;
  };

  const undo = useCallback(() => {
    const entry = history[history.length - 1];
    if (!entry) return;
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [...f, entry]);
    void applyPatch(entry.tableId, entry.before, entry.after, false);
  }, [applyPatch, history]);

  const redo = useCallback(() => {
    const entry = future[future.length - 1];
    if (!entry) return;
    setFuture((f) => f.slice(0, -1));
    setHistory((h) => [...h, entry]);
    void applyPatch(entry.tableId, entry.after, entry.before, false);
  }, [applyPatch, future]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // ── Drag & resize ──
  const [drag, setDrag] = useState<{
    id: Id<"tables">;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    w: number;
    h: number;
  } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [resize, setResize] = useState<{
    id: Id<"tables">;
    startX: number;
    startY: number;
    origW: number;
    origH: number;
    shape: TableShape;
  } | null>(null);
  const [resizeLive, setResizeLive] = useState<{ widthM: number; heightM: number } | null>(null);

  const dragTarget = (d: NonNullable<typeof drag>, clientX: number, clientY: number) => {
    const minX = Math.max(-box.minX, MIN_REL);
    const minY = Math.max(-box.minY, MIN_REL);
    const relX = d.origX - box.minX + (clientX - d.startX) / scale;
    const relY = d.origY - box.minY + (clientY - d.startY) / scale;
    return {
      x: Math.max(minX, snap(Math.max(minX, Math.min(canvasW - WALL_INSET - d.w - 4, relX)))),
      y: Math.max(minY, snap(Math.max(minY, Math.min(canvasH - WALL_INSET - d.h - 4, relY)))),
    };
  };

  const resizeTarget = (r: NonNullable<typeof resize>, clientX: number, clientY: number) => {
    const w = Math.max(0.4, r.origW + (clientX - r.startX) / scale / PX_PER_M);
    const h = Math.max(0.4, r.origH + (clientY - r.startY) / scale / PX_PER_M);
    const round = (n: number) => Math.round(n * 10) / 10;
    return r.shape === "circle"
      ? { widthM: round(Math.max(w, h)), heightM: round(Math.max(w, h)) }
      : { widthM: round(w), heightM: round(h) };
  };

  const onTablePointerDown = (e: React.PointerEvent, row: Doc<"tables">) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setTool("tables");
    setSelectedId(row._id);
    const shown = drawn(row);
    const { x, y } = tableScaleXY(shown);
    const { w, h } = tableFootprint(shown.shape ?? "square", x, y);
    const origX = row.posX ?? 100;
    const origY = row.posY ?? 100;
    setDrag({ id: row._id, startX: e.clientX, startY: e.clientY, origX, origY, w, h });
    setDragPos({ x: origX - box.minX, y: origY - box.minY });
  };

  const onResizePointerDown = (e: React.PointerEvent, row: Doc<"tables">) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const shown = drawn(row);
    const m = tableMetres(shown);
    setResize({
      id: row._id,
      startX: e.clientX,
      startY: e.clientY,
      origW: m.widthM,
      origH: m.heightM,
      shape: (shown.shape ?? "square") as TableShape,
    });
    setResizeLive({ widthM: m.widthM, heightM: m.heightM });
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (resize) {
      e.preventDefault();
      const next = resizeTarget(resize, e.clientX, e.clientY);
      setResizeLive(next);
      setDraft((d) => (d ? { ...d, widthM: fmtM(next.widthM), heightM: fmtM(next.heightM) } : d));
      return;
    }
    if (!drag) return;
    e.preventDefault();
    setDragPos(dragTarget(drag, e.clientX, e.clientY));
  };

  const endPointer = (e: React.PointerEvent) => {
    if (resize) {
      // Resize only edits the draft; Save writes it (with undo).
      setResize(null);
      setResizeLive(null);
      return;
    }
    if (!drag) return;
    const { x, y } = dragTarget(drag, e.clientX, e.clientY);
    const posX = x + box.minX;
    const posY = y + box.minY;
    const { id, origX, origY } = drag;
    setDrag(null);
    setDragPos(null);
    if (posX === origX && posY === origY) return;
    void applyPatch(id, { posX, posY }, { posX: origX, posY: origY }, true);
  };

  const cancelPointer = () => {
    setDrag(null);
    setDragPos(null);
    setResize(null);
    setResizeLive(null);
  };

  // Wheel over a table: first selects it, then resizes the draft (like the corner handle; Save writes it).
  // Native listener because React's onWheel is passive and cannot stop the canvas from scrolling.
  const wheelAccRef = useRef(0);
  useEffect(() => {
    const el = floorRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || drag || resize) return;
      const tableEl = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-table-id]");
      const id = tableEl?.dataset.tableId as Id<"tables"> | undefined;
      if (!id) return;
      e.preventDefault();
      if (id !== selectedId) {
        wheelAccRef.current = 0;
        setTool("tables");
        setSelectedId(id);
        return;
      }
      const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      wheelAccRef.current += px;
      const steps = Math.trunc(wheelAccRef.current / WHEEL_PX_PER_STEP);
      if (steps === 0) return;
      wheelAccRef.current -= steps * WHEEL_PX_PER_STEP;
      const delta = -steps * WHEEL_STEP_M;
      setDraft((d) => {
        if (!d) return d;
        const w = parseM(d.widthM);
        const h = parseM(d.heightM);
        if (!Number.isFinite(w) || !Number.isFinite(h)) return d;
        const base = baseSize(d.shape);
        const clampDim = (v: number, basePx: number) =>
          Math.min(
            (basePx * TABLE_SCALE_MAX) / PX_PER_M,
            Math.max(Math.max(0.4, (basePx * TABLE_SCALE_MIN) / PX_PER_M), v),
          );
        const nextW = clampDim(w + delta, base.w);
        const nextH = clampDim(h + delta, base.h);
        if (d.shape === "circle") {
          const side = fmtM(Math.max(nextW, nextH));
          return { ...d, widthM: side, heightM: side };
        }
        return { ...d, widthM: fmtM(nextW), heightM: fmtM(nextH) };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [hasZone, selectedId, drag, resize]);

  // ── Table actions ──
  const addTable = async (preset?: (typeof SIZE_PRESETS)[number]) => {
    if (!activeZone) return;
    const zone = activeZone;
    const shape = preset?.shape ?? "square";
    const slot = firstFreeFloorSlot(zoneTables, shape);
    try {
      const newId = await createTable({
        licenseKey,
        seats: preset?.seats ?? 4,
        zone,
        posX: slot.posX,
        posY: slot.posY,
        shape,
      });
      if (typeof newId !== "string" || !newId) {
        toast.error(t("floor.save_failed"));
        return;
      }
      const scale = preset ? metresToScale(shape, preset.widthM, preset.heightM) : { x: 1, y: 1 };
      if (scale.x !== 1 || scale.y !== 1) {
        await updateTable({ licenseKey, tableId: newId, tableScale: scale.x, tableScaleY: scale.y });
      }
      const row: Doc<"tables"> = {
        _id: newId as Id<"tables">,
        _creationTime: Date.now(),
        licenseKey,
        name: `T${zoneTables.length + 1}`,
        seats: preset?.seats ?? 4,
        zone,
        status: "available",
        posX: slot.posX,
        posY: slot.posY,
        shape,
        tableScale: scale.x,
        tableScaleY: scale.y,
      } as unknown as Doc<"tables">;
      setLocalTables((rows) => [...rows, row]);
      await writeCache((rows) => [...rows, row]);
      setSelectedId(row._id);
      setTool("tables");
      toast.success(t("floor.table_added"));
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, t("floor.save_failed")));
    }
  };

  const duplicateSelected = async () => {
    if (!selected) return;
    const src = drawn(selected);
    const shape = (src.shape ?? "square") as TableShape;
    const slot = firstFreeFloorSlot(localTables.filter((x) => x.zone === src.zone), shape);
    try {
      const newId = await createTable({
        licenseKey,
        seats: src.seats,
        zone: src.zone,
        posX: slot.posX,
        posY: slot.posY,
        shape,
      });
      if (typeof newId !== "string" || !newId) {
        toast.error(t("floor.save_failed"));
        return;
      }
      const { x, y } = tableScaleXY(src);
      if (x !== 1 || y !== 1) {
        await updateTable({ licenseKey, tableId: newId, tableScale: x, tableScaleY: y });
      }
      const count = localTables.filter((row) => row.zone === src.zone).length;
      const row = {
        ...src,
        _id: newId as Id<"tables">,
        _creationTime: Date.now(),
        name: `T${count + 1}`,
        status: "available",
        posX: slot.posX,
        posY: slot.posY,
        tableScale: x,
        tableScaleY: y,
      } as Doc<"tables">;
      setLocalTables((rows) => [...rows, row]);
      await writeCache((rows) => [...rows, row]);
      setSelectedId(row._id);
      toast.success(t("floor.duplicated"));
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, t("floor.save_failed")));
    }
  };

  const deleteErrorText = (e: unknown) => {
    const message = e instanceof Error ? e.message : String(e ?? "");
    const open = /TABLE_HAS_OPEN_ORDER:(.*)/.exec(message);
    if (open) return t("floor.table_has_open_order", { name: open[1] || "" });
    return errorMessageFromUnknown(e, t("floor.save_failed"));
  };

  const deleteSelected = async () => {
    if (!selected) return;
    if (!window.confirm(t("floor.delete_table_confirm", { name: selected.name }))) return;
    try {
      await deleteTable({ licenseKey, tableId: selected._id });
      const id = selected._id;
      setLocalTables((rows) => rows.filter((x) => x._id !== id));
      await writeCache((rows) => rows.filter((x) => x._id !== id));
      setHistory((h) => h.filter((x) => x.tableId !== id));
      setFuture((f) => f.filter((x) => x.tableId !== id));
      setSelectedId(null);
      toast.success(t("floor.table_deleted", { name: selected.name }));
    } catch (e) {
      toast.error(deleteErrorText(e));
    }
  };

  const saveDraft = async () => {
    if (!selected || !draft) return;
    const patch = draftPatch(selected, draft);
    if (!patch) {
      toast.error(t("floor.invalid_size"));
      return;
    }
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    const ok = await applyPatch(selected._id, patch, pickPrevious(selected, patch), true);
    setSaving(false);
    if (ok) {
      toast.success(t("floor.saved"));
      if (patch.zone) setActiveZone(patch.zone);
    }
  };

  const applyPreset = (preset: (typeof SIZE_PRESETS)[number]) => {
    if (selected && draft) {
      setDraft({
        ...draft,
        seats: preset.seats,
        shape: preset.shape,
        widthM: fmtM(preset.widthM),
        heightM: fmtM(preset.heightM),
      });
      return;
    }
    void addTable(preset);
  };

  // ── Zone actions ──
  const addZone = async () => {
    const name = newZone.trim();
    if (!name) return;
    if (zones.some((z) => z.toLowerCase() === name.toLowerCase())) {
      toast.error(t("floor.zone_exists"));
      return;
    }
    setCreatingZone(true);
    const slot = nextFloorTableSlot(0);
    try {
      const newId = await createTable({ licenseKey, seats: 4, zone: name, posX: slot.posX, posY: slot.posY, shape: "square" });
      const id =
        typeof newId === "string" && newId
          ? newId
          : typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `pending-room-${Date.now()}`;
      const row = {
        _id: id as Id<"tables">,
        _creationTime: Date.now(),
        licenseKey,
        name: "T1",
        seats: 4,
        zone: name,
        status: "available",
        posX: slot.posX,
        posY: slot.posY,
        shape: "square",
        tableScale: 1,
        tableScaleY: 1,
      } as unknown as Doc<"tables">;
      setLocalTables((rows) => [...rows, row]);
      await writeCache((rows) => [...rows, row]);
      setActiveZone(name);
      setNewZone("");
      toast.success(t("floor.zone_created", { name }));
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, t("floor.save_failed")));
    } finally {
      setCreatingZone(false);
    }
  };

  const renameZone = async () => {
    const from = renameFor;
    const to = renameValue.trim();
    setRenameFor(null);
    if (!from || !to || to === from) return;
    try {
      await renameZoneMut({ licenseKey, oldName: from, newName: to });
      setLocalTables((rows) => rows.map((x) => (x.zone === from ? { ...x, zone: to } : x)));
      await writeCache((rows) => rows.map((x) => (x.zone === from ? { ...x, zone: to } : x)));
      if (activeZone === from) setActiveZone(to);
      toast.success(t("floor.zone_renamed"));
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, t("floor.save_failed")));
    }
  };

  const deleteZone = async (zone: string) => {
    const count = localTables.filter((x) => x.zone === zone).length;
    if (!window.confirm(t("floor.delete_zone_confirm", { zone, count }))) return;
    try {
      await deleteZoneMut({ licenseKey, zone });
      setLocalTables((rows) => rows.filter((x) => x.zone !== zone));
      await writeCache((rows) => rows.filter((x) => x.zone !== zone));
      if (activeZone === zone) setActiveZone(null);
      setSelectedId(null);
      toast.success(t("floor.zone_deleted"));
    } catch (e) {
      toast.error(deleteErrorText(e));
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      /* fullscreen not allowed */
    }
  };

  const selectedSummary = selected ? summaries[selected._id] : undefined;
  const selectedMinutes = minutesSince(selectedSummary?.openedAt, now);
  const zoneSeats = zoneTables.reduce((sum, x) => sum + (x.seats ?? 0), 0);

  // ── Render ──
  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col gap-3 bg-[#f4f6fa] p-4">
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Canvas column */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-[#e6edf5] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#eef2f6] px-3 py-2.5">
            <ToolButton active={tool === "tables"} onClick={() => setTool("tables")} icon={<LayoutGrid className="size-4" />}>
              {t("floor.tool_tables")}
            </ToolButton>
            <ToolButton active={tool === "zones"} onClick={() => setTool("zones")} icon={<Layers className="size-4" />}>
              {t("floor.tool_zones")}
            </ToolButton>
            <ToolButton disabled icon={<BrickWall className="size-4" />} soon={t("floor.soon")}>
              {t("floor.tool_walls")}
            </ToolButton>
            <ToolButton disabled icon={<Shapes className="size-4" />} soon={t("floor.soon")}>
              {t("floor.tool_shapes")}
            </ToolButton>
            <ToolButton disabled icon={<Type className="size-4" />} soon={t("floor.soon")}>
              {t("floor.tool_text")}
            </ToolButton>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {zones.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#e2e8f0] bg-white px-3 text-sm font-semibold text-[#0f172a] hover:bg-[#f8fafc]"
                    >
                      <DoorOpen className="size-4 text-[#64748b]" />
                      <span className="max-w-[140px] truncate">{activeZone}</span>
                      <ChevronDown className="size-4 text-[#94a3b8]" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={MENU_CONTENT}>
                    {zones.map((z) => (
                      <DropdownMenuItem
                        key={z}
                        className={cn(MENU_ITEM, "justify-between")}
                        onSelect={() => {
                          setActiveZone(z);
                          setSelectedId(null);
                        }}
                      >
                        <span className="truncate">{z}</span>
                        <span className="flex items-center gap-2 text-xs text-[#64748b]">
                          {localTables.filter((x) => x.zone === z).length}
                          {z === activeZone ? <Check className="size-4 text-[#005bd6]" /> : null}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-[#eef2f6]" />
                    <DropdownMenuItem className={MENU_ITEM} onSelect={() => setTool("zones")}>
                      <Layers className="size-4 text-[#64748b]" />
                      {t("floor.manage_zones")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <div className="flex items-center rounded-[10px] border border-[#e2e8f0]">
                <IconButton label={t("floor.undo")} disabled={history.length === 0} onClick={undo}>
                  <Undo2 className="size-4" />
                </IconButton>
                <IconButton label={t("floor.redo")} disabled={future.length === 0} onClick={redo}>
                  <Redo2 className="size-4" />
                </IconButton>
              </div>
              <div className="flex items-center rounded-[10px] border border-[#e2e8f0]">
                <IconButton
                  label={t("floor.zoom_out")}
                  disabled={zoom <= ZOOM_MIN + 0.001}
                  onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10))}
                >
                  <Minus className="size-4" />
                </IconButton>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="h-9 min-w-[56px] px-1 text-sm font-semibold tabular-nums text-[#0f172a]"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <IconButton
                  label={t("floor.zoom_in")}
                  disabled={zoom >= ZOOM_MAX - 0.001}
                  onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10))}
                >
                  <Plus className="size-4" />
                </IconButton>
              </div>
              <div className="rounded-[10px] border border-[#e2e8f0]">
                <IconButton label={t(fullscreen ? "floor.exit_fullscreen" : "floor.fullscreen")} onClick={() => void toggleFullscreen()}>
                  {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </IconButton>
              </div>
              {activeZone ? (
                <button
                  type="button"
                  onClick={() => void addTable()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold"
                  style={{ backgroundColor: "#005bd6", color: "#ffffff" }}
                >
                  <Plus className="size-4" />
                  {t("floor.add_table")}
                </button>
              ) : null}
            </div>
          </div>

          {zones.length === 0 ? (
            <EmptyState
              icon={<DoorOpen className="size-5" />}
              title={t("floor.no_rooms_title")}
              description={t("floor.no_rooms_desc")}
              action={
                <button
                  type="button"
                  onClick={() => setTool("zones")}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold"
                  style={{ backgroundColor: "#005bd6", color: "#ffffff" }}
                >
                  <Plus className="size-4" />
                  {t("floor.add_room")}
                </button>
              }
            />
          ) : (
            <div
              ref={floorRef}
              className={cn(
                "relative min-h-0 flex-1 select-none overscroll-contain bg-[#fbfcfe]",
                zoom > 1 ? "overflow-auto" : "overflow-hidden",
              )}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={cancelPointer}
              onClick={() => setSelectedId(null)}
            >
              <div style={{ width: Math.floor(totalW * scale), height: Math.floor(totalH * scale) }}>
                <div
                  className="relative"
                  style={{ width: totalW, height: totalH, transform: `scale(${scale})`, transformOrigin: "0 0" }}
                >
                  {/* Rulers */}
                  <DimensionLine horizontal x={RULER + WALL_INSET} y={10} length={roomW} label={`${fmtM(roomW / PX_PER_M)} m`} />
                  <DimensionLine x={10} y={RULER + WALL_INSET} length={roomH} label={`${fmtM(roomH / PX_PER_M)} m`} />

                  {/* Room: grid + walls */}
                  <div
                    className="absolute rounded-[2px]"
                    style={{
                      left: RULER + WALL_INSET,
                      top: RULER + WALL_INSET,
                      width: roomW,
                      height: roomH,
                      backgroundColor: "#ffffff",
                      backgroundImage:
                        "linear-gradient(#eef2f7 1px, transparent 1px), linear-gradient(90deg, #eef2f7 1px, transparent 1px), linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)",
                      backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px, ${GRID_SIZE}px ${GRID_SIZE}px, ${PX_PER_M}px ${PX_PER_M}px, ${PX_PER_M}px ${PX_PER_M}px`,
                      boxShadow: "inset 0 0 0 6px #8b95a5",
                    }}
                  />

                  {zoneTables.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="pointer-events-auto rounded-[14px] border border-[#e6edf5] bg-white/95 px-6 py-5 text-center shadow-sm">
                        <p className="text-sm font-semibold text-[#0f172a]">
                          {t("floor.no_tables_in_zone", { zone: activeZone ?? "" })}
                        </p>
                        <p className="mt-1 text-sm text-[#64748b]">{t("floor.add_table_to_room")}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void addTable();
                          }}
                          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold"
                          style={{ backgroundColor: "#005bd6", color: "#ffffff" }}
                        >
                          <Plus className="size-4" />
                          {t("floor.add_table")}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {zoneTables.map((raw) => {
                    const row = drawn(raw);
                    const isSel = raw._id === selectedId;
                    const isDrag = drag?.id === raw._id && dragPos;
                    const isResize = resize?.id === raw._id && resizeLive;
                    const shape = (row.shape ?? "square") as TableShape;
                    const scale = isResize
                      ? metresToScale(shape, resizeLive.widthM, resizeLive.heightM)
                      : tableScaleXY(row);
                    const { w, h } = tableFootprint(shape, scale.x, scale.y);
                    const left = RULER + (isDrag ? dragPos.x : (row.posX ?? 100) - box.minX);
                    const top = RULER + (isDrag ? dragPos.y : (row.posY ?? 100) - box.minY);
                    const st = STATUS_STYLE[(row.status as TableStatus) ?? "available"] ?? STATUS_STYLE.available;
                    const minutes = minutesSince(summaries[raw._id]?.openedAt, now);
                    const showTimer = minutes !== null && row.status !== "available";
                    return (
                      <div
                        key={raw._id}
                        data-table-id={raw._id}
                        className={cn("absolute touch-none", isDrag || isResize ? "z-40" : isSel ? "z-30" : "z-10")}
                        style={{ left, top, width: w, height: h }}
                      >
                        {chairLayout(shape, row.seats, w, h).map((c, i) => (
                          <span
                            key={i}
                            className="pointer-events-none absolute rounded-[5px]"
                            style={{
                              left: c.x,
                              top: c.y,
                              width: c.w,
                              height: c.h,
                              backgroundColor: st.chair,
                              boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.12)",
                            }}
                          />
                        ))}
                        <div
                          onPointerDown={(e) => onTablePointerDown(e, raw)}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "absolute inset-0 flex cursor-grab flex-col items-center justify-center border-2 active:cursor-grabbing",
                            shape === "circle" ? "rounded-full" : "rounded-[12px]",
                          )}
                          style={{
                            borderColor: st.border,
                            backgroundColor: st.fill,
                            boxShadow: isSel
                              ? `0 0 0 3px ${st.border}33, 0 10px 24px -12px rgba(15,23,42,0.35)`
                              : "0 4px 12px -8px rgba(15,23,42,0.3)",
                          }}
                        >
                          <span className="max-w-full truncate px-1 text-[13px] font-bold leading-tight text-[#0f172a]">
                            {row.name}
                          </span>
                          <span className="text-[11px] font-medium text-[#64748b]">{row.seats}</span>
                        </div>
                        {showTimer ? (
                          <span
                            className="pointer-events-none absolute left-1/2 -bottom-2.5 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                            style={{ backgroundColor: st.badge, color: "#ffffff" }}
                          >
                            <Clock className="size-2.5" />
                            {fmtDuration(minutes)}
                          </span>
                        ) : null}
                        {isSel ? (
                          <button
                            type="button"
                            aria-label={t("floor.resize")}
                            className="absolute -bottom-1.5 -right-1.5 size-4 cursor-nwse-resize touch-none rounded-sm border-2 border-white shadow"
                            style={{ backgroundColor: "#005bd6" }}
                            onPointerDown={(e) => onResizePointerDown(e, raw)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Inspector */}
        <aside className="hidden w-[300px] shrink-0 flex-col overflow-y-auto rounded-[16px] border border-[#e6edf5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex">
          {tool === "zones" ? (
            <ZonesPanel
              t={t}
              zones={zones}
              activeZone={activeZone}
              counts={(z) => localTables.filter((x) => x.zone === z).length}
              onPick={(z) => {
                setActiveZone(z);
                setSelectedId(null);
              }}
              newZone={newZone}
              setNewZone={setNewZone}
              creating={creatingZone}
              onAdd={() => void addZone()}
              onRename={(z) => {
                setRenameFor(z);
                setRenameValue(z);
              }}
              onDelete={(z) => void deleteZone(z)}
            />
          ) : selected && draft ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <h2 className="truncate text-[18px] font-bold text-[#0f172a]">{draft.name || selected.name}</h2>
                <StatusPill status={selected.status as TableStatus} t={t} />
              </div>
              <div className="mt-4 space-y-4">
                <Field label={t("floor.table_name")}>
                  <div className="flex gap-2">
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      className={FIELD}
                    />
                    <button
                      type="button"
                      title={t("floor.duplicate")}
                      aria-label={t("floor.duplicate")}
                      onClick={() => void duplicateSelected()}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                </Field>
                <Field label={t("floor.seats_label")}>
                  <div className="flex h-10 items-center rounded-[10px] border border-[#e2e8f0]">
                    <IconButton label="−" disabled={draft.seats <= 1} onClick={() => setDraft({ ...draft, seats: Math.max(1, draft.seats - 1) })}>
                      <Minus className="size-4" />
                    </IconButton>
                    <span className="flex-1 text-center text-sm font-semibold tabular-nums text-[#0f172a]">{draft.seats}</span>
                    <IconButton label="+" disabled={draft.seats >= 16} onClick={() => setDraft({ ...draft, seats: Math.min(16, draft.seats + 1) })}>
                      <Plus className="size-4" />
                    </IconButton>
                  </div>
                </Field>
                <Field label={t("floor.shape")}>
                  <MenuSelect
                    value={draft.shape}
                    options={[
                      { value: "square", label: t("floor.shape_square") },
                      { value: "rectangle", label: t("floor.shape_rectangle") },
                      { value: "circle", label: t("floor.shape_circle") },
                    ]}
                    onChange={(v) => {
                      const shape = v as TableShape;
                      const base = baseSize(shape);
                      setDraft({
                        ...draft,
                        shape,
                        widthM: fmtM(base.w / PX_PER_M),
                        heightM: fmtM(base.h / PX_PER_M),
                      });
                    }}
                  />
                </Field>
                <Field label={t("floor.size_wh")}>
                  <div className="grid grid-cols-2 gap-2">
                    <MetreInput
                      value={draft.widthM}
                      onChange={(v) =>
                        setDraft(draft.shape === "circle" ? { ...draft, widthM: v, heightM: v } : { ...draft, widthM: v })
                      }
                    />
                    <MetreInput
                      value={draft.heightM}
                      onChange={(v) =>
                        setDraft(draft.shape === "circle" ? { ...draft, widthM: v, heightM: v } : { ...draft, heightM: v })
                      }
                    />
                  </div>
                </Field>
                <Field label={t("floor.zone")}>
                  <MenuSelect
                    value={draft.zone}
                    options={zones.map((z) => ({ value: z, label: z }))}
                    onChange={(v) => setDraft({ ...draft, zone: v })}
                  />
                </Field>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-[#334155]">{t("floor.status")}</span>
                  <StatusPill status={selected.status as TableStatus} t={t} />
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-[#334155]">{t("floor.current_order")}</span>
                  {selectedMinutes !== null ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-[#ea580c]">
                      <Clock className="size-3.5" />
                      {selectedMinutes < 60
                        ? t("floor.minutes", { count: selectedMinutes })
                        : fmtDuration(selectedMinutes)}
                    </span>
                  ) : (
                    <span className="text-[#94a3b8]">{t("floor.no_order")}</span>
                  )}
                </div>
              </div>
              <div className="mt-auto flex gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => void deleteSelected()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#fecaca] bg-white px-3 text-sm font-semibold text-[#dc2626] hover:bg-[#fef2f2]"
                >
                  <Trash2 className="size-4" />
                  {t("floor.delete_table")}
                </button>
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  disabled={!dirty || saving}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-sm font-semibold disabled:opacity-40"
                  style={{ backgroundColor: "#005bd6", color: "#ffffff" }}
                >
                  <Check className="size-4" />
                  {saving ? "…" : t("floor.save")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#eef4ff] text-[#005bd6]">
                <ArrowRightLeft className="size-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[#0f172a]">{t("floor.inspector_empty_title")}</p>
              <p className="mt-1 text-sm text-[#64748b]">{t("floor.inspector_empty_desc")}</p>
              {activeZone ? (
                <p className="mt-4 rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-medium text-[#475569]">
                  {activeZone} · {t("floor.room_summary", { tables: zoneTables.length, seats: zoneSeats })}
                </p>
              ) : null}
            </div>
          )}
        </aside>
      </div>

      {/* Recommended sizes */}
      <section className="shrink-0 rounded-[16px] border border-[#e6edf5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-bold text-[#0f172a]">{t("floor.sizes_title")}</h3>
          <p className="text-xs text-[#64748b]">{t(selected ? "floor.sizes_hint_selected" : "floor.sizes_hint_new")}</p>
        </div>
        <div className="mt-3 flex flex-col gap-3 xl:flex-row">
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-6">
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!activeZone}
                onClick={() => applyPreset(p)}
                className="flex items-center gap-3 rounded-[12px] border border-[#eef2f6] px-3 py-2.5 text-left transition hover:border-[#005bd6]/40 hover:bg-[#f8fbff] disabled:opacity-50"
              >
                <PresetGlyph shape={p.shape} widthM={p.widthM} heightM={p.heightM} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[#005bd6]">
                    {t(p.round ? "floor.preset_round" : "floor.preset_seats", { count: p.seats })}
                  </span>
                  <span className="block text-xs font-semibold text-[#0f172a]">
                    {p.round ? `${fmtM(p.widthM)} m` : `${fmtM(p.widthM)} × ${fmtM(p.heightM)} m`}
                  </span>
                  <span className="block text-[11px] text-[#94a3b8]">
                    {t("floor.min_space")} {p.space}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-start gap-2.5 rounded-[12px] bg-[#eef4ff] px-4 py-3 xl:w-[300px]">
            <Info className="mt-0.5 size-4 shrink-0 text-[#005bd6]" />
            <div>
              <p className="text-[13px] font-semibold text-[#005bd6]">{t("floor.space_title")}</p>
              <p className="mt-0.5 text-xs leading-snug text-[#475569]">{t("floor.space_desc")}</p>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={renameFor !== null} onOpenChange={(open) => !open && setRenameFor(null)}>
        <DialogContent className="max-w-sm border-[#e6edf5] bg-white text-[#0f172a]">
          <DialogHeader>
            <DialogTitle className="text-[#0f172a]">{t("floor.rename_room")}</DialogTitle>
            <DialogDescription className="text-[#64748b]">{renameFor}</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void renameZone();
            }}
            className={FIELD}
          />
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRenameFor(null)}
              className="inline-flex h-10 items-center rounded-[10px] border border-[#e2e8f0] px-4 text-sm font-semibold text-[#0f172a]"
            >
              {t("btn.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void renameZone()}
              className="inline-flex h-10 items-center rounded-[10px] px-4 text-sm font-semibold"
              style={{ backgroundColor: "#005bd6", color: "#ffffff" }}
            >
              {t("floor.rename")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolButton({
  active,
  disabled,
  soon,
  onClick,
  icon,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  soon?: string;
  onClick?: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={soon}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-sm font-semibold transition",
        active
          ? "border-[#005bd6] bg-[#005bd6]"
          : "border-[#e2e8f0] bg-white text-[#334155] hover:bg-[#f8fafc]",
        disabled && "cursor-not-allowed opacity-45 hover:bg-white",
      )}
      style={active ? { color: "#ffffff" } : undefined}
    >
      {icon}
      {children}
      {soon ? (
        <span className="rounded-md bg-[#f1f5f9] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#64748b]">
          {soon}
        </span>
      ) : null}
    </button>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center text-[#475569] transition hover:text-[#0f172a] disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-semibold text-[#334155]">{label}</p>
      {children}
    </div>
  );
}

function MetreInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className={cn(FIELD, "pr-9")} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]">m</span>
    </div>
  );
}

function MenuSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(FIELD, "flex items-center justify-between gap-2 text-left")}>
          <span className="truncate">{current?.label ?? value}</span>
          <ChevronDown className="size-4 shrink-0 text-[#94a3b8]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn(MENU_CONTENT, "max-h-72 w-(--radix-dropdown-menu-trigger-width) overflow-y-auto")}>
        {options.map((o) => (
          <DropdownMenuItem key={o.value} className={cn(MENU_ITEM, "justify-between")} onSelect={() => onChange(o.value)}>
            <span className="truncate">{o.label}</span>
            {o.value === value ? <Check className="size-4 text-[#005bd6]" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusPill({ status, t }: { status: TableStatus; t: (k: string) => string }) {
  const st = STATUS_STYLE[status] ?? STATUS_STYLE.available;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${st.border}1a`, color: st.badge }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: st.border }} />
      {t(st.labelKey)}
    </span>
  );
}

function DimensionLine({
  horizontal,
  x,
  y,
  length,
  label,
}: {
  horizontal?: boolean;
  x: number;
  y: number;
  length: number;
  label: string;
}) {
  if (horizontal) {
    return (
      <div className="pointer-events-none absolute" style={{ left: x, top: y, width: length, height: 16 }}>
        <span className="absolute left-0 right-0 top-1/2 h-px bg-[#94a3b8]" />
        <span className="absolute left-0 top-1 h-2 w-px bg-[#94a3b8]" />
        <span className="absolute right-0 top-1 h-2 w-px bg-[#94a3b8]" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#fbfcfe] px-2 text-[12px] font-semibold text-[#334155]">
          {label}
        </span>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute" style={{ left: x, top: y, width: 16, height: length }}>
      <span className="absolute bottom-0 left-1/2 top-0 w-px bg-[#94a3b8]" />
      <span className="absolute left-1 top-0 h-px w-2 bg-[#94a3b8]" />
      <span className="absolute bottom-0 left-1 h-px w-2 bg-[#94a3b8]" />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap bg-[#fbfcfe] px-2 text-[12px] font-semibold text-[#334155]">
        {label}
      </span>
    </div>
  );
}

function PresetGlyph({ shape, widthM, heightM }: { shape: TableShape; widthM: number; heightM: number }) {
  const s = 26 / Math.max(widthM, heightM);
  const w = Math.round(widthM * s);
  const h = Math.round(heightM * s);
  return (
    <span className="flex size-9 shrink-0 items-center justify-center">
      <span
        className={cn("border-2 border-[#475569]", shape === "circle" ? "rounded-full" : "rounded-[5px]")}
        style={{ width: w, height: h }}
      />
    </span>
  );
}

function ZonesPanel({
  t,
  zones,
  activeZone,
  counts,
  onPick,
  newZone,
  setNewZone,
  creating,
  onAdd,
  onRename,
  onDelete,
}: {
  t: (k: string, o?: Record<string, unknown>) => string;
  zones: string[];
  activeZone: string | null;
  counts: (zone: string) => number;
  onPick: (zone: string) => void;
  newZone: string;
  setNewZone: (v: string) => void;
  creating: boolean;
  onAdd: () => void;
  onRename: (zone: string) => void;
  onDelete: (zone: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-[18px] font-bold text-[#0f172a]">{t("floor.zones_title")}</h2>
      <p className="mt-0.5 text-sm text-[#64748b]">{t("floor.zones_desc")}</p>
      <div className="mt-4 space-y-1.5">
        {zones.map((z) => (
          <div
            key={z}
            className={cn(
              "flex items-center gap-2 rounded-[12px] border px-3 py-2",
              z === activeZone ? "border-[#005bd6] bg-[#eef4ff]" : "border-[#eef2f6] bg-white",
            )}
          >
            <button type="button" onClick={() => onPick(z)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold text-[#0f172a]">{z}</span>
              <span className="block text-xs text-[#64748b]">{t("floor.zone_tables", { count: counts(z) })}</span>
            </button>
            <button
              type="button"
              aria-label={t("floor.rename_room")}
              onClick={() => onRename(z)}
              className="inline-flex size-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-white hover:text-[#005bd6]"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={t("floor.delete_room")}
              onClick={() => onDelete(z)}
              className="inline-flex size-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-white hover:text-[#dc2626]"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={newZone}
          onChange={(e) => setNewZone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !creating) onAdd();
          }}
          placeholder={t("floor.room_name_ph")}
          className={FIELD}
        />
        <button
          type="button"
          disabled={creating || !newZone.trim()}
          onClick={onAdd}
          className="inline-flex h-10 shrink-0 items-center gap-1 rounded-[10px] px-3 text-sm font-semibold disabled:opacity-40"
          style={{ backgroundColor: "#005bd6", color: "#ffffff" }}
        >
          <Plus className="size-4" />
          {t("floor.add_zone")}
        </button>
      </div>
      <p className="mt-2 text-xs text-[#94a3b8]">{t("floor.zone_first_table")}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-[#0f172a]">{title}</p>
      <p className="mt-1 max-w-md text-sm text-[#64748b]">{description}</p>
      {action}
    </div>
  );
}
