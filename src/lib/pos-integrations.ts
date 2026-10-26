/** Venue-facing integrations registry. Only list connectors that exist or are explicitly unavailable. */

export type IntegrationCategory = "accounting" | "delivery" | "payments" | "api";

export type IntegrationStatus = "connected" | "error" | "unavailable";

export type IntegrationError = {
  at: string;
  message: string;
};

export type VenueIntegration = {
  id: string;
  category: IntegrationCategory;
  titleKey: string;
  descKey: string;
  setupKey: string;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  errors: IntegrationError[];
};

export const INTEGRATION_CATEGORIES: {
  id: IntegrationCategory;
  titleKey: string;
  leadKey: string;
}[] = [
  {
    id: "accounting",
    titleKey: "settings.int_cat_accounting",
    leadKey: "settings.int_cat_accounting_lead",
  },
  {
    id: "delivery",
    titleKey: "settings.int_cat_delivery",
    leadKey: "settings.int_cat_delivery_lead",
  },
  {
    id: "payments",
    titleKey: "settings.int_cat_payments",
    leadKey: "settings.int_cat_payments_lead",
  },
  {
    id: "api",
    titleKey: "settings.int_cat_api",
    leadKey: "settings.int_cat_api_lead",
  },
];

/**
 * Live POS does not ship venue accounting, delivery, payment-gateway, or public API connectors.
 * Status is unavailable until a real connector is registered here.
 */
export const VENUE_INTEGRATIONS: VenueIntegration[] = [
  {
    id: "accounting",
    category: "accounting",
    titleKey: "settings.int_accounting_title",
    descKey: "settings.int_accounting_desc",
    setupKey: "settings.int_accounting_setup",
    status: "unavailable",
    lastSyncAt: null,
    errors: [],
  },
  {
    id: "delivery",
    category: "delivery",
    titleKey: "settings.int_delivery_title",
    descKey: "settings.int_delivery_desc",
    setupKey: "settings.int_delivery_setup",
    status: "unavailable",
    lastSyncAt: null,
    errors: [],
  },
  {
    id: "payments",
    category: "payments",
    titleKey: "settings.int_payments_title",
    descKey: "settings.int_payments_desc",
    setupKey: "settings.int_payments_setup",
    status: "unavailable",
    lastSyncAt: null,
    errors: [],
  },
  {
    id: "api",
    category: "api",
    titleKey: "settings.int_api_title",
    descKey: "settings.int_api_desc",
    setupKey: "settings.int_api_setup",
    status: "unavailable",
    lastSyncAt: null,
    errors: [],
  },
];

export function integrationsForCategory(
  category: IntegrationCategory,
): VenueIntegration[] {
  return VENUE_INTEGRATIONS.filter((item) => item.category === category);
}

export function integrationCanDisconnect(item: VenueIntegration): boolean {
  return item.status === "connected" || item.status === "error";
}
