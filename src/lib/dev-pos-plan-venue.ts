import { supabase, isSupabaseConfigured } from "@/lib/supabase.ts";
import { activateLicense } from "@/lib/supabase-pos.ts";
import {
  getActivation,
  getOrCreateDeviceId,
  saveActivation,
  type ActivationData,
} from "@/lib/local-db.ts";
import { licenseKeyLookupVariants } from "@/lib/license-key-variants.ts";
import { normalizePlan, type PlanName } from "@/pages/pos/_lib/plan-features.ts";

const DEV_PLAN_TEST_VENUES: Record<PlanName, string> = {
  starter: "Starter Test Venue",
  professional: "Professional Test Venue",
  enterprise: "Enterprise Test Venue",
};

export function getDevPosPlanEnv(): PlanName | null {
  if (!import.meta.env.DEV) return null;
  const raw = import.meta.env.VITE_POS_DEV_PLAN;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return normalizePlan(raw.trim());
}

function keysMatch(a: string, b: string): boolean {
  const av = new Set(licenseKeyLookupVariants(a));
  return licenseKeyLookupVariants(b).some((k) => av.has(k));
}

/**
 * When `npm run dev:restaurant-*` sets `VITE_POS_DEV_PLAN`, bind this POS
 * to the matching seeded test venue instead of whatever license was last used.
 */
export async function switchActivationToDevPlanVenue(
  stored: ActivationData | undefined,
): Promise<ActivationData | undefined> {
  const plan = getDevPosPlanEnv();
  if (!plan || !isSupabaseConfigured) return stored;

  const venueName = DEV_PLAN_TEST_VENUES[plan];
  const { data, error } = await supabase
    .from("restaurants")
    .select("license_key, name, plan")
    .eq("name", venueName)
    .eq("plan", plan)
    .eq("license_status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data?.license_key) {
    console.warn("[dev-plan-venue] could not load", venueName, error?.message);
    return stored;
  }

  const licenseKey = String(data.license_key).trim().toUpperCase();
  if (stored && keysMatch(stored.licenseKey, licenseKey)) return stored;

  const deviceId = stored?.deviceId || (await getOrCreateDeviceId());
  const result = await activateLicense(licenseKey, deviceId);
  await saveActivation({
    licenseKey: result.licenseKey,
    plan: result.plan,
    businessName: result.businessName,
    businessType: result.businessType,
    expiresAt: result.expiresAt,
    deviceId: result.deviceId,
    activatedAt: result.activatedAt,
  });
  return (await getActivation()) ?? stored;
}
