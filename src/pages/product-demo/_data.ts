import { photoUrlForMenuItem } from "@/lib/menu-item-photo-urls.ts";

export type DemoTableStatus = "available" | "occupied" | "reserved";

export type DemoTable = {
  id: string;
  label: string;
  seats: number;
  status: DemoTableStatus;
};

export type DemoMenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  emoji: string;
  imageUrl: string;
  available: boolean;
};

export type DemoStaffMember = {
  id: string;
  name: string;
  role: "admin" | "manager" | "waiter" | "kitchen";
  color: string;
};

export type DemoOrderLine = {
  itemId: string;
  qty: number;
};

export const DEMO_TABLES: DemoTable[] = [
  { id: "t1", label: "T1", seats: 2, status: "available" },
  { id: "t2", label: "T2", seats: 4, status: "occupied" },
  { id: "t3", label: "T3", seats: 4, status: "available" },
  { id: "t4", label: "T4", seats: 2, status: "reserved" },
  { id: "t5", label: "T5", seats: 6, status: "available" },
  { id: "t6", label: "T6", seats: 4, status: "occupied" },
  { id: "t7", label: "T7", seats: 2, status: "available" },
  { id: "t8", label: "T8", seats: 4, status: "available" },
];

export const DEMO_CATEGORIES = ["Starters", "Mains", "Drinks", "Desserts"] as const;

const demoItem = (
  id: string,
  name: string,
  price: number,
  category: string,
  emoji: string,
  available: boolean,
): DemoMenuItem => ({
  id,
  name,
  price,
  category,
  emoji,
  imageUrl: photoUrlForMenuItem(name, category),
  available,
});

export const DEMO_MENU_ITEMS: DemoMenuItem[] = [
  demoItem("m1", "Bruschetta", 6.5, "Starters", "🍞", true),
  demoItem("m2", "Caesar Salad", 8, "Starters", "🥗", true),
  demoItem("m3", "Soup of the Day", 5.5, "Starters", "🍲", true),
  demoItem("m4", "Grilled Salmon", 18, "Mains", "🐟", true),
  demoItem("m5", "Ribeye Steak", 24, "Mains", "🥩", true),
  demoItem("m6", "Margherita Pizza", 12, "Mains", "🍕", true),
  demoItem("m7", "Truffle Pasta", 15, "Mains", "🍝", false),
  demoItem("m8", "Sparkling Water", 2.5, "Drinks", "💧", true),
  demoItem("m9", "House Red Wine", 7, "Drinks", "🍷", true),
  demoItem("m10", "Espresso", 2, "Drinks", "☕", true),
  demoItem("m11", "Tiramisu", 6, "Desserts", "🍰", true),
  demoItem("m12", "Gelato", 5, "Desserts", "🍨", true),
];

export const DEMO_STAFF: DemoStaffMember[] = [
  { id: "s1", name: "Endrit F.", role: "admin", color: "#0066FF" },
  { id: "s2", name: "Ana K.", role: "manager", color: "#44CC00" },
  { id: "s3", name: "Bledi M.", role: "waiter", color: "#00AACC" },
  { id: "s4", name: "Sara L.", role: "waiter", color: "#F59E0B" },
  { id: "s5", name: "Gent P.", role: "kitchen", color: "#EF4444" },
];

export const DEMO_WEEKLY_SALES = [
  { day: "Mon", sales: 820 },
  { day: "Tue", sales: 932 },
  { day: "Wed", sales: 1010 },
  { day: "Thu", sales: 980 },
  { day: "Fri", sales: 1420 },
  { day: "Sat", sales: 1680 },
  { day: "Sun", sales: 1240 },
];

export const TAX_RATE = 0.1;
