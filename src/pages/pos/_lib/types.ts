export type StaffRole = "admin" | "manager" | "waiter" | "inventory" | "accountant" | "auditor" | "kitchen";

export type ActiveStaff = {
  id: string;
  name: string;
  role: StaffRole;
};

export type PosView =
  | "home"
  | "menu"
  | "tables"
  | "staff"
  | "floor"
  | "order"
  | "dashboard"
  | "z-report"
  | "stock"
  | "debt-ledger"
  | "audit-log"
  | "settings"
  | "order-history"
  | "kitchen-display";

export type TableStatus = "available" | "occupied" | "reserved" | "bill-printed";
export type TableShape = "square" | "circle" | "rectangle";
