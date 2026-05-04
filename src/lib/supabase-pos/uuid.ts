/** PostgreSQL uuid v1–v5 (RFC 4122) — rejects Convex-style ids and placeholders like `local-admin`. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function uuidOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return UUID_RE.test(s) ? s : null;
}

/** PIN admin from device setup — not a row in `public.staff`. */
export function isLocalDevicePosAdmin(value: string | null | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === "local-admin";
}

/** Case-insensitive UUID compare (floor plan / order ownership). */
export function staffIdsEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ua = uuidOrNull(a ?? undefined);
  const ub = uuidOrNull(b ?? undefined);
  if (!ua || !ub) return false;
  return ua.toLowerCase() === ub.toLowerCase();
}
