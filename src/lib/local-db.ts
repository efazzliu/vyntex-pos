/**
 * IndexedDB utilities for VYNTEX POS local storage.
 * Stores activation tokens, local admin credentials, and cached staff for offline access.
 */

const DB_NAME = "vyntex-local";
const DB_VERSION = 2;
const CONFIG_STORE = "config";
const ADMINS_STORE = "admins";
const STAFF_STORE = "staff";

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

export type LocalStaff = {
  convexId: string;
  name: string;
  role: "admin" | "waiter" | "kitchen";
  pinHash: string;
  isActive: boolean;
};

// ── Database ──────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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

// ── Hashing ───────────────────────────────────────────

export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Device ID ─────────────────────────────────────────

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await dbGet<string>(CONFIG_STORE, "deviceId");
  if (existing) return existing;

  const deviceId = crypto.randomUUID();
  await dbPut(CONFIG_STORE, "deviceId", deviceId);
  return deviceId;
}

// ── Activation Token ──────────────────────────────────

export async function generateActivationToken(
  licenseKey: string,
  deviceId: string
): Promise<string> {
  // Create a hash of the license key + device ID to form a token
  return hashString(`vyntex:${licenseKey}:${deviceId}:activated`);
}

export async function saveActivation(data: Omit<ActivationData, "token">): Promise<void> {
  const token = await generateActivationToken(data.licenseKey, data.deviceId);
  await dbPut(CONFIG_STORE, "activation", { ...data, token });
}

export async function getActivation(): Promise<ActivationData | undefined> {
  return dbGet<ActivationData>(CONFIG_STORE, "activation");
}

export async function clearActivation(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONFIG_STORE, "readwrite");
    const store = tx.objectStore(CONFIG_STORE);
    const request = store.delete("activation");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
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

/**
 * Replace the entire local staff cache with fresh data from the server.
 */
export async function saveStaffCache(staffList: LocalStaff[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STAFF_STORE, "readwrite");
    const store = tx.objectStore(STAFF_STORE);

    // Clear existing cache
    store.clear();

    // Add all staff
    for (const member of staffList) {
      store.put(member);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all cached staff members from IndexedDB.
 */
export async function getStaffCache(): Promise<LocalStaff[]> {
  return dbGetAll<LocalStaff>(STAFF_STORE);
}

/**
 * Verify a PIN hash against the local staff cache.
 * Used when offline and the Convex backend is unreachable.
 */
export async function verifyLocalStaffPin(
  pinHash: string
): Promise<{ convexId: string; name: string; role: "admin" | "waiter" | "kitchen" } | null> {
  const staff = await getStaffCache();
  const match = staff.find((s) => s.pinHash === pinHash && s.isActive);
  if (!match) return null;
  return { convexId: match.convexId, name: match.name, role: match.role };
}
