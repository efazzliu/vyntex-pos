export type PaymentHandlingMode = "waiter" | "counter";

export type PaymentCounterRoles = {
  admin: boolean;
  manager: boolean;
  waiter: boolean;
};

export type PaymentMethodId = "cash" | "card" | "qr";

export type PayMethodKey = "cash" | "card" | "qr" | "other";
export type PayRoleKey = "admin" | "manager" | "cashier" | "waiter" | "kitchen";

export type PaymentMethods = {
  cash: boolean;
  card: boolean;
  qr: boolean;
};

export type MethodFlags = {
  cash: boolean;
  card: boolean;
  qr: boolean;
  other: boolean;
};

export type PaymentChannels = {
  pos: MethodFlags;
  phone: MethodFlags;
};

export type RoleMethodMatrix = Record<PayRoleKey, MethodFlags>;

export type PosPaymentSettings = {
  handling: PaymentHandlingMode;
  counterRoles: PaymentCounterRoles;
  methods: PaymentMethods;
  channels: PaymentChannels;
  roleMethods: RoleMethodMatrix;
  /** Venue-level split bill. Still requires plan + staff permission. Admin-only to change. */
  allowSplitBill: boolean;
  /** When false, only an administrator can void/refund lines. Admin-only to change. */
  allowRefund: boolean;
};

export const PAY_METHOD_KEYS: PayMethodKey[] = ["cash", "card", "qr", "other"];
export const LOCKED_PAY_METHODS: PayMethodKey[] = ["qr", "other"];
export const PAY_ROLE_KEYS: PayRoleKey[] = [
  "admin",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
];

const ALL_ON: MethodFlags = { cash: true, card: true, qr: true, other: true };
const ALL_OFF: MethodFlags = { cash: false, card: false, qr: false, other: false };

export const DEFAULT_PAYMENT_COUNTER_ROLES: PaymentCounterRoles = {
  admin: true,
  manager: true,
  waiter: false,
};

export const DEFAULT_PAYMENT_METHODS: PaymentMethods = {
  cash: true,
  card: true,
  qr: false,
};

export const DEFAULT_PAYMENT_CHANNELS: PaymentChannels = {
  pos: { cash: true, card: true, qr: false, other: false },
  phone: { cash: true, card: true, qr: false, other: false },
};

export const DEFAULT_ROLE_METHODS: RoleMethodMatrix = {
  admin: { cash: true, card: true, qr: false, other: false },
  manager: { cash: true, card: true, qr: false, other: false },
  cashier: { cash: true, card: true, qr: false, other: false },
  waiter: { cash: true, card: true, qr: false, other: false },
  kitchen: { ...ALL_OFF },
};

/** Conservative fallback for venues that never saved the new matrix. */
const LEGACY_ROLE_METHODS: RoleMethodMatrix = {
  admin: { ...ALL_ON },
  manager: { cash: true, card: true, qr: false, other: false },
  cashier: { cash: true, card: true, qr: false, other: false },
  waiter: { ...ALL_OFF },
  kitchen: { ...ALL_OFF },
};

/** Screenshot / Reset to default. */
export const FACTORY_POS_PAYMENT_SETTINGS: PosPaymentSettings = {
  handling: "counter",
  counterRoles: { admin: true, manager: true, waiter: true },
  methods: { cash: true, card: true, qr: false },
  channels: {
    pos: { ...DEFAULT_PAYMENT_CHANNELS.pos },
    phone: { ...DEFAULT_PAYMENT_CHANNELS.phone },
  },
  roleMethods: {
    admin: { ...DEFAULT_ROLE_METHODS.admin },
    manager: { ...DEFAULT_ROLE_METHODS.manager },
    cashier: { ...DEFAULT_ROLE_METHODS.cashier },
    waiter: { ...DEFAULT_ROLE_METHODS.waiter },
    kitchen: { ...DEFAULT_ROLE_METHODS.kitchen },
  },
  allowSplitBill: true,
  allowRefund: true,
};

