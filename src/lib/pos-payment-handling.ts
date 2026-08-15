export type PaymentHandlingMode = "waiter" | "counter";

export type PaymentCounterRoles = {
  admin: boolean;
  manager: boolean;
  waiter: boolean;
};

export type PaymentMethodId = "cash" | "card" | "qr";

export type PaymentMethods = {
  cash: boolean;
  card: boolean;
  qr: boolean;
};

export type PosPaymentSettings = {
  handling: PaymentHandlingMode;
  counterRoles: PaymentCounterRoles;
  methods: PaymentMethods;
  /** Venue-level split bill. Still requires plan + staff permission. Admin-only to change. */
  allowSplitBill: boolean;
  /** When false, only an administrator can void/refund lines. Admin-only to change. */
  allowRefund: boolean;
};

export const DEFAULT_PAYMENT_COUNTER_ROLES: PaymentCounterRoles = {
  admin: true,
  manager: true,
  waiter: false,
};

export const DEFAULT_PAYMENT_METHODS: PaymentMethods = {
  cash: true,
  card: true,
  qr: true,
};

/** Phone is for orders; the till closes the bill unless the venue opts into waiter collection. */
export const DEFAULT_POS_PAYMENT_SETTINGS: PosPaymentSettings = {
  handling: "counter",
  counterRoles: { ...DEFAULT_PAYMENT_COUNTER_ROLES },
  methods: { ...DEFAULT_PAYMENT_METHODS },
  allowSplitBill: true,
  allowRefund: true,
};

export const PAYMENT_HANDLING_LS_PREFIX = "vyntex.pos.paymentHandling:";

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

function parseMethods(raw: unknown): PaymentMethods {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PAYMENT_METHODS };
  const o = raw as Record<string, unknown>;
  const methods: PaymentMethods = {
    cash: asBool(o.cash, true),
    card: asBool(o.card, true),
    qr: asBool(o.qr, true),
  };
  if (!methods.cash && !methods.card && !methods.qr) methods.cash = true;
  return methods;
}

export function normalizePosPaymentSettings(
  settings: PosPaymentSettings,
): PosPaymentSettings {
  return parsePosPaymentSettings(settings);
}

export function parsePosPaymentSettings(raw: unknown): PosPaymentSettings {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_POS_PAYMENT_SETTINGS,
      counterRoles: { ...DEFAULT_PAYMENT_COUNTER_ROLES },
      methods: { ...DEFAULT_PAYMENT_METHODS },
    };
  }
  const o = raw as Record<string, unknown>;
  const handling: PaymentHandlingMode =
    o.handling === "waiter" ? "waiter" : "counter";
  const rolesRaw =
    o.counterRoles && typeof o.counterRoles === "object"
      ? (o.counterRoles as Record<string, unknown>)
      : o;
  return {
    handling,
    counterRoles: {
      admin: true,
      manager: asBool(rolesRaw.manager, true),
      waiter: asBool(rolesRaw.waiter, false),
    },
    methods: parseMethods(o.methods),
    allowSplitBill: asBool(o.allowSplitBill, true),
    allowRefund: asBool(o.allowRefund, true),
  };
}

export function readLocalPaymentSettings(licenseKey: string): PosPaymentSettings {
  try {
    const raw = localStorage.getItem(PAYMENT_HANDLING_LS_PREFIX + licenseKey);
    if (raw) return parsePosPaymentSettings(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  try {
    const legacy = localStorage.getItem("vyntex.pos.paymentRoles:" + licenseKey);
    if (legacy) {
      const parsed = JSON.parse(legacy) as { manager?: boolean; waiter?: boolean };
      return {
        handling: parsed.waiter === true ? "waiter" : "counter",
        counterRoles: {
          admin: true,
          manager: parsed.manager !== false,
          waiter: parsed.waiter === true,
        },
        methods: { ...DEFAULT_PAYMENT_METHODS },
        allowSplitBill: true,
        allowRefund: true,
      };
    }
  } catch {
    /* ignore */
  }
  return {
    ...DEFAULT_POS_PAYMENT_SETTINGS,
    counterRoles: { ...DEFAULT_PAYMENT_COUNTER_ROLES },
    methods: { ...DEFAULT_PAYMENT_METHODS },
  };
}

export function writeLocalPaymentSettings(
  licenseKey: string,
  settings: PosPaymentSettings,
): void {
  const normalized = parsePosPaymentSettings(settings);
  try {
    localStorage.setItem(
      PAYMENT_HANDLING_LS_PREFIX + licenseKey,
      JSON.stringify(normalized),
    );
  } catch {
    /* ignore */
  }
}

/** Waiter phone may take Cash/Card/QR and close the table. */
export function waiterPhoneCanCollectPayment(settings: PosPaymentSettings): boolean {
  return settings.handling === "waiter";
}

/**
 * POS till (counter/bar). In waiter-collects mode anyone who opened the ticket can pay.
 * In counter mode only the roles checked under “Who can process payments at the counter?”.
 */
export function posTerminalCanProcessPayment(
  role: string,
  settings: PosPaymentSettings,
): boolean {
  if (settings.handling === "waiter") return true;
  if (role === "admin") return true;
  if (role === "manager") return settings.counterRoles.manager !== false;
  if (role === "waiter") return settings.counterRoles.waiter === true;
  return false;
}

export function paymentMethodEnabled(
  settings: PosPaymentSettings,
  method: PaymentMethodId,
): boolean {
  return settings.methods[method] !== false;
}

export function enabledPaymentMethods(
  settings: PosPaymentSettings,
): PaymentMethodId[] {
  const ids: PaymentMethodId[] = [];
  if (settings.methods.cash) ids.push("cash");
  if (settings.methods.card) ids.push("card");
  if (settings.methods.qr) ids.push("qr");
  return ids.length > 0 ? ids : ["cash"];
}

/** Admin always; manager only when the venue allows refunds. Waiters never from this policy. */
export function roleCanRefund(role: string, settings: PosPaymentSettings): boolean {
  if (role === "admin") return true;
  if (role === "manager") return settings.allowRefund !== false;
  return false;
}
