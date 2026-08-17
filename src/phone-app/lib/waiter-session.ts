import type { ActiveStaff } from "@/pages/pos/_lib/types.ts";

const VENUE_KEY = "vyntex-waiter-venue-key";
const SESSION_KEY = "vyntex-waiter-session";
const PAIR_KEY = "vyntex-waiter-phone-pair";

/** Local design/demo venue — no POS QR/code required. */
export const WAITER_DESIGN_PREVIEW_LICENSE = "DEMO-PREVIEW";

export type WaiterSession = {
  licenseKey: string;
  staff: ActiveStaff;
  signedInAt: number;
};

export type WaiterPhonePair = {
  licenseKey: string;
  restaurantName: string;
  deviceId: string;
  deviceRowId: string;
  pairedAt: number;
};

export function isWaiterDesignPreviewLicense(licenseKey: string): boolean {
  return normalizeWaiterVenueKey(licenseKey) === WAITER_DESIGN_PREVIEW_LICENSE;
}

export function isWaiterDesignPreviewActive(): boolean {
  const session = getWaiterSession();
  if (session && isWaiterDesignPreviewLicense(session.licenseKey)) return true;
  const pair = getWaiterPhonePair();
  return Boolean(pair && isWaiterDesignPreviewLicense(pair.licenseKey));
}

/** Enter waiter UI without QR pairing (phone-only design preview). */
export function enterWaiterDesignPreview(
  staffName = "Kamerier Demo",
  restaurantName = "Demo Restaurant",
): WaiterSession {
  const pair: WaiterPhonePair = {
    licenseKey: WAITER_DESIGN_PREVIEW_LICENSE,
    restaurantName: restaurantName.trim() || "Demo Restaurant",
    deviceId: "design-preview-device",
    deviceRowId: "design-preview-row",
    pairedAt: Date.now(),
  };
  setWaiterPhonePair(pair);
  const session: WaiterSession = {
    licenseKey: WAITER_DESIGN_PREVIEW_LICENSE,
    staff: {
      id: "00000000-0000-4000-8000-000000000001",
      name: staffName.trim() || "Kamerier Demo",
      role: "waiter",
    },
    signedInAt: Date.now(),
  };
  setWaiterSession(session);
  return session;
}

export function normalizeWaiterVenueKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function getWaiterVenueKey(): string {
  try {
    return normalizeWaiterVenueKey(localStorage.getItem(VENUE_KEY) ?? "");
  } catch {
    return "";
  }
}

export function setWaiterVenueKey(key: string): void {
  const next = normalizeWaiterVenueKey(key);
  try {
    if (next) localStorage.setItem(VENUE_KEY, next);
    else localStorage.removeItem(VENUE_KEY);
  } catch {
    /* ignore */
  }
}

export function getWaiterSession(): WaiterSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WaiterSession;
    if (!parsed?.licenseKey || !parsed?.staff?.id || !parsed?.staff?.name) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setWaiterSession(session: WaiterSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearWaiterSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function getWaiterPhonePair(): WaiterPhonePair | null {
  try {
    const raw = localStorage.getItem(PAIR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WaiterPhonePair;
    if (!parsed?.licenseKey || !parsed?.deviceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setWaiterPhonePair(pair: WaiterPhonePair): void {
  try {
    localStorage.setItem(PAIR_KEY, JSON.stringify(pair));
    setWaiterVenueKey(pair.licenseKey);
  } catch {
    /* ignore */
  }
}

export function clearWaiterPhonePair(): void {
  try {
    localStorage.removeItem(PAIR_KEY);
  } catch {
    /* ignore */
  }
}

export function isWaiterPhonePaired(): boolean {
  return getWaiterPhonePair() != null;
}

const LICENSE_PENDING_KEY = "vyntex-waiter-license-pending";

export type WaiterLicensePending = {
  licenseKey: string;
  deviceId: string;
  restaurantName: string;
  expiresAt: string;
};

export function getWaiterLicensePending(): WaiterLicensePending | null {
  try {
    const raw = localStorage.getItem(LICENSE_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WaiterLicensePending;
    if (!parsed?.licenseKey || !parsed?.deviceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setWaiterLicensePending(pending: WaiterLicensePending): void {
  try {
    localStorage.setItem(LICENSE_PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* ignore */
  }
}

export function clearWaiterLicensePending(): void {
  try {
    localStorage.removeItem(LICENSE_PENDING_KEY);
  } catch {
    /* ignore */
  }
}
