import { supabase } from "@/lib/supabase.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { staffFromRow } from "./mappers.ts";
import { isLocalDevicePosAdmin, uuidOrNull } from "./uuid.ts";
import {
  STAFF_INACTIVE_DENIED,
  STAFF_PERMISSION_DENIED,
  isFullAccessStaffRole,
  staffHasPermission,
  type StaffPermissionKey,
} from "@/lib/staff-permissions.ts";

function rlsOr(error: { message?: string; code?: string } | null): Error | null {
  if (!error) return null;
  const msg = String(error.message ?? "").toLowerCase();
  const isRls =
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    String(error.code ?? "") === "42501";
  if (!isRls) return null;
  return new Error(STAFF_PERMISSION_DENIED);
}

export async function loadStaffMember(licenseKey: string, staffId: string) {
  const r = await getRestaurantByLicense(licenseKey);
  const sid = uuidOrNull(staffId);
  if (!sid) return null;
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("id", sid)
    .eq("restaurant_id", r.id)
    .maybeSingle();
  if (error) throw rlsOr(error) ?? error;
  if (!data) return null;
  return staffFromRow(data as Parameters<typeof staffFromRow>[0]);
}

export async function assertStaffPermission(args: {
  licenseKey: string;
  staffId?: string | null;
  permission: StaffPermissionKey;
}): Promise<void> {
  const staffId = String(args.staffId ?? "").trim();
  if (!staffId) throw new Error(STAFF_PERMISSION_DENIED);
  if (isLocalDevicePosAdmin(staffId)) return;
  const staff = await loadStaffMember(args.licenseKey, staffId);
  if (!staff) throw new Error(STAFF_PERMISSION_DENIED);
  if (staff.isActive === false) throw new Error(STAFF_INACTIVE_DENIED);
  if (!staffHasPermission(staff, args.permission)) {
    throw new Error(STAFF_PERMISSION_DENIED);
  }
}

export async function assertStaffCanManageStaff(args: {
  licenseKey: string;
  actorStaffId?: string | null;
}): Promise<void> {
  const actorId = String(args.actorStaffId ?? "").trim();
  if (!actorId) return;
  if (isLocalDevicePosAdmin(actorId)) return;
  const staff = await loadStaffMember(args.licenseKey, actorId);
  if (!staff) throw new Error(STAFF_PERMISSION_DENIED);
  if (staff.isActive === false) throw new Error(STAFF_INACTIVE_DENIED);
  if (!isFullAccessStaffRole(staff.role)) {
    throw new Error(STAFF_PERMISSION_DENIED);
  }
}
