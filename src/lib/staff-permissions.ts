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

/** Only admin is locked to every permission in the role editor. */
export function isFullAccessStaffRole(role: string | undefined): boolean {
  return role === "admin";
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
  const raw = staff.permissions;
  if (raw && typeof raw === "object" && typeof raw[key] === "boolean") {
    return raw[key] === true;
  }
  // Managers (and other roles) without a stored row fall back to the role template.
  return permissionsForRole(staff.role ?? "")[key] === true;
}

// ── Module permission grid (Settings → Users & roles) ──────────────────────

export type StaffModuleId =
  | "orders"
  | "tables"
  | "payments"
  | "discounts"
  | "menu"
  | "stock"
  | "reports"
  | "house"
  | "staff"
  | "settings"
  | "fiscal";

export type StaffModuleAction = "view" | "create" | "edit" | "delete";

export const STAFF_MODULE_IDS: StaffModuleId[] = [
  "orders",
  "tables",
  "payments",
  "discounts",
  "menu",
  "stock",
  "reports",
  "house",
  "staff",
  "settings",
  "fiscal",
];

export const STAFF_MODULE_ACTIONS: StaffModuleAction[] = ["view", "create", "edit", "delete"];

export type StaffModuleMatrix = Partial<
  Record<StaffModuleId, Partial<Record<StaffModuleAction, boolean>>>
>;

/**
 * Every grid cell that changes something in the POS. A permission key is the
 * existing per-staff switch; "access" cells live only in `permissions.modules`.
 * Cells not listed here have no feature behind them and are not shown as checkboxes.
 */
export const STAFF_MODULE_CELLS: Record<
  StaffModuleId,
  Partial<Record<StaffModuleAction, StaffPermissionKey | "access">>
> = {
  orders: { view: "access", delete: "canVoidItems" },
  tables: {
    view: "access",
    create: "access",
    edit: "canTransferTables",
    delete: "canMergeTables",
  },
  payments: {
    view: "canChargeDebt",
    create: "access",
    edit: "canSplitBills",
    delete: "access",
  },
  discounts: { create: "canGiveDiscount" },
  menu: { view: "access", edit: "canManageMenu" },
  stock: { view: "access", create: "canLogStaffConsumption", edit: "canManageStock" },
  reports: { view: "canViewReports" },
  house: { create: "canMarkComplimentary" },
  staff: { view: "access", edit: "access" },
  settings: { view: "access" },
  fiscal: { view: "canViewAuditLog" },
};

type AccessDefaults = Partial<Record<StaffModuleId, Partial<Record<StaffModuleAction, boolean>>>>;

const ALL_ACCESS: AccessDefaults = {
  orders: { view: true },
  tables: { view: true, create: true },
  payments: { create: true, delete: true },
  menu: { view: true },
  stock: { view: true },
  staff: { view: true, edit: true },
  settings: { view: true },
};

/** What each role could already reach before the grid was saved for it. */
const ROLE_ACCESS_DEFAULTS: Record<StaffRole, AccessDefaults> = {
  admin: ALL_ACCESS,
  manager: ALL_ACCESS,
  cashier: { tables: { view: true }, payments: { create: true } },
  waiter: { tables: { view: true } },
  kitchen: {},
  inventory: { stock: { view: true } },
  accountant: {},
  auditor: {},
};

export function isStaffModuleCell(module: StaffModuleId, action: StaffModuleAction): boolean {
  return STAFF_MODULE_CELLS[module]?.[action] != null;
}

function storedModules(
  staff: StaffPermissionHolder | null | undefined,
): StaffModuleMatrix | undefined {
  const raw = (staff?.permissions as { modules?: unknown } | null | undefined)?.modules;
  return raw && typeof raw === "object" ? (raw as StaffModuleMatrix) : undefined;
}

