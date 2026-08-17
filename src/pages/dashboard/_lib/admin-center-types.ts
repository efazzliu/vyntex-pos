import type { OwnedRestaurantRow } from "@/lib/supabase-pos/phone-pos-session.ts";

export type DatePreset =
  | "today"
  | "week"
  | "month"
  | "last_month"
  | "quarter"
  | "year"
  | "custom";

export type ChartRange = "7d" | "30d" | "3m" | "1y";

export type VenueMetric = "revenue" | "orders" | "customers" | "average";

export type LicenseHealth = "active" | "expiring" | "expired";

export type AdminVenue = OwnedRestaurantRow & {
  city: string;
  daysRemaining: number | null;
  health: LicenseHealth;
  planLabel: string;
};

export type VenuePerformance = {
  venueId: string;
  name: string;
  city: string;
  plan: string;
  health: LicenseHealth;
  daysRemaining: number | null;
  licenseKey: string;
  revenue: number;
  orders: number;
  customers: number;
  averageOrder: number;
  growth: number;
  staff: number;
  tables: number;
  lastActive: string | null;
  spark: number[];
};

export type RevenuePoint = {
  key: string;
  label: string;
  date: string;
  revenue: number;
  orders: number;
};

export type AdminActivityItem = {
  id: string;
  tone: "green" | "blue" | "violet" | "orange" | "red";
  title: string;
  venue: string;
  at: string;
  relative: string;
};

export type RenewTerm = "1m" | "1y" | "2y";

export const RENEW_OPTIONS: { id: RenewTerm; label: string; months: number; price: number }[] = [
  { id: "1m", label: "1 Month", months: 1, price: 29 },
  { id: "1y", label: "1 Year", months: 12, price: 290 },
  { id: "2y", label: "2 Years", months: 24, price: 520 },
];
