import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import {
  printHtmlDocument,
  getDesktopSystemPrintersInvoker,
  type DesktopSystemPrinterInfo,
} from "@/lib/print-html.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  Settings,
  Printer,
  Bluetooth,
  Wifi,
  Usb,
  Trash2,
  Plus,
  TestTube2,
  Building2,
  CreditCard,
  MapPin,
  Phone,
  Coins,
  ShieldCheck,
  Receipt,
  Sun,
  Moon,
  Globe,
  CircleDollarSign,
  ImageIcon,
  Pencil,
} from "lucide-react";
import TemplateManager from "./template-manager.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Slider } from "@/components/ui/slider.tsx";
import {
  getPinLoginBranding,
  savePinLoginBranding,
  DEFAULT_PIN_LOGIN_BRANDING,
  type PinLoginBranding,
  type PinLoginPlacement,
} from "@/lib/local-db.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import {
  errorMessageFromUnknown,
  isMissingSupabaseTableError,
} from "@/lib/supabase-pos/db-errors.ts";
import ensurePosPrintersSql from "../../../../supabase/ensure_pos_printers.sql?raw";
import {
  normalizePlan,
  planLabel,
  planTerminalFloor,
} from "../_lib/plan-features.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

const DEFAULT_PIN_LOGO_PREVIEW = VYNTEX_APP_LOGO_SRC;

/** Days until license end + date; null if no valid expiry. */
function licenseExpirySubline(
  expiryIso: string | undefined,
  licenseStatus: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): { text: string; lineClass: string } | null {
  if (!expiryIso) return null;
  const end = new Date(expiryIso);
  if (Number.isNaN(end.getTime())) return null;
  const dateStr = end.toLocaleDateString();
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);

  if (licenseStatus === "suspended") {
    return {
      text: t("settings.license_suspended_period", { date: dateStr }),
      lineClass: "text-amber-400/90",
    };
  }

  if (licenseStatus === "expired" || days < 0) {
    return {
      text: t("settings.license_expired_on", { date: dateStr }),
      lineClass: "text-red-400/90",
    };
  }
  if (days === 0) {
    return {
      text: t("settings.license_expires_today", { date: dateStr }),
      lineClass: "text-amber-400/90",
    };
  }
  if (days === 1) {
    return {
      text: t("settings.license_one_day_left", { date: dateStr }),
      lineClass: "text-emerald-400/85",
    };
  }
  const warn = days <= 14;
  return {
    text: t("settings.license_days_remaining", { count: days, date: dateStr }),
    lineClass: warn ? "text-amber-400/90" : "text-[#8b93a7]",
  };
}

async function resizeImageFileToJpegDataUrl(file: File): Promise<string> {
  const maxBytes = 2 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("too_large");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("load"));
    el.src = dataUrl;
  });

  const maxDim = 512;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.88);
}

