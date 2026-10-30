import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  ArrowRight,
  Bluetooth,
  ChefHat,
  GitBranch,
  LayoutTemplate,
  Pencil,
  Play,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Ruler,
  Trash2,
  Usb,
  Wifi,
  Wine,
  type LucideIcon,
} from "lucide-react";
import {
  getDesktopSystemPrintersInvoker,
  hasElectronSilentPrintIpc,
  previewCalibrationPdf,
  printCalibrationPage,
  tryPrintHtmlDocumentAsync,
  type DesktopSystemPrinterInfo,
} from "@/lib/print-html.ts";
import {
  defaultPrinterCalibration,
  getPrinterCalibration,
  normalizePrinterCalibration,
  savePrinterCalibration,
  PAPER_MAX_MM,
  PAPER_MIN_MM,
} from "@/lib/print-calibration.ts";
import {
  getQueuedPrintJobs,
  removeQueuedPrintJob,
  type QueuedPrintJob,
} from "@/lib/local-db.ts";
import { flushQueuedPrintJob } from "@/lib/print-queue.ts";
import {
  errorMessageFromUnknown,
  isMissingSupabaseTableError,
} from "@/lib/supabase-pos/db-errors.ts";
import ensurePosPrintersSql from "../../../../supabase/ensure_pos_printers.sql?raw";
import {
  clearPrinterRoutingRecord,
  getPrinterConnectionKind,
  getPrinterDefaults,
  getPrinterProbe,
  markPrinterTested,
  setPrinterDefault,
  type PrinterConnectionKind,
  type PrinterRole,
} from "@/lib/pos-printer-routing.ts";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type PosPrinter = {
  _id: string;
  name: string;
  type: "bluetooth" | "network" | "usb";
  address: string;
  role: PrinterRole;
  isActive: boolean;
};

type AddPrinterFn = (args: {
  licenseKey: string;
  name: string;
  type: "bluetooth" | "network" | "usb";
  address: string;
  role: PrinterRole;
}) => Promise<unknown>;

const TYPE_ICONS: Record<PosPrinter["type"], LucideIcon> = {
  bluetooth: Bluetooth,
  network: Wifi,
  usb: Usb,
};

const TYPE_LABELS: Record<PosPrinter["type"], string> = {
  bluetooth: "Bluetooth",
  network: "Network (IP)",
  usb: "USB / System",
};

const ROLE_COLORS: Record<PrinterRole, string> = {
  receipt: "bg-emerald-500/12 text-emerald-600 border-emerald-500/25",
  kitchen: "bg-brand/12 text-brand border-brand/25",
  bar: "bg-brand/12 text-brand border-brand/25",
};

const ROUTING_ROLES: {
  id: PrinterRole;
  icon: LucideIcon;
  color: string;
  titleKey: string;
  hintKey: string;
}[] = [
  {
    id: "receipt",
    icon: Receipt,
    color: "#34D399",
    titleKey: "settings.printer_routing_receipt",
    hintKey: "settings.printer_routing_receipt_hint",
  },
  {
    id: "kitchen",
    icon: ChefHat,
    color: "#FB923C",
    titleKey: "settings.printer_routing_kitchen",
    hintKey: "settings.printer_routing_kitchen_hint",
  },
  {
    id: "bar",
    icon: Wine,
    color: "#A78BFA",
    titleKey: "settings.printer_routing_bar",
    hintKey: "settings.printer_routing_bar_hint",
  },
];

const TYPE_KEY: Record<PosPrinter["type"], string> = {
  bluetooth: "settings.printer_type_bluetooth",
  network: "settings.printer_type_network",
  usb: "settings.printer_type_usb",
};

function PrinterStatusMark({
  kind,
  error,
  t,
}: {
  kind: PrinterConnectionKind;
  error?: string;
  t: Translate;
}) {
  return (
    <span className="inline-flex min-w-0 flex-col gap-0.5" title={error}>
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
          kind === "connected" && "bg-emerald-500/12 text-emerald-600",
          kind === "failed" && "bg-red-500/12 text-red-600",
          kind === "untested" && "bg-amber-500/12 text-amber-600",
        )}
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            kind === "connected" && "bg-emerald-500",
            kind === "failed" && "bg-red-500",
            kind === "untested" && "bg-amber-500",
          )}
        />
        {connectionLabel(kind, t)}
      </span>
      {kind === "failed" && error ? (
        <span className="max-w-[160px] truncate text-[11px] text-red-500">{error}</span>
      ) : null}
    </span>
  );
}

