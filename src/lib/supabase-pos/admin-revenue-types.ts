import type { PlanName } from "@/pages/pos/_lib/plan-features.ts";

export type AdminMrrTrendPoint = {
  label: string;
  monthTitle: string;
  mrrEur: number;
};

export type AdminPlanDistributionRange =
  | "this_month"
  | "last_month"
  | "last_6_months"
  | "last_12_months"
  | "all_time";

export type AdminPlanDistribution = {
  starter: number;
  professional: number;
  enterprise: number;
  total: number;
};

export type AdminPayingByPlanPoint = {
  label: string;
  monthTitle: string;
  starter: number;
  professional: number;
  enterprise: number;
};

export type AdminTransactionCategory = "restaurant_pos";

export type AdminTransactionCycle = "monthly" | "yearly";

export type AdminTransactionStatus = "paid" | "pending" | "failed" | "refunded";

export type AdminTransactionMethod = "card" | "bank_transfer" | "paypal";

export type AdminRecentTransaction = {
  id: string;
  customerName: string;
  customerEmail: string;
  category: AdminTransactionCategory;
  plan: PlanName;
  cycle: AdminTransactionCycle;
  amountEur: number;
  status: AdminTransactionStatus;
  method: AdminTransactionMethod;
  createdAt: string;
};
