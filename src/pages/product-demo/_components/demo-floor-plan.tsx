import { Users } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { DemoTable } from "../_data.ts";

const STATUS_STYLES: Record<DemoTable["status"], string> = {
  available: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
  occupied: "border-amber-500/40 bg-amber-500/10 text-amber-300 cursor-not-allowed opacity-80",
  reserved: "border-violet-500/40 bg-violet-500/10 text-violet-300 cursor-not-allowed opacity-80",
};

const STATUS_DOT: Record<DemoTable["status"], string> = {
  available: "bg-emerald-400",
  occupied: "bg-amber-400",
  reserved: "bg-violet-400",
};

export default function DemoFloorPlan({
  tables,
  onSelectTable,
}: {
  tables: DemoTable[];
  onSelectTable: (id: string) => void;
}) {
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-[#8b93a7]">
        <Legend color={STATUS_DOT.available} label="Available" />
        <Legend color={STATUS_DOT.occupied} label="Occupied" />
        <Legend color={STATUS_DOT.reserved} label="Reserved" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {tables.map((table) => (
          <button
            key={table.id}
            type="button"
            disabled={table.status !== "available"}
            onClick={() => onSelectTable(table.id)}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 transition-colors",
              STATUS_STYLES[table.status],
            )}
          >
            <span className="text-lg font-bold text-white">{table.label}</span>
            <span className="flex items-center gap-1 text-[11px] text-current">
              <Users className="size-3" />
              {table.seats}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-current">
              {table.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", color)} />
      {label}
    </span>
  );
}
