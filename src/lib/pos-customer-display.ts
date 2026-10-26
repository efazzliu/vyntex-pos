export type CustomerDisplayLanguage = "en" | "sq";

export type CustomerDisplayPhase = "welcome" | "order" | "change";

export type PosCustomerDisplaySettings = {
  enabled: boolean;
  showItems: boolean;
  showSubtotal: boolean;
  showTax: boolean;
  showTotal: boolean;
  showChange: boolean;
  welcomeMessage: string;
  language: CustomerDisplayLanguage;
};

export const DEFAULT_POS_CUSTOMER_DISPLAY: PosCustomerDisplaySettings = {
  enabled: false,
  showItems: true,
  showSubtotal: true,
  showTax: true,
  showTotal: true,
  showChange: true,
  welcomeMessage: "",
  language: "en",
};

export type CustomerDisplayLine = {
  name: string;
  quantity: number;
  lineTotal: string;
};

export type CustomerDisplaySnapshot = {
  v: 1;
  kind: "snapshot";
  licenseKey: string;
  at: number;
  phase: CustomerDisplayPhase;
  venueName: string;
  settings: PosCustomerDisplaySettings;
  items: CustomerDisplayLine[];
  subtotal: string;
  tax: string;
  total: string;
  change: string;
};

export type CustomerDisplayAlive = {
  kind: "alive";
  at: number;
};

export type CustomerDisplayClose = {
  kind: "close";
};

export type CustomerDisplayMessage =
  | CustomerDisplaySnapshot
  | CustomerDisplayAlive
  | CustomerDisplayClose;

const CHANNEL = "vyntex-pos-customer-display";
const LS_SETTINGS = "vyntex.pos.customerDisplay:";
const LS_SNAP = "vyntex.pos.customerDisplaySnap:";

function pickLang(value: unknown): CustomerDisplayLanguage {
  return value === "sq" ? "sq" : "en";
}

export function parsePosCustomerDisplay(raw: unknown): PosCustomerDisplaySettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    enabled: o.enabled === true,
    showItems: o.showItems !== false,
    showSubtotal: o.showSubtotal !== false,
    showTax: o.showTax !== false,
    showTotal: o.showTotal !== false,
    showChange: o.showChange !== false,
    welcomeMessage: typeof o.welcomeMessage === "string" ? o.welcomeMessage.slice(0, 240) : "",
    language: pickLang(o.language),
  };
}

export function serializePosCustomerDisplay(
  settings: PosCustomerDisplaySettings,
): PosCustomerDisplaySettings {
  return parsePosCustomerDisplay(settings);
}

export function readLocalCustomerDisplay(licenseKey: string): PosCustomerDisplaySettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS + licenseKey);
    if (!raw) return { ...DEFAULT_POS_CUSTOMER_DISPLAY };
    return parsePosCustomerDisplay(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_POS_CUSTOMER_DISPLAY };
  }
}

export function writeLocalCustomerDisplay(
  licenseKey: string,
  settings: PosCustomerDisplaySettings,
) {
  localStorage.setItem(
    LS_SETTINGS + licenseKey,
    JSON.stringify(serializePosCustomerDisplay(settings)),
  );
}

export function readCachedCustomerDisplaySnapshot(
  licenseKey: string,
): CustomerDisplaySnapshot | null {
  try {
    const raw = localStorage.getItem(LS_SNAP + licenseKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomerDisplaySnapshot;
    if (parsed?.kind !== "snapshot" || parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function channel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
}

export function postCustomerDisplayMessage(message: CustomerDisplayMessage) {
  const ch = channel();
  if (!ch) return;
  try {
    ch.postMessage(message);
  } finally {
    ch.close();
  }
}

export function subscribeCustomerDisplay(
  onMessage: (message: CustomerDisplayMessage) => void,
): () => void {
  const ch = channel();
  if (!ch) return () => {};
  ch.onmessage = (event) => {
    const data = event.data as CustomerDisplayMessage | null;
    if (!data || typeof data !== "object") return;
    if (data.kind === "snapshot" || data.kind === "alive" || data.kind === "close") {
      onMessage(data);
    }
  };
  return () => ch.close();
}

export function publishCustomerDisplaySnapshot(snapshot: CustomerDisplaySnapshot) {
  const next: CustomerDisplaySnapshot = {
    ...snapshot,
    v: 1,
    kind: "snapshot",
    at: Date.now(),
    settings: serializePosCustomerDisplay(snapshot.settings),
  };
  try {
    localStorage.setItem(LS_SNAP + snapshot.licenseKey, JSON.stringify(next));
  } catch {
    /* quota */
  }
  postCustomerDisplayMessage(next);
}

export function customerDisplayPageUrl(): string {
  const origin = window.location.origin;
  const path = window.location.pathname.replace(/index\.html$/i, "");
  const hashMode = window.location.hash.startsWith("#/");
  if (hashMode || window.desktop?.isElectron) {
    return `${origin}${path}${window.location.search}#/pos/customer-display`;
  }
  const base = path.endsWith("/") ? path : `${path}/`;
  return `${origin}${base}pos/customer-display`;
}

export type CustomerDisplayHardwareStatus = {
  open: boolean;
  extraDisplayCount: number;
  displayLabel: string | null;
};

export async function readCustomerDisplayHardware(): Promise<CustomerDisplayHardwareStatus> {
  const api = window.desktop;
  if (!api?.isElectron || typeof api.customerDisplayStatus !== "function") {
    return { open: false, extraDisplayCount: 0, displayLabel: null };
  }
  try {
    const row = await api.customerDisplayStatus();
    return {
      open: row.open === true,
      extraDisplayCount: Number(row.extraDisplayCount) || 0,
      displayLabel: row.displayLabel ? String(row.displayLabel) : null,
    };
  } catch {
    return { open: false, extraDisplayCount: 0, displayLabel: null };
  }
}

export async function openCustomerDisplayWindow(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const api = window.desktop;
  if (api?.isElectron && typeof api.customerDisplayOpen === "function") {
    const result = await api.customerDisplayOpen();
    if (result.ok) return { ok: true };
    if (result.error === "NO_EXTRA_DISPLAY") {
      return { ok: false, error: "NO_EXTRA_DISPLAY" };
    }
    return { ok: false, error: result.error || "OPEN_FAILED" };
  }
  const popup = window.open(
    customerDisplayPageUrl(),
    "vyntex-customer-display",
    "width=1024,height=768,menubar=no,toolbar=no,location=no,status=no",
  );
  if (!popup) return { ok: false, error: "POPUP_BLOCKED" };
  return { ok: true };
}

export async function closeCustomerDisplayWindow() {
  postCustomerDisplayMessage({ kind: "close" });
  const api = window.desktop;
  if (api?.isElectron && typeof api.customerDisplayClose === "function") {
    try {
      await api.customerDisplayClose();
    } catch {
      /* ignore */
    }
  }
}
