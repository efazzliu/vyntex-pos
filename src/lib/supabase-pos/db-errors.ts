/** Normalize Supabase PostgREST errors for UI and logging. */

/** True when Postgres reports a missing column (migration 002 not applied on `sale_items`, etc.). */
export function isMissingPgColumnError(message: string, columnName: string): boolean {
  const m = message.toLowerCase();
  const col = columnName.toLowerCase().replace(/"/g, "");
  if (!m.includes(col)) return false;
  // Postgres: column "x" does not exist
  if (m.includes("does not exist")) return true;
  // PostgREST schema cache (Supabase): Could not find the 'x' column of 't' in the schema cache
  if (m.includes("could not find") && m.includes("schema cache")) return true;
  return false;
}

export function assertNoPgError(
  context: string,
  error: { message: string; details?: string; hint?: string; code?: string } | null,
): void {
  if (!error) return;
  const parts = [error.message, error.details, error.hint].filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  throw new Error(
    parts.length > 0
      ? `${context}: ${parts.join(" — ")}`
      : `${context} (${error.code ?? "unknown"})`,
  );
}

export function errorMessageFromUnknown(
  e: unknown,
  fallback = "Something went wrong",
): string {
  if (e instanceof Error && e.message.trim()) return e.message;
  if (e !== null && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

/** PostgREST when a table was never created or the schema cache is stale. */
export function isMissingSupabaseTableError(
  message: string,
  tableName: string,
): boolean {
  const m = message.toLowerCase().replace(/"/g, "");
  const short = tableName.toLowerCase().replace(/^public\./, "");
  return (
    m.includes(short) &&
    (m.includes("schema cache") ||
      m.includes("does not exist") ||
      m.includes("could not find the table"))
  );
}
