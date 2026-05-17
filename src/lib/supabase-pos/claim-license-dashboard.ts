import { setDashboardRestaurantId } from "@/hooks/use-dashboard-restaurant.ts";
import { supabase } from "@/lib/supabase.ts";

function isMissingClaimRpcError(err: { message?: string }): boolean {
  const m = String(err.message ?? "").toLowerCase();
  return (
    m.includes("could not find the function") ||
    m.includes("vyntex_claim_license_by_key") ||
    (m.includes("schema cache") && m.includes("function"))
  );
}

/**
 * Links an unassigned (`owner_user_id` null) restaurant row to the current Supabase session.
 * Run migration `020_vyntex_claim_license_by_key.sql` on the project so the RPC exists.
 */
export async function claimUnassignedLicenseForDashboardAccount(
  rawLicenseKey: string,
): Promise<{ id: string; licenseKey: string }> {
  const key = rawLicenseKey.trim();
  if (key.replace(/[^a-zA-Z0-9]/g, "").length < 16) {
    throw new Error("Enter the full 16-character license key.");
  }

  const { data, error } = await supabase.rpc("vyntex_claim_license_by_key", {
    p_license: key,
  });

  if (error) {
    if (isMissingClaimRpcError(error)) {
      throw new Error(
        "The claim function is not installed on this database. Run migration 020_vyntex_claim_license_by_key.sql in the Supabase SQL Editor, then try again.",
      );
    }
    throw new Error(error.message);
  }

  const list = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
  const row = list[0] as { id: string; license_key: string } | undefined;
  if (!row?.id || !row.license_key) {
    throw new Error("Could not read the linked license from the server.");
  }

  const licenseKey = String(row.license_key).trim().toUpperCase();
  const id = String(row.id);

  setDashboardRestaurantId(id);

  return { id, licenseKey };
}
