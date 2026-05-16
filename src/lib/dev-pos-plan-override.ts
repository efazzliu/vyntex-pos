import { normalizePlan, type PlanName } from "@/pages/pos/_lib/plan-features.ts";

/**
 * Dev-only: set `VITE_POS_DEV_PLAN` to `starter`, `professional`, or `enterprise` so the
 * POS client uses that tier for UI/feature gates without changing Supabase. Ignored in production builds.
 */
export function devPosPlanDisplayOverride(plan: PlanName): PlanName {
  if (!import.meta.env.DEV) return plan;
  const raw = import.meta.env.VITE_POS_DEV_PLAN;
  if (typeof raw !== "string") return plan;
  const trimmed = raw.trim();
  if (!trimmed) return plan;
  return normalizePlan(trimmed);
}
