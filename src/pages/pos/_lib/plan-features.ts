import type { PosView } from "./types.ts";

/**
 * Defines which POS views / features are available in each plan.
 * Higher tiers inherit everything below. See `PLAN_FEATURE_DESCRIPTIONS` for marketing copy.
 */

export type PlanName = "starter" | "professional" | "enterprise";

/** Map billing/product names that may appear in DB or APIs to our internal plan id */
const PLAN_ALIASES: Record<string, PlanName> = {
  pro: "professional",
  premium: "professional",
  paid: "professional",
  restaurant_pos: "professional",
  restaurantpos: "professional",
  business: "enterprise",
  scale: "enterprise",
  ent: "enterprise",
  /** Common typo */
  enterprice: "enterprise",
  profesional: "professional",
};

/**
 * Normalize plan string for feature checks (case-insensitive, common aliases).
 * Unknown values default to `professional` so legacy / mistyped rows keep full operational access.
 */
export function normalizePlan(plan: string): PlanName {
  const key = plan.trim().toLowerCase();
  if (key === "starter" || key === "professional" || key === "enterprise") {
    return key;
  }
  return PLAN_ALIASES[key] ?? "professional";
}

/**
 * Starter — core POS plus simplified “today” overview (no full analytics pack).
 */
const STARTER_VIEWS: PosView[] = [
  "home",
  "dashboard",
  "floor",
  "order",
  "menu",
  "settings",
  "order-history",
  "z-report",
  "tables",
  "stock",
  "staff",
];

/**
 * Professional — full analytics dashboard, KDS, debt ledger, audit log (same module set as Enterprise).
 */
const PROFESSIONAL_VIEWS: PosView[] = [
  ...STARTER_VIEWS,
  "audit-log",
  "debt-ledger",
  "kitchen-display",
];

/**
 * Enterprise — same POS modules as Professional today; differentiate with limits, support & roadmap
 * (e.g. more terminals, priority support, future multi-site / API). Use `hasEnterpriseExtras` when
 * you add Enterprise-only toggles in the UI.
 */
const ENTERPRISE_VIEWS: PosView[] = [...PROFESSIONAL_VIEWS];

const PLAN_VIEW_MAP: Record<PlanName, PosView[]> = {
  starter: STARTER_VIEWS,
  professional: PROFESSIONAL_VIEWS,
  enterprise: ENTERPRISE_VIEWS,
};

/** The minimum plan required to access each gated view */
const VIEW_MIN_PLAN: Partial<Record<PosView, PlanName>> = {
  tables: "starter",
  stock: "starter",
  staff: "starter",
  dashboard: "starter",
  "audit-log": "professional",
  "debt-ledger": "professional",
  "z-report": "starter",
  "kitchen-display": "professional",
};

/**
 * Short descriptions for pricing pages / sales — keep in sync with `PLAN_VIEW_MAP`.
 */
export const PLAN_FEATURE_DESCRIPTIONS: Record<
  PlanName,
  { tagline: string; posModules: string[]; commercialAddOns: string[] }
> = {
  starter: {
    tagline: "Essential POS with tables, inventory, and staff roles.",
    posModules: [
      "Floor plan & live orders",
      "Menu management",
      "Order history",
      "Table / seating management",
      "Stock & inventory",
      "Staff, PINs & roles",
      "Device & receipt settings",
      "Today overview (simplified)",
      "Z-report / shift closing",
    ],
    commercialAddOns: [
      "Typically 1 terminal / small team (set max terminals in admin)",
      "Email support",
    ],
  },
  professional: {
    tagline: "Full restaurant operations for one location.",
    posModules: [
      "Everything in Starter",
      "Up to 5 terminals (enforced with plan cap)",
      "Kitchen display (KDS) workflow",
      "Split bills / partial payments",
      "Advanced analytics dashboard",
      "Dashboard & sales overview",
      "Customer debt (house accounts)",
      "Audit log",
    ],
    commercialAddOns: [
      "Priority in-app support channel",
      "Higher terminal limits on Enterprise",
    ],
  },
  enterprise: {
    tagline: "Professional feature set with room to scale.",
    posModules: [
      "Everything in Professional (same POS screens today)",
      "Full analytics dashboard & sales overview",
      "Kitchen & bar supply (mall / furnizim) workflows in Menu and Stock",
      "Optional supply recipe (ingredients per portion) with automatic stock deduction on sale",
    ],
    commercialAddOns: [
      "Highest terminal limits & rollout support",
      "Priority / dedicated support, SLA-style agreements",
      "Roadmap: multi-location rollups, integrations, API access (when shipped)",
    ],
  },
};

