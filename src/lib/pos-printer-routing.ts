export type PrinterRole = "receipt" | "kitchen" | "bar";

export type PosPrinterLike = {
  _id?: string;
  id?: string;
  isActive?: boolean;
  role?: string;
  address?: string | null;
  name?: string | null;
};

export type PrinterProbe = {
  testedOk: boolean;
  testedAt: number;
  lastError?: string;
};

export type PrinterConnectionKind = "untested" | "connected" | "failed";

type RoutingStore = {
  defaults: Partial<Record<PrinterRole, string>>;
  probes: Record<string, PrinterProbe>;
};

const LS_PREFIX = "vyntex.pos.printerRouting:";

function emptyStore(): RoutingStore {
  return { defaults: {}, probes: {} };
}

function readStore(licenseKey: string): RoutingStore {
  try {
    const raw = localStorage.getItem(LS_PREFIX + licenseKey);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<RoutingStore>;
    return {
      defaults:
        parsed.defaults && typeof parsed.defaults === "object"
          ? parsed.defaults
          : {},
      probes:
        parsed.probes && typeof parsed.probes === "object" ? parsed.probes : {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(licenseKey: string, store: RoutingStore): void {
  localStorage.setItem(LS_PREFIX + licenseKey, JSON.stringify(store));
}

export function printerRecordId(printer: PosPrinterLike): string {
  return String(printer._id ?? printer.id ?? "").trim();
}

export function printerDeviceName(printer: PosPrinterLike | undefined): string | undefined {
  if (!printer) return undefined;
  const address = (printer.address ?? "").trim();
  const name = (printer.name ?? "").trim();
  return address || name || undefined;
}

export function getPrinterDefaults(
  licenseKey: string,
): Partial<Record<PrinterRole, string>> {
  return readStore(licenseKey).defaults;
}

export function setPrinterDefault(
  licenseKey: string,
  role: PrinterRole,
  printerId: string | null,
): void {
  const store = readStore(licenseKey);
  if (!printerId) {
    delete store.defaults[role];
  } else {
    store.defaults[role] = printerId;
  }
  writeStore(licenseKey, store);
}

export function getPrinterProbe(
  licenseKey: string,
  printerId: string,
): PrinterProbe | undefined {
  return readStore(licenseKey).probes[printerId];
}

export function getPrinterConnectionKind(
  licenseKey: string,
  printerId: string,
): PrinterConnectionKind {
  const probe = getPrinterProbe(licenseKey, printerId);
  if (!probe) return "untested";
  return probe.testedOk ? "connected" : "failed";
}

export function markPrinterTested(
  licenseKey: string,
  printerId: string,
  testedOk: boolean,
  lastError?: string,
): PrinterProbe {
  const store = readStore(licenseKey);
  const probe: PrinterProbe = {
    testedOk,
    testedAt: Date.now(),
    lastError: testedOk ? undefined : lastError,
  };
  store.probes[printerId] = probe;
  writeStore(licenseKey, store);
  return probe;
}

export function clearPrinterRoutingRecord(
  licenseKey: string,
  printerId: string,
): void {
  const store = readStore(licenseKey);
  delete store.probes[printerId];
  for (const role of ["receipt", "kitchen", "bar"] as const) {
    if (store.defaults[role] === printerId) delete store.defaults[role];
  }
  writeStore(licenseKey, store);
}

export function pickPrinterForRole<T extends PosPrinterLike>(
  printers: T[],
  role: PrinterRole,
  licenseKey: string,
): T | undefined {
  const list = printers.filter((p) => p.isActive !== false);
  const defaultId = readStore(licenseKey).defaults[role];
  if (defaultId) {
    const hit = list.find(
      (p) => printerRecordId(p) === defaultId && p.role === role,
    );
    if (hit) return hit;
  }
  return list.find((p) => p.role === role);
}

export function printerDeviceNameForRole(
  printers: PosPrinterLike[],
  role: PrinterRole,
  licenseKey: string,
): string | undefined {
  return printerDeviceName(pickPrinterForRole(printers, role, licenseKey));
}

/** Kitchen/bar papers use those stations; every other document uses the receipt printer. */
export function templatePrinterRole(templateType: string): PrinterRole {
  if (templateType === "kitchen_ticket") return "kitchen";
  if (templateType === "bar_ticket") return "bar";
  return "receipt";
}

/**
 * Print Layout assignment wins. If none, Printers & Devices role routing is used.
 * A known Device ID / printer name is never treated as an auth credential here.
 */
export function resolvePaperPrinterDeviceName(
  printers: PosPrinterLike[],
  licenseKey: string,
  templatePrinterId?: string | null,
  templateType?: string,
): string | undefined {
  const list = printers.filter((p) => p.isActive !== false);
  const assignedId = String(templatePrinterId ?? "").trim();
  if (assignedId) {
    const hit = list.find((p) => printerRecordId(p) === assignedId);
    const name = printerDeviceName(hit);
    if (name) return name;
  }
  return printerDeviceNameForRole(
    printers,
    templatePrinterRole(templateType ?? "fiscal_receipt"),
    licenseKey,
  );
}
