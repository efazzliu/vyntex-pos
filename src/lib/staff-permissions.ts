import type { StaffRole } from "@/pages/pos/_lib/types.ts";

export type StaffPermissionKey =
  | "canVoidItems"
  | "canGiveDiscount"
  | "canTransferTables"
  | "canMergeTables"
  | "canSplitBills"
  | "canViewReports"
  | "canManageMenu"
  | "canManageStock"
  | "canLogStaffConsumption"
  | "canChargeDebt"
  | "canMarkComplimentary"
  | "canViewAuditLog";

export type StaffPermissions = Record<StaffPermissionKey, boolean>;

export const STAFF_PERMISSION_KEYS: StaffPermissionKey[] = [
  "canVoidItems",
  "canGiveDiscount",
  "canTransferTables",
  "canMergeTables",
  "canSplitBills",
  "canViewReports",
  "canManageMenu",
  "canManageStock",
  "canLogStaffConsumption",
  "canChargeDebt",
  "canMarkComplimentary",
  "canViewAuditLog",
];

const ALL_ON: StaffPermissions = {
  canVoidItems: true,
  canGiveDiscount: true,
  canTransferTables: true,
  canMergeTables: true,
  canSplitBills: true,
  canViewReports: true,
  canManageMenu: true,
  canManageStock: true,
  canLogStaffConsumption: true,
  canChargeDebt: true,
  canMarkComplimentary: true,
  canViewAuditLog: true,
};

const ALL_OFF: StaffPermissions = {
  canVoidItems: false,
  canGiveDiscount: false,
  canTransferTables: false,
  canMergeTables: false,
  canSplitBills: false,
  canViewReports: false,
  canManageMenu: false,
  canManageStock: false,
  canLogStaffConsumption: false,
  canChargeDebt: false,
  canMarkComplimentary: false,
  canViewAuditLog: false,
};

/** Default permission set applied when a staff role is selected. */
export const ROLE_PERMISSION_TEMPLATES: Record<StaffRole, StaffPermissions> = {
  admin: { ...ALL_ON },
  manager: { ...ALL_ON },
  cashier: {
    ...ALL_OFF,
    canSplitBills: true,
  },
  waiter: {
    ...ALL_OFF,
    canTransferTables: true,
  },
  kitchen: { ...ALL_OFF },
  inventory: {
    ...ALL_OFF,
    canManageStock: true,
  },
  accountant: {
    ...ALL_OFF,
    canViewReports: true,
  },
  auditor: {
    ...ALL_OFF,
    canViewReports: true,
    canViewAuditLog: true,
  },
};

/** Venue-level overrides of role defaults (e.g. from Role Permissions editor). */
let rolePermissionOverrides: Partial<Record<StaffRole, StaffPermissions>> = {};

export function rolePermissionOverridesCacheKey(licenseKey: string): string {
  return `role-perm-templates:${licenseKey}`;
}

export function loadRolePermissionOverrides(
  map: Partial<Record<StaffRole, Partial<StaffPermissions>>> | null | undefined,
): void {
  const next: Partial<Record<StaffRole, StaffPermissions>> = {};
  if (map && typeof map === "object") {
    for (const role of Object.keys(map) as StaffRole[]) {
      if (isFullAccessStaffRole(role)) continue;
      const raw = map[role];
      if (!raw || typeof raw !== "object") continue;
      const base = ROLE_PERMISSION_TEMPLATES[role]
        ? { ...ROLE_PERMISSION_TEMPLATES[role] }
        : { ...ALL_OFF };
      for (const key of STAFF_PERMISSION_KEYS) {
        if (typeof raw[key] === "boolean") base[key] = raw[key];
      }
      next[role] = base;
    }
  }
  rolePermissionOverrides = next;
}

export function setRolePermissionOverride(role: StaffRole, perms: StaffPermissions): void {
  if (isFullAccessStaffRole(role)) return;
  rolePermissionOverrides = {
    ...rolePermissionOverrides,
    [role]: { ...perms },
  };
}

export function getRolePermissionOverrides(): Partial<Record<StaffRole, StaffPermissions>> {
  const out: Partial<Record<StaffRole, StaffPermissions>> = {};
  for (const role of Object.keys(rolePermissionOverrides) as StaffRole[]) {
    const perms = rolePermissionOverrides[role];
    if (perms) out[role] = { ...perms };
  }
  return out;
}

export const PRIMARY_STAFF_ROLES: StaffRole[] = [
  "admin",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
];

export const PERMISSION_LABEL_KEYS: Record<StaffPermissionKey, string> = {
  canVoidItems: "staff.perm_void_label",
  canGiveDiscount: "staff.perm_discount_label",
  canTransferTables: "staff.perm_transfer_label",
  canMergeTables: "staff.perm_merge_label",
  canSplitBills: "staff.perm_split_label",
  canViewReports: "staff.perm_reports_label",
  canManageMenu: "staff.perm_menu_label",
  canManageStock: "staff.perm_stock_label",
  canLogStaffConsumption: "staff.perm_consumption_label",
  canChargeDebt: "staff.perm_debt_label",
  canMarkComplimentary: "staff.perm_complimentary_label",
  canViewAuditLog: "staff.perm_audit_label",
};

export function isFullAccessStaffRole(role: string | undefined): boolean {
  return role === "admin" || role === "manager";
}

export function isFloorStaffRole(role: string | undefined): boolean {
  return role === "waiter" || role === "cashier";
}

export function permissionsForRole(role: string): StaffPermissions {
  if (isFullAccessStaffRole(role)) return { ...ALL_ON };
  const override = rolePermissionOverrides[role as StaffRole];
  if (override) return { ...override };
  if (role in ROLE_PERMISSION_TEMPLATES) {
    return { ...ROLE_PERMISSION_TEMPLATES[role as StaffRole] };
  }
  return { ...ALL_OFF };
}

export function enabledPermissionKeys(perms: StaffPermissions): StaffPermissionKey[] {
  return STAFF_PERMISSION_KEYS.filter((key) => perms[key]);
}

export type StaffPermissionHolder = {
  role?: string;
  isActive?: boolean;
  permissions?: Partial<StaffPermissions> | Record<string, unknown> | null;
};

export function staffHasPermission(
  staff: StaffPermissionHolder | null | undefined,
  key: StaffPermissionKey,
): boolean {
  if (!staff || staff.isActive === false) return false;
  if (isFullAccessStaffRole(staff.role)) return true;
  return staff.permissions?.[key] === true;
}

export const STAFF_PERMISSION_DENIED =
  "This action is not allowed for your role. / Ky veprim nuk lejohet për rolin tuaj.";

export const STAFF_INACTIVE_DENIED =
  "This staff account is inactive. / Kjo llogari stafi është joaktive.";
