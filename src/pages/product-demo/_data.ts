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

export const DEMO_MENU_ITEMS: DemoMenuItem[] = [
  { id: "m1", name: "Bruschetta", price: 6.5, category: "Starters", emoji: "🍞", available: true },
  { id: "m2", name: "Caesar Salad", price: 8, category: "Starters", emoji: "🥗", available: true },
  { id: "m3", name: "Soup of the Day", price: 5.5, category: "Starters", emoji: "🍲", available: true },
  { id: "m4", name: "Grilled Salmon", price: 18, category: "Mains", emoji: "🐟", available: true },
  { id: "m5", name: "Ribeye Steak", price: 24, category: "Mains", emoji: "🥩", available: true },
  { id: "m6", name: "Margherita Pizza", price: 12, category: "Mains", emoji: "🍕", available: true },
  { id: "m7", name: "Truffle Pasta", price: 15, category: "Mains", emoji: "🍝", available: false },
  { id: "m8", name: "Sparkling Water", price: 2.5, category: "Drinks", emoji: "💧", available: true },
  { id: "m9", name: "House Red Wine", price: 7, category: "Drinks", emoji: "🍷", available: true },
  { id: "m10", name: "Espresso", price: 2, category: "Drinks", emoji: "☕", available: true },
  { id: "m11", name: "Tiramisu", price: 6, category: "Desserts", emoji: "🍰", available: true },
  { id: "m12", name: "Gelato", price: 5, category: "Desserts", emoji: "🍨", available: true },
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
