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
 * Starter — essentials for cafés / fast food / small venues:
 * 1 location, 5 staff, 1 terminal, 1 printer, 1 floor; basic stock & daily report;
 * no CSV export, split bills, or debt.
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
 * Professional — The Complete Operation for one busy restaurant:
 * 1 location, 25 staff, 5 terminals, many printers/floors; advanced stock, split bills,
 * debt, audit log, advanced Z-Report & analytics, CSV/Excel export; KDS coming soon.
 */
const PROFESSIONAL_VIEWS: PosView[] = [
  ...STARTER_VIEWS,
  "audit-log",
  "debt-ledger",
  "kitchen-display",
];

/**
 * Enterprise — Business Intelligence & Control for multi-venue operators:
 * multi-location, high staff/terminals, supply + recipes, centralized / enterprise dashboard,
 * custom & scheduled reports. API/webhooks and white-label remain roadmap helpers below.
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
    tagline: "The Essentials — for cafés, fast food, and small venues.",
    posModules: [
      "1 location · 5 staff · 1 terminal · 1 printer · 1 floor",
      "Basic POS, tables, and menu",
      "Basic stock (no CSV export)",
      "Basic Z-Report & daily report",
      "Order history",
      "Staff PINs & roles",
      "Receipt & device settings",
    ],
    commercialAddOns: [
      "No split bills or debt management",
      "Email support",
    ],
  },
  professional: {
    tagline: "The Complete Operation — for restaurants with staff, kitchen, and higher order volume.",
    posModules: [
      "1 location · 25 staff · 5 terminals",
      "Multiple printers · multiple floors & zones",
      "Advanced stock + CSV / Excel export",
      "Split bills & debt management",
      "Audit log",
      "Advanced Z-Report & analytics reports",
      "Kitchen display (KDS) — coming soon",
    ],
    commercialAddOns: [
      "Priority in-app support channel",
      "Higher limits & supply workflows on Enterprise",
    ],
  },
  enterprise: {
    tagline:
      "Business Intelligence & Control — for companies running multiple restaurants and centralized operations.",
    posModules: [
      "Multi-location (up to 50 venues)",
      "Staff by agreement (very high practical limit) · up to 50 terminals / location",
      "Centralized / enterprise dashboard",
      "Supply management · recipe management · ingredient costing",
      "Advanced inventory",
      "Multi-location analytics · custom reports · scheduled email reports",
      "Advanced roles & permissions · detailed audit history",
      "Priority support & SLA",
      "API & webhooks · white-label branding — coming soon",
    ],
    commercialAddOns: [
      "Highest terminal / printer / floor limits",
      "Dedicated onboarding & SLA-style agreements",
    ],
  },
};

/** Enterprise dashboard extras: live ops, profitability, custom reports, scheduled reports UI. */
export function hasEnterpriseExtras(plan: string): boolean {
  return normalizePlan(plan) === "enterprise";
}

/** Alias — centralized / BI-style POS overview for Enterprise. */
export function hasEnterpriseCentralDashboard(plan: string): boolean {
  return hasEnterpriseExtras(plan);
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

/** Enterprise-only custom reports + scheduled email report UI (when POS is open). */
export function hasEnterpriseCustomReports(plan: string): boolean {
  return hasEnterpriseExtras(plan);
}

/**
 * Public API & webhooks for Enterprise — not shipped yet.
 * Keep false until integrations land; marketing should say “coming soon”.
 */
export function hasEnterpriseApiAccess(_plan: string): boolean {
  return false;
}

/**
 * Full white-label branding for Enterprise — not shipped yet (logo/theme theming exists for all plans).
 */
export function hasEnterpriseWhiteLabel(_plan: string): boolean {
  return false;
}

/**
 * Temporary kill-switch for Menu → Variants (Settings card, Edit Product tab, waiter/POS picker).
 * Existing `variantGroups` prefs and `menu_items.customization_config` stay in the database.
 * Flip to `true` to re-enable; Modifiers are independent.
 */
export const MENU_VARIANTS_FEATURE_ENABLED = false;

/** Whether Variants UI and waiter picking are active. */
export function isMenuVariantsEnabled(): boolean {
  return MENU_VARIANTS_FEATURE_ENABLED;
}

/** Hard cap on simultaneous device activations per plan tier (used with `restaurants.max_terminals`). */
export function maxTerminalsCapForPlan(plan: string): number {
  const tier = normalizePlan(plan);
  if (tier === "starter") return 1;
  if (tier === "professional") return 5;
  return 50;
}

/**
 * Max staff accounts (PIN users) per venue.
 * Enterprise: very high practical ceiling (“by agreement” commercially).
 */
export function maxStaffForPlan(plan: string): number {
  const tier = normalizePlan(plan);
  if (tier === "starter") return 5;
  if (tier === "professional") return 25;
  return 9999;
}

/** Max configured POS printers per venue. Starter: 1; Professional: many; Enterprise: highest. */
export function maxPrintersForPlan(plan: string): number {
  const tier = normalizePlan(plan);
  if (tier === "starter") return 1;
  if (tier === "professional") return 15;
  return 50;
}

/** Max floor zones / rooms per venue. Starter: 1; Professional: many; Enterprise: highest. */
export function maxFloorsForPlan(plan: string): number {
  const tier = normalizePlan(plan);
  if (tier === "starter") return 1;
  if (tier === "professional") return 15;
  return 50;
}

/** Max owned venues (locations) for this plan tier. */
export function maxLocationsForPlan(plan: string): number {
  const tier = normalizePlan(plan);
  if (tier === "starter") return 1;
  if (tier === "professional") return 1;
  return 50;
}

/** CSV / spreadsheet export (stock, etc.). Starter: blocked. */
export function canExportCsv(plan: string): boolean {
  return normalizePlan(plan) !== "starter";
}

/** Z-Report history beyond the live daily close. Starter: live / basic only. */
export function canViewZReportHistory(plan: string): boolean {
  return normalizePlan(plan) !== "starter";
}

/** Multi-day / custom dashboard date ranges. Starter: today (daily report) only. */
export function canUseMultiDayReports(plan: string): boolean {
  return normalizePlan(plan) !== "starter";
}

export function planLimitReachedMessage(
  kind: "staff" | "printer" | "floor" | "location" | "terminal",
  plan: string,
): string {
  const tier = planLabel(plan);
  const caps: Record<typeof kind, number> = {
    staff: maxStaffForPlan(plan),
    printer: maxPrintersForPlan(plan),
    floor: maxFloorsForPlan(plan),
    location: maxLocationsForPlan(plan),
    terminal: maxTerminalsCapForPlan(plan),
  };
  return `${tier} plan allows up to ${caps[kind]} ${kind}${caps[kind] === 1 ? "" : "s"}. Upgrade to add more.`;
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
