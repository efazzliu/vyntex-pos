import { supabase } from "@/lib/supabase.ts";
import { assertNoPgError } from "./db-errors.ts";

/** PostgREST has not reloaded after DDL, or table is not exposed to the API role. */
export function isPostgrestExposeOrCacheError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("could not find the table") ||
    m.includes("could not find the relation")
  );
}

/**
 * Floor status sync is best-effort: the sale row is already committed.
 * Skips when `pos_floor_tables` is missing from the API schema cache.
 */
export async function updateFloorTableStatusSafe(
  tableId: string,
  status: "occupied" | "available" | "reserved" | "bill-printed",
  context: string,
): Promise<void> {
  const id = tableId.trim();
  if (!id) return;
  const { error } = await supabase
    .from("pos_floor_tables")
    .update({ status })
    .eq("id", id);
  if (!error) return;
  if (isPostgrestExposeOrCacheError(error.message)) {
    console.warn(`[POS] ${context} (skipped):`, error.message);
    return;
  }
  assertNoPgError(context, error);
}

export async function getFloorTableNameOrUnknown(tableId: string): Promise<string> {
  const id = tableId.trim();
  if (!id) return "Unknown";
  const { data, error } = await supabase
    .from("pos_floor_tables")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  if (!error && data?.name) return data.name;
  if (error && isPostgrestExposeOrCacheError(error.message)) return "Unknown";
  if (error) throw new Error(`Load table name: ${error.message}`);
  return "Unknown";
}