/** Phone is for orders; the till closes the bill unless the venue opts into waiter collection. */
export const DEFAULT_POS_PAYMENT_SETTINGS: PosPaymentSettings = {
  handling: "counter",
  counterRoles: { ...DEFAULT_PAYMENT_COUNTER_ROLES },
  methods: { ...DEFAULT_PAYMENT_METHODS },
  channels: {
    pos: { cash: true, card: true, qr: false, other: false },
    phone: { cash: true, card: true, qr: false, other: false },
  },
  roleMethods: {
    admin: { ...LEGACY_ROLE_METHODS.admin },
    manager: { ...LEGACY_ROLE_METHODS.manager },
    cashier: { ...LEGACY_ROLE_METHODS.cashier },
    waiter: { ...LEGACY_ROLE_METHODS.waiter },
    kitchen: { ...LEGACY_ROLE_METHODS.kitchen },
  },
  allowSplitBill: true,
  allowRefund: true,
};

export const PAYMENT_HANDLING_LS_PREFIX = "vyntex.pos.paymentHandling:";

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

function parseMethodFlags(raw: unknown, fallback: MethodFlags): MethodFlags {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    cash: asBool(o.cash, fallback.cash),
    card: asBool(o.card, fallback.card),
    qr: asBool(o.qr, fallback.qr),
    other: asBool(o.other, fallback.other),
  };
}

function parseMethods(raw: unknown): PaymentMethods {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PAYMENT_METHODS };
  const o = raw as Record<string, unknown>;
  const methods: PaymentMethods = {
    cash: asBool(o.cash, true),
    card: asBool(o.card, true),
    qr: asBool(o.qr, false),
  };
  if (!methods.cash && !methods.card) methods.cash = true;
  return methods;
}

function rolePaysOnPos(flags: MethodFlags, pos: MethodFlags): boolean {
  return PAY_METHOD_KEYS.some((key) => flags[key] && pos[key]);
}

function cloneSettings(settings: PosPaymentSettings): PosPaymentSettings {
  return {
    handling: "counter",
    counterRoles: { ...settings.counterRoles, admin: true },
    methods: { ...settings.methods },
    channels: {
      pos: { ...settings.channels.pos },
      phone: { ...settings.channels.phone },
    },
    roleMethods: {
      admin: { ...ALL_ON },
      manager: { ...settings.roleMethods.manager },
      cashier: { ...settings.roleMethods.cashier },
      waiter: { ...settings.roleMethods.waiter },
      kitchen: { ...settings.roleMethods.kitchen },
    },
    allowSplitBill: settings.allowSplitBill,
    allowRefund: settings.allowRefund,
  };
}

export function normalizePosPaymentSettings(
  settings: PosPaymentSettings,
): PosPaymentSettings {
  return parsePosPaymentSettings(settings);
}