function connectionLabel(kind: PrinterConnectionKind, t: Translate) {
  if (kind === "connected") return t("settings.printer_status_connected");
  if (kind === "failed") return t("settings.printer_status_failed");
  return t("settings.printer_status_untested");
}

function printErrorText(error: string | undefined, t: Translate) {
  if (!error) return t("order.print_ticket_silent_failed");
  const key = `settings.print_err_${error.replace(/-/g, "_")}`;
  const translated = t(key);
  return translated === key ? error : translated;
}

function testPrintHtml(printer: PosPrinter) {
  return `
    <html>
    <head><title>Test Print</title>
      <style>
        body { font-family: monospace; padding: 20px; text-align: center; font-size: 14px; }
        hr { border: 1px dashed #333; }
        .title { font-size: 18px; font-weight: bold; }
        .info { color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <p class="title">Vyntex POS</p>
      <hr/>
      <p>TEST PRINT</p>
      <p>Printer: ${printer.name}</p>
      <p>Role: ${printer.role}</p>
      <p>Type: ${TYPE_LABELS[printer.type]}</p>
      <p>Address: ${printer.address}</p>
      <hr/>
      <p class="info">${new Date().toLocaleString()}</p>
      <p class="info">If you see this, the connection is active.</p>
      <hr/>
    </body>
    </html>
  `;
}

function tableMissingToast(t: Translate) {
  toast.error(t("settings.printer_table_missing_title"), {
    description: t("settings.printer_table_missing_steps"),
    duration: 25_000,
    action: {
      label: t("settings.printer_copy_sql"),
      onClick: () => {
        void navigator.clipboard.writeText(ensurePosPrintersSql).then(
          () => toast.success(t("settings.printer_sql_copied")),
          () => toast.error(t("settings.printer_sql_copy_failed")),
        );
      },
    },
  });
}

type SettingsDevicesPanelProps = {
  t: Translate;
  licenseKey: string;
  onOpenPrintLayout: () => void;
};

