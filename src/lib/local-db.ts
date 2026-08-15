/**
 * IndexedDB utilities for VYNTEX POS local storage.
 * Stores activation tokens, local admin credentials, cached staff,
 * and offline data (menu, tables, orders, queue) for offline POS access.
 */

const DB_NAME = "vyntex-local";
const DB_VERSION = 4;

// Store names
const CONFIG_STORE = "config";
const ADMINS_STORE = "admins";
const STAFF_STORE = "staff";
const CACHE_STORE = "dataCache";
const OFFLINE_QUEUE_STORE = "offlineQueue";
const PRINT_QUEUE_STORE = "printQueue";

// ── Types ─────────────────────────────────────────────

export type ActivationData = {
  licenseKey: string;
  plan: string;
  businessName: string;
  businessType: string;
  expiresAt: string;
  deviceId: string;
  activatedAt: string;
  token: string; // hashed activation token
};

export type LocalAdmin = {
  id?: number;
  name: string;
  passwordHash: string;
  pin: string; // stored as hash
  createdAt: string;
};

import type { StaffRole } from "@/pages/pos/_lib/types.ts";
import { clearRestaurantCache } from "@/lib/supabase-pos/restaurant.ts";

export type LocalStaff = {
  convexId: string;
  name: string;
  role: StaffRole;
  pinHash: string;
  isActive: boolean;
};

/** A queued mutation that will be replayed when back online */
export type QueuedMutation = {
  id: number;
  functionPath: string;
  args: Record<string, unknown>;
  createdAt: string;
  retries: number;
};

export type QueuedPrintJob = {
  id: number;
  createdAt: string;
  retries: number;
  html: string;
  /** Windows/Electron: exact OS printer name (match Settings — use Address if set). */
  deviceName?: string;
  /** We always enqueue for silent printing. */
  silent: boolean;
  /** Whether the caller allowed interactive fallback when silent failed. */
  allowInteractiveFallback: boolean;
  jobType: "ticket" | "bill" | "receipt" | "custom";
  lastError?: string;
};

// ── Database ──────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE);
      }
      if (!db.objectStoreNames.contains(ADMINS_STORE)) {
        db.createObjectStore(ADMINS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
      if (!db.objectStoreNames.contains(STAFF_STORE)) {
        db.createObjectStore(STAFF_STORE, { keyPath: "convexId" });
      }
      // Key-value store for caching query results
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE);
      }
      // Auto-increment queue for offline mutations
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
      // Auto-increment queue for failed/queued HTML prints
      if (!db.objectStoreNames.contains(PRINT_QUEUE_STORE)) {
        db.createObjectStore(PRINT_QUEUE_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => finish(() => resolve(request.result));
    request.onerror = () => finish(() => reject(request.error ?? new Error("IndexedDB open failed")));
    request.onblocked = () =>
      finish(() => reject(new Error("IndexedDB open blocked")));
  });
}

function dbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result as T | undefined);
        request.onerror = () => reject(request.error);
      })
  );
}

function dbPut(storeName: string, key: string, value: unknown): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
}

function dbAdd<T>(storeName: string, value: T): Promise<number> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.add(value);
        request.onsuccess = () => resolve(request.result as number);
        request.onerror = () => reject(request.error);
      })
  );
}

function dbGetAll<T>(storeName: string): Promise<T[]> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      })
  );
}

function dbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
}

// ── Hashing ───────────────────────────────────────────

export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Device ID ─────────────────────────────────────────

const DEVICE_ID_LS_KEY = "vyntex.pos.deviceId";

function newDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readLocalDeviceId(): string | null {
  try {
    const value = localStorage.getItem(DEVICE_ID_LS_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function writeLocalDeviceId(id: string): void {
  try {
    localStorage.setItem(DEVICE_ID_LS_KEY, id);
  } catch {
    // private mode / storage blocked
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Stable device id for license binding.
 * Prefers IndexedDB, falls back to localStorage if IDB is slow/unavailable
 * (common cause of activation screen stuck on "Generating...").
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const fromLs = readLocalDeviceId();

  try {
    const existing = await withTimeout(dbGet<string>(CONFIG_STORE, "deviceId"), 2500);
    if (existing) {
      writeLocalDeviceId(existing);
      return existing;
    }

    const deviceId = fromLs ?? newDeviceId();
    writeLocalDeviceId(deviceId);
    try {
      await withTimeout(dbPut(CONFIG_STORE, "deviceId", deviceId), 2500);
    } catch {
      // localStorage already has it
    }
    return deviceId;
  } catch {
    if (fromLs) return fromLs;
    const deviceId = newDeviceId();
    writeLocalDeviceId(deviceId);
    return deviceId;
  }
}

// ── Activation Token ──────────────────────────────────

export async function generateActivationToken(
  licenseKey: string,
  deviceId: string
): Promise<string> {
  return hashString(`vyntex:${licenseKey}:${deviceId}:activated`);
}

function normalizeLicenseKey(key: string): string {
  return key.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Clears per-license local session data (admin PIN, staff cache, queues).
 * Keeps deviceId and activation until those are updated/cleared separately.
 */
export async function clearLocalPosSessionData(): Promise<void> {
  const db = await openDB();
  const stores = [
    ADMINS_STORE,
    STAFF_STORE,
    CACHE_STORE,
    OFFLINE_QUEUE_STORE,
    PRINT_QUEUE_STORE,
  ];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    for (const name of stores) {
      tx.objectStore(name).clear();
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const ACTIVATION_LS_KEY = "vyntex.pos.activation";

function readLocalActivation(): ActivationData | undefined {
  try {
    const raw = localStorage.getItem(ACTIVATION_LS_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ActivationData;
    if (!parsed?.licenseKey || !parsed?.deviceId || !parsed?.token) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function writeLocalActivation(data: ActivationData): void {
  try {
    localStorage.setItem(ACTIVATION_LS_KEY, JSON.stringify(data));
  } catch {
    // private mode / storage blocked
  }
}

function clearLocalActivation(): void {
  try {
    localStorage.removeItem(ACTIVATION_LS_KEY);
  } catch {
    // ignore
  }
}

export async function saveActivation(data: Omit<ActivationData, "token">): Promise<void> {
  const previous = await getActivation();
  const licenseChanged =
    previous &&
    normalizeLicenseKey(previous.licenseKey) !== normalizeLicenseKey(data.licenseKey);
  if (licenseChanged) {
    try {
      await clearLocalPosSessionData();
    } catch (err) {
      // IndexedDB often throws DOMException "Internal error." in Electron
      console.warn("[local-db] clearLocalPosSessionData failed", err);
    }
  }
  clearRestaurantCache();
  const token = await generateActivationToken(data.licenseKey, data.deviceId);
  const full: ActivationData = { ...data, token };
  writeLocalActivation(full);
  try {
    await withTimeout(dbPut(CONFIG_STORE, "activation", full), 2500);
  } catch (err) {
    // Persist via localStorage so activation is not blocked by broken IndexedDB
    console.warn("[local-db] IndexedDB saveActivation failed; using localStorage", err);
  }
}

export async function getActivation(): Promise<ActivationData | undefined> {
  try {
    const fromDb = await withTimeout(dbGet<ActivationData>(CONFIG_STORE, "activation"), 2500);
    if (fromDb?.licenseKey && fromDb?.deviceId && fromDb?.token) {
      writeLocalActivation(fromDb);
      return fromDb;
    }
  } catch (err) {
    console.warn("[local-db] IndexedDB getActivation failed; using localStorage", err);
  }
  return readLocalActivation();
}

export async function clearActivation(): Promise<void> {
  clearLocalActivation();
  try {
    await clearLocalPosSessionData();
  } catch (err) {
    console.warn("[local-db] clearLocalPosSessionData failed", err);
  }
  clearRestaurantCache();
  try {
    const db = await withTimeout(openDB(), 2500);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CONFIG_STORE, "readwrite");
      const store = tx.objectStore(CONFIG_STORE);
      const request = store.delete("activation");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("[local-db] IndexedDB clearActivation failed", err);
  }
}

export async function verifyLocalToken(
  licenseKey: string,
  deviceId: string,
  storedToken: string
): Promise<boolean> {
  const expectedToken = await generateActivationToken(licenseKey, deviceId);
  return expectedToken === storedToken;
}

// ── Local Admin ───────────────────────────────────────

export async function saveLocalAdmin(
  name: string,
  masterPassword: string,
  pin: string
): Promise<number> {
  const passwordHash = await hashString(masterPassword);
  const pinHash = await hashString(pin);

  const admin: LocalAdmin = {
    name,
    passwordHash,
    pin: pinHash,
    createdAt: new Date().toISOString(),
  };

  return dbAdd(ADMINS_STORE, admin);
}

export async function getLocalAdmins(): Promise<LocalAdmin[]> {
  return dbGetAll<LocalAdmin>(ADMINS_STORE);
}

export async function verifyMasterPassword(password: string): Promise<boolean> {
  const admins = await getLocalAdmins();
  if (admins.length === 0) return false;
  const hash = await hashString(password);
  return admins.some((a) => a.passwordHash === hash);
}

export async function verifyPin(pin: string): Promise<LocalAdmin | null> {
  const admins = await getLocalAdmins();
  const hash = await hashString(pin);
  return admins.find((a) => a.pin === hash) ?? null;
}

// ── Staff Cache (for offline PIN verification) ────────

export async function saveStaffCache(staffList: LocalStaff[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STAFF_STORE, "readwrite");
    const store = tx.objectStore(STAFF_STORE);
    store.clear();
    for (const member of staffList) {
      store.put(member);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStaffCache(): Promise<LocalStaff[]> {
  return dbGetAll<LocalStaff>(STAFF_STORE);
}

export async function verifyLocalStaffPin(
  pinHash: string
): Promise<{ convexId: string; name: string; role: StaffRole } | null> {
  const staff = await getStaffCache();
  const match = staff.find((s) => s.pinHash === pinHash && s.isActive);
  if (!match) return null;
  return { convexId: match.convexId, name: match.name, role: match.role };
}

// ── Data Cache (for offline query results) ────────────

/**
 * Save a query result to the local cache, keyed by a string identifier.
 * The value is JSON-serialized.
 */
export async function saveDataCache(key: string, value: unknown): Promise<void> {
  await dbPut(CACHE_STORE, key, {
    data: value,
    cachedAt: new Date().toISOString(),
  });
}

/**
 * Retrieve a cached query result from IndexedDB.
 */
export async function getDataCache<T>(key: string): Promise<T | undefined> {
  const entry = await dbGet<{ data: T; cachedAt: string }>(CACHE_STORE, key);
  return entry?.data;
}

// ── Local open shifts (Convex clockIn is stubbed; Supabase shift row may not exist) ──

type OpenShiftsMap = Record<
  string,
  { clockIn: string; openingCash: number }
>;

function openShiftsCacheKey(licenseKey: string) {
  return `openShifts:${licenseKey}`;
}

async function getOpenShiftsMap(licenseKey: string): Promise<OpenShiftsMap> {
  return (
    (await getDataCache<OpenShiftsMap>(openShiftsCacheKey(licenseKey))) ?? {}
  );
}

/** Mark a waiter as having an active shift on this device (until closed in Z-report or close day). */
export async function setStaffOpenShift(
  licenseKey: string,
  staffId: string,
  openingCash: number,
): Promise<void> {
  const map = await getOpenShiftsMap(licenseKey);
  map[staffId] = {
    clockIn: new Date().toISOString(),
    openingCash,
  };
  await saveDataCache(openShiftsCacheKey(licenseKey), map);
}

export async function hasStaffOpenShiftLocal(
  licenseKey: string,
  staffId: string,
): Promise<boolean> {
  const map = await getOpenShiftsMap(licenseKey);
  return map[staffId] !== undefined;
}

export async function clearStaffOpenShiftLocal(
  licenseKey: string,
  staffId: string,
): Promise<void> {
  const map = await getOpenShiftsMap(licenseKey);
  delete map[staffId];
  await saveDataCache(openShiftsCacheKey(licenseKey), map);
}

export async function clearAllOpenShiftsLocal(licenseKey: string): Promise<void> {
  await saveDataCache(openShiftsCacheKey(licenseKey), {});
}

// ── Offline Mutation Queue ────────────────────────────

/**
 * Add a mutation to the offline queue to be replayed when back online.
 */
export async function enqueueMutation(
  functionPath: string,
  args: Record<string, unknown>
): Promise<number> {
  return dbAdd(OFFLINE_QUEUE_STORE, {
    functionPath,
    args,
    createdAt: new Date().toISOString(),
    retries: 0,
  });
}

/**
 * Get all queued mutations in insertion order.
 */
export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  return dbGetAll<QueuedMutation>(OFFLINE_QUEUE_STORE);
}

/**
 * Remove a successfully replayed mutation from the queue.
 */
export async function removeQueuedMutation(id: number): Promise<void> {
  await dbDelete(OFFLINE_QUEUE_STORE, id);
}

/**
 * Increment retry count for a failed mutation.
 */
export async function incrementMutationRetry(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(OFFLINE_QUEUE_STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const item = request.result as QueuedMutation | undefined;
      if (item) {
        store.put({ ...item, retries: item.retries + 1 });
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all queued mutations (e.g. after successful sync or on user reset).
 */
export async function clearOfflineQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(OFFLINE_QUEUE_STORE);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get the count of pending offline mutations.
 */
export async function getOfflineQueueCount(): Promise<number> {
  const items = await getQueuedMutations();
  return items.length;
}

// ── Print Queue ────────────────────────────────────────────

/**
 * Enqueue a failed/queued HTML print so it can be retried when the printer is connected.
 * Stored locally in IndexedDB for resilience across app reloads.
 */
export async function enqueuePrintJob(args: Omit<QueuedPrintJob, "id" | "retries">): Promise<number> {
  return dbAdd(PRINT_QUEUE_STORE, {
    ...args,
    retries: 0,
  });
}

/** Get all queued print jobs in insertion order. */
export async function getQueuedPrintJobs(): Promise<QueuedPrintJob[]> {
  return dbGetAll<QueuedPrintJob>(PRINT_QUEUE_STORE);
}

/** Remove a successfully replayed print job from the queue. */
export async function removeQueuedPrintJob(id: number): Promise<void> {
  await dbDelete(PRINT_QUEUE_STORE, id);
}

/** Increment retry count and optionally record last error. */
export async function incrementPrintJobRetry(id: number, lastError?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRINT_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(PRINT_QUEUE_STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const item = request.result as QueuedPrintJob | undefined;
      if (item) {
        store.put({ ...item, retries: item.retries + 1, lastError: lastError ?? item.lastError });
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/** Get the count of queued print jobs. */
export async function getPrintQueueCount(): Promise<number> {
  const items = await getQueuedPrintJobs();
  return items.length;
}

/** Clear all queued print jobs (e.g. debugging / user reset). */
export async function clearPrintQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRINT_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(PRINT_QUEUE_STORE);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── PIN login screen branding (per device, local only) ─────

export type PinLoginPlacement =
  | "top-center"
  | "top-left"
  | "top-right"
  | "above-pin"
  /** Logo + business name vertically centered with PIN block below */
  | "center"
  /** Logo + name above the footer strip (PIN stays in the middle column) */
  | "bottom-center"
  /** Free position: logo + PIN column use separate percent offsets (see `PinLoginBranding`) */
  | "custom";

export const PIN_LOGIN_PLACEMENTS: PinLoginPlacement[] = [
  "top-center",
  "top-left",
  "top-right",
  "above-pin",
  "center",
  "bottom-center",
  "custom",
];

export type PinLoginBranding = {
  /** Custom image; null keeps the default Vyntex mark */
  logoDataUrl: string | null;
  /** Logo height in CSS pixels (width follows aspect ratio) */
  logoHeightPx: number;
  placement: PinLoginPlacement;
  /** 0 = left … 100 = right of the PIN screen (used when `placement === "custom"`) */
  logoOffsetXPercent: number;
  /** 0 = top … 100 = bottom of the PIN screen (used when `placement === "custom"`) */
  logoOffsetYPercent: number;
  /** 0 = left … 100 = right — anchor for the PIN column (wifi + field + keypad) when `placement === "custom"` */
  pinBlockOffsetXPercent: number;
  /** 0 = top … 100 = bottom — anchor for the PIN column when `placement === "custom"` */
  pinBlockOffsetYPercent: number;
};

export const DEFAULT_PIN_LOGIN_BRANDING: PinLoginBranding = {
  logoDataUrl: null,
  logoHeightPx: 140,
  placement: "top-center",
  logoOffsetXPercent: 50,
  logoOffsetYPercent: 22,
  pinBlockOffsetXPercent: 50,
  pinBlockOffsetYPercent: 56,
};

const LOGO_HEIGHT_MIN = 40;
const LOGO_HEIGHT_MAX = 520;

export function normalizePinLoginBranding(
  raw: Partial<PinLoginBranding> | null | undefined,
): PinLoginBranding {
  const merged: PinLoginBranding = {
    ...DEFAULT_PIN_LOGIN_BRANDING,
    ...(raw ?? {}),
  };
  merged.logoDataUrl =
    raw?.logoDataUrl === undefined ? merged.logoDataUrl : raw.logoDataUrl ?? null;

  const p = raw?.placement;
  if (
    typeof p === "string" &&
    (PIN_LOGIN_PLACEMENTS as readonly string[]).includes(p)
  ) {
    merged.placement = p as PinLoginPlacement;
  } else {
    merged.placement = DEFAULT_PIN_LOGIN_BRANDING.placement;
  }

  const h = Number(raw?.logoHeightPx);
  if (Number.isFinite(h)) {
    merged.logoHeightPx = Math.round(
      Math.min(LOGO_HEIGHT_MAX, Math.max(LOGO_HEIGHT_MIN, h)),
    );
  }

  const ox = Number(raw?.logoOffsetXPercent);
  merged.logoOffsetXPercent = Number.isFinite(ox)
    ? Math.min(100, Math.max(0, Math.round(ox)))
    : merged.logoOffsetXPercent;

  const oy = Number(raw?.logoOffsetYPercent);
  merged.logoOffsetYPercent = Number.isFinite(oy)
    ? Math.min(100, Math.max(0, Math.round(oy)))
    : merged.logoOffsetYPercent;

  const px = Number(raw?.pinBlockOffsetXPercent);
  merged.pinBlockOffsetXPercent = Number.isFinite(px)
    ? Math.min(100, Math.max(0, Math.round(px)))
    : merged.pinBlockOffsetXPercent;

  const py = Number(raw?.pinBlockOffsetYPercent);
  merged.pinBlockOffsetYPercent = Number.isFinite(py)
    ? Math.min(100, Math.max(0, Math.round(py)))
    : merged.pinBlockOffsetYPercent;

  return merged;
}

function pinBrandingKey(licenseKey: string) {
  return `pinBranding:${licenseKey}`;
}

export async function getPinLoginBranding(
  licenseKey: string,
): Promise<PinLoginBranding> {
  const raw = await dbGet<Partial<PinLoginBranding>>(
    CONFIG_STORE,
    pinBrandingKey(licenseKey),
  );
  if (!raw) return { ...DEFAULT_PIN_LOGIN_BRANDING };
  return normalizePinLoginBranding({
    ...raw,
    logoDataUrl:
      raw.logoDataUrl === undefined ? null : raw.logoDataUrl,
  });
}

export async function savePinLoginBranding(
  licenseKey: string,
  branding: PinLoginBranding,
): Promise<void> {
  await dbPut(
    CONFIG_STORE,
    pinBrandingKey(licenseKey),
    normalizePinLoginBranding(branding),
  );
}