function PinLoginBrandingSection({ licenseKey }: { licenseKey: string }) {
  const { t } = usePosLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const [branding, setBranding] = useState<PinLoginBranding>(DEFAULT_PIN_LOGIN_BRANDING);
  const [busy, setBusy] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offsetSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getPinLoginBranding(licenseKey).then(setBranding);
  }, [licenseKey]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (offsetSaveTimerRef.current)
        window.clearTimeout(offsetSaveTimerRef.current);
    },
    [],
  );

  const debouncePersistBranding = useCallback(
    (next: PinLoginBranding) => {
      if (offsetSaveTimerRef.current)
        window.clearTimeout(offsetSaveTimerRef.current);
      offsetSaveTimerRef.current = window.setTimeout(() => {
        offsetSaveTimerRef.current = null;
        void savePinLoginBranding(licenseKey, next).catch(() => {});
      }, 400);
    },
    [licenseKey],
  );

  const saveWithToast = async (next: PinLoginBranding) => {
    setBusy(true);
    try {
      await savePinLoginBranding(licenseKey, next);
      setBranding(next);
      toast.success(t("settings.pin_logo_saved"));
    } catch {
      toast.error(t("settings.save_failed"));
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      toast.error(t("settings.pin_logo_invalid"));
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeImageFileToJpegDataUrl(file);
      const current = await getPinLoginBranding(licenseKey);
      await saveWithToast({ ...current, logoDataUrl: dataUrl });
    } catch (err) {
      if (err instanceof Error && err.message === "too_large") {
        toast.error(t("settings.pin_logo_invalid"));
      } else {
        toast.error(t("settings.pin_logo_read_error"));
      }
    } finally {
      setBusy(false);
    }
  };

  const previewSrc = branding.logoDataUrl ?? DEFAULT_PIN_LOGO_PREVIEW;

  return (
    <section className="rounded-xl border border-[#1e2a45] bg-[#0D1326] p-5 space-y-5">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <ImageIcon className="size-5 text-[#0066FF]" />
        {t("settings.pin_screen")}
      </h2>
      <p className="text-sm text-[#8b93a7]">{t("settings.pin_screen_desc")}</p>

      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-[#131A2E]/80 border border-[#1e2a45] min-h-[11rem] w-full sm:w-[14rem] shrink-0">
          <img
            src={previewSrc}
            alt=""
            style={{
              height: Math.min(branding.logoHeightPx, 200),
              width: "auto",
              maxWidth: "min(100%, 280px)",
            }}
            className="object-contain"
          />
          <span className="text-xs text-[#5a6580] text-center px-1">
            {t("settings.pin_logo_preview")}
          </span>
        </div>

        <div className="flex-1 space-y-4 w-full min-w-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onPickFile}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              className="border-[#1e2a45] bg-[#131A2E] text-white hover:bg-[#1e2a45]"
              onClick={() => fileRef.current?.click()}
            >
              {t("settings.pin_upload_logo")}
            </Button>
            {branding.logoDataUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={async () => {
                  const current = await getPinLoginBranding(licenseKey);
                  await saveWithToast({ ...current, logoDataUrl: null });
                }}
              >
                {t("settings.pin_remove_logo")}
              </Button>
            )}
          </div>

          <SettingRow
            label={t("settings.pin_logo_size")}
            description={t("settings.pin_logo_size_hint")}
          >
            <div className="flex items-center gap-3 w-full max-w-xs">
              <Slider
                value={[branding.logoHeightPx]}
                min={40}
                max={520}
                step={4}
                disabled={busy}
                onValueChange={([v]) => {
                  setBranding((prev) => {
                    const next = { ...prev, logoHeightPx: v };
                    if (saveTimerRef.current)
                      window.clearTimeout(saveTimerRef.current);
                    saveTimerRef.current = window.setTimeout(() => {
                      saveTimerRef.current = null;
                      void savePinLoginBranding(licenseKey, next).catch(
                        () => {},
                      );
                    }, 450);
                    return next;
                  });
                }}
                className="flex-1"
              />
              <span className="text-xs text-[#8b93a7] w-10 tabular-nums">
                {branding.logoHeightPx}px
              </span>
            </div>
          </SettingRow>

          <SettingRow
            label={t("settings.pin_placement")}
            description={t("settings.pin_placement_hint")}
          >
            <Select
              value={branding.placement}
              disabled={busy}
              onValueChange={async (val) => {
                const current = await getPinLoginBranding(licenseKey);
                const placement = val as PinLoginPlacement;
                await saveWithToast({
                  ...current,
                  placement,
                  ...(placement === "custom"
                    ? {
                        logoOffsetXPercent:
                          current.logoOffsetXPercent ??
                          DEFAULT_PIN_LOGIN_BRANDING.logoOffsetXPercent,
                        logoOffsetYPercent:
                          current.logoOffsetYPercent ??
                          DEFAULT_PIN_LOGIN_BRANDING.logoOffsetYPercent,
                        pinBlockOffsetXPercent:
                          current.pinBlockOffsetXPercent ??
                          DEFAULT_PIN_LOGIN_BRANDING.pinBlockOffsetXPercent,
                        pinBlockOffsetYPercent:
                          current.pinBlockOffsetYPercent ??
                          DEFAULT_PIN_LOGIN_BRANDING.pinBlockOffsetYPercent,
                      }
                    : {}),
                });
              }}
            >
              <SelectTrigger className="w-full max-w-xs bg-[#131A2E] border-[#1e2a45] text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-center">
                  {t("settings.pin_place_top_center")}
                </SelectItem>
                <SelectItem value="top-left">
                  {t("settings.pin_place_top_left")}
                </SelectItem>
                <SelectItem value="top-right">
                  {t("settings.pin_place_top_right")}
                </SelectItem>
                <SelectItem value="above-pin">
                  {t("settings.pin_place_above_pin")}
                </SelectItem>
                <SelectItem value="center">
                  {t("settings.pin_place_center")}
                </SelectItem>
                <SelectItem value="bottom-center">
                  {t("settings.pin_place_bottom_center")}
                </SelectItem>
                <SelectItem value="custom">
                  {t("settings.pin_place_custom")}
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          {branding.placement === "custom" && (
            <div className="rounded-lg border border-[#1e2a45]/60 bg-[#131A2E]/35 p-4 space-y-4">
              <p className="text-xs text-[#8b93a7] leading-relaxed">
                {t("settings.pin_custom_hint")}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#8b93a7]">
                    {t("settings.pin_pos_horizontal")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[branding.logoOffsetXPercent]}
                      min={0}
                      max={100}
                      step={1}
                      disabled={busy}
                      onValueChange={([v]) => {
                        setBranding((prev) => {
                          const next = { ...prev, logoOffsetXPercent: v };
                          debouncePersistBranding(next);
                          return next;
                        });
                      }}
                      className="flex-1"
                    />
                    <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-[#8b93a7]">
                      {branding.logoOffsetXPercent}%
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#8b93a7]">
                    {t("settings.pin_pos_vertical")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[branding.logoOffsetYPercent]}
                      min={0}
                      max={100}
                      step={1}
                      disabled={busy}
                      onValueChange={([v]) => {
                        setBranding((prev) => {
                          const next = { ...prev, logoOffsetYPercent: v };
                          debouncePersistBranding(next);
                          return next;
                        });
                      }}
                      className="flex-1"
                    />
                    <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-[#8b93a7]">
                      {branding.logoOffsetYPercent}%
                    </span>
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#5a6580]">
                    {t("settings.pin_block_section_label")}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#8b93a7]">
                    {t("settings.pin_block_pos_horizontal")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[branding.pinBlockOffsetXPercent]}
                      min={0}
                      max={100}
                      step={1}
                      disabled={busy}
                      onValueChange={([v]) => {
                        setBranding((prev) => {
                          const next = { ...prev, pinBlockOffsetXPercent: v };
                          debouncePersistBranding(next);
                          return next;
                        });
                      }}
                      className="flex-1"
                    />
                    <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-[#8b93a7]">
                      {branding.pinBlockOffsetXPercent}%
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#8b93a7]">
                    {t("settings.pin_block_pos_vertical")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[branding.pinBlockOffsetYPercent]}
                      min={0}
                      max={100}
                      step={1}
                      disabled={busy}
                      onValueChange={([v]) => {
                        setBranding((prev) => {
                          const next = { ...prev, pinBlockOffsetYPercent: v };
                          debouncePersistBranding(next);
                          return next;
                        });
                      }}
                      className="flex-1"
                    />
                    <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-[#8b93a7]">
                      {branding.pinBlockOffsetYPercent}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

type PosSettingsProps = {
  licenseKey: string;
  /** License tier from activation (Supabase `restaurants.plan`). */
  plan: string;
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
};

const TYPE_ICONS = {
  bluetooth: Bluetooth,
  network: Wifi,
  usb: Usb,
} as const;

const TYPE_LABELS = {
  bluetooth: "Bluetooth",
  network: "Network (IP)",
  usb: "USB",
} as const;

const ROLE_COLORS = {
  receipt: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  kitchen: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  bar: "bg-violet-500/15 text-violet-400 border-violet-500/30",
} as const;

const CURRENCY_OPTIONS = [
  { value: "Lek", label: "Lek (Albanian Lek)" },
  { value: "€", label: "€ (Euro)" },
  { value: "$", label: "$ (US Dollar)" },
  { value: "£", label: "£ (British Pound)" },
  { value: "CHF", label: "CHF (Swiss Franc)" },
  { value: "din", label: "din (Serbian Dinar)" },
];

export default function PosSettings({
  licenseKey,
  plan,
  theme,
  onThemeChange,
}: PosSettingsProps) {
  const { t, formatPrice } = usePosLocale();
  const printersQuery = useQuery('pos.settings.getPrinters', { licenseKey });
  const companyQuery = useQuery('pos.settings.getCompanyDetails', { licenseKey });
  const addPrinter = useMutation('pos.settings.addPrinter');
  const updatePrinter = useMutation('pos.settings.updatePrinter');
  const deletePrinter = useMutation('pos.settings.deletePrinter');
  const updateLocale = useMutation('pos.settings.updateLocaleSettings');
  const updateCompanyProfile = useMutation('pos.settings.updateCompanyProfile');

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [systemPrinterDialogOpen, setSystemPrinterDialogOpen] =
    useState(false);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "templates">("general");
  const [savingLocale, setSavingLocale] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftAddress, setDraftAddress] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  const printers = Array.isArray(printersQuery) ? printersQuery : [];
  const invokeSystemPrinters = useMemo(
    () => getDesktopSystemPrintersInvoker(),
    [],
  );
  /** Web Bluetooth is not exposed in Electron; desktop BT printers use Windows pairing + USB/System. */
  const webBluetoothSupported = useMemo(
    () => typeof navigator !== "undefined" && "bluetooth" in navigator,
    [],
  );
  const company =
    companyQuery &&
    typeof companyQuery === "object" &&
    !Array.isArray(companyQuery) &&
    "name" in companyQuery
      ? companyQuery
      : {
          name: "Restaurant POS",
          address: "",
          phone: "",
          currency: "Lek",
          plan: "professional",
          licenseStatus: "active",
          licenseExpiry: undefined as string | undefined,
          language: "sq",
          currencySymbol: "Lek",
          currencyPosition: "suffix",
          currencyDecimals: 2,
        };

  // ── Locale save helpers ────────────────────────────────

  const handleLocaleChange = async (
    field: "language" | "currencySymbol" | "currencyPosition" | "currencyDecimals",
    value: string | number,
  ) => {
    setSavingLocale(true);
    try {
      await updateLocale({ licenseKey, [field]: value });
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("settings.save_failed")));
    } finally {
      setSavingLocale(false);
    }
  };

  const planTierDisplay = (p: string) => {
    const tier = normalizePlan(p);
    const key = `settings.plan_tier_${tier}`;
    const translated = t(key);
    return translated !== key ? translated : planLabel(p);
  };

  const licenseStatusDisplay = (status: string) => {
    if (status === "active") return t("settings.license_status_active");
    if (status === "expired") return t("settings.license_status_expired");
    if (status === "suspended") return t("settings.license_status_suspended");
    return status;
  };

  const licenseExpiryLine = useMemo(
    () =>
      licenseExpirySubline(
        "licenseExpiry" in company ? company.licenseExpiry : undefined,
        String(company.licenseStatus ?? ""),
        t,
      ),
    [company, t],
  );

  const startEditCompany = () => {
    setDraftName(company.name);
    setDraftAddress(company.address ?? "");
    setDraftPhone(company.phone ?? "");
    setEditingCompany(true);
  };

  const saveCompany = async () => {
    const name = draftName.trim();
    if (!name) {
      toast.error(t("settings.company_name_required"));
      return;
    }
    setSavingCompany(true);
    try {
      await updateCompanyProfile({
        licenseKey,
        name,
        address: draftAddress,
        phone: draftPhone,
      });
      toast.success(t("settings.saved"));
      setEditingCompany(false);
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("settings.save_failed")));
    } finally {
      setSavingCompany(false);
    }
  };

  // ── Bluetooth scanning ──────────────────────────────────

  const handleBluetoothScan = useCallback(async () => {
    if (!("bluetooth" in navigator)) {
      toast.error(t("msg.bluetooth_unavailable"));
      return;
    }

    setScanning(true);
    try {
      const bt = (navigator as Navigator & { bluetooth?: { requestDevice: (opts: unknown) => Promise<{ name?: string; id: string }> } }).bluetooth;
      if (!bt) {
        toast.error(t("msg.bluetooth_unavailable"));
        return;
      }
      const device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["battery_service"],
      });

      const label =
        (device.name ?? "").trim() || `BT-${device.id.slice(0, 8)}`;
      await addPrinter({
        licenseKey,
        name: label,
        type: "bluetooth",
        address: device.id,
        role: "receipt",
      });
      toast.success(`${t("settings.printer_added")}: ${label}`);
    } catch (err) {
      if (err instanceof Error && err.name === "NotFoundError") return;
      if (err instanceof Error && err.name === "SecurityError") {
        toast.error(t("msg.bluetooth_permission_denied"));
        return;
      }
      toast.error(t("msg.bluetooth_unavailable"));
    } finally {
      setScanning(false);
    }
  }, [licenseKey, addPrinter, t]);

  // ── Test print ──────────────────────────────────────────

  const handleTestPrint = useCallback((printer: Doc<"printers">) => {
    const html = `
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
    if (!printHtmlDocument(html)) {
      toast.error(t("msg.popup_blocked"));
      return;
    }
    toast.success("Test print sent");
  }, [t]);

  // ── Delete ──────────────────────────────────────────────

  const handleDelete = async (printerId: Doc<"printers">["_id"]) => {
    try {
      await deletePrinter({ licenseKey, printerId });
      toast.success(t("settings.printer_removed"));
    } catch {
      toast.error(t("settings.save_failed"));
    }
  };

  // ── Role update ─────────────────────────────────────────

  const handleRoleChange = async (
    printerId: Doc<"printers">["_id"],
    role: "receipt" | "kitchen" | "bar",
  ) => {
    try {
      await updatePrinter({ licenseKey, printerId, role });
      toast.success(t("settings.printer_role_updated"));
    } catch {
      toast.error(t("settings.save_failed"));
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="size-6" />
          {t("settings.title")}
        </h1>
        <p className="text-[#8b93a7] text-sm mt-1">
          {t("settings.description")}
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#131A2E] border border-[#1e2a45] w-fit">
        <button
          onClick={() => setActiveTab("general")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
            activeTab === "general"
              ? "bg-[#0066FF] text-white"
              : "text-[#8b93a7] hover:text-white hover:bg-[#1e2a45]",
          )}
        >
          <Settings className="size-4" />
          {t("settings.general")}
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
            activeTab === "templates"
              ? "bg-[#0066FF] text-white"
              : "text-[#8b93a7] hover:text-white hover:bg-[#1e2a45]",
          )}
        >
          <Receipt className="size-4" />
          {t("settings.templates")}
        </button>
      </div>

      {/* ── Tab content ── */}
      {activeTab === "templates" ? (
        <TemplateManager licenseKey={licenseKey} />
      ) : (
        <>
          {/* ── Company Details ── */}
          {company && (
            <section className="rounded-xl border border-[#1e2a45] bg-[#0D1326] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Building2 className="size-5 text-[#0066FF]" />
                  {t("settings.company_details")}
                </h2>
                {editingCompany ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[#2a3a5a] text-[#8b93a7] hover:text-white"
                      onClick={() => setEditingCompany(false)}
                      disabled={savingCompany}
                    >
                      {t("settings.company_cancel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#0066FF] hover:bg-[#0052CC]"
                      onClick={() => void saveCompany()}
                      disabled={savingCompany}
                    >
                      {savingCompany ? "…" : t("settings.company_save")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-[#2a3a5a] text-[#8b93a7] hover:text-white shrink-0"
                    onClick={startEditCompany}
                  >
                    <Pencil className="size-3.5 mr-1.5" />
                    {t("settings.company_edit")}
                  </Button>
                )}
              </div>

              {editingCompany ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
                      {t("settings.business_name")}
                    </Label>
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="bg-[#0A0F1E] border-[#1e2a45] text-white h-11"
                      autoComplete="organization"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
                      {t("settings.address")}
                    </Label>
                    <Input
                      value={draftAddress}
                      onChange={(e) => setDraftAddress(e.target.value)}
                      className="bg-[#0A0F1E] border-[#1e2a45] text-white h-11"
                      autoComplete="street-address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
                      {t("settings.phone")}
                    </Label>
                    <Input
                      value={draftPhone}
                      onChange={(e) => setDraftPhone(e.target.value)}
                      className="bg-[#0A0F1E] border-[#1e2a45] text-white h-11"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {editingCompany ? null : (
                  <>
                    <DetailCard icon={Building2} label={t("settings.business_name")} value={company.name} />
                    <DetailCard icon={MapPin} label={t("settings.address")} value={company.address || t("settings.not_set")} />
                    <DetailCard icon={Phone} label={t("settings.phone")} value={company.phone || t("settings.not_set")} />
                  </>
                )}
                <DetailCard icon={Coins} label={t("settings.currency")} value={company.currency} />
                <DetailCard
                  icon={CreditCard}
                  label={t("settings.plan")}
                  value={planTierDisplay(company.plan)}
                  hint={t("settings.plan_cannot_change_here")}
                />
                <DetailCard
                  icon={ShieldCheck}
                  label={t("settings.license")}
                  value={licenseStatusDisplay(String(company.licenseStatus ?? ""))}
                  valueColor={
                    company.licenseStatus === "active" ? "text-emerald-400" : "text-red-400"
                  }
                  subline={licenseExpiryLine?.text}
                  sublineClassName={licenseExpiryLine?.lineClass}
                />
              </div>
            </section>
          )}

          <PinLoginBrandingSection licenseKey={licenseKey} />

          {/* ── Language & Currency ── */}
          {company && (
            <section className="rounded-xl border border-[#1e2a45] bg-[#0D1326] p-5 space-y-5">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Globe className="size-5 text-[#0066FF]" />
                {t("settings.language_currency")}
              </h2>

              {/* Language */}
              <SettingRow
                label={t("settings.language")}
                description={t("settings.language_desc")}
              >
                <div className="flex rounded-lg overflow-hidden border border-[#1e2a45]">
                  <button
                    type="button"
                    onClick={() => handleLocaleChange("language", "en")}
                    disabled={savingLocale}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors cursor-pointer",
                      company.language === "en"
                        ? "bg-[#0066FF] text-white"
                        : "bg-[#131A2E] text-[#5a6580] hover:text-white",
                    )}
                  >
                    <span className="text-sm leading-none" aria-hidden="true">
                      🇺🇸
                    </span>
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLocaleChange("language", "sq")}
                    disabled={savingLocale}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors cursor-pointer",
                      company.language === "sq"
                        ? "bg-[#0066FF] text-white"
                        : "bg-[#131A2E] text-[#5a6580] hover:text-white",
                    )}
                  >
                    <span className="text-sm leading-none" aria-hidden="true">
                      🇦🇱
                    </span>
                    Albanian
                  </button>
                </div>
              </SettingRow>

              {/* Currency Symbol */}
              <SettingRow
                label={t("settings.currency_symbol")}
                description={t("settings.currency_symbol_desc")}
              >
                <Select
                  value={company.currencySymbol}
                  onValueChange={(val) =>
                    handleLocaleChange("currencySymbol", val)
                  }
                  disabled={savingLocale}
                >
                  <SelectTrigger className="w-48 bg-[#131A2E] border-[#1e2a45] text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Currency Position */}
              <SettingRow
                label={t("settings.currency_position")}
                description={t("settings.currency_position_desc")}
              >
                <div className="flex rounded-lg overflow-hidden border border-[#1e2a45]">
                  <button
                    type="button"
                    onClick={() =>
                      handleLocaleChange("currencyPosition", "prefix")
                    }
                    disabled={savingLocale}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors cursor-pointer",
                      company.currencyPosition === "prefix"
                        ? "bg-[#0066FF] text-white"
                        : "bg-[#131A2E] text-[#5a6580] hover:text-white",
                    )}
                  >
                    <CircleDollarSign className="size-3.5" />
                    {t("settings.position_prefix")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleLocaleChange("currencyPosition", "suffix")
                    }
                    disabled={savingLocale}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors cursor-pointer",
                      company.currencyPosition === "suffix"
                        ? "bg-[#0066FF] text-white"
                        : "bg-[#131A2E] text-[#5a6580] hover:text-white",
                    )}
                  >
                    {t("settings.position_suffix")}
                    <CircleDollarSign className="size-3.5" />
                  </button>
                </div>
              </SettingRow>

              {/* Decimals */}
              <SettingRow
                label={t("settings.decimals")}
                description={t("settings.decimals_desc")}
              >
                <Select
                  value={String(company.currencyDecimals)}
                  onValueChange={(val) =>
                    handleLocaleChange("currencyDecimals", Number(val))
                  }
                  disabled={savingLocale}
                >
                  <SelectTrigger className="w-32 bg-[#131A2E] border-[#1e2a45] text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 (100)</SelectItem>
                    <SelectItem value="1">1 (100.0)</SelectItem>
                    <SelectItem value="2">2 (100.00)</SelectItem>
                    <SelectItem value="3">3 (100.000)</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Live preview */}
              <div className="p-3 rounded-lg bg-[#131A2E]/60 border border-[#1e2a45]/50">
                <p className="text-[10px] text-[#5a6580] uppercase tracking-wider mb-1">
                  Preview
                </p>
                <p className="text-lg font-bold text-white">
                  {formatPrice(1234.56)}
                </p>
              </div>
            </section>
          )}

          {/* ── Appearance ── */}
          <section className="rounded-xl border border-[#1e2a45] bg-[#0D1326] p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {theme === "dark" ? (
                <Moon className="size-5 text-[#0066FF]" />
              ) : (
                <Sun className="size-5 text-[#0066FF]" />
              )}
              {t("settings.appearance")}
            </h2>

            <SettingRow
              label={t("settings.theme")}
              description={t("settings.theme_desc")}
            >
              <div className="flex rounded-lg overflow-hidden border border-[#1e2a45]">
                <button
                  type="button"
                  onClick={() => onThemeChange("dark")}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer",
                    theme === "dark"
                      ? "bg-[#0066FF] text-white"
                      : "bg-[#131A2E] text-[#5a6580] hover:text-white",
                  )}
                >
                  <Moon className="size-3.5" />
                  {t("settings.night")}
                </button>
                <button
                  type="button"
                  onClick={() => onThemeChange("light")}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer",
                    theme === "light"
                      ? "bg-[#0066FF] text-white"
                      : "bg-[#131A2E] text-[#5a6580] hover:text-white",
                  )}
                >
                  <Sun className="size-3.5" />
                  {t("settings.light")}
                </button>
              </div>
            </SettingRow>
          </section>

          {/* ── Printers & Peripherals ── */}
          <section className="rounded-xl border border-[#1e2a45] bg-[#0D1326] p-5 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Printer className="size-5 text-[#0066FF]" />
                {t("settings.printers")}
              </h2>

              <div className="flex items-center gap-2 flex-wrap">
                {invokeSystemPrinters ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSystemPrinterDialogOpen(true)}
                    className="bg-[#1e2a45] border-[#2a3a5c] text-white hover:bg-[#2a3a5c]"
                  >
                    <Usb className="size-4 mr-1.5" />
                    {t("settings.add_usb_printer")}
                  </Button>
                ) : null}
                {webBluetoothSupported ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleBluetoothScan}
                    disabled={scanning}
                    className="bg-[#1e2a45] border-[#2a3a5c] text-white hover:bg-[#2a3a5c]"
                  >
                    <Bluetooth className="size-4 mr-1.5" />
                    {scanning ? t("settings.scanning") : t("settings.scan_bluetooth")}
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="size-4 mr-1.5" />
                  {t("settings.add_ip_printer")}
                </Button>
              </div>
            </div>

            <p className="text-xs text-[#5a6580]">
              {t("settings.printers_desc")}
            </p>

            <AddSystemPrinterDialog
              open={systemPrinterDialogOpen}
              onOpenChange={setSystemPrinterDialogOpen}
              licenseKey={licenseKey}
              addPrinter={addPrinter}
              existingDeviceNames={printers.map((p) =>
                (p.address ?? "").trim().toLowerCase(),
              )}
            />

            {printers.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Printer />
                  </EmptyMedia>
                  <EmptyTitle>{t("settings.no_printers")}</EmptyTitle>
                  <EmptyDescription>
                    {t("settings.no_printers_desc")}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                    <Plus className="size-4 mr-1" />
                    {t("settings.add_printer")}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="space-y-3">
                {printers.map((printer) => (
                  <PrinterCard
                    key={printer._id}
                    printer={printer}
                    onRoleChange={handleRoleChange}
                    onTestPrint={handleTestPrint}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Add IP Printer dialog */}
          <AddPrinterDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            licenseKey={licenseKey}
            addPrinter={addPrinter}
          />
        </>
      )}
    </div>
  );
}

// ── Setting Row ─────────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[#131A2E]/60 border border-[#1e2a45]/50 flex-wrap gap-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-[#5a6580] mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

// ── Detail card ───────────────────────────────────────────

function DetailCard({
  icon: Icon,
  label,
  value,
  valueColor,
  subline,
  sublineClassName,
  hint,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  valueColor?: string;
  subline?: string;
  sublineClassName?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-[#131A2E]/60 border border-[#1e2a45]/50">
      <div className="p-2 rounded-lg bg-[#1e2a45]/60 shrink-0">
        <Icon className="size-4 text-[#5a6580]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-[#5a6580] uppercase tracking-wider">{label}</p>
        <p className={cn("text-sm font-medium text-white", valueColor)}>{value}</p>
        {subline ? (
          <p
            className={cn(
              "text-xs mt-1 leading-snug",
              sublineClassName ?? "text-[#8b93a7]",
            )}
          >
            {subline}
          </p>
        ) : null}
        {hint ? (
          <p className="text-[10px] text-[#5a6580] mt-1.5 leading-snug">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

// ── Printer card ──────────────────────────────────────────

function PrinterCard({
  printer,
  onRoleChange,
  onTestPrint,
  onDelete,
}: {
  printer: Doc<"printers">;
  onRoleChange: (id: Doc<"printers">["_id"], role: "receipt" | "kitchen" | "bar") => void;
  onTestPrint: (printer: Doc<"printers">) => void;
  onDelete: (id: Doc<"printers">["_id"]) => void;
}) {
  const { t } = usePosLocale();
  const TypeIcon = TYPE_ICONS[printer.type];
  const roleColor = ROLE_COLORS[printer.role];

  const ROLE_LABELS_MAP = {
    receipt: t("settings.receipt_printer"),
    kitchen: t("settings.kitchen_printer"),
    bar: t("settings.bar_printer"),
  } as const;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-[#131A2E] border border-[#1e2a45] flex-wrap">
      <div className="p-2.5 rounded-xl bg-[#1e2a45] shrink-0">
        <TypeIcon className="size-5 text-[#0066FF]" />
      </div>

      <div className="flex-1 min-w-[140px]">
        <p className="text-sm font-semibold text-white">{printer.name}</p>
        <p className="text-xs text-[#5a6580] mt-0.5">
          {TYPE_LABELS[printer.type]} &middot; {printer.address}
        </p>
      </div>

      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full border", roleColor)}>
        {ROLE_LABELS_MAP[printer.role]}
      </span>

      <Select
        value={printer.role}
        onValueChange={(val) => onRoleChange(printer._id, val as "receipt" | "kitchen" | "bar")}
      >
        <SelectTrigger className="w-36 h-8 text-xs bg-[#0D1326] border-[#1e2a45] text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-[#131A2E] border-[#1e2a45]">
          <SelectItem value="receipt">{t("settings.receipt_printer")}</SelectItem>
          <SelectItem value="kitchen">{t("settings.kitchen_printer")}</SelectItem>
          <SelectItem value="bar">{t("settings.bar_printer")}</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onTestPrint(printer)}
          className="h-8 bg-[#1e2a45] border-[#2a3a5c] text-white hover:bg-[#2a3a5c]"
        >
          <TestTube2 className="size-3.5 mr-1" />
          {t("settings.test_print")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onDelete(printer._id)}
          className="h-8"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Add USB / Windows print queue (desktop only) ─────────

function AddSystemPrinterDialog({
  open,
  onOpenChange,
  licenseKey,
  addPrinter,
  existingDeviceNames,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  addPrinter: (args: {
    licenseKey: string;
    name: string;
    type: "bluetooth" | "network" | "usb";
    address: string;
    role: "receipt" | "kitchen" | "bar";
  }) => Promise<unknown>;
  existingDeviceNames: string[];
}) {
  const { t } = usePosLocale();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<DesktopSystemPrinterInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [friendlyName, setFriendlyName] = useState("");
  const [role, setRole] = useState<"receipt" | "kitchen" | "bar">("receipt");
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

  const handleSelectDevice = (dn: string) => {
    setDeviceName(dn);
    const p = list.find((x) => x.deviceName === dn);
    if (p) setFriendlyName(p.displayName);
  };

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
      toast.success(t("settings.printer_added"));
      onOpenChange(false);
    } catch (err) {
      const msg = errorMessageFromUnknown(err, t("settings.save_failed"));
      if (isMissingSupabaseTableError(msg, "pos_printers")) {
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
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D1326] border-[#1e2a45] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Usb className="size-5 text-[#0066FF]" />
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
                <Label className="text-[#8b93a7]">
                  {t("settings.usb_printer_windows_queue")}
                </Label>
                <Select
                  value={deviceName}
                  onValueChange={handleSelectDevice}
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
                <Label className="text-[#8b93a7]">
                  {t("settings.printer_name")}
                </Label>
                <Input
                  value={friendlyName}
                  onChange={(e) => setFriendlyName(e.target.value)}
                  placeholder={deviceName}
                  className="bg-[#131A2E] border-[#1e2a45] text-white"
                />
                <p className="text-[10px] text-[#5a6580]">
                  {t("settings.usb_printer_label_hint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[#8b93a7]">{t("settings.assign_role")}</Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as "receipt" | "kitchen" | "bar")}
                >
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
                <p className="text-xs text-amber-400/90">
                  {t("settings.usb_printer_already_added")}
                </p>
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

/** If the user enters only an IPv4 address, append the usual raw/JetDirect port. */
function normalizeNetworkPrinterAddress(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  const ipv4Only = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Only.test(s)) return `${s}:9100`;
  return s;
}

// ── Add IP Printer dialog ─────────────────────────────────

function AddPrinterDialog({
  open,
  onOpenChange,
  licenseKey,
  addPrinter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  addPrinter: (args: {
    licenseKey: string;
    name: string;
    type: "bluetooth" | "network" | "usb";
    address: string;
    role: "receipt" | "kitchen" | "bar";
  }) => Promise<unknown>;
}) {
  const { t } = usePosLocale();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<"receipt" | "kitchen" | "bar">("receipt");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !address.trim()) {
      toast.error(t("settings.printer_name_address_required"));
      return;
    }
    const resolvedAddress = normalizeNetworkPrinterAddress(address);
    setSaving(true);
    try {
      await addPrinter({
        licenseKey,
        name: name.trim(),
        type: "network",
        address: resolvedAddress,
        role,
      });
      toast.success(t("settings.printer_added"));
      setName("");
      setAddress("");
      setRole("receipt");
      onOpenChange(false);
    } catch (err) {
      const msg = errorMessageFromUnknown(err, t("settings.save_failed"));
      if (isMissingSupabaseTableError(msg, "pos_printers")) {
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
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D1326] border-[#1e2a45] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="size-5 text-[#0066FF]" />
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
            <Select value={role} onValueChange={(v) => setRole(v as "receipt" | "kitchen" | "bar")}>
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
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !address.trim()}
          >
            {saving ? t("common.loading") : t("settings.add_printer")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
