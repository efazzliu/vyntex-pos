export type StaffRole = "admin" | "waiter" | "kitchen";

export type ActiveStaff = {
  id: string;
  name: string;
  role: StaffRole;
};

export type PosView = "home" | "menu" | "tables" | "staff";