export default function SettingsDevicesPanel({
  t,
  licenseKey,
  onOpenPrintLayout,
}: SettingsDevicesPanelProps) {
  const printersQuery = useQuery("pos.settings.getPrinters", { licenseKey });
  const addPrinter = useMutation("pos.settings.addPrinter") as AddPrinterFn;
  const updatePrinter = useMutation("pos.settings.updatePrinter");
  const deletePrinter = useMutation("pos.settings.deletePrinter");

  const printers = useMemo<PosPrinter[]>(() => {
    if (!Array.isArray(printersQuery)) return [];
    return printersQuery.map((row) => {
      const rec = row as Record<string, unknown>;
      const type = rec.type === "bluetooth" || rec.type === "network" ? rec.type : "usb";
      const role: PrinterRole =
        rec.role === "kitchen" || rec.role === "bar" ? rec.role : "receipt";
      return {
        _id: String(rec._id ?? rec.id ?? ""),
        name: String(rec.name ?? ""),
        type,
        address: String(rec.address ?? ""),
        role,
        isActive: rec.isActive !== false,
      };
    });
  }, [printersQuery]);

  const invokeSystemPrinters = useMemo(() => getDesktopSystemPrintersInvoker(), []);
  const [addIpOpen, setAddIpOpen] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PosPrinter | null>(null);
  const [calibrating, setCalibrating] = useState<PosPrinter | null>(null);
  const [calibrationTick, setCalibrationTick] = useState(0);
  const [routingTick, setRoutingTick] = useState(0);
  const [queue, setQueue] = useState<QueuedPrintJob[]>([]);
  const [queueBusy, setQueueBusy] = useState(false);

  const refreshRouting = () => setRoutingTick((n) => n + 1);
  const defaults = useMemo(
    () => getPrinterDefaults(licenseKey),
    [licenseKey, routingTick],
  );

  const refreshQueue = useCallback(async () => {
    try {
      setQueue(await getQueuedPrintJobs());
    } catch {
      setQueue([]);
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
    const id = window.setInterval(() => void refreshQueue(), 4000);
    return () => window.clearInterval(id);
  }, [refreshQueue]);

  /** Printing goes through Windows print queues, so a Bluetooth printer must be paired in Windows first. */
  const handleBluetoothPrinter = () => {
    toast.info(t("msg.bluetooth_desktop_use_system"), { duration: 7000 });
    if (invokeSystemPrinters) setSystemOpen(true);
  };

  const handleTestPrint = async (printer: PosPrinter) => {
    setTestingId(printer._id);
    try {
      const canProve = hasElectronSilentPrintIpc();
      const outcome = await tryPrintHtmlDocumentAsync(testPrintHtml(printer), {
        silent: canProve,
        allowInteractiveFallback: false,
        deviceName: printer.address?.trim() || printer.name?.trim() || undefined,
      });
      if (!canProve) {
        toast.info(t("settings.printer_test_desktop_only"));
        return;
      }
      if (!outcome.ok) {
        markPrinterTested(licenseKey, printer._id, false, outcome.error);
        refreshRouting();
        toast.error(printErrorText(outcome.error, t));
        return;
      }
      markPrinterTested(licenseKey, printer._id, true);
      refreshRouting();
      toast.success(t("settings.test_print_ok"));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (printer: PosPrinter) => {
    try {
      await deletePrinter({ licenseKey, printerId: printer._id });
      clearPrinterRoutingRecord(licenseKey, printer._id);
      refreshRouting();
      toast.success(t("settings.printer_removed"));
    } catch {
      toast.error(t("settings.save_failed"));
    }
  };

  const handleRoleChange = async (printer: PosPrinter, role: PrinterRole) => {
    try {
      await updatePrinter({ licenseKey, printerId: printer._id, role });
      if (defaults[printer.role] === printer._id && printer.role !== role) {
        setPrinterDefault(licenseKey, printer.role, null);
      }
      refreshRouting();
      toast.success(t("settings.printer_role_updated"));
    } catch {
      toast.error(t("settings.save_failed"));
    }
  };

  const handleRouteChange = async (role: PrinterRole, printerId: string) => {
    if (printerId === "none") {
      setPrinterDefault(licenseKey, role, null);
      refreshRouting();
      return;
    }
    const printer = printers.find((p) => p._id === printerId);
    if (!printer) return;
    try {
      if (printer.role !== role) {
        await updatePrinter({ licenseKey, printerId, role });
      }
      setPrinterDefault(licenseKey, role, printerId);
      refreshRouting();
      toast.success(t("settings.printer_routing_saved"));
    } catch {
      toast.error(t("settings.save_failed"));
    }
  };

  const handleRetryJob = async (id: number) => {
    setQueueBusy(true);
    try {
      const result = await flushQueuedPrintJob(id);
      await refreshQueue();
      if (result === "sent") toast.success(t("settings.print_queue_retry_ok"));
      else if (result === "failed") toast.error(t("settings.print_queue_retry_failed"));
    } finally {
      setQueueBusy(false);
    }
  };

  const printersLoading = printersQuery === undefined;

  const addPrinterButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          className="h-10 rounded-xl bg-brand px-4 font-semibold hover:bg-brand-hover"
        >
          <Plus className="size-4" />
          {t("settings.add_printer")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-pos-theme={
          typeof document !== "undefined" &&
          document.querySelector("[data-pos-theme]")?.getAttribute("data-pos-theme") ===
            "light"
            ? "light"
            : "dark"
        }
        className="min-w-52 border-[#1e2a45] bg-[#131A2E] text-white"
      >
        {invokeSystemPrinters ? (
          <DropdownMenuItem
            className="gap-2"
            onSelect={() => setSystemOpen(true)}
          >
            <Usb className="size-4 text-brand" />
            {t("settings.add_usb_printer")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem className="gap-2" onSelect={() => setAddIpOpen(true)}>
          <Wifi className="size-4 text-brand" />
          {t("settings.add_ip_printer")}
        </DropdownMenuItem>
        {invokeSystemPrinters ? (
          <DropdownMenuItem className="gap-2" onSelect={handleBluetoothPrinter}>
            <Bluetooth className="size-4 text-brand" />
            {t("settings.add_bluetooth_printer")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/12">
          <Printer className="size-5 text-brand" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">
            {t("settings.devices_heading")}
          </h1>
          <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-[#8b93a7]">
            {t("settings.devices_lead")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-[22px] border border-[#1e2a45] bg-[#131A2E]">
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Printer className="size-4 text-brand" />
                {t("settings.printers")}
              </h2>
              <p className="mt-0.5 text-sm text-[#8b93a7]">{t("settings.printers_desc")}</p>
            </div>
            {addPrinterButton}
          </div>
          {printersLoading ? (
            <p className="px-5 py-10 text-sm text-[#8b93a7]">{t("common.loading")}</p>
          ) : printers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Printer className="size-5" />
              </span>
              <p className="text-sm font-medium text-white">{t("settings.no_printers")}</p>
              <p className="max-w-sm text-sm text-[#8b93a7]">{t("settings.no_printers_desc")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-y border-[#1e2a45] text-[12px] font-medium text-[#5a6580]">
                    <th className="px-5 py-2.5 font-medium">{t("settings.printer_col_name")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("settings.printer_col_type")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("settings.printer_col_address")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("settings.printer_col_role")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("settings.printer_col_status")}</th>
                    <th className="px-5 py-2.5 text-right font-medium">
                      {t("settings.printer_col_actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {printers.map((printer) => {
                    const TypeIcon = TYPE_ICONS[printer.type];
                    const kind = getPrinterConnectionKind(licenseKey, printer._id);
                    const probe = getPrinterProbe(licenseKey, printer._id);
                    return (
                      <tr
                        key={printer._id}
                        className="border-b border-[#1e2a45] last:border-b-0"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0D1326] text-[#8b93a7]">
                              <TypeIcon className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {printer.name}
                              </p>
                              <p className="truncate text-[11px] text-[#8b93a7]">
                                {TYPE_LABELS[printer.type]}
                              </p>
                              <CalibrationSummary
                                deviceName={printerDeviceName(printer)}
                                tick={calibrationTick}
                                t={t}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-sm text-white">
                            <TypeIcon className="size-3.5 text-[#8b93a7]" />
                            {t(TYPE_KEY[printer.type])}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 font-mono text-[12px] text-[#8b93a7]">
                          {printer.address || t("settings.not_set")}
                        </td>
                        <td className="px-3 py-3.5">
                          <Select
                            value={printer.role}
                            onValueChange={(val) =>
                              void handleRoleChange(printer, val as PrinterRole)
                            }
                          >
                            <SelectTrigger
                              className={cn(
                                "h-8 w-[132px] rounded-full border px-2.5 text-xs font-medium",
                                ROLE_COLORS[printer.role],
                                "bg-transparent",
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-[#1e2a45] bg-[#131A2E] text-white">
                              <SelectItem value="receipt">
                                {t("settings.receipt_printer")}
                              </SelectItem>
                              <SelectItem value="kitchen">
                                {t("settings.kitchen_printer")}
                              </SelectItem>
                              <SelectItem value="bar">{t("settings.bar_printer")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3.5">
                          <PrinterStatusMark
                            kind={kind}
                            error={
                              kind === "failed" && probe?.lastError
                                ? printErrorText(probe.lastError, t)
                                : undefined
                            }
                            t={t}
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleTestPrint(printer)}
                              disabled={testingId === printer._id}
                              className="h-8 rounded-lg px-2.5 text-brand hover:bg-brand/10 hover:text-brand"
                            >
                              <Play className="size-3.5 fill-current" />
                              {testingId === printer._id ? "…" : t("settings.test_print")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setCalibrating(printer)}
                              className="size-8 text-[#8b93a7] hover:bg-[#0D1326] hover:text-white"
                              aria-label={t("settings.calibrate_printer")}
                              title={t("settings.calibrate_printer")}
                            >
                              <Ruler className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditing(printer)}
                              className="size-8 text-[#8b93a7] hover:bg-[#0D1326] hover:text-white"
                              aria-label={t("settings.edit_printer")}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleDelete(printer)}
                              className="size-8 text-[#8b93a7] hover:bg-red-500/10 hover:text-red-500"
                              aria-label={t("settings.printer_delete")}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[22px] border border-[#1e2a45] bg-[#131A2E] p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <GitBranch className="size-4 text-brand" />
            {t("settings.printer_routing_title")}
          </h2>
          <p className="mt-0.5 text-sm text-[#8b93a7]">{t("settings.printer_routing_lead")}</p>
          <div className="mt-4 space-y-2.5">
            {ROUTING_ROLES.map((item) => {
              const Icon = item.icon;
              const raw = defaults[item.id] ?? "none";
              const value = printers.some((p) => p._id === raw) ? raw : "none";
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#1e2a45] bg-[#0D1326] px-3.5 py-3"
                >
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <span
                      className="flex size-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${item.color}22` }}
                    >
                      <Icon className="size-4" style={{ color: item.color }} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{t(item.titleKey)}</p>
                      <p className="text-[11px] text-[#8b93a7]">{t(item.hintKey)}</p>
                    </div>
                  </div>
                  <Select
                    value={value}
                    onValueChange={(id) => void handleRouteChange(item.id, id)}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-[#1e2a45] bg-[#131A2E] text-white">
                      <SelectValue placeholder={t("settings.not_set")} />
                    </SelectTrigger>
                    <SelectContent className="border-[#1e2a45] bg-[#131A2E] text-white">
                      <SelectItem value="none">{t("settings.not_set")}</SelectItem>
                      {printers.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-[22px] border border-[#1e2a45] bg-[#131A2E] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                {t("settings.print_queue_title")}
              </h2>
              <p className="mt-0.5 text-sm text-[#8b93a7]">{t("settings.print_queue_lead")}</p>
            </div>
            {queue.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600">
                {t("settings.print_queue_failed_count", { count: queue.length })}
              </span>
            ) : null}
          </div>
          {queue.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#1e2a45] px-4 py-8 text-center text-sm text-[#8b93a7]">
              {t("settings.print_queue_empty")}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-y border-[#1e2a45] text-[12px] font-medium text-[#5a6580]">
                    <th className="py-2.5 pr-3 font-medium">{t("settings.print_queue_col_time")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("settings.printer_col_type")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("settings.print_queue_col_details")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("settings.print_queue_col_printer")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("settings.printer_col_status")}</th>
                    <th className="py-2.5 pl-3 text-right font-medium">
                      {t("settings.printer_col_actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((job) => (
                    <tr key={job.id} className="border-b border-[#1e2a45] last:border-b-0">
                      <td className="py-3 pr-3 text-sm text-[#8b93a7]">
                        {new Date(job.createdAt).toLocaleString(undefined, {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-3 text-sm text-white">
                        {t(`settings.print_job_${job.jobType}`)}
                      </td>
                      <td className="px-3 py-3 text-sm text-[#8b93a7]">
                        {job.lastError
                          ? printErrorText(job.lastError, t)
                          : job.retries > 0
                            ? t("settings.print_queue_retries", { count: job.retries })
                            : "—"}
                      </td>
                      <td className="px-3 py-3 text-sm text-white">
                        {job.deviceName || t("settings.not_set")}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                          {t("settings.print_queue_failed")}
                        </span>
                      </td>
                      <td className="py-3 pl-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={queueBusy}
                            className="h-8 text-brand hover:bg-brand/10 hover:text-brand"
                            onClick={() => void handleRetryJob(job.id)}
                          >
                            <RefreshCw className="size-3.5" />
                            {t("settings.print_queue_retry_one")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-8 text-[#8b93a7] hover:bg-red-500/10 hover:text-red-500"
                            onClick={() => {
                              void removeQueuedPrintJob(job.id).then(() => refreshQueue());
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={onOpenPrintLayout}
          className="flex flex-col justify-between rounded-[22px] border border-[#1e2a45] bg-[#131A2E] p-5 text-left hover:border-brand/35"
        >
          <div>
            <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand/10">
              <LayoutTemplate className="size-6 text-brand" />
            </span>
            <p className="text-base font-semibold text-white">
              {t("settings.devices_print_layout_title")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[#8b93a7]">
              {t("settings.devices_print_layout_desc")}
            </p>
          </div>
          <span className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/10 text-sm font-semibold text-brand">
            {t("settings.open_print_layout")}
            <ArrowRight className="size-4" />
          </span>
        </button>
      </div>

      <AddSystemPrinterDialog
        open={systemOpen}
        onOpenChange={setSystemOpen}
        licenseKey={licenseKey}
        addPrinter={addPrinter}
        existingDeviceNames={printers.map((p) => (p.address ?? "").trim().toLowerCase())}
        t={t}
      />
      <AddPrinterDialog
        open={addIpOpen}
        onOpenChange={setAddIpOpen}
        licenseKey={licenseKey}
        addPrinter={addPrinter}
        t={t}
      />
      <EditPrinterDialog
        printer={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        licenseKey={licenseKey}
        updatePrinter={updatePrinter}
        t={t}
      />
      <CalibratePrinterDialog
        printer={calibrating}
        onOpenChange={(open) => {
          if (!open) setCalibrating(null);
        }}
        onSaved={() => setCalibrationTick((n) => n + 1)}
        t={t}
      />
    </div>
  );
}

function AddSystemPrinterDialog({
  open,
  onOpenChange,
  licenseKey,
  addPrinter,
  existingDeviceNames,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  addPrinter: AddPrinterFn;
  existingDeviceNames: string[];
  t: Translate;
}) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<DesktopSystemPrinterInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [friendlyName, setFriendlyName] = useState("");
  const [role, setRole] = useState<PrinterRole>("receipt");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const inv = getDesktopSystemPrintersInvoker();
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setList([]);
    setDeviceName("");
    setFriendlyName("");
    setRole("receipt");
    if (!inv) {
      setLoading(false);
      setLoadError("no-desktop");
      return;
    }
    void inv().then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) {
        setLoadError(r.error);
        return;
      }
      const printers = [...r.printers].sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: "base",
        });
      });
      setList(printers);
      const first = printers.find((p) => p.isDefault) ?? printers[0];
      if (first) {
        setDeviceName(first.deviceName);
        setFriendlyName(first.displayName);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const isDuplicate =
    deviceName.trim().length > 0 &&
    existingDeviceNames.includes(deviceName.trim().toLowerCase());

  const handleSubmit = async () => {
    if (!deviceName.trim()) {
      toast.error(t("settings.usb_printer_pick_required"));
      return;
    }
    if (isDuplicate) {
      toast.error(t("settings.usb_printer_already_added"));
      return;
    }
    setSaving(true);
    try {
      await addPrinter({
        licenseKey,
        name: friendlyName.trim() || deviceName.trim(),
        type: "usb",
        address: deviceName.trim(),
        role,
      });
      toast.success(`${t("settings.printer_added")}. ${t("settings.printer_test_required")}`);
      onOpenChange(false);
    } catch (err) {
      const msg = errorMessageFromUnknown(err, t("settings.save_failed"));
      if (isMissingSupabaseTableError(msg, "pos_printers")) tableMissingToast(t);
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D1326] border-[#1e2a45] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Usb className="size-5 text-brand" />
            {t("settings.usb_printer_dialog_title")}
          </DialogTitle>
          <DialogDescription className="text-[#8b93a7]">
            {t("settings.usb_printer_dialog_desc")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {loading ? (
            <p className="text-sm text-[#8b93a7]">{t("common.loading")}</p>
          ) : loadError ? (
            <p className="text-sm text-red-400/90">
              {loadError === "no-desktop"
                ? t("settings.usb_printer_desktop_only")
                : `${t("settings.usb_printer_load_failed")}: ${loadError}`}
            </p>
          ) : list.length === 0 ? (
            <p className="text-sm text-[#8b93a7]">{t("settings.usb_printer_empty")}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-[#8b93a7]">{t("settings.usb_printer_windows_queue")}</Label>
                <Select
                  value={deviceName}
                  onValueChange={(dn) => {
                    setDeviceName(dn);
                    const p = list.find((x) => x.deviceName === dn);
                    if (p) setFriendlyName(p.displayName);
                  }}
                >
                  <SelectTrigger className="bg-[#131A2E] border-[#1e2a45] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#131A2E] border-[#1e2a45] max-h-64">
                    {list.map((p) => (
                      <SelectItem key={p.deviceName} value={p.deviceName}>
                        {p.displayName}
                        {p.isDefault ? ` (${t("settings.usb_printer_default_badge")})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#8b93a7]">{t("settings.printer_name")}</Label>
                <Input
                  value={friendlyName}
                  onChange={(e) => setFriendlyName(e.target.value)}
                  placeholder={deviceName}
                  className="bg-[#131A2E] border-[#1e2a45] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8b93a7]">{t("settings.assign_role")}</Label>
                <Select value={role} onValueChange={(v) => setRole(v as PrinterRole)}>
                  <SelectTrigger className="bg-[#131A2E] border-[#1e2a45] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#131A2E] border-[#1e2a45]">
                    <SelectItem value="receipt">{t("settings.receipt_printer")}</SelectItem>
                    <SelectItem value="kitchen">{t("settings.kitchen_printer")}</SelectItem>
                    <SelectItem value="bar">{t("settings.bar_printer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isDuplicate ? (
                <p className="text-xs text-amber-400/90">{t("settings.usb_printer_already_added")}</p>
              ) : null}
              <Button
                className="w-full"
                onClick={() => void handleSubmit()}
                disabled={saving || !deviceName.trim() || isDuplicate}
              >
                {saving ? t("common.loading") : t("settings.add_printer")}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function normalizeNetworkPrinterAddress(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  const ipv4Only = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Only.test(s)) return `${s}:9100`;
  return s;
}

function AddPrinterDialog({
  open,
  onOpenChange,
  licenseKey,
  addPrinter,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  addPrinter: AddPrinterFn;
  t: Translate;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<PrinterRole>("receipt");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !address.trim()) {
      toast.error(t("settings.printer_name_address_required"));
      return;
    }
    setSaving(true);
    try {
      await addPrinter({
        licenseKey,
        name: name.trim(),
        type: "network",
        address: normalizeNetworkPrinterAddress(address),
        role,
      });
      toast.success(`${t("settings.printer_added")}. ${t("settings.printer_test_required")}`);
      setName("");
      setAddress("");
      setRole("receipt");
      onOpenChange(false);
    } catch (err) {
      const msg = errorMessageFromUnknown(err, t("settings.save_failed"));
      if (isMissingSupabaseTableError(msg, "pos_printers")) tableMissingToast(t);
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D1326] border-[#1e2a45] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="size-5 text-brand" />
            {t("settings.add_ip_printer")}
          </DialogTitle>
          <DialogDescription className="text-[#8b93a7]">
            {t("settings.ip_address")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">{t("settings.printer_name")}</Label>
            <Input
              placeholder="Kitchen Star TSP143"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#131A2E] border-[#1e2a45] text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">{t("settings.ip_address")}</Label>
            <Input
              placeholder="192.168.1.100:9100"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="bg-[#131A2E] border-[#1e2a45] text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">{t("settings.assign_role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as PrinterRole)}>
              <SelectTrigger className="bg-[#131A2E] border-[#1e2a45] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#131A2E] border-[#1e2a45]">
                <SelectItem value="receipt">{t("settings.receipt_printer")}</SelectItem>
                <SelectItem value="kitchen">{t("settings.kitchen_printer")}</SelectItem>
                <SelectItem value="bar">{t("settings.bar_printer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            onClick={() => void handleSubmit()}
            disabled={saving || !name.trim() || !address.trim()}
          >
            {saving ? t("common.loading") : t("settings.add_printer")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** OS print queue used for silent print and as the calibration key (same rule as Test print). */
function printerDeviceName(printer: PosPrinter): string {
  return printer.address?.trim() || printer.name?.trim() || "";
}

function formatMm(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function CalibrationSummary({
  deviceName,
  tick,
  t,
}: {
  deviceName: string;
  tick: number;
  t: Translate;
}) {
  const cal = useMemo(() => getPrinterCalibration(deviceName), [deviceName, tick]);
  if (!cal) return null;
  return (
    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand">
      <Ruler className="size-3" />
      {t("settings.calibration_summary", {
        paper: cal.paperWidthMm,
        start: formatMm(cal.startMm),
        end: formatMm(cal.endMm),
      })}
    </p>
  );
}

function parseMm(raw: string): number {
  return Number.parseFloat(raw.replace(",", ".").trim());
}

function CalibratePrinterDialog({
  printer,
  onOpenChange,
  onSaved,
  t,
}: {
  printer: PosPrinter | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  t: Translate;
}) {
  const deviceName = printer ? printerDeviceName(printer) : "";
  const [paper, setPaper] = useState("80");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState<"print" | "preview" | null>(null);

  useEffect(() => {
    if (!printer) return;
    const cal = getPrinterCalibration(printerDeviceName(printer)) ?? defaultPrinterCalibration(80);
    setPaper(String(cal.paperWidthMm));
    setStart(formatMm(cal.startMm));
    setEnd(formatMm(cal.endMm));
  }, [printer]);

  const paperMm = parseMm(paper);
  const paperValid = Number.isFinite(paperMm) && paperMm >= PAPER_MIN_MM && paperMm <= PAPER_MAX_MM;

  const choosePaper = (mm: number) => {
    const def = defaultPrinterCalibration(mm);
    setPaper(String(def.paperWidthMm));
    setStart(formatMm(def.startMm));
    setEnd(formatMm(def.endMm));
  };

  const rulerCopy = () => ({
    title: t("settings.calibration_page_title", { paper: Math.round(paperMm), name: printer?.name ?? "" }),
    hint: t("settings.calibration_page_hint"),
  });

  const handlePrintRuler = async () => {
    if (!paperValid) {
      toast.error(t("settings.calibration_invalid"));
      return;
    }
    setBusy("print");
    try {
      const outcome = await printCalibrationPage({ deviceName, paperWidthMm: paperMm, ...rulerCopy() });
      if (outcome.ok) toast.success(t("settings.calibration_page_sent"));
      else toast.error(printErrorText(outcome.error, t));
    } finally {
      setBusy(null);
    }
  };

  const handlePreviewRuler = async () => {
    if (!paperValid) {
      toast.error(t("settings.calibration_invalid"));
      return;
    }
    setBusy("preview");
    try {
      const outcome = await previewCalibrationPdf({ paperWidthMm: paperMm, ...rulerCopy() });
      if (!outcome.ok) toast.error(t("templates.pdf_failed"), { description: outcome.error });
    } finally {
      setBusy(null);
    }
  };

  const handleSave = () => {
    if (!printer) return;
    const cal = normalizePrinterCalibration({
      paperWidthMm: paperMm,
      startMm: parseMm(start),
      endMm: parseMm(end),
    });
    if (!cal) {
      toast.error(t("settings.calibration_invalid"));
      return;
    }
    savePrinterCalibration(deviceName, cal);
    onSaved();
    toast.success(t("settings.calibration_saved"));
    onOpenChange(false);
  };

  const handleReset = () => {
    if (!printer) return;
    savePrinterCalibration(deviceName, null);
    onSaved();
    toast.success(t("settings.calibration_reset_done"));
    onOpenChange(false);
  };

  const isPreset = paper === "58" || paper === "80";

  return (
    <Dialog open={printer !== null} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D1326] border-[#1e2a45] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="size-5 text-brand" />
            {t("settings.calibrate_printer")}
          </DialogTitle>
          <DialogDescription className="text-[#8b93a7]">
            {printer?.name} · {t("settings.calibration_lead")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">{t("settings.calibration_step_paper")}</Label>
            <div className="flex gap-2">
              {[58, 80].map((mm) => (
                <button
                  key={mm}
                  type="button"
                  onClick={() => choosePaper(mm)}
                  className={cn(
                    "h-9 flex-1 rounded-xl border text-sm font-semibold transition",
                    paper === String(mm)
                      ? "border-brand bg-brand/12 text-brand"
                      : "border-[#1e2a45] bg-[#131A2E] text-[#8b93a7] hover:text-white",
                  )}
                >
                  {mm} mm
                </button>
              ))}
              <Input
                inputMode="decimal"
                value={isPreset ? "" : paper}
                placeholder={t("templates.design.custom")}
                onChange={(e) => setPaper(e.target.value)}
                onBlur={() => {
                  const mm = parseMm(paper);
                  if (Number.isFinite(mm) && !isPreset) choosePaper(mm);
                }}
                className="h-9 w-24 bg-[#131A2E] border-[#1e2a45] text-center text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[#8b93a7]">{t("settings.calibration_step_ruler")}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => void handlePrintRuler()}
                disabled={busy !== null}
                className="h-9 flex-1"
              >
                <Printer className="size-4" />
                {busy === "print" ? "…" : t("settings.calibration_print_ruler")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handlePreviewRuler()}
                disabled={busy !== null}
                className="h-9 flex-1 border border-[#1e2a45] text-[#8b93a7] hover:text-white"
              >
                {busy === "preview" ? "…" : t("settings.calibration_preview_ruler")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[#8b93a7]">{t("settings.calibration_step_read")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[11px] text-[#8b93a7]">{t("settings.calibration_start")}</span>
                <Input
                  inputMode="decimal"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="h-9 bg-[#131A2E] border-[#1e2a45] text-white"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-[#8b93a7]">{t("settings.calibration_end")}</span>
                <Input
                  inputMode="decimal"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="h-9 bg-[#131A2E] border-[#1e2a45] text-white"
                />
              </div>
            </div>
            <p className="text-[11px] leading-snug text-[#8b93a7]">{t("settings.calibration_read_hint")}</p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              className="h-10 border border-[#1e2a45] text-[#8b93a7] hover:text-white"
            >
              {t("settings.calibration_reset")}
            </Button>
            <Button type="button" className="h-10 flex-1" onClick={handleSave}>
              {t("settings.save_changes")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditPrinterDialog({
  printer,
  onOpenChange,
  licenseKey,
  updatePrinter,
  t,
}: {
  printer: PosPrinter | null;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  updatePrinter: (args: {
    licenseKey: string;
    printerId: string;
    name?: string;
    address?: string;
    role?: PrinterRole;
  }) => Promise<unknown>;
  t: Translate;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<PrinterRole>("receipt");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!printer) return;
    setName(printer.name);
    setAddress(printer.address);
    setRole(printer.role);
  }, [printer]);

  const handleSubmit = async () => {
    if (!printer) return;
    if (!name.trim()) {
      toast.error(t("settings.printer_name_address_required"));
      return;
    }
    setSaving(true);
    try {
      await updatePrinter({
        licenseKey,
        printerId: printer._id,
        name: name.trim(),
        address:
          printer.type === "network"
            ? normalizeNetworkPrinterAddress(address)
            : address.trim(),
        role,
      });
      toast.success(t("settings.printer_updated"));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("settings.save_failed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={printer !== null} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D1326] border-[#1e2a45] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-brand" />
            {t("settings.edit_printer")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">{t("settings.printer_name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#131A2E] border-[#1e2a45] text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">
              {printer?.type === "network"
                ? t("settings.ip_address")
                : t("settings.usb_printer_windows_queue")}
            </Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="bg-[#131A2E] border-[#1e2a45] text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#8b93a7]">{t("settings.assign_role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as PrinterRole)}>
              <SelectTrigger className="bg-[#131A2E] border-[#1e2a45] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#131A2E] border-[#1e2a45]">
                <SelectItem value="receipt">{t("settings.receipt_printer")}</SelectItem>
                <SelectItem value="kitchen">{t("settings.kitchen_printer")}</SelectItem>
                <SelectItem value="bar">{t("settings.bar_printer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={() => void handleSubmit()} disabled={saving || !name.trim()}>
            {saving ? t("common.loading") : t("settings.save_changes")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