export function parsePosPaymentSettings(raw: unknown): PosPaymentSettings {
  if (!raw || typeof raw !== "object") {
    return cloneSettings(DEFAULT_POS_PAYMENT_SETTINGS);
  }
  const o = raw as Record<string, unknown>;
  const methods = parseMethods(o.methods ?? o);
  const channelsRaw =
    o.channels && typeof o.channels === "object"
      ? (o.channels as Record<string, unknown>)
      : null;
  const channels: PaymentChannels = channelsRaw
    ? {
        pos: parseMethodFlags(channelsRaw.pos, {
          cash: methods.cash,
          card: methods.card,
          qr: methods.qr,
          other: false,
        }),
        phone: parseMethodFlags(channelsRaw.phone, {
          cash: methods.cash,
          card: methods.card,
          qr: methods.qr,
          other: false,
        }),
      }
    : {
        pos: {
          cash: methods.cash,
          card: methods.card,
          qr: methods.qr,
          other: false,
        },
        phone: {
          cash: methods.cash,
          card: methods.card,
          qr: methods.qr,
          other: false,
        },
      };
  if (!channels.pos.cash && !channels.pos.card) channels.pos.cash = true;

  const rolesRaw =
    o.counterRoles && typeof o.counterRoles === "object"
      ? (o.counterRoles as Record<string, unknown>)
      : o;
  const legacyWaiter = asBool(rolesRaw.waiter, false);
  const legacyManager = asBool(rolesRaw.manager, true);

  const rmRaw =
    o.roleMethods && typeof o.roleMethods === "object"
      ? (o.roleMethods as Record<string, unknown>)
      : null;
  const roleMethods: RoleMethodMatrix = {
    admin: { ...ALL_ON },
    manager: parseMethodFlags(
      rmRaw?.manager,
      legacyManager
        ? { cash: channels.pos.cash, card: channels.pos.card, qr: channels.pos.qr, other: false }
        : ALL_OFF,
    ),
    cashier: parseMethodFlags(rmRaw?.cashier, {
      cash: channels.pos.cash,
      card: channels.pos.card,
      qr: false,
      other: false,
    }),
    waiter: parseMethodFlags(
      rmRaw?.waiter,
      legacyWaiter
        ? { cash: channels.pos.cash, card: channels.pos.card, qr: channels.pos.qr, other: false }
        : ALL_OFF,
    ),
    kitchen: parseMethodFlags(rmRaw?.kitchen, ALL_OFF),
  };
  roleMethods.admin = { cash: true, card: true, qr: false, other: false };
  channels.pos.qr = false;
  channels.pos.other = false;
  channels.phone.qr = false;
  channels.phone.other = false;
  for (const role of PAY_ROLE_KEYS) {
    roleMethods[role].qr = false;
    roleMethods[role].other = false;
  }

  const methodsOut: PaymentMethods = {
    cash: channels.pos.cash,
    card: channels.pos.card,
    qr: false,
  };
  if (!methodsOut.cash && !methodsOut.card) methodsOut.cash = true;

  return {
    handling: "counter",
    counterRoles: {
      admin: true,
      manager: rolePaysOnPos(roleMethods.manager, channels.pos),
      waiter: rolePaysOnPos(roleMethods.waiter, channels.pos),
    },
    methods: methodsOut,
    channels,
    roleMethods,
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
      return parsePosPaymentSettings({
        handling: "counter",
        counterRoles: {
          admin: true,
          manager: parsed.manager !== false,
          waiter: parsed.waiter === true,
        },
        methods: { ...DEFAULT_PAYMENT_METHODS },
        allowSplitBill: true,
        allowRefund: true,
      });
    }
  } catch {
    /* ignore */
  }
  return cloneSettings(DEFAULT_POS_PAYMENT_SETTINGS);
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
 * In counter mode only the roles with at least one POS method in the permissions matrix.
 */
export function posTerminalCanProcessPayment(
  role: string,
  settings: PosPaymentSettings,
): boolean {
  if (settings.handling === "waiter") return true;
  if (role === "admin") return true;
  const flags = settings.roleMethods[role as PayRoleKey];
  if (flags) return rolePaysOnPos(flags, settings.channels.pos);
  if (role === "manager") return settings.counterRoles.manager !== false;
  if (role === "waiter") return settings.counterRoles.waiter === true;
  return false;
}

export function paymentMethodEnabled(
  settings: PosPaymentSettings,
  method: PaymentMethodId,
): boolean {
  return settings.channels.pos[method] !== false;
}

export function enabledPaymentMethods(
  settings: PosPaymentSettings,
): PaymentMethodId[] {
  const ids: PaymentMethodId[] = [];
  if (settings.channels.pos.cash) ids.push("cash");
  if (settings.channels.pos.card) ids.push("card");
  if (settings.channels.pos.qr) ids.push("qr");
  return ids.length > 0 ? ids : ["cash"];
}

/** Admin always; manager only when the venue allows refunds. Waiters never from this policy. */
export function roleCanRefund(role: string, settings: PosPaymentSettings): boolean {
  if (role === "admin") return true;
  if (role === "manager") return settings.allowRefund !== false;
  return false;
}