export function hasEnterpriseExtras(plan: string): boolean {
  return normalizePlan(plan) === "enterprise";
}

/**
 * Enterprise-only: kitchen/bar mall (furnizim) in Menu, supply stock tabs + create flows in Stock,
 * hiding supply categories from the product category strip, mall stock picker / adjust dialogs.
 */
export function hasEnterpriseSupplyMall(plan: string): boolean {
  return normalizePlan(plan) === "enterprise";
}

/**
 * Enterprise-only: optional supply recipe (BOM) on sellable menu items + automatic deduction on payment.
 * Today matches {@link hasEnterpriseSupplyMall}; kept separate so tiers can diverge later.
 */
export function hasEnterpriseSupplyRecipe(plan: string): boolean {
  return normalizePlan(plan) === "enterprise";
}

/** Hard cap on simultaneous device activations per plan tier (used with `restaurants.max_terminals`). */
export function maxTerminalsCapForPlan(plan: string): number {
  const tier = normalizePlan(plan);
  if (tier === "starter") return 1;
  if (tier === "professional") return 5;
  return 50;
}

/** Effective terminal slots: min(stored license limit, plan cap). */
export function maxEffectiveTerminalsForLicense(
  plan: string,
  storedMax: number | null | undefined,
): number {
  const configured = Math.max(1, Math.floor(Number(storedMax) || 1));
  return Math.min(configured, maxTerminalsCapForPlan(plan));
}

export function hasSplitBills(plan: string): boolean {
  const tier = normalizePlan(plan);
  return tier === "professional" || tier === "enterprise";
}

/**
 * Full analytics POS dashboard (sales charts, staff performance, fiscal strip, popular times, etc.).
 * **Professional** and **Enterprise** return true; **Starter** uses the simplified same-day overview only.
 */
export function hasAdvancedAnalytics(plan: string): boolean {
  const tier = normalizePlan(plan);
  return tier === "professional" || tier === "enterprise";
}

/** Alias for readability — same rule as {@link hasAdvancedAnalytics}. */
export function hasFullPosAnalyticsDashboard(plan: string): boolean {
  return hasAdvancedAnalytics(plan);
}

export function hasPrioritySupportChat(plan: string): boolean {
  const tier = normalizePlan(plan);
  return tier === "professional" || tier === "enterprise";
}

/**
 * Minimum device slots we apply when assigning a plan in admin (and when syncing an Enterprise license on activation).
 * Professional is higher than Starter so rollout can use several terminals without a manual edit.
 */
const PLAN_TERMINAL_FLOOR: Record<PlanName, number> = {
  starter: 1,
  professional: 5,
  enterprise: 15,
};

export function planTerminalFloor(plan: string): number {
  return PLAN_TERMINAL_FLOOR[normalizePlan(plan)];
}

/**
 * Check whether a plan has access to a given view.
 */
export function canAccessView(plan: string, view: PosView): boolean {
  const tier = normalizePlan(plan);
  const allowed = PLAN_VIEW_MAP[tier];
  return allowed.includes(view);
}

/**
 * When true, the POS shell opens the Kitchen display (KDS) route for plans that include it.
 * When false, the nav entry stays visible for eligible plans as “Coming soon” and routing is blocked.
 */
export const KITCHEN_DISPLAY_SHELL_ENABLED = false;

/** Whether KDS appears in menus and whether the live screen may open. */
export function kitchenDisplayNavState(plan: string): "hidden" | "coming_soon" | "live" {
  if (!canAccessView(plan, "kitchen-display")) return "hidden";
  if (!KITCHEN_DISPLAY_SHELL_ENABLED) return "coming_soon";
  return "live";
}

/**
 * Default screen after PIN login for admin/manager — must match `canAccessView` for that plan.
 * Starter opens dashboard in simplified mode; Professional / Enterprise get the full analytics layout.
 */
export function defaultAdminManagerLandingView(plan: string): PosView {
  const order: PosView[] = [
    "dashboard",
    "floor",
    "menu",
    "order-history",
    "tables",
    "stock",
    "staff",
    "settings",
  ];
  for (const v of order) {
    if (canAccessView(plan, v)) return v;
  }
  return "settings";
}

/**
 * Returns the minimum plan required for a view, or null if it's
 * available on all plans.
 */
export function getRequiredPlan(view: PosView): PlanName | null {
  return VIEW_MIN_PLAN[view] ?? null;
}

/**
 * Returns a human-friendly label for a plan name.
 */
export function planLabel(plan: string): string {
  const tier = normalizePlan(plan);
  const labels: Record<PlanName, string> = {
    starter: "Starter",
    professional: "Professional",
    enterprise: "Enterprise",
  };
  return labels[tier] ?? plan;
}
