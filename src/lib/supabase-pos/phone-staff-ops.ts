import { supabase } from "@/lib/supabase.ts";
import { assertNoPgError } from "./db-errors.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { getStaff } from "./staff-ops.ts";

/**
 * Lista e stafit + kush ka turn të hapur (`shifts.clock_out` null) → “Online”.
 */
export async function fetchPhoneStaffBundle(licenseKey: string) {
  const r = await getRestaurantByLicense(licenseKey);
  const [{ data: shiftRows, error: shiftErr }, staff] = await Promise.all([
    supabase
      .from("shifts")
      .select("staff_id")
      .eq("restaurant_id", r.id)
      .is("clock_out", null),
    getStaff(licenseKey),
  ]);
  assertNoPgError("Phone staff: open shifts", shiftErr);
  const onlineStaffIds = new Set(
    (shiftRows ?? []).map((row) => String(row.staff_id ?? "")).filter(Boolean),
  );
  return { staff, onlineStaffIds };
}