/** The value saved in the grid for this staff member, or undefined when never saved. */
export function staffModuleExplicit(
  staff: StaffPermissionHolder | null | undefined,
  module: StaffModuleId,
  action: StaffModuleAction,
): boolean | undefined {
  const value = storedModules(staff)?.[module]?.[action];
  return typeof value === "boolean" ? value : undefined;
}

/** Whether the grid allows this module action for the staff member. */
export function staffCan(
  staff: StaffPermissionHolder | null | undefined,
  module: StaffModuleId,
  action: StaffModuleAction,
): boolean {
  if (!staff || staff.isActive === false) return false;
  if (isFullAccessStaffRole(staff.role)) return true;
  const cell = STAFF_MODULE_CELLS[module]?.[action];
  if (!cell) return false;
  if (cell !== "access") return staffHasPermission(staff, cell);
  const explicit = staffModuleExplicit(staff, module, action);
  if (explicit !== undefined) return explicit;
  return ROLE_ACCESS_DEFAULTS[staff.role as StaffRole]?.[module]?.[action] === true;
}

/** Grid as it should look for a role (or staff) that has not been saved yet. */
export function defaultModuleMatrix(
  role: string,
  perms: StaffPermissions,
  saved?: StaffModuleMatrix | null,
): Record<StaffModuleId, Record<StaffModuleAction, boolean>> {
  const holder: StaffPermissionHolder = {
    role,
    isActive: true,
    permissions: { ...perms, modules: saved ?? undefined },
  };
  const out = {} as Record<StaffModuleId, Record<StaffModuleAction, boolean>>;
  for (const module of STAFF_MODULE_IDS) {
    const row = {} as Record<StaffModuleAction, boolean>;
    for (const action of STAFF_MODULE_ACTIONS) {
      row[action] = isStaffModuleCell(module, action) && staffCan(holder, module, action);
    }
    out[module] = row;
  }
  return out;
}

/** Turn a saved grid into the stored permissions object (switches + module access). */
export function permissionsFromModuleMatrix(
  matrix: StaffModuleMatrix,
): StaffPermissions & { modules: StaffModuleMatrix } {
  const perms = { ...ALL_OFF };
  const modules: StaffModuleMatrix = {};
  for (const module of STAFF_MODULE_IDS) {
    for (const action of STAFF_MODULE_ACTIONS) {
      const cell = STAFF_MODULE_CELLS[module]?.[action];
      if (!cell) continue;
      const on = matrix[module]?.[action] === true;
      if (cell === "access") {
        modules[module] = { ...(modules[module] ?? {}), [action]: on };
      } else if (on) {
        perms[cell] = true;
      }
    }
  }
  return { ...perms, modules };
}

/** Keep the saved grid when a staff row is re-saved from another editor. */
export function withStoredModules<T extends object>(
  perms: T,
  previous: Record<string, unknown> | null | undefined,
): T & { modules?: StaffModuleMatrix } {
  const modules = (previous as { modules?: unknown } | null | undefined)?.modules;
  if (!modules || typeof modules !== "object") return perms;
  return { ...perms, modules: modules as StaffModuleMatrix };
}

let roleModuleOverrides: Partial<Record<StaffRole, StaffModuleMatrix>> = {};

export function setRoleModuleOverrides(
  map: Partial<Record<StaffRole, StaffModuleMatrix>> | null | undefined,
): void {
  roleModuleOverrides = map && typeof map === "object" ? { ...map } : {};
}

/** Saved grid for a role, used when a new staff member gets that role. */
export function modulesForRole(role: string): StaffModuleMatrix | undefined {
  if (isFullAccessStaffRole(role)) return undefined;
  const matrix = roleModuleOverrides[role as StaffRole];
  if (!matrix) return undefined;
  return permissionsFromModuleMatrix(matrix).modules;
}

export const STAFF_PERMISSION_DENIED =
  "This action is not allowed for your role. / Ky veprim nuk lejohet për rolin tuaj.";

export const STAFF_INACTIVE_DENIED =
  "This staff account is inactive. / Kjo llogari stafi është joaktive.";
