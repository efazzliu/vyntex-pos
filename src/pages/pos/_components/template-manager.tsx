import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { cn } from "@/lib/utils.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { buildFiscalReceiptHtml } from "@/lib/print-fiscal-receipt.ts";
import {
  buildPreBillHtml,
  resolvePreBillCopy,
  visibilityFromReceiptElements,
} from "@/lib/print-pre-bill.ts";
import {
  COMPLIMENTARY_BADGE,
  COMPLIMENTARY_FOOTER,
  COMPLIMENTARY_MOTTO,
  COMPLIMENTARY_NOTICE,
  COMPLIMENTARY_TITLE,
  buildComplimentarySlipHtml,
  resolveComplimentaryCopy,
  visibilityFromComplimentaryElements,
} from "@/lib/print-complimentary-slip.ts";
import {
  DEBT_VOUCHER_BADGE,
  DEBT_VOUCHER_FOOTER,
  DEBT_VOUCHER_MOTTO,
  DEBT_VOUCHER_NOTICE,
  DEBT_VOUCHER_TITLE,
  buildDebtVoucherHtml,
  resolveDebtVoucherCopy,
  visibilityFromDebtElements,
} from "@/lib/print-debt-voucher.ts";
import {
  PRINT_POWERED_BY,
  hasElectronSilentPrintIpc,
  tryPrintHtmlDocumentAsync,
} from "@/lib/print-html.ts";
import {
  KITCHEN_TICKET_TITLE,
  buildKitchenTicketHtml,
  resolveKitchenTicketCopy,
  visibilityFromKitchenElements,
} from "@/lib/print-kitchen-ticket.ts";
import {
  BAR_TICKET_TITLE,
  buildBarTicketHtml,
  resolveBarTicketCopy,
  visibilityFromBarElements,
} from "@/lib/print-bar-ticket.ts";
import { buildWaiterShiftReportHtml } from "@/lib/print-waiter-shift-report.ts";
import {
  X_REPORT_NOTICE,
  X_REPORT_TITLE,
  buildXReportHtml,
  resolveXReportCopy,
  visibilityFromXElements,
} from "@/lib/print-x-report.ts";
import {
  Z_REPORT_FOOTER,
  Z_REPORT_SUBTITLE,
  Z_REPORT_TITLE,
  buildZReportHtml,
  resolveZReportCopy,
  visibilityFromZElements,
} from "@/lib/print-z-report.ts";
import {
  EXPENSE_VOUCHER_SUBTITLE,
  EXPENSE_VOUCHER_TITLE,
  buildExpenseVoucherHtml,
  resolveExpenseVoucherCopy,
  visibilityFromExpenseElements,
} from "@/lib/print-expense-voucher.ts";
import {
  Receipt,
  FileText,
  ChefHat,
  Wine,
  ClipboardList,
  BarChart3,
  BarChart4,
  Gift,
  Wallet,
  CreditCard,
  Eye,
  ChevronRight,
  Printer,
  Save,
  LayoutTemplate,
  Type,
  Palette,
  Rows3,
  Minus,
  Plus,
  QrCode,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Building2,
  Clock,
  Hash,
  UserCog,
  UserRound,
  UtensilsCrossed,
  List,
  Percent,
  MessageCircleHeart,
  Globe,
  MapPin,
  Quote,
  AlignVerticalJustifyEnd,
  Upload,
  Tags,
  Banknote,
  Users,
  Layers,
  StickyNote,
  Coins,
  Contact,
} from "lucide-react";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { resolvePaperPrinterDeviceName } from "@/lib/pos-printer-routing.ts";

// ── Template type metadata ──────────────────────────────

type TemplateTypeId =
  | "fiscal_receipt"
  | "non_fiscal_receipt"
  | "kitchen_ticket"
  | "bar_ticket"
  | "waiter_shift_report"
  | "x_report"
  | "z_report"
  | "complimentary_slip"
  | "expense_voucher"
  | "debt_voucher";

type TemplateTypeMeta = {
  id: TemplateTypeId;
  category: "sales" | "internal";
  icon: typeof Receipt;
};

const TEMPLATE_TYPES: TemplateTypeMeta[] = [
  { id: "fiscal_receipt", category: "sales", icon: Receipt },
  { id: "non_fiscal_receipt", category: "sales", icon: FileText },
  { id: "complimentary_slip", category: "sales", icon: Gift },
  { id: "debt_voucher", category: "sales", icon: CreditCard },
  { id: "kitchen_ticket", category: "internal", icon: ChefHat },
  { id: "bar_ticket", category: "internal", icon: Wine },
  { id: "waiter_shift_report", category: "internal", icon: ClipboardList },
  { id: "x_report", category: "internal", icon: BarChart3 },
  { id: "z_report", category: "internal", icon: BarChart4 },
  { id: "expense_voucher", category: "internal", icon: Wallet },
];

function templateTypeLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  id: TemplateTypeId,
  field: "name" | "description" | "short" | "chip1" | "chip2"
) {
  return t(`templates.type.${id}.${field}`);
}

type TemplateRecord = {
  templateType: string;
  toggles: {
    logo: boolean;
    headerText: boolean;
    footerText: boolean;
    waiterName: boolean;
    tableNumber: boolean;
    timestamp: boolean;
    unitPrices: boolean;
    taxDetails: boolean;
    orderNumber: boolean;
  };
  labels: { headerText: string; footerText: string };
  styles?: Record<string, Record<string, unknown>>;
  printerId: string | null;
};

type PrinterRecord = {
  _id: string;
  name: string;
  address?: string | null;
  role?: string;
};

const EDITOR_TABS = ["design", "content"] as const;
type EditorTab = (typeof EDITOR_TABS)[number];

type DesignSettings = {
  paperWidth: "58" | "80" | "custom";
  customWidth: string;
  orientation: "portrait" | "landscape";
  font: "default" | "mono" | "sans";
  fontSize: number;
  align: "left" | "center" | "right";
  lineSpacing: "tight" | "normal" | "loose";
  lineHeight: number;
  sectionSpacing: "tight" | "normal" | "loose";
  margin: "tight" | "normal" | "loose";
  dividerStyle: "dashed" | "dotted" | "solid" | "none";
  lineThickness: "thin" | "normal" | "thick";
  showTopBorder: boolean;
  showBottomBorder: boolean;
  qrSize: "small" | "medium" | "large";
  qrEcc: "L" | "M" | "Q" | "H";
};

type ContentSettings = {
  storeName: string;
  venueName: string;
  motto: string;
  subtitle: string;
  legalText: string;
  showQtyPrefix: boolean;
  showUnitPrices: boolean;
  itemsTitle: string;
  colQty: string;
  colItem: string;
  colPrice: string;
  colLineTotal: string;
  dateLabel: string;
  fiscalLabel: string;
  operatorLabel: string;
  waiterLabel: string;
  tableLabel: string;
  timeLabel: string;
  guestsLabel: string;
  discountLabel: string;
  paymentLabel: string;
  subtotalLabel: string;
  taxLabel: string;
  totalLabel: string;
  dateFormat: "short" | "long";
  timeFormat: "24h" | "12h";
  currency: "none" | "eur" | "all";
  currencyPosition: "before" | "after";
};

const DEFAULT_CONTENT: ContentSettings = {
  storeName: "Vyntex POS",
  venueName: "Enterprise Test Venue",
  motto: "GOOD FOOD · GREAT PEOPLE",
  subtitle: "PRELIMINARY BILL",
  legalText: "PRELIMINARY BILL — NOT A FISCAL RECEIPT",
  showQtyPrefix: true,
  showUnitPrices: true,
  itemsTitle: "ITEMS",
  colQty: "QTY",
  colItem: "ITEM",
  colPrice: "PRICE",
  colLineTotal: "TOTAL",
  dateLabel: "Date",
  fiscalLabel: "Fiscal #",
  operatorLabel: "Operator",
  waiterLabel: "Waiter",
  tableLabel: "Table",
  timeLabel: "Time",
  guestsLabel: "Guests",
  discountLabel: "Discount",
  paymentLabel: "Payment",
  subtotalLabel: "Subtotal",
  taxLabel: "TVSH (20%)",
  totalLabel: "TOTAL",
  dateFormat: "short",
  timeFormat: "24h",
  currency: "none",
  currencyPosition: "after",
};

function readText(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function readContent(
  styles: TemplateRecord["styles"],
  toggles?: TemplateRecord["toggles"],
  type?: TemplateTypeId,
): ContentSettings {
  const raw = styles?._design;
  const extra = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const o =
    extra.content && typeof extra.content === "object"
      ? (extra.content as Record<string, unknown>)
      : extra;
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T) =>
    typeof value === "string" && (allowed as readonly string[]).includes(value)
      ? (value as T)
      : fallback;
  return {
    storeName: readText(o.storeName, DEFAULT_CONTENT.storeName),
    venueName: readText(o.venueName, DEFAULT_CONTENT.venueName),
    motto: readText(
      o.motto ?? extra.tagline,
      DEFAULT_CONTENT.motto,
    ),
    subtitle: readText(o.subtitle ?? extra.subtitle, DEFAULT_CONTENT.subtitle),
    legalText: (() => {
      const saved = readText(o.legalText ?? extra.legalText, DEFAULT_CONTENT.legalText);
      if (type === "complimentary_slip") {
        return !saved ||
          /^this is not a fiscal/i.test(saved) ||
          /^preliminary bill/i.test(saved)
          ? COMPLIMENTARY_NOTICE
          : saved;
      }
      if (type === "debt_voucher") {
        return !saved ||
          /^this is not a fiscal/i.test(saved) ||
          /^preliminary bill/i.test(saved) ||
          /^complimentary/i.test(saved)
          ? DEBT_VOUCHER_NOTICE
          : saved;
      }
      return /^this is not a fiscal/i.test(saved)
        ? DEFAULT_CONTENT.legalText
        : saved;
    })(),
    showQtyPrefix: readBool(o.showQtyPrefix, DEFAULT_CONTENT.showQtyPrefix),
    showUnitPrices: readBool(o.showUnitPrices, toggles?.unitPrices ?? DEFAULT_CONTENT.showUnitPrices),
    itemsTitle:
      type === "complimentary_slip"
        ? (() => {
            const saved = typeof o.itemsTitle === "string" ? o.itemsTitle.trim() : "";
            return !saved || saved === "ITEMS" ? "TREAT" : saved;
          })()
        : readText(o.itemsTitle, DEFAULT_CONTENT.itemsTitle),
    colQty: readText(o.colQty, DEFAULT_CONTENT.colQty),
    colItem: readText(o.colItem, DEFAULT_CONTENT.colItem),
    colPrice: readText(o.colPrice, DEFAULT_CONTENT.colPrice),
    colLineTotal: readText(o.colLineTotal, DEFAULT_CONTENT.colLineTotal),
    dateLabel: DEFAULT_CONTENT.dateLabel,
    fiscalLabel: readText(o.fiscalLabel, DEFAULT_CONTENT.fiscalLabel),
    operatorLabel: DEFAULT_CONTENT.operatorLabel,
    waiterLabel: DEFAULT_CONTENT.waiterLabel,
    tableLabel: DEFAULT_CONTENT.tableLabel,
    timeLabel: DEFAULT_CONTENT.timeLabel,
    guestsLabel: DEFAULT_CONTENT.guestsLabel,
    discountLabel: readText(o.discountLabel, DEFAULT_CONTENT.discountLabel),
    paymentLabel: readText(o.paymentLabel, DEFAULT_CONTENT.paymentLabel),
    subtotalLabel: readText(o.subtotalLabel, DEFAULT_CONTENT.subtotalLabel),
    taxLabel: readText(o.taxLabel, DEFAULT_CONTENT.taxLabel),
    totalLabel: readText(o.totalLabel, DEFAULT_CONTENT.totalLabel),
    dateFormat: DEFAULT_CONTENT.dateFormat,
    timeFormat: DEFAULT_CONTENT.timeFormat,
    currency: pick(o.currency, ["none", "eur", "all"] as const, "none"),
    currencyPosition: pick(o.currencyPosition, ["before", "after"] as const, "after"),
  };
}

function formatContentPrice(n: number, content: ContentSettings) {
  const digits = content.currency === "all" ? 0 : 2;
  const num = n.toFixed(digits);
  const sym = content.currency === "eur" ? "€" : content.currency === "all" ? "L" : "";
  if (!sym) return num;
  return content.currencyPosition === "before" ? `${sym}${num}` : `${num} ${sym}`;
}

function formatContentDate(content: ContentSettings, at = new Date()) {
  if (content.dateFormat === "long") {
    return at.toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  return at.toLocaleDateString("en-GB").replace(/\//g, ".");
}

function formatContentTime(content: ContentSettings, at = new Date()) {
  return at.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: content.timeFormat === "12h",
  });
}

function formatContentStamp(content: ContentSettings) {
  const now = new Date();
  const date =
    content.dateFormat === "long"
      ? now.toLocaleDateString(undefined, {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : now.toLocaleDateString();
  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: content.timeFormat === "12h",
  });
  return `${date}  ${time}`;
}

const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 20;

const LINE_HEIGHT_MIN = 1;
const LINE_HEIGHT_MAX = 2;

function readLineHeight(value: unknown, spacing: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, Math.round(value * 10) / 10));
  }
  if (spacing === "tight") return 1;
  if (spacing === "loose") return 1.6;
  return 1.2;
}

function SizeStepper({
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (next: number) => void;
}) {
  const round = (n: number) => Math.round(n * 10) / 10;
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(round(Math.max(min, value - step)))}
        className="grid h-8 w-8 place-items-center text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="flex h-8 min-w-[3.4rem] items-center justify-center gap-0.5 text-[12px] font-semibold tabular-nums text-slate-800">
        {Number.isInteger(value) ? value : value.toFixed(1)}
        {suffix ? (
          <span className="text-[10px] font-medium text-slate-400">{suffix}</span>
        ) : null}
      </span>
      <button
        type="button"
        disabled={value >= max}
        onClick={() => onChange(round(Math.min(max, value + step)))}
        className="grid h-8 w-8 place-items-center text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function readFontSize(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)));
  }
  if (value === "small") return 10;
  if (value === "large") return 14;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(n)));
    }
  }
  return 12;
}

const DEFAULT_DESIGN: DesignSettings = {
  paperWidth: "80",
  customWidth: "80",
  orientation: "portrait",
  font: "default",
  fontSize: 12,
  align: "center",
  lineSpacing: "normal",
  lineHeight: 1.2,
  sectionSpacing: "normal",
  margin: "normal",
  dividerStyle: "dashed",
  lineThickness: "normal",
  showTopBorder: false,
  showBottomBorder: true,
  qrSize: "medium",
  qrEcc: "M",
};

type ReceiptElementId =
  | "logo"
  | "storeInfo"
  | "divider"
  | "timestamp"
  | "fiscalNumber"
  | "orderNumber"
  | "operator"
  | "waiterName"
  | "tableNumber"
  | "customerName"
  | "guestCount"
  | "itemList"
  | "unitPrices"
  | "itemModifiers"
  | "itemNotes"
  | "discount"
  | "subtotal"
  | "taxSummary"
  | "totalDue"
  | "preliminaryNotice"
  | "paymentMethod"
  | "thankYou"
  | "qrCode";

type ReceiptElements = Record<ReceiptElementId, boolean>;

const RECEIPT_ELEMENT_ITEMS: {
  id: ReceiptElementId;
  key: string;
  icon: typeof Receipt;
}[] = [
  { id: "logo", key: "templates.elements.logo", icon: ImageIcon },
  { id: "storeInfo", key: "templates.elements.store_info", icon: Building2 },
  { id: "divider", key: "templates.elements.divider", icon: Minus },
  { id: "timestamp", key: "templates.elements.datetime", icon: Clock },
  { id: "fiscalNumber", key: "templates.elements.fiscal_number", icon: Hash },
  { id: "orderNumber", key: "templates.elements.order_number", icon: Hash },
  { id: "waiterName", key: "templates.elements.waiter_name", icon: UserRound },
  { id: "operator", key: "templates.elements.operator", icon: UserCog },
  { id: "tableNumber", key: "templates.elements.table_number", icon: UtensilsCrossed },
  { id: "customerName", key: "templates.elements.customer", icon: Contact },
  { id: "guestCount", key: "templates.elements.guest_count", icon: Users },
  { id: "itemList", key: "templates.elements.item_list", icon: List },
  { id: "unitPrices", key: "templates.elements.unit_prices", icon: Coins },
  { id: "itemModifiers", key: "templates.elements.item_modifiers", icon: Layers },
  { id: "itemNotes", key: "templates.elements.item_notes", icon: StickyNote },
  { id: "discount", key: "templates.elements.discount", icon: Tags },
  { id: "subtotal", key: "templates.elements.subtotal", icon: Banknote },
  { id: "taxSummary", key: "templates.elements.tax_summary", icon: Percent },
  { id: "totalDue", key: "templates.elements.total_due", icon: Receipt },
  { id: "preliminaryNotice", key: "templates.elements.preliminary_notice", icon: FileText },
  { id: "paymentMethod", key: "templates.elements.payment_method", icon: CreditCard },
  { id: "thankYou", key: "templates.elements.thank_you", icon: MessageCircleHeart },
  { id: "qrCode", key: "templates.elements.qr_code", icon: QrCode },
];

type CustomLabels = {
  headerText: string;
  footerText: string;
  address: string;
  website: string;
  motto: string;
};

const DEFAULT_CUSTOM_LABELS: CustomLabels = {
  headerText: "FISCAL RECEIPT",
  footerText: "Thank you for your visit!",
  address: "",
  website: "",
  motto: "",
};

const CUSTOM_TEXT_ITEMS: {
  id: keyof CustomLabels;
  key: string;
  icon: typeof Receipt;
}[] = [
  { id: "headerText", key: "templates.custom.header", icon: Type },
  { id: "address", key: "templates.custom.address", icon: MapPin },
  { id: "footerText", key: "templates.custom.footer", icon: AlignVerticalJustifyEnd },
  { id: "website", key: "templates.custom.website", icon: Globe },
  { id: "motto", key: "templates.custom.motto", icon: Quote },
];

function readLogoDataUrl(styles: TemplateRecord["styles"]): string | null {
  const extra =
    styles?._design && typeof styles._design === "object"
      ? (styles._design as Record<string, unknown>)
      : {};
  return typeof extra.logoDataUrl === "string" && extra.logoDataUrl
    ? extra.logoDataUrl
    : null;
}

async function fileToLogoDataUrl(file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error("too_large");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("load"));
    el.src = dataUrl;
  });
  const maxDim = 512;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.88);
}

function readCustomLabels(
  labels: TemplateRecord["labels"] | undefined,
  styles: TemplateRecord["styles"],
  type?: TemplateTypeId,
): CustomLabels {
  const extra =
    styles?._design && typeof styles._design === "object"
      ? (styles._design as Record<string, unknown>)
      : {};
  const preBill = type === "non_fiscal_receipt";
  const complimentary = type === "complimentary_slip";
  const debt = type === "debt_voucher";
  const kitchen = type === "kitchen_ticket";
  const bar = type === "bar_ticket";
  const shift = type === "waiter_shift_report";
  const xReport = type === "x_report";
  const zReport = type === "z_report";
  const expense = type === "expense_voucher";
  const station = kitchen || bar;
  const register = shift || xReport || zReport;
  const hospitality = preBill || complimentary || debt;
  return {
    headerText:
      typeof labels?.headerText === "string" && labels.headerText.trim()
        ? preBill && /^non[-\s]?fiscal/i.test(labels.headerText.trim())
          ? "PRE-BILL"
          : complimentary && /^complimentary$/i.test(labels.headerText.trim())
            ? COMPLIMENTARY_TITLE
            : debt && /^debt voucher$/i.test(labels.headerText.trim())
              ? DEBT_VOUCHER_TITLE
              : kitchen && /^kitchen( order)?$/i.test(labels.headerText.trim())
                ? KITCHEN_TICKET_TITLE
                : bar && /^bar( order)?$/i.test(labels.headerText.trim())
                  ? BAR_TICKET_TITLE
                  : zReport && /^z[-\s]?report(\s*[\(\[]?\s*end of day\s*[\)\]]?)?$/i.test(labels.headerText.trim())
                    ? Z_REPORT_TITLE
                    : expense && /^expense(\s+voucher)?$/i.test(labels.headerText.trim())
                      ? EXPENSE_VOUCHER_TITLE
                      : labels.headerText
        : complimentary
          ? COMPLIMENTARY_TITLE
          : debt
            ? DEBT_VOUCHER_TITLE
            : preBill
              ? "PRE-BILL"
              : kitchen
                ? KITCHEN_TICKET_TITLE
                : bar
                  ? BAR_TICKET_TITLE
                  : shift
                    ? "SHIFT REPORT"
                    : xReport
                      ? X_REPORT_TITLE
                      : zReport
                        ? Z_REPORT_TITLE
                        : expense
                          ? EXPENSE_VOUCHER_TITLE
                          : DEFAULT_CUSTOM_LABELS.headerText,
    footerText:
      station || xReport
        ? ""
        : shift || expense
          ? typeof labels?.footerText === "string"
            ? labels.footerText
            : ""
        : zReport
          ? typeof labels?.footerText === "string"
            ? labels.footerText
            : Z_REPORT_FOOTER
        : typeof labels?.footerText === "string"
          ? complimentary && /^on the house/i.test(labels.footerText.trim())
            ? COMPLIMENTARY_FOOTER
            : labels.footerText
          : complimentary
            ? COMPLIMENTARY_FOOTER
            : debt
              ? DEBT_VOUCHER_FOOTER
              : preBill
                ? "Thank you for your visit!"
                : DEFAULT_CUSTOM_LABELS.footerText,
    address:
      station || register || expense
        ? ""
        : typeof extra.address === "string"
          ? extra.address
          : hospitality
            ? "Rr. Prishtina 10000, 10000 Prishtinë, Kosovë"
            : "",
    website:
      station || register || expense
        ? ""
        : typeof extra.website === "string"
          ? extra.website
          : hospitality
            ? "www.vyntexpos.net"
            : "",
    motto:
      station || register || expense
        ? ""
        : typeof extra.motto === "string"
          ? extra.motto
          : typeof extra.tagline === "string"
            ? extra.tagline
            : extra.content &&
                typeof extra.content === "object" &&
                typeof (extra.content as Record<string, unknown>).motto === "string"
              ? ((extra.content as Record<string, unknown>).motto as string)
              : hospitality
                ? COMPLIMENTARY_MOTTO
                : "",
  };
}

const DEFAULT_ELEMENTS: ReceiptElements = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  fiscalNumber: true,
  orderNumber: false,
  operator: true,
  waiterName: true,
  tableNumber: true,
  customerName: false,
  guestCount: false,
  itemList: true,
  unitPrices: true,
  itemModifiers: false,
  itemNotes: false,
  discount: true,
  subtotal: true,
  taxSummary: true,
  totalDue: true,
  preliminaryNotice: false,
  paymentMethod: true,
  thankYou: true,
  qrCode: true,
};

const DEFAULT_PRE_BILL_ELEMENTS: ReceiptElements = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  fiscalNumber: false,
  orderNumber: true,
  operator: false,
  waiterName: true,
  tableNumber: true,
  customerName: false,
  guestCount: false,
  itemList: true,
  unitPrices: true,
  itemModifiers: false,
  itemNotes: false,
  discount: true,
  subtotal: true,
  taxSummary: false,
  totalDue: true,
  preliminaryNotice: true,
  paymentMethod: false,
  thankYou: true,
  qrCode: false,
};

const PRE_BILL_ELEMENT_IDS: ReceiptElementId[] = [
  "logo",
  "storeInfo",
  "divider",
  "timestamp",
  "orderNumber",
  "waiterName",
  "tableNumber",
  "itemList",
  "unitPrices",
  "discount",
  "subtotal",
  "totalDue",
  "preliminaryNotice",
  "thankYou",
];

const DEFAULT_COMPLIMENTARY_ELEMENTS: ReceiptElements = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  fiscalNumber: false,
  orderNumber: true,
  operator: true,
  waiterName: true,
  tableNumber: true,
  customerName: false,
  guestCount: false,
  itemList: true,
  unitPrices: false,
  itemModifiers: false,
  itemNotes: false,
  discount: false,
  subtotal: true,
  taxSummary: false,
  totalDue: true,
  preliminaryNotice: true,
  paymentMethod: false,
  thankYou: true,
  qrCode: false,
};

const COMPLIMENTARY_ELEMENT_IDS: ReceiptElementId[] = [
  "logo",
  "storeInfo",
  "divider",
  "timestamp",
  "orderNumber",
  "waiterName",
  "tableNumber",
  "operator",
  "itemList",
  "subtotal",
  "totalDue",
  "preliminaryNotice",
  "thankYou",
];

const DEFAULT_DEBT_ELEMENTS: ReceiptElements = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  fiscalNumber: false,
  orderNumber: true,
  operator: false,
  waiterName: true,
  tableNumber: true,
  customerName: true,
  guestCount: false,
  itemList: true,
  unitPrices: true,
  itemModifiers: false,
  itemNotes: false,
  discount: false,
  subtotal: false,
  taxSummary: false,
  totalDue: true,
  preliminaryNotice: true,
  paymentMethod: false,
  thankYou: true,
  qrCode: false,
};

const DEBT_ELEMENT_IDS: ReceiptElementId[] = [
  "logo",
  "storeInfo",
  "divider",
  "timestamp",
  "customerName",
  "orderNumber",
  "waiterName",
  "tableNumber",
  "itemList",
  "unitPrices",
  "totalDue",
  "preliminaryNotice",
  "thankYou",
];

const DEFAULT_KITCHEN_ELEMENTS: ReceiptElements = {
  logo: false,
  storeInfo: false,
  divider: true,
  timestamp: true,
  fiscalNumber: false,
  orderNumber: true,
  operator: false,
  waiterName: true,
  tableNumber: true,
  customerName: false,
  guestCount: false,
  itemList: true,
  unitPrices: false,
  itemModifiers: true,
  itemNotes: true,
  discount: false,
  subtotal: false,
  taxSummary: false,
  totalDue: false,
  preliminaryNotice: false,
  paymentMethod: false,
  thankYou: false,
  qrCode: false,
};

const KITCHEN_ELEMENT_IDS: ReceiptElementId[] = [
  "logo",
  "divider",
  "timestamp",
  "orderNumber",
  "waiterName",
  "tableNumber",
  "itemList",
  "itemModifiers",
  "itemNotes",
];

const DEFAULT_BAR_ELEMENTS: ReceiptElements = { ...DEFAULT_KITCHEN_ELEMENTS };
const BAR_ELEMENT_IDS: ReceiptElementId[] = [...KITCHEN_ELEMENT_IDS];

const DEFAULT_SHIFT_ELEMENTS: ReceiptElements = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  fiscalNumber: false,
  orderNumber: false,
  operator: true,
  waiterName: true,
  tableNumber: false,
  customerName: false,
  guestCount: false,
  itemList: false,
  unitPrices: false,
  itemModifiers: false,
  itemNotes: false,
  discount: false,
  subtotal: false,
  taxSummary: true,
  totalDue: true,
  preliminaryNotice: false,
  paymentMethod: true,
  thankYou: false,
  qrCode: false,
};

const SHIFT_ELEMENT_IDS: ReceiptElementId[] = [
  "logo",
  "storeInfo",
  "divider",
  "timestamp",
  "operator",
  "paymentMethod",
  "taxSummary",
];

function shiftElementLabel(id: ReceiptElementId) {
  if (id === "operator") return "templates.elements.closed_by";
  if (id === "paymentMethod") return "templates.elements.payment_breakdown";
  if (id === "taxSummary") return "templates.elements.vat";
  return undefined;
}

const DEFAULT_X_ELEMENTS: ReceiptElements = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  fiscalNumber: false,
  orderNumber: false,
  operator: false,
  waiterName: false,
  tableNumber: false,
  customerName: false,
  guestCount: false,
  itemList: false,
  unitPrices: false,
  itemModifiers: false,
  itemNotes: false,
  discount: false,
  subtotal: false,
  taxSummary: true,
  totalDue: false,
  preliminaryNotice: false,
  paymentMethod: true,
  thankYou: false,
  qrCode: false,
};

const X_ELEMENT_IDS: ReceiptElementId[] = [
  "logo",
  "storeInfo",
  "divider",
  "timestamp",
  "paymentMethod",
  "taxSummary",
];

function xReportElementLabel(id: ReceiptElementId) {
  if (id === "paymentMethod") return "templates.elements.payment_breakdown";
  if (id === "taxSummary") return "templates.elements.vat";
  return undefined;
}

const DEFAULT_Z_ELEMENTS: ReceiptElements = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  fiscalNumber: false,
  orderNumber: false,
  operator: true,
  waiterName: false,
  tableNumber: false,
  customerName: false,
  guestCount: false,
  itemList: false,
  unitPrices: false,
  itemModifiers: false,
  itemNotes: false,
  discount: false,
  subtotal: false,
  taxSummary: true,
  totalDue: true,
  preliminaryNotice: false,
  paymentMethod: true,
  thankYou: false,
  qrCode: false,
};

const Z_ELEMENT_IDS: ReceiptElementId[] = [
  "logo",
  "storeInfo",
  "divider",
  "timestamp",
  "operator",
  "paymentMethod",
  "taxSummary",
];

function zReportElementLabel(id: ReceiptElementId) {
  if (id === "operator") return "templates.elements.closed_by";
  if (id === "paymentMethod") return "templates.elements.payment_breakdown";
  if (id === "taxSummary") return "templates.elements.vat";
  return undefined;
}

const DEFAULT_EXPENSE_ELEMENTS: ReceiptElements = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  fiscalNumber: false,
  orderNumber: false,
  operator: true,
  waiterName: true,
  tableNumber: false,
  customerName: false,
  guestCount: false,
  itemList: true,
  unitPrices: false,
  itemModifiers: false,
  itemNotes: false,
  discount: false,
  subtotal: false,
  taxSummary: false,
  totalDue: true,
  preliminaryNotice: false,
  paymentMethod: false,
  thankYou: false,
  qrCode: false,
};

const EXPENSE_ELEMENT_IDS: ReceiptElementId[] = [
  "logo",
  "storeInfo",
  "divider",
  "timestamp",
  "operator",
];

function expenseElementLabel(id: ReceiptElementId) {
  if (id === "operator") return "templates.elements.approved_by";
  return undefined;
}

const PRE_BILL_ONLY_ELEMENT_IDS = new Set<ReceiptElementId>([
  "orderNumber",
  "customerName",
  "guestCount",
  "itemModifiers",
  "itemNotes",
  "unitPrices",
  "subtotal",
  "totalDue",
  "preliminaryNotice",
]);

function debtElementLabel(id: ReceiptElementId) {
  if (id === "totalDue") return "templates.elements.amount_due";
  if (id === "preliminaryNotice") return "templates.elements.balance_notice";
  return undefined;
}

function complimentaryElementLabel(id: ReceiptElementId) {
  if (id === "operator") return "templates.elements.approved_by";
  if (id === "subtotal") return "templates.elements.menu_value";
  if (id === "preliminaryNotice") return "templates.elements.complimentary_notice";
  return undefined;
}

function readBool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readElements(
  toggles: TemplateRecord["toggles"] | undefined,
  styles: TemplateRecord["styles"],
  type?: TemplateTypeId,
): ReceiptElements {
  const extra =
    styles?._design && typeof styles._design === "object"
      ? (styles._design as { elements?: Record<string, unknown> }).elements
      : undefined;
  const extraRec = extra && typeof extra === "object" ? extra : {};
  const complimentary = type === "complimentary_slip";
  const debt = type === "debt_voucher";
  const kitchen = type === "kitchen_ticket";
  const bar = type === "bar_ticket";
  const shift = type === "waiter_shift_report";
  const xReport = type === "x_report";
  const zReport = type === "z_report";
  const expense = type === "expense_voucher";
  const station = kitchen || bar;
  const defaults = type === "non_fiscal_receipt"
    ? DEFAULT_PRE_BILL_ELEMENTS
    : complimentary
      ? DEFAULT_COMPLIMENTARY_ELEMENTS
      : debt
        ? DEFAULT_DEBT_ELEMENTS
        : kitchen
          ? DEFAULT_KITCHEN_ELEMENTS
          : bar
            ? DEFAULT_BAR_ELEMENTS
            : shift
              ? DEFAULT_SHIFT_ELEMENTS
              : xReport
                ? DEFAULT_X_ELEMENTS
                : zReport
                  ? DEFAULT_Z_ELEMENTS
                  : expense
                    ? DEFAULT_EXPENSE_ELEMENTS
                    : DEFAULT_ELEMENTS;
  const preBill = type === "non_fiscal_receipt";
  const hospitality = preBill || complimentary || debt;
  const noMoney = hospitality || station;
  const register = shift || xReport || zReport;
  return {
    logo: readBool(toggles?.logo, defaults.logo),
    storeInfo: station ? false : readBool(extraRec.storeInfo, defaults.storeInfo),
    divider: readBool(extraRec.divider, defaults.divider),
    timestamp: readBool(toggles?.timestamp, defaults.timestamp),
    fiscalNumber: noMoney || register || expense
      ? false
      : readBool(toggles?.orderNumber, defaults.fiscalNumber),
    orderNumber: register || expense
      ? false
      : hospitality || station
        ? readBool(extraRec.orderNumber, defaults.orderNumber)
        : false,
    operator: preBill || debt || station || xReport ? false : readBool(extraRec.operator, defaults.operator),
    waiterName: shift || expense ? true : register ? false : readBool(toggles?.waiterName, defaults.waiterName),
    tableNumber: register || expense ? false : readBool(toggles?.tableNumber, defaults.tableNumber),
    customerName: debt ? readBool(extraRec.customerName, defaults.customerName) : false,
    guestCount: false,
    itemList: register ? false : expense ? true : readBool(extraRec.itemList, defaults.itemList),
    unitPrices: complimentary || station || register || expense
      ? false
      : readBool(
          extraRec.unitPrices ?? toggles?.unitPrices,
          defaults.unitPrices,
        ),
    itemModifiers: station ? readBool(extraRec.itemModifiers, defaults.itemModifiers) : false,
    itemNotes: station ? readBool(extraRec.itemNotes, defaults.itemNotes) : false,
    discount: complimentary || debt || station || register || expense
      ? false
      : readBool(extraRec.discount, defaults.discount),
    subtotal: station || debt || register || expense
      ? false
      : hospitality
        ? readBool(extraRec.subtotal, defaults.subtotal)
        : true,
    taxSummary: noMoney || expense
      ? false
      : readBool(toggles?.taxDetails, defaults.taxSummary),
    totalDue: station || xReport ? false : shift || zReport || expense ? true : hospitality ? readBool(extraRec.totalDue, defaults.totalDue) : true,
    preliminaryNotice: station || register || expense
      ? false
      : hospitality
        ? readBool(extraRec.preliminaryNotice, defaults.preliminaryNotice)
        : false,
    paymentMethod: noMoney || expense
      ? false
      : readBool(extraRec.paymentMethod, defaults.paymentMethod),
    thankYou: station || register || expense ? false : readBool(toggles?.footerText, defaults.thankYou),
    qrCode: noMoney || register || expense ? false : readBool(extraRec.qrCode, defaults.qrCode),
  };
}

function elementsToToggles(
  elements: ReceiptElements,
  fallback: TemplateRecord["toggles"] | undefined,
  content?: ContentSettings,
): TemplateRecord["toggles"] {
  return {
    logo: elements.logo,
    headerText: fallback?.headerText ?? true,
    footerText: elements.thankYou,
    waiterName: elements.waiterName,
    tableNumber: elements.tableNumber,
    timestamp: elements.timestamp,
    unitPrices: elements.unitPrices,
    taxDetails: elements.taxSummary,
    orderNumber: elements.orderNumber || elements.fiscalNumber,
  };
}

function readDesign(styles: TemplateRecord["styles"]): DesignSettings {
  const raw = styles?._design;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_DESIGN };
  const o = raw as Record<string, unknown>;
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T) =>
    typeof value === "string" && (allowed as readonly string[]).includes(value)
      ? (value as T)
      : fallback;
  return {
    paperWidth: pick(o.paperWidth, ["58", "80", "custom"] as const, "80"),
    customWidth: typeof o.customWidth === "string" ? o.customWidth : "80",
    orientation: pick(o.orientation, ["portrait", "landscape"] as const, "portrait"),
    font: pick(o.font, ["default", "mono", "sans"] as const, "default"),
    fontSize: readFontSize(o.fontSize),
    align: pick(o.align, ["left", "center", "right"] as const, "center"),
    lineSpacing: pick(o.lineSpacing, ["tight", "normal", "loose"] as const, "normal"),
    lineHeight: readLineHeight(o.lineHeight, o.lineSpacing),
    sectionSpacing: pick(o.sectionSpacing, ["tight", "normal", "loose"] as const, "normal"),
    margin: pick(o.margin, ["tight", "normal", "loose"] as const, "normal"),
    dividerStyle: pick(o.dividerStyle, ["dashed", "dotted", "solid", "none"] as const, "dashed"),
    lineThickness: pick(o.lineThickness, ["thin", "normal", "thick"] as const, "normal"),
    showTopBorder: typeof o.showTopBorder === "boolean" ? o.showTopBorder : false,
    showBottomBorder: typeof o.showBottomBorder === "boolean" ? o.showBottomBorder : true,
    qrSize: pick(o.qrSize, ["small", "medium", "large"] as const, "medium"),
    qrEcc: pick(o.qrEcc, ["L", "M", "Q", "H"] as const, "M"),
  };
}

const PAPER_MM_MIN = 48;
const PAPER_MM_MAX = 110;
const PAPER_MM_VALUES = Array.from(
  { length: PAPER_MM_MAX - PAPER_MM_MIN + 1 },
  (_, i) => PAPER_MM_MIN + i,
);
const PAPER_WHEEL_ITEM = 36;

function paperMmValue(design: DesignSettings) {
  if (design.paperWidth === "58") return 58;
  if (design.paperWidth === "80") return 80;
  const n = Number(design.customWidth);
  if (!Number.isFinite(n)) return 80;
  return Math.min(PAPER_MM_MAX, Math.max(PAPER_MM_MIN, Math.round(n)));
}

function applyPaperMm(design: DesignSettings, mm: number): DesignSettings {
  return { ...design, paperWidth: "custom", customWidth: String(mm) };
}

function PaperMmWheel({
  value,
  onChange,
  onPick,
}: {
  value: number;
  onChange: (mm: number) => void;
  onPick?: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef(true);
  const lastRef = useRef(value);
  const dragRef = useRef<{ y: number; top: number; moved: boolean } | null>(null);
  const [offset, setOffset] = useState(() =>
    Math.max(0, PAPER_MM_VALUES.indexOf(value)),
  );

  const snapTo = (raw: number, close: boolean) => {
    const el = scrollerRef.current;
    const i = Math.max(0, Math.min(PAPER_MM_VALUES.length - 1, Math.round(raw)));
    el?.scrollTo({ top: i * PAPER_WHEEL_ITEM, behavior: close ? undefined : "smooth" });
    if (skipRef.current) return;
    const mm = PAPER_MM_VALUES[i];
    if (mm !== lastRef.current) {
      lastRef.current = mm;
      onChange(mm);
    }
    if (close) onPick?.();
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    skipRef.current = true;
    lastRef.current = value;
    const i = Math.max(0, PAPER_MM_VALUES.indexOf(value));
    el.scrollTop = i * PAPER_WHEEL_ITEM;
    setOffset(i);
    const ready = window.setTimeout(() => {
      skipRef.current = false;
    }, 120);
    const onEnd = () => snapTo(el.scrollTop / PAPER_WHEEL_ITEM, false);
    el.addEventListener("scrollend", onEnd);
    return () => {
      window.clearTimeout(ready);
      el.removeEventListener("scrollend", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="relative h-[180px] w-[5.5rem]"
      style={{ perspective: "1200px", perspectiveOrigin: "50% 50%" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%)",
        }}
      >
        {PAPER_MM_VALUES.map((mm, i) => {
          const delta = i - offset;
          if (Math.abs(delta) > 3.2) return null;
          const abs = Math.abs(delta);
          const on = abs < 0.4;
          return (
            <div
              key={mm}
              className={cn(
                "absolute inset-x-0 top-1/2 flex h-9 items-center justify-center pr-5 text-[16px] tabular-nums",
                on ? "font-semibold text-slate-950" : "font-medium text-slate-500",
              )}
              style={{
                transform: `translateY(-50%) rotateX(${delta * 24}deg) translateZ(78px)`,
                opacity: on ? 0 : Math.max(0, 1 - abs * 0.32),
                backfaceVisibility: "hidden",
              }}
            >
              {mm}
            </div>
          );
        })}
      </div>
      <div
        ref={scrollerRef}
        onScroll={() => {
          const el = scrollerRef.current;
          if (!el) return;
          setOffset(el.scrollTop / PAPER_WHEEL_ITEM);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const el = scrollerRef.current;
          if (!el) return;
          dragRef.current = { y: e.clientY, top: el.scrollTop, moved: false };
          el.setPointerCapture(e.pointerId);
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          const el = scrollerRef.current;
          if (!drag || !el) return;
          if (!drag.moved && Math.abs(e.clientY - drag.y) < 5) return;
          drag.moved = true;
          el.scrollTop = drag.top + (drag.y - e.clientY);
        }}
        onPointerUp={(e) => {
          const el = scrollerRef.current;
          const drag = dragRef.current;
          dragRef.current = null;
          if (!el) return;
          if (drag && !drag.moved) {
            const rect = el.getBoundingClientRect();
            const rows = Math.round(
              (e.clientY - (rect.top + rect.height / 2)) / PAPER_WHEEL_ITEM,
            );
            snapTo(el.scrollTop / PAPER_WHEEL_ITEM + rows, true);
            return;
          }
          snapTo(el.scrollTop / PAPER_WHEEL_ITEM, false);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        className="absolute inset-0 z-20 cursor-grab overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden active:cursor-grabbing"
        style={{ scrollSnapType: "y mandatory", touchAction: "none" }}
      >
        <div style={{ height: PAPER_WHEEL_ITEM * 2 }} />
        {PAPER_MM_VALUES.map((mm, i) => (
          <button
            key={mm}
            type="button"
            aria-label={`${mm} mm`}
            onClick={() => {
              scrollerRef.current?.scrollTo({
                top: i * PAPER_WHEEL_ITEM,
                behavior: "smooth",
              });
            }}
            className="pointer-events-none block w-full"
            style={{ height: PAPER_WHEEL_ITEM, scrollSnapAlign: "center" }}
          />
        ))}
        <div style={{ height: PAPER_WHEEL_ITEM * 2 }} />
      </div>
    </div>
  );
}

function DesignSeg({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {options.map((opt) => {
        const on = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "min-w-0 flex-1 truncate px-1.5 py-2 text-[11px] font-semibold leading-none transition",
              on
                ? "bg-brand text-[#f8fafc]"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function DesignSelect({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  items: { id: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full rounded-xl border-slate-200 bg-white text-[12px] text-slate-800 shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-slate-200 bg-white text-slate-800 shadow-lg">
        {items.map((item) => (
          <SelectItem
            key={item.id}
            value={item.id}
            className="text-slate-700 focus:bg-slate-100 focus:text-slate-900"
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DesignBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Receipt;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div className="shrink-0 border-t border-slate-200 pt-6 pb-2 first:border-t-0 first:pt-0">
      <div className="mb-3.5 flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand/10 text-brand">
          <Icon className="size-3.5" strokeWidth={1.75} />
        </span>
        <p className="truncate text-[12px] font-semibold text-slate-950">{title}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function DesignPanel({
  design,
  onChange,
  t,
  hideQr = false,
}: {
  design: DesignSettings;
  onChange: (next: DesignSettings) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  hideQr?: boolean;
}) {
  const [widthOpen, setWidthOpen] = useState(false);
  const set = <K extends keyof DesignSettings>(key: K, value: DesignSettings[K]) =>
    onChange({ ...design, [key]: value });
  const currentMm = paperMmValue(design);

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-start overflow-y-auto px-4 py-5">
      <DesignBlock
        icon={LayoutTemplate}
        title={t("templates.design.layout_title")}
        sub={t("templates.design.layout_sub")}
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">
              {t("templates.design.paper_width")}
            </p>
            <p className="mb-1.5 text-[10px] leading-snug text-slate-400">
              {t("templates.design.paper_width_hint")}
            </p>
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
              {(["58", "80"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setWidthOpen(false);
                    onChange({ ...design, paperWidth: id, customWidth: id });
                  }}
                  className={cn(
                    "flex-1 py-1.5 text-[12px] font-semibold transition",
                    !widthOpen && design.paperWidth === id
                      ? "bg-brand text-[#f8fafc]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                  )}
                >
                  {id} mm
                </button>
              ))}
              <Popover
                open={widthOpen}
                onOpenChange={(open) => {
                  setWidthOpen(open);
                  if (open) {
                    onChange(
                      applyPaperMm(
                        design,
                        design.paperWidth === "custom" ? currentMm : paperMmValue(design),
                      ),
                    );
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 py-1.5 text-[12px] font-semibold transition",
                      design.paperWidth === "custom" || widthOpen
                        ? "bg-brand text-[#f8fafc]"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                    )}
                  >
                    {design.paperWidth === "custom"
                      ? `${currentMm} mm`
                      : t("templates.design.custom")}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="center"
                  side="bottom"
                  avoidCollisions={false}
                  sideOffset={-108}
                  className="w-auto border-0 bg-transparent p-0 shadow-none outline-none data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 data-[side=bottom]:slide-in-from-top-0"
                >
                  <PaperMmWheel
                    value={currentMm}
                    onChange={(mm) => onChange(applyPaperMm(design, mm))}
                    onPick={() => setWidthOpen(false)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">
              {t("templates.design.orientation")}
            </p>
            <DesignSeg
              value={design.orientation}
              onChange={(id) => set("orientation", id as DesignSettings["orientation"])}
              options={[
                { id: "portrait", label: t("templates.design.portrait") },
                { id: "landscape", label: t("templates.design.landscape") },
              ]}
            />
          </div>
        </div>
      </DesignBlock>

      <DesignBlock
        icon={Palette}
        title={t("templates.design.type_title")}
        sub={t("templates.design.type_sub")}
      >
        <div>
          <p className="mb-1 text-[11px] font-medium text-slate-500">
            {t("templates.design.font")}
          </p>
          <DesignSelect
            value={design.font}
            onChange={(id) => set("font", id as DesignSettings["font"])}
            items={[
              { id: "default", label: t("templates.design.font_default") },
              { id: "mono", label: t("templates.design.font_mono") },
              { id: "sans", label: t("templates.design.font_sans") },
            ]}
          />
        </div>
        <div className="mt-1.5 flex items-end justify-between">
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">
              {t("templates.design.font_size")}
            </p>
            <SizeStepper
              value={design.fontSize}
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              step={1}
              suffix="pt"
              onChange={(n) => set("fontSize", n)}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">
              {t("templates.design.line_height")}
            </p>
            <SizeStepper
              value={design.lineHeight}
              min={LINE_HEIGHT_MIN}
              max={LINE_HEIGHT_MAX}
              step={0.1}
              onChange={(n) => set("lineHeight", n)}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">
              {t("templates.design.align")}
            </p>
            <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white">
              {(
                [
                  ["left", AlignLeft],
                  ["center", AlignCenter],
                  ["right", AlignRight],
                ] as const
              ).map(([id, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("align", id)}
                  className={cn(
                    "grid h-8 w-[3.15rem] place-items-center transition",
                    design.align === id
                      ? "bg-brand text-[#f8fafc]"
                      : "text-slate-400 hover:bg-slate-50 hover:text-slate-600",
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </DesignBlock>

      <DesignBlock
        icon={Rows3}
        title={t("templates.design.spacing_title")}
        sub={t("templates.design.spacing_sub")}
      >
        <div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">
              {t("templates.design.section_spacing")}
            </p>
            <DesignSelect
              value={design.sectionSpacing}
              onChange={(id) => set("sectionSpacing", id as DesignSettings["sectionSpacing"])}
              items={[
                { id: "tight", label: t("templates.design.size_tight") },
                { id: "normal", label: t("templates.design.size_normal") },
                { id: "loose", label: t("templates.design.size_loose") },
              ]}
            />
          </div>
          <div className="mt-2">
            <p className="mb-1 text-[11px] font-medium text-slate-500">
              {t("templates.design.margins")}
            </p>
            <DesignSelect
              value={design.margin}
              onChange={(id) => set("margin", id as DesignSettings["margin"])}
              items={[
                { id: "tight", label: t("templates.design.size_tight") },
                { id: "normal", label: t("templates.design.size_normal") },
                { id: "loose", label: t("templates.design.size_loose") },
              ]}
            />
          </div>
        </div>
      </DesignBlock>

      <DesignBlock
        icon={Minus}
        title={t("templates.design.borders_title")}
        sub={t("templates.design.borders_sub")}
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">
              {t("templates.design.divider_style")}
            </p>
            <DesignSelect
              value={design.dividerStyle}
              onChange={(id) => set("dividerStyle", id as DesignSettings["dividerStyle"])}
              items={[
                { id: "dashed", label: "- - - - - - - -" },
                { id: "dotted", label: "· · · · · · · ·" },
                { id: "solid", label: "────────" },
                { id: "none", label: t("templates.design.none") },
              ]}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">
              {t("templates.design.line_thickness")}
            </p>
            <DesignSelect
              value={design.lineThickness}
              onChange={(id) => set("lineThickness", id as DesignSettings["lineThickness"])}
              items={[
                { id: "thin", label: t("templates.design.size_thin") },
                { id: "normal", label: t("templates.design.size_normal") },
                { id: "thick", label: t("templates.design.size_thick") },
              ]}
            />
          </div>
        </div>
      </DesignBlock>

      {hideQr ? null : (
        <DesignBlock
          icon={QrCode}
          title={t("templates.design.qr_title")}
          sub={t("templates.design.qr_sub")}
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[11px] font-medium text-slate-500">
                {t("templates.design.qr_size")}
              </p>
              <DesignSelect
                value={design.qrSize}
                onChange={(id) => set("qrSize", id as DesignSettings["qrSize"])}
                items={[
                  { id: "small", label: t("templates.design.size_small") },
                  { id: "medium", label: t("templates.design.size_medium") },
                  { id: "large", label: t("templates.design.size_large") },
                ]}
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium text-slate-500">
                {t("templates.design.qr_ecc")}
              </p>
              <DesignSelect
                value={design.qrEcc}
                onChange={(id) => set("qrEcc", id as DesignSettings["qrEcc"])}
                items={[
                  { id: "L", label: "L" },
                  { id: "M", label: t("templates.design.qr_ecc_m") },
                  { id: "Q", label: "Q" },
                  { id: "H", label: "H" },
                ]}
              />
            </div>
          </div>
        </DesignBlock>
      )}
    </div>
  );
}

function ContentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0">
      <p className="mb-1.5 text-[11px] font-medium text-slate-500">{label}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand"
      />
    </label>
  );
}

function ContentSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300"
    >
      <span className="text-[12px] font-medium text-slate-700">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand" : "bg-slate-200",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-[left]",
            checked ? "left-4" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function ContentPanel({
  content,
  onChange,
  t,
  preBill = false,
  complimentary = false,
  debt = false,
  fiscal = false,
  shift = false,
  xReport = false,
  zReport = false,
  expense = false,
}: {
  content: ContentSettings;
  onChange: (next: ContentSettings) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  preBill?: boolean;
  complimentary?: boolean;
  debt?: boolean;
  fiscal?: boolean;
  shift?: boolean;
  xReport?: boolean;
  zReport?: boolean;
  expense?: boolean;
}) {
  const set = <K extends keyof ContentSettings>(key: K, value: ContentSettings[K]) =>
    onChange({ ...content, [key]: value });
  const moneySample = formatContentPrice(12.5, content);
  const register = shift || xReport || zReport || expense;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
      <DesignBlock icon={Building2} title={t("templates.content.header_title")}>
        <div className="grid grid-cols-2 gap-3">
          <ContentField
            label={t("templates.content.store_name")}
            value={content.storeName}
            onChange={(v) => set("storeName", v)}
          />
          <ContentField
            label={t("templates.content.venue_name")}
            value={content.venueName}
            onChange={(v) => set("venueName", v)}
          />
        </div>
      </DesignBlock>

      {preBill || complimentary || debt || register ? null : (
        <DesignBlock icon={FileText} title={t("templates.content.title_block")}>
          <ContentField
            label={t("templates.content.label_fiscal")}
            value={content.fiscalLabel}
            onChange={(v) => set("fiscalLabel", v)}
          />
        </DesignBlock>
      )}

      {register ? null : (
      <DesignBlock icon={List} title={t("templates.content.items_title")}>
        <ContentField
          label={t("templates.content.items_heading")}
          value={content.itemsTitle}
          onChange={(v) => set("itemsTitle", v)}
        />
        {fiscal ? null : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ContentField
            label={t("templates.content.col_qty")}
            value={content.colQty}
            onChange={(v) => set("colQty", v)}
          />
          <ContentField
            label={t("templates.content.col_item")}
            value={content.colItem}
            onChange={(v) => set("colItem", v)}
          />
          {complimentary ? null : (
            <>
              <ContentField
                label={t("templates.content.col_price")}
                value={content.colPrice}
                onChange={(v) => set("colPrice", v)}
              />
              <ContentField
                label={t("templates.content.col_line_total")}
                value={content.colLineTotal}
                onChange={(v) => set("colLineTotal", v)}
              />
            </>
          )}
        </div>
        )}
        {preBill || complimentary || debt ? null : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ContentSwitch
              label={t("templates.content.show_qty")}
              checked={content.showQtyPrefix}
              onChange={(v) => set("showQtyPrefix", v)}
            />
            <ContentSwitch
              label={t("templates.content.show_unit")}
              checked={content.showUnitPrices}
              onChange={(v) => set("showUnitPrices", v)}
            />
          </div>
        )}
      </DesignBlock>
      )}

      <DesignBlock icon={Banknote} title={t("templates.content.totals_title")}>
        {preBill || complimentary || debt || register ? null : (
          <div className="grid grid-cols-2 gap-2">
            <ContentField
              label={t("templates.content.label_subtotal")}
              value={content.subtotalLabel}
              onChange={(v) => set("subtotalLabel", v)}
            />
            <ContentField
              label={t("templates.content.label_discount")}
              value={content.discountLabel}
              onChange={(v) => set("discountLabel", v)}
            />
            <ContentField
              label={t("templates.content.label_tax")}
              value={content.taxLabel}
              onChange={(v) => set("taxLabel", v)}
            />
            <ContentField
              label={t("templates.content.label_total")}
              value={content.totalLabel}
              onChange={(v) => set("totalLabel", v)}
            />
          </div>
        )}
        <div className={cn("grid gap-3", preBill || complimentary || debt || register ? "grid-cols-1" : "mt-2 grid-cols-2")}>
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-medium text-slate-500">
              {t("templates.content.currency")}
            </p>
            <DesignSeg
              value={content.currency}
              onChange={(id) => set("currency", id as ContentSettings["currency"])}
              options={[
                { id: "none", label: t("templates.content.currency_none") },
                { id: "eur", label: "€" },
                { id: "all", label: "L" },
              ]}
            />
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-medium text-slate-500">
              {t("templates.content.currency_pos")}
            </p>
            <DesignSeg
              value={content.currencyPosition}
              onChange={(id) => set("currencyPosition", id as ContentSettings["currencyPosition"])}
              options={[
                { id: "before", label: t("templates.content.pos_before") },
                { id: "after", label: t("templates.content.pos_after") },
              ]}
            />
          </div>
        </div>
        <p className="mt-3 text-[11px] font-medium text-slate-400">
          {t("templates.content.money_preview")}:{" "}
          <span className="tabular-nums text-slate-700">{moneySample}</span>
        </p>
      </DesignBlock>

      {register ? null : (
      <DesignBlock icon={AlignVerticalJustifyEnd} title={t("templates.content.footer_title")}>
        <ContentField
          label={t("templates.content.legal")}
          value={content.legalText}
          onChange={(v) => set("legalText", v)}
        />
      </DesignBlock>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────

export default function TemplateManager({
  licenseKey,
  onEditingChange,
  onEditorTitle,
  registerEditorBack,
  onOpenDevices,
}: {
  licenseKey: string;
  onEditingChange?: (editing: boolean) => void;
  onEditorTitle?: (title: string | null) => void;
  registerEditorBack?: (fn: (() => void) | null) => void;
  onOpenDevices?: () => void;
}) {
  const { t } = usePosLocale();
  const templates = useQuery('pos.templates.listTemplates', { licenseKey });
  const printers = useQuery('pos.settings.getPrinters', { licenseKey });
  const [selectedType, setSelectedType] = useState<TemplateTypeId | null>(null);

  useEffect(() => {
    onEditingChange?.(selectedType != null);
    return () => onEditingChange?.(false);
  }, [selectedType, onEditingChange]);

  useEffect(() => {
    registerEditorBack?.(() => setSelectedType(null));
    return () => registerEditorBack?.(null);
  }, [registerEditorBack]);

  useEffect(() => {
    if (!selectedType) {
      onEditorTitle?.(null);
      return;
    }
    onEditorTitle?.(templateTypeLabel(t, selectedType, "name"));
    return () => onEditorTitle?.(null);
  }, [selectedType, onEditorTitle, t]);

  if (templates === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 bg-[#131A2E]" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-[#131A2E]" />
          ))}
        </div>
      </div>
    );
  }

  if (selectedType) {
    const meta = TEMPLATE_TYPES.find((t) => t.id === selectedType)!;
    const data = templates.find((row) => row.templateType === selectedType);
    return (
      <TemplateEditor
        licenseKey={licenseKey}
        meta={meta}
        data={data}
        printers={(printers ?? []) as PrinterRecord[]}
        t={t}
        onOpenDevices={onOpenDevices}
      />
    );
  }

  const salesTemplates = TEMPLATE_TYPES.filter((t) => t.category === "sales");
  const internalTemplates = TEMPLATE_TYPES.filter(
    (t) => t.category === "internal"
  );

  return (
    <div className="space-y-6">
      <header className="flex min-w-0 items-start gap-3 px-1">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e7f0ff] text-[#005bd6]">
          <Receipt className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-[#0f172a]">
            {t("settings.cat.print")}
          </h1>
          <p className="mt-0.5 text-sm text-[#64748b]">{t("settings.cat.print_desc")}</p>
          <p className="mt-2 max-w-2xl text-xs text-[#64748b]">{t("templates.admin_hint")}</p>
          {onOpenDevices ? (
            <button
              type="button"
              onClick={onOpenDevices}
              className="mt-2 text-sm font-medium text-brand hover:underline"
            >
              {t("templates.open_devices")}
            </button>
          ) : null}
        </div>
      </header>

      <SalesReceiptsGallery
        types={salesTemplates}
        templates={templates}
        t={t}
        onSelect={(id) => setSelectedType(id)}
      />

      <InternalReportsGallery
        types={internalTemplates}
        templates={templates}
        t={t}
        onSelect={(id) => setSelectedType(id)}
      />
    </div>
  );
}

const SALES_CARD_THEME: Record<
  "fiscal_receipt" | "non_fiscal_receipt" | "complimentary_slip" | "debt_voucher",
  {
    panel: string;
    iconWrap: string;
    icon: string;
    button: string;
    chip: string;
    accent: string;
  }
> = {
  fiscal_receipt: {
    panel: "bg-[linear-gradient(180deg,#eef4ff_0%,#f7faff_100%)]",
    iconWrap: "bg-[#e8f0ff] text-brand",
    icon: "text-brand",
    button: "bg-brand hover:bg-brand-hover text-[#f8fafc]",
    chip: "bg-[#dbe7ff] text-brand",
    accent: "text-brand",
  },
  non_fiscal_receipt: {
    panel: "bg-[linear-gradient(180deg,#f4eeff_0%,#faf7ff_100%)]",
    iconWrap: "bg-[#eee6ff] text-[#7c3aed]",
    icon: "text-[#7c3aed]",
    button: "bg-[#7c3aed] hover:bg-[#6d28d9] text-[#f8fafc]",
    chip: "bg-[#ede9fe] text-[#7c3aed]",
    accent: "text-[#7c3aed]",
  },
  complimentary_slip: {
    panel: "bg-[linear-gradient(180deg,#fff4e8_0%,#fffaf4_100%)]",
    iconWrap: "bg-[#ffe8d2] text-[#ea580c]",
    icon: "text-[#ea580c]",
    button: "bg-[#ea580c] hover:bg-[#c2410c] text-[#f8fafc]",
    chip: "bg-[#ffedd5] text-[#c2410c]",
    accent: "text-[#ea580c]",
  },
  debt_voucher: {
    panel: "bg-[linear-gradient(180deg,#ffe8ef_0%,#fff6f8_100%)]",
    iconWrap: "bg-[#ffd6e2] text-[#e11d48]",
    icon: "text-[#e11d48]",
    button: "bg-[#e11d48] hover:bg-[#be123c] text-[#f8fafc]",
    chip: "bg-[#ffe4e6] text-[#e11d48]",
    accent: "text-[#e11d48]",
  },
};

function ReceiptPaperShell({
  bite,
  size = "compact",
  sheetStyle,
  landscape = false,
  children,
}: {
  bite: string;
  size?: "compact" | "preview";
  sheetStyle?: CSSProperties;
  landscape?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "pos-receipt-stage",
        size === "compact" ? "pos-receipt-stage--compact" : "pos-receipt-stage--preview",
        landscape && "pos-receipt-stage--landscape",
      )}
    >
      <div
        className="pos-receipt-sheet"
        style={{ ["--receipt-bite" as string]: bite, ...sheetStyle }}
      >
        {children}
        <span className="pos-receipt-sheet__fold" />
        <span className="pos-receipt-sheet__dogear" />
      </div>
    </div>
  );
}

function ReceiptDots({
  style = "dashed",
  thickness = "normal",
  spacing = "normal",
}: {
  style?: DesignSettings["dividerStyle"];
  thickness?: DesignSettings["lineThickness"];
  spacing?: DesignSettings["sectionSpacing"];
}) {
  if (style === "none") {
    return (
      <div
        className={cn(
          spacing === "tight" && "my-1",
          spacing === "normal" && "my-1.5",
          spacing === "loose" && "my-3",
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        "w-full border-slate-300",
        style === "dashed" && "border-dashed",
        style === "dotted" && "border-dotted",
        style === "solid" && "border-solid",
        thickness === "thin" && "border-t",
        thickness === "normal" && "border-t-[1.5px]",
        thickness === "thick" && "border-t-2",
        spacing === "tight" && "my-1",
        spacing === "normal" && "my-1.5",
        spacing === "loose" && "my-3",
      )}
    />
  );
}

function CutleryMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} fill="currentColor" aria-hidden>
      <path d="M13.2 4.2c.4 0 .7.5.7 1.1v7.2c0 1.1-.6 1.8-1.4 2v16.2c0 .7-.5 1.3-1.2 1.3s-1.2-.6-1.2-1.3V14.5c-.8-.2-1.4-.9-1.4-2V5.3c0-.6.3-1.1.7-1.1s.7.5.7 1.1v6.4h.7V5.3c0-.6.3-1.1.7-1.1s.7.5.7 1.1v6.4h.7V5.3c0-.6.3-1.1.7-1.1Z" />
      <path d="M24.8 4.5c.7 0 1.2.6 1.2 1.3v9.4c2 1 3.2 2.6 3.2 4.6 0 2.4-1.7 4.3-4.1 4.8v6.1c0 .7-.5 1.3-1.2 1.3s-1.2-.6-1.2-1.3V24.6c-2.4-.5-4.1-2.4-4.1-4.8 0-2 1.2-3.6 3.2-4.6V5.8c0-.7.5-1.3 1.2-1.3h1.8Z" />
    </svg>
  );
}

function GiftMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} fill="none" aria-hidden>
      <path d="M7.5 14.5h21v4.2H7.5z" fill="currentColor" />
      <rect x="7.5" y="18.7" width="21" height="12.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M18 14.5v16.5" stroke="#fff" strokeWidth="1.7" />
      <path d="M18 14.6c-3.4-4.2-8-4.1-8-1.2 0 2.4 3.6 3 8 1.2Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18 14.6c3.4-4.2 8-4.1 8-1.2 0 2.4-3.6 3-8 1.2Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function LedgerMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} fill="none" aria-hidden>
      <rect x="8" y="5.5" width="20" height="25" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 13h12M12 18.2h12M12 23.4h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

function paperWidthRem(design: DesignSettings) {
  if (design.paperWidth === "58") return design.orientation === "landscape" ? 21 : 17;
  if (design.paperWidth === "80") return design.orientation === "landscape" ? 26.5 : 22.5;
  const mm = Number(design.customWidth);
  const base = Number.isFinite(mm) ? Math.min(110, Math.max(48, mm)) : 80;
  const rem = (base / 80) * 22.5;
  return design.orientation === "landscape" ? rem * 1.18 : rem;
}

function PreBillPreview({
  design,
  elements,
  customLabels,
  content,
  logoDataUrl,
}: {
  design: DesignSettings;
  elements: ReceiptElements;
  customLabels: CustomLabels;
  content: ContentSettings;
  logoDataUrl?: string | null;
}) {
  const copy = resolvePreBillCopy(customLabels);
  const brand = (content.storeName.trim() || "VYNTEX").toUpperCase();
  const venueSub = content.venueName.trim();
  const address = customLabels.address.trim();
  const website = customLabels.website.trim().replace(/^https?:\/\//, "");
  const money = (n: number) => formatContentPrice(n, content);
  const date = formatContentDate(content);
  const time = formatContentTime(content);
  const items = [
    ["Caesar Salad", 2, 5.5, 11] as const,
    ["Margherita Pizza", 1, 7.9, 7.9] as const,
    ["Grilled Chicken", 1, 8.5, 8.5] as const,
    ["Coca-Cola 0.33L", 3, 2.2, 6.6] as const,
    ["Espresso", 1, 1.5, 1.5] as const,
  ];
  const fontFamily =
    design.font === "mono"
      ? 'ui-monospace, "Geist Mono", "Courier New", monospace'
      : "ui-sans-serif, system-ui, Helvetica, Arial, sans-serif";
  const align =
    design.align === "left" ? "left" : design.align === "right" ? "right" : "center";
  const textAlign =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  const rowAlign =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const dots = {
    style: design.dividerStyle,
    thickness: design.lineThickness,
    spacing: design.sectionSpacing,
  };
  const meta: Array<{ label: string; value: string }> = [];
  if (elements.tableNumber) {
    meta.push({ label: content.tableLabel || "Table", value: "12" });
  }
  if (elements.timestamp) {
    meta.push({ label: content.dateLabel || "Date", value: date });
  }
  if (elements.timestamp) {
    meta.push({ label: content.timeLabel || "Time", value: time });
  }
  if (elements.orderNumber) {
    meta.push({ label: "Order", value: "#10288" });
  }
  if (elements.waiterName) {
    meta.push({ label: content.waiterLabel || "Waiter", value: "Arben" });
  }

  return (
    <ReceiptPaperShell
      bite="#f7f4ef"
      size="preview"
      landscape={design.orientation === "landscape"}
      sheetStyle={{
        width: `${paperWidthRem(design)}rem`,
        fontFamily,
        fontSize: `${design.fontSize}px`,
        lineHeight: design.lineHeight,
        textAlign: align,
        transition: "width 200ms ease, font-size 200ms ease",
      }}
    >
      {elements.storeInfo || elements.logo ? (
        <div className={cn("text-slate-900", textAlign)}>
          <div className={cn("flex items-center gap-2", rowAlign)}>
            {elements.storeInfo ? (
              <p className="text-[1.55em] font-extrabold tracking-[0.12em]">{brand}</p>
            ) : null}
            {elements.logo ? (
              logoDataUrl ? (
                <img src={logoDataUrl} alt="" className="h-[2.2em] w-auto max-w-[4.5rem] object-contain" />
              ) : (
                <CutleryMark className="size-[2em]" />
              )
            ) : null}
          </div>
          {elements.storeInfo ? (
            <>
              {venueSub ? (
                <p className="mt-1 text-[0.68em] tracking-[0.38em] text-slate-500">
                  {venueSub.toUpperCase()}
                </p>
              ) : null}
              <div className="mt-2.5 text-[0.86em] leading-relaxed text-slate-600">
                {address ? <p>{address}</p> : null}
                <p>Tel: +383 44 123 456</p>
                {website ? <p>{website}</p> : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3.5" />}
      {copy.title ? (
        <p className={cn("text-[1.05em] font-extrabold tracking-[0.1em] text-slate-900", textAlign)}>
          {copy.title}
        </p>
      ) : null}
      {meta.length > 0 ? (
        <>
          {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3.5" />}
          <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-left text-[0.9em] leading-relaxed text-slate-700">
            {meta.map((row) => (
              <div key={`${row.label}-${row.value}`}>
                <span className="text-slate-400">{row.label}: </span>
                {row.value}
              </div>
            ))}
          </div>
        </>
      ) : null}
      {elements.itemList ? (
        <>
          {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3.5" />}
          {content.itemsTitle.trim() ? (
            <p className={cn("mb-2.5 text-[0.68em] tracking-[0.2em] text-slate-400", textAlign)}>
              {content.itemsTitle.trim()}
            </p>
          ) : null}
          <table className="w-full border-separate border-spacing-y-1.5 text-left text-[0.9em] leading-relaxed text-slate-800">
            <thead>
              <tr className="text-[0.68em] tracking-[0.14em] text-slate-400">
                <th className="pb-2 pr-2 font-semibold">{content.colQty || "QTY"}</th>
                <th className="pb-2 pr-2 font-semibold">{content.colItem || "ITEM"}</th>
                {elements.unitPrices ? (
                  <th className="pb-2 pl-2 text-right font-semibold">{content.colPrice || "PRICE"}</th>
                ) : null}
                <th className="pb-2 pl-2 text-right font-semibold">{content.colLineTotal || "TOTAL"}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(([name, qty, unit, total]) => (
                <tr key={name}>
                  <td className="pr-2 align-top">{qty}</td>
                  <td className="pr-2 align-top">{name}</td>
                  {elements.unitPrices ? (
                    <td className="pl-2 text-right align-top tabular-nums">{money(unit)}</td>
                  ) : null}
                  <td className="pl-2 text-right align-top tabular-nums">{money(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3.5" />}
      {elements.subtotal || elements.discount || elements.totalDue ? (
        <div className="ml-auto w-[62%] space-y-1.5 text-left text-[0.9em] leading-relaxed text-slate-700">
          {elements.subtotal ? (
            <div className="flex justify-between gap-4">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(35.5)}</span>
            </div>
          ) : null}
          {elements.discount ? (
            <div className="flex justify-between gap-4">
              <span>Discount (10%)</span>
              <span className="tabular-nums">-{money(3.55)}</span>
            </div>
          ) : null}
          {elements.totalDue ? (
            <div className="flex justify-between gap-4 pt-1 text-[1.15em] font-extrabold text-slate-950">
              <span>TOTAL</span>
              <span className="tabular-nums">{money(elements.discount ? 31.95 : 35.5)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {elements.preliminaryNotice && content.legalText.trim() ? (
        <p className={cn("mt-4 text-[0.72em] font-extrabold tracking-[0.12em] text-slate-800", textAlign)}>
          {content.legalText.trim()}
        </p>
      ) : null}
      {elements.thankYou ? (
        <p className={cn("mt-1.5 text-[0.86em] text-slate-500", textAlign)}>{copy.footerText}</p>
      ) : null}
      <div className="mt-4 flex items-center gap-2">
        <span className="h-px flex-1 bg-slate-900" />
        <CutleryMark className="size-[1.7em]" />
        <span className="h-px flex-1 bg-slate-900" />
      </div>
      {customLabels.motto.trim() ? (
        <p className={cn("mt-1.5 text-[0.62em] tracking-[0.24em] text-slate-400", textAlign)}>
          {customLabels.motto.trim()}
        </p>
      ) : null}
      <p className={cn("mt-2 text-[0.68em] text-slate-400", textAlign)}>{PRINT_POWERED_BY}</p>
    </ReceiptPaperShell>
  );
}

function ComplimentarySlipPreview({
  design,
  elements,
  customLabels,
  content,
  logoDataUrl,
}: {
  design: DesignSettings;
  elements: ReceiptElements;
  customLabels: CustomLabels;
  content: ContentSettings;
  logoDataUrl?: string | null;
}) {
  const copy = resolveComplimentaryCopy({
    ...customLabels,
    legalText: content.legalText,
    tagline: customLabels.motto,
  });
  const brand = (content.storeName.trim() || "VYNTEX").toUpperCase();
  const venueSub = content.venueName.trim();
  const address = customLabels.address.trim();
  const website = customLabels.website.trim().replace(/^https?:\/\//, "");
  const money = (n: number) => formatContentPrice(n, content);
  const date = formatContentDate(content);
  const time = formatContentTime(content);
  const items = [
    ["Tiramisu", 1] as const,
    ["Espresso", 2] as const,
    ["House Wine", 1] as const,
  ];
  const menuValue = 18.4;
  const fontFamily =
    design.font === "mono"
      ? 'ui-monospace, "Geist Mono", "Courier New", monospace'
      : "ui-sans-serif, system-ui, Helvetica, Arial, sans-serif";
  const align =
    design.align === "left" ? "left" : design.align === "right" ? "right" : "center";
  const textAlign =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  const rowAlign =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const dots = {
    style: design.dividerStyle,
    thickness: design.lineThickness,
    spacing: design.sectionSpacing,
  };
  const meta: Array<{ label: string; value: string }> = [];
  if (elements.tableNumber) {
    meta.push({ label: content.tableLabel || "Table", value: "8" });
  }
  if (elements.timestamp) {
    meta.push({ label: content.dateLabel || "Date", value: date });
  }
  if (elements.timestamp) {
    meta.push({ label: content.timeLabel || "Time", value: time });
  }
  if (elements.orderNumber) {
    meta.push({ label: "Order", value: "#10412" });
  }
  if (elements.waiterName) {
    meta.push({ label: content.waiterLabel || "Waiter", value: "Arben" });
  }
  if (elements.operator) {
    meta.push({ label: "Approved", value: "Admin" });
  }

  return (
    <ReceiptPaperShell
      bite="#fff6ec"
      size="preview"
      landscape={design.orientation === "landscape"}
      sheetStyle={{
        width: `${paperWidthRem(design)}rem`,
        fontFamily,
        fontSize: `${design.fontSize}px`,
        lineHeight: design.lineHeight,
        textAlign: align,
        transition: "width 200ms ease, font-size 200ms ease",
      }}
    >
      {elements.storeInfo || elements.logo ? (
        <div className={cn("text-slate-900", textAlign)}>
          <div className={cn("flex items-center gap-2", rowAlign)}>
            {elements.storeInfo ? (
              <p className="text-[1.55em] font-extrabold tracking-[0.12em]">{brand}</p>
            ) : null}
            {elements.logo ? (
              logoDataUrl ? (
                <img src={logoDataUrl} alt="" className="h-[2.2em] w-auto max-w-[4.5rem] object-contain" />
              ) : (
                <GiftMark className="size-[1.85em] text-slate-900" />
              )
            ) : null}
          </div>
          {elements.storeInfo ? (
            <>
              {venueSub ? (
                <p className="mt-1 text-[0.68em] tracking-[0.38em] text-slate-500">
                  {venueSub.toUpperCase()}
                </p>
              ) : null}
              <div className="mt-2.5 text-[0.86em] leading-relaxed text-slate-600">
                {address ? <p>{address}</p> : null}
                <p>Tel: +383 44 123 456</p>
                {website ? <p>{website}</p> : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3.5" />}
      {copy.title ? (
        <p className={cn("text-[1.05em] font-extrabold tracking-[0.16em] text-slate-900", textAlign)}>
          {copy.title}
        </p>
      ) : null}
      <div className={cn("mt-2.5 flex", rowAlign)}>
        <span className="border-2 border-slate-900 px-3 py-1 text-[0.62em] font-extrabold tracking-[0.28em] text-slate-950">
          {COMPLIMENTARY_BADGE}
        </span>
      </div>
      {meta.length > 0 ? (
        <>
          {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3.5" />}
          <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-left text-[0.9em] leading-relaxed text-slate-700">
            {meta.map((row) => (
              <div key={`${row.label}-${row.value}`}>
                <span className="text-slate-400">{row.label}: </span>
                {row.value}
              </div>
            ))}
          </div>
        </>
      ) : null}
      {elements.itemList ? (
        <>
          {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3.5" />}
          <p className={cn("mb-2.5 text-[0.68em] tracking-[0.28em] text-slate-400", textAlign)}>
            {content.itemsTitle.trim() || "TREAT"}
          </p>
          <table className="w-full border-separate border-spacing-y-1.5 text-left text-[0.9em] leading-relaxed text-slate-800">
            <thead>
              <tr className="text-[0.68em] tracking-[0.14em] text-slate-400">
                <th className="w-[2.2em] pb-2 pr-2 font-semibold">{content.colQty || "QTY"}</th>
                <th className="pb-2 font-semibold">{content.colItem || "ITEM"}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(([name, qty]) => (
                <tr key={name}>
                  <td className="pr-2 align-top">{qty}</td>
                  <td className="align-top">{name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3.5" />}
      {elements.subtotal || elements.totalDue ? (
        <div className="ml-auto w-[68%] space-y-1.5 text-left text-[0.9em] leading-relaxed text-slate-700">
          {elements.subtotal ? (
            <div className="flex justify-between gap-4">
              <span>Menu value</span>
              <span className="tabular-nums">{money(menuValue)}</span>
            </div>
          ) : null}
          {elements.totalDue ? (
            <div className="flex justify-between gap-4 pt-1 text-[1.15em] font-extrabold text-slate-950">
              <span>TOTAL</span>
              <span className="tabular-nums">{money(0)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {elements.preliminaryNotice ? (
        <p className={cn("mt-4 text-[0.72em] font-extrabold tracking-[0.12em] text-slate-800", textAlign)}>
          {copy.legalText}
        </p>
      ) : null}
      {elements.thankYou ? (
        <p className={cn("mt-2 text-[0.92em] text-slate-600", textAlign)}>{copy.footerText}</p>
      ) : null}
      <div className="mt-4 flex items-center gap-2">
        <span className="h-px flex-1 bg-slate-900" />
        <GiftMark className="size-[1.55em] text-slate-900" />
        <span className="h-px flex-1 bg-slate-900" />
      </div>
      {customLabels.motto.trim() ? (
        <p className={cn("mt-1.5 text-[0.62em] tracking-[0.24em] text-slate-400", textAlign)}>
          {customLabels.motto.trim()}
        </p>
      ) : null}
      <p className={cn("mt-2 text-[0.68em] text-slate-400", textAlign)}>{PRINT_POWERED_BY}</p>
    </ReceiptPaperShell>
  );
}

function DebtVoucherPreview({
  design,
  elements,
  customLabels,
  content,
  logoDataUrl,
}: {
  design: DesignSettings;
  elements: ReceiptElements;
  customLabels: CustomLabels;
  content: ContentSettings;
  logoDataUrl?: string | null;
}) {
  const copy = resolveDebtVoucherCopy({
    ...customLabels,
    legalText: content.legalText,
    tagline: customLabels.motto,
  });
  const brand = (content.storeName.trim() || "VYNTEX").toUpperCase();
  const venueSub = content.venueName.trim();
  const address = customLabels.address.trim();
  const website = customLabels.website.trim().replace(/^https?:\/\//, "");
  const money = (n: number) => formatContentPrice(n, content);
  const date = formatContentDate(content);
  const time = formatContentTime(content);
  const items = [
    ["Margherita Pizza", 1, 12, 12] as const,
    ["Coca-Cola 0.33L", 2, 2.2, 4.4] as const,
    ["Tiramisu", 1, 8.5, 8.5] as const,
  ];
  const due = 24.9;
  const fontFamily =
    design.font === "mono"
      ? 'ui-monospace, "Geist Mono", "Courier New", monospace'
      : "ui-sans-serif, system-ui, Helvetica, Arial, sans-serif";
  const align =
    design.align === "left" ? "left" : design.align === "right" ? "right" : "center";
  const textAlign =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  const rowAlign =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const dots = {
    style: design.dividerStyle,
    thickness: design.lineThickness,
    spacing: design.sectionSpacing,
  };
  const meta: Array<{ label: string; value: string; wide?: boolean }> = [];
  if (elements.customerName) {
    meta.push({ label: "Customer", value: "Arta Krasniqi", wide: true });
  }
  if (elements.tableNumber) {
    meta.push({ label: content.tableLabel || "Table", value: "12" });
  }
  if (elements.timestamp) {
    meta.push({ label: content.dateLabel || "Date", value: date });
  }
  if (elements.timestamp) {
    meta.push({ label: content.timeLabel || "Time", value: time });
  }
  if (elements.orderNumber) {
    meta.push({ label: "Order", value: "#10820" });
  }
  if (elements.waiterName) {
    meta.push({ label: content.waiterLabel || "Waiter", value: "Arben" });
  }

  return (
    <ReceiptPaperShell
      bite="#fff1f4"
      size="preview"
      landscape={design.orientation === "landscape"}
      sheetStyle={{
        width: `${paperWidthRem(design)}rem`,
        fontFamily,
        fontSize: `${design.fontSize}px`,
        lineHeight: design.lineHeight,
        textAlign: align,
        transition: "width 200ms ease, font-size 200ms ease",
      }}
    >
      {elements.storeInfo || elements.logo ? (
        <div className={cn("text-slate-900", textAlign)}>
          <div className={cn("flex items-center gap-2", rowAlign)}>
            {elements.storeInfo ? (
              <p className="text-[1.55em] font-extrabold tracking-[0.12em]">{brand}</p>
            ) : null}
            {elements.logo ? (
              logoDataUrl ? (
                <img src={logoDataUrl} alt="" className="h-[2.2em] w-auto max-w-[4.5rem] object-contain" />
              ) : (
                <LedgerMark className="size-[1.85em] text-slate-900" />
              )
            ) : null}
          </div>
          {elements.storeInfo ? (
            <>
              {venueSub ? (
                <p className="mt-1 text-[0.68em] tracking-[0.38em] text-slate-500">
                  {venueSub.toUpperCase()}
                </p>
              ) : null}
              <div className="mt-2.5 text-[0.86em] leading-relaxed text-slate-600">
                {address ? <p>{address}</p> : null}
                <p>Tel: +383 44 123 456</p>
                {website ? <p>{website}</p> : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3.5" />}
      {copy.title ? (
        <p className={cn("text-[1.05em] font-extrabold tracking-[0.16em] text-slate-900", textAlign)}>
          {copy.title}
        </p>
      ) : null}
      <div className={cn("mt-2.5 flex", rowAlign)}>
        <span className="border-2 border-slate-900 px-3 py-1 text-[0.62em] font-extrabold tracking-[0.28em] text-slate-950">
          {DEBT_VOUCHER_BADGE}
        </span>
      </div>
      {meta.length > 0 ? (
        <>
          {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3.5" />}
          <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-left text-[0.9em] leading-relaxed text-slate-700">
            {meta.map((row) => (
              <div key={`${row.label}-${row.value}`} className={row.wide ? "col-span-2" : undefined}>
                <span className="text-slate-400">{row.label}: </span>
                {row.value}
              </div>
            ))}
          </div>
        </>
      ) : null}
      {elements.itemList ? (
        <>
          {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3.5" />}
          {content.itemsTitle.trim() ? (
            <p className={cn("mb-2.5 text-[0.68em] tracking-[0.2em] text-slate-400", textAlign)}>
              {content.itemsTitle.trim()}
            </p>
          ) : null}
          <table className="w-full border-separate border-spacing-y-1.5 text-left text-[0.9em] leading-relaxed text-slate-800">
            <thead>
              <tr className="text-[0.68em] tracking-[0.14em] text-slate-400">
                <th className="pb-2 pr-2 font-semibold">{content.colQty || "QTY"}</th>
                <th className="pb-2 pr-2 font-semibold">{content.colItem || "ITEM"}</th>
                {elements.unitPrices ? (
                  <th className="pb-2 pl-2 text-right font-semibold">{content.colPrice || "PRICE"}</th>
                ) : null}
                <th className="pb-2 pl-2 text-right font-semibold">{content.colLineTotal || "TOTAL"}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(([name, qty, unit, total]) => (
                <tr key={name}>
                  <td className="pr-2 align-top">{qty}</td>
                  <td className="pr-2 align-top">{name}</td>
                  {elements.unitPrices ? (
                    <td className="pl-2 text-right align-top tabular-nums">{money(unit)}</td>
                  ) : null}
                  <td className="pl-2 text-right align-top tabular-nums">{money(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3.5" />}
      {elements.totalDue ? (
        <div className="ml-auto w-[68%] space-y-1.5 text-left text-[0.9em] leading-relaxed text-slate-700">
          <div className="flex justify-between gap-4 pt-1 text-[1.15em] font-extrabold text-slate-950">
            <span>TOTAL DUE</span>
            <span className="tabular-nums">{money(due)}</span>
          </div>
        </div>
      ) : null}
      {elements.preliminaryNotice ? (
        <p className={cn("mt-4 text-[0.72em] font-extrabold tracking-[0.12em] text-slate-800", textAlign)}>
          {copy.legalText}
        </p>
      ) : null}
      {elements.thankYou ? (
        <p className={cn("mt-2 text-[0.92em] text-slate-600", textAlign)}>{copy.footerText}</p>
      ) : null}
      <div className="mt-4 flex items-center gap-2">
        <span className="h-px flex-1 bg-slate-900" />
        <LedgerMark className="size-[1.55em] text-slate-900" />
        <span className="h-px flex-1 bg-slate-900" />
      </div>
      {customLabels.motto.trim() ? (
        <p className={cn("mt-1.5 text-[0.62em] tracking-[0.24em] text-slate-400", textAlign)}>
          {customLabels.motto.trim()}
        </p>
      ) : null}
      <p className={cn("mt-2 text-[0.68em] text-slate-400", textAlign)}>{PRINT_POWERED_BY}</p>
    </ReceiptPaperShell>
  );
}

function KitchenTicketPreview({
  design,
  elements,
  customLabels,
  logoDataUrl,
}: {
  design: DesignSettings;
  elements: ReceiptElements;
  customLabels: CustomLabels;
  logoDataUrl?: string | null;
}) {
  const copy = resolveKitchenTicketCopy(customLabels);
  const items = [
    { name: "Grilled Chicken", qty: 2, notes: "Well done" },
    { name: "Pasta Carbonara", qty: 1, modifiers: "No onions" },
    { name: "Caesar Salad", qty: 1, modifiers: "Dressing: Caesar" },
  ];
  const fontFamily =
    design.font === "mono"
      ? 'ui-monospace, "Geist Mono", "Courier New", monospace'
      : "ui-sans-serif, system-ui, Helvetica, Arial, sans-serif";
  const align =
    design.align === "left" ? "left" : design.align === "right" ? "right" : "center";
  const textAlign =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  const rowAlign =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const dots = {
    style: design.dividerStyle,
    thickness: design.lineThickness,
    spacing: design.sectionSpacing,
  };
  const meta: Array<{ label: string; value: string }> = [];
  if (elements.orderNumber) meta.push({ label: "Order", value: "#10820" });
  if (elements.waiterName) meta.push({ label: "Waiter", value: "Arben" });
  if (elements.timestamp) {
    meta.push({ label: "Time", value: "13:41" });
    meta.push({ label: "Date", value: "17.10.2026" });
  }

  return (
    <ReceiptPaperShell
      bite="#f3faf4"
      size="preview"
      landscape={design.orientation === "landscape"}
      sheetStyle={{
        width: `${paperWidthRem(design)}rem`,
        fontFamily,
        fontSize: `${design.fontSize}px`,
        lineHeight: design.lineHeight,
        textAlign: align,
        transition: "width 200ms ease, font-size 200ms ease",
      }}
    >
      {elements.logo ? (
        <div className={cn("mb-2 flex", rowAlign)}>
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="" className="h-10 w-auto max-w-[5.5rem] object-contain" />
          ) : (
            <span className="grid size-[2.2em] place-items-center rounded-full border border-slate-200 text-[1em] font-bold text-slate-800">
              V
            </span>
          )}
        </div>
      ) : null}
      {copy.title ? (
        <p className={cn("text-[1.35em] font-extrabold tracking-[0.2em] text-slate-900", textAlign)}>
          {copy.title}
        </p>
      ) : null}
      {elements.tableNumber ? (
        <p className={cn("mt-1 text-[0.86em] font-extrabold tracking-[0.2em] text-slate-700", textAlign)}>
          TABLE 12
        </p>
      ) : null}
      {meta.length ? (
        <>
          {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.82em] text-slate-700">
            {meta.map((row) => (
              <div key={row.label} className="flex justify-between gap-2">
                <span className="text-slate-400">{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {elements.itemList ? (
        <>
          {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
          <div className="space-y-2.5">
            {items.map((item) => (
              <div key={item.name} className="flex items-start gap-2.5 text-slate-900">
                <span className="min-w-[1.1em] text-[1.35em] font-extrabold leading-none">
                  {item.qty}
                </span>
                <div className="min-w-0">
                  <p className="text-[1.02em] font-bold leading-tight">{item.name}</p>
                  {elements.itemModifiers && item.modifiers ? (
                    <p className="mt-0.5 text-[0.78em] font-medium text-slate-500">{item.modifiers}</p>
                  ) : null}
                  {elements.itemNotes && item.notes ? (
                    <p className="mt-0.5 text-[0.78em] font-medium text-slate-500">{item.notes}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <p className={cn("mt-4 text-[0.68em] text-slate-400", textAlign)}>{PRINT_POWERED_BY}</p>
    </ReceiptPaperShell>
  );
}

function BarTicketPreview({
  design,
  elements,
  customLabels,
  logoDataUrl,
}: {
  design: DesignSettings;
  elements: ReceiptElements;
  customLabels: CustomLabels;
  logoDataUrl?: string | null;
}) {
  const copy = resolveBarTicketCopy(customLabels);
  const items = [
    { name: "Espresso", qty: 2, notes: "No sugar" },
    { name: "Coca-Cola", qty: 3, modifiers: "No ice" },
    { name: "House Wine", qty: 1, modifiers: "Extra shot" },
  ];
  const fontFamily =
    design.font === "mono"
      ? 'ui-monospace, "Geist Mono", "Courier New", monospace'
      : "ui-sans-serif, system-ui, Helvetica, Arial, sans-serif";
  const align =
    design.align === "left" ? "left" : design.align === "right" ? "right" : "center";
  const textAlign =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  const rowAlign =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const dots = {
    style: design.dividerStyle,
    thickness: design.lineThickness,
    spacing: design.sectionSpacing,
  };
  const meta: Array<{ label: string; value: string }> = [];
  if (elements.orderNumber) meta.push({ label: "Order", value: "#10820" });
  if (elements.waiterName) meta.push({ label: "Waiter", value: "Arben" });
  if (elements.timestamp) {
    meta.push({ label: "Time", value: "13:41" });
    meta.push({ label: "Date", value: "17.10.2026" });
  }

  return (
    <ReceiptPaperShell
      bite="#eefbf8"
      size="preview"
      landscape={design.orientation === "landscape"}
      sheetStyle={{
        width: `${paperWidthRem(design)}rem`,
        fontFamily,
        fontSize: `${design.fontSize}px`,
        lineHeight: design.lineHeight,
        textAlign: align,
        transition: "width 200ms ease, font-size 200ms ease",
      }}
    >
      {elements.logo ? (
        <div className={cn("mb-2 flex", rowAlign)}>
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="" className="h-10 w-auto max-w-[5.5rem] object-contain" />
          ) : (
            <span className="grid size-[2.2em] place-items-center rounded-full border border-slate-200 text-[1em] font-bold text-slate-800">
              V
            </span>
          )}
        </div>
      ) : null}
      {copy.title ? (
        <p className={cn("text-[1.35em] font-extrabold tracking-[0.2em] text-slate-900", textAlign)}>
          {copy.title}
        </p>
      ) : null}
      {elements.tableNumber ? (
        <p className={cn("mt-1 text-[0.86em] font-extrabold tracking-[0.2em] text-slate-700", textAlign)}>
          TABLE 12
        </p>
      ) : null}
      {meta.length ? (
        <>
          {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.82em] text-slate-700">
            {meta.map((row) => (
              <div key={row.label} className="flex justify-between gap-2">
                <span className="text-slate-400">{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {elements.itemList ? (
        <>
          {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
          <div className="space-y-2.5">
            {items.map((item) => (
              <div key={item.name} className="flex items-start gap-2.5 text-slate-900">
                <span className="min-w-[1.1em] text-[1.35em] font-extrabold leading-none">
                  {item.qty}
                </span>
                <div className="min-w-0">
                  <p className="text-[1.02em] font-bold leading-tight">{item.name}</p>
                  {elements.itemModifiers && item.modifiers ? (
                    <p className="mt-0.5 text-[0.78em] font-medium text-slate-500">{item.modifiers}</p>
                  ) : null}
                  {elements.itemNotes && item.notes ? (
                    <p className="mt-0.5 text-[0.78em] font-medium text-slate-500">{item.notes}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <p className={cn("mt-4 text-[0.68em] text-slate-400", textAlign)}>{PRINT_POWERED_BY}</p>
    </ReceiptPaperShell>
  );
}

const SHIFT_PREVIEW_SAMPLE = {
  waiterName: "Arben",
  closedBy: "Admin",
  shiftRange: "10:00 – 18:00",
  printed: "17.10.2026 18:02",
  orders: 18,
  openingCash: 50,
  revenue: 420,
  paidCash: 210,
  paidCard: 180,
  paidDebt: 12,
  paidComplimentary: 18,
  vat: 70,
  expenses: 24,
  expenseNote: "Produce",
  damages: 16,
  handover: 220,
};

function WaiterShiftPreview({
  design,
  elements,
  customLabels,
  content,
  logoDataUrl,
}: {
  design: DesignSettings;
  elements: ReceiptElements;
  customLabels: CustomLabels;
  content: ContentSettings;
  logoDataUrl?: string | null;
}) {
  const header = customLabels.headerText.trim() || "SHIFT REPORT";
  const footer = customLabels.footerText.trim();
  const brand = (content.storeName.trim() || "VYNTEX").toUpperCase();
  const venue = content.venueName.trim() || "Enterprise Test Venue";
  const money = (n: number) => formatContentPrice(n, content);
  const fontFamily =
    design.font === "mono"
      ? 'ui-monospace, "Geist Mono", "Courier New", monospace'
      : "ui-sans-serif, system-ui, Helvetica, Arial, sans-serif";
  const align =
    design.align === "left" ? "left" : design.align === "right" ? "right" : "center";
  const textAlign =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  const rowAlign =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const dots = {
    style: design.dividerStyle,
    thickness: design.lineThickness,
    spacing: design.sectionSpacing,
  };
  const sample = SHIFT_PREVIEW_SAMPLE;
  const info: Array<{ label: string; value: string }> = [];
  if (elements.timestamp) info.push({ label: "Printed", value: sample.printed });
  if (elements.waiterName) info.push({ label: "Staff", value: sample.waiterName });
  if (elements.operator) info.push({ label: "Closed by", value: sample.closedBy });
  if (elements.timestamp) info.push({ label: "Shift", value: sample.shiftRange });
  info.push({ label: "Orders", value: String(sample.orders) });
  info.push({ label: "Opening cash", value: money(sample.openingCash) });

  return (
    <ReceiptPaperShell
      bite="#f4faf0"
      size="preview"
      landscape={design.orientation === "landscape"}
      sheetStyle={{
        width: `${paperWidthRem(design)}rem`,
        fontFamily,
        fontSize: `${design.fontSize}px`,
        lineHeight: design.lineHeight,
        textAlign: align,
        transition: "width 200ms ease, font-size 200ms ease",
      }}
    >
      {elements.logo ? (
        <div className={cn("mb-2 flex", rowAlign)}>
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="" className="h-10 w-auto max-w-[5.5rem] object-contain" />
          ) : (
            <span className="grid size-[2.2em] place-items-center rounded-full border border-slate-200 text-[1em] font-bold text-slate-800">
              V
            </span>
          )}
        </div>
      ) : null}
      <p className={cn("text-[1.05em] font-extrabold tracking-[0.16em] text-slate-900", textAlign)}>
        {header}
      </p>
      {elements.storeInfo ? (
        <>
          <p className={cn("mt-1 text-[0.72em] tracking-[0.18em] text-slate-400", textAlign)}>{brand}</p>
          <p className={cn("text-[0.78em] text-slate-500", textAlign)}>{venue}</p>
        </>
      ) : null}
      {info.length ? (
        <>
          {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
          <div className="space-y-1 text-[0.82em] text-slate-700">
            {info.map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <span className="text-slate-400">{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
      <p className={cn("mb-2 text-[0.68em] font-extrabold tracking-[0.16em] text-slate-400", textAlign)}>
        REVENUE
      </p>
      <div className="space-y-1 text-[0.82em] text-slate-700">
        <div className="flex justify-between gap-3">
          <span>Gross sales</span>
          <span className="tabular-nums">{money(sample.revenue)}</span>
        </div>
        {elements.paymentMethod ? (
          <>
            <div className="flex justify-between gap-3 text-slate-500">
              <span>Cash</span>
              <span className="tabular-nums">{money(sample.paidCash)}</span>
            </div>
            <div className="flex justify-between gap-3 text-slate-500">
              <span>Card</span>
              <span className="tabular-nums">{money(sample.paidCard)}</span>
            </div>
            <div className="flex justify-between gap-3 text-slate-500">
              <span>Debt</span>
              <span className="tabular-nums">{money(sample.paidDebt)}</span>
            </div>
            <div className="flex justify-between gap-3 text-slate-500">
              <span>Comp</span>
              <span className="tabular-nums">{money(sample.paidComplimentary)}</span>
            </div>
          </>
        ) : null}
        {elements.taxSummary ? (
          <div className="flex justify-between gap-3 text-slate-500">
            <span>VAT (20%)</span>
            <span className="tabular-nums">{money(sample.vat)}</span>
          </div>
        ) : null}
      </div>
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
      <p className={cn("mb-2 text-[0.68em] font-extrabold tracking-[0.16em] text-slate-400", textAlign)}>
        DEDUCTIONS
      </p>
      <div className="space-y-1 text-[0.82em] text-slate-700">
        <div className="flex justify-between gap-3 text-slate-500">
          <span>{sample.expenseNote}</span>
          <span className="tabular-nums">−{money(sample.expenses)}</span>
        </div>
        <div className="flex justify-between gap-3 text-slate-500">
          <span>Damages / staff</span>
          <span className="tabular-nums">−{money(sample.damages)}</span>
        </div>
      </div>
      {elements.totalDue ? (
        <>
          {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
          <p className={cn("text-[0.68em] font-extrabold tracking-[0.16em] text-slate-400", textAlign)}>
            TOTAL TO HAND OVER
          </p>
          <p className={cn("mt-1 text-[1.35em] font-extrabold tabular-nums text-slate-950", textAlign)}>
            {money(sample.handover)}
          </p>
        </>
      ) : null}
      {footer ? (
        <p className={cn("mt-3 text-[0.82em] text-slate-500", textAlign)}>{footer}</p>
      ) : null}
      <p className={cn("mt-3 text-[0.68em] text-slate-400", textAlign)}>{PRINT_POWERED_BY}</p>
    </ReceiptPaperShell>
  );
}

const X_PREVIEW_SAMPLE = {
  printed: "17.10.2026 14:10",
  orders: 42,
  revenue: 890,
  paidCash: 400,
  paidCard: 490,
  paidDebt: 0,
  paidComplimentary: 0,
  vat: 148.33,
};

function XReportPreview({
  design,
  elements,
  customLabels,
  content,
  logoDataUrl,
}: {
  design: DesignSettings;
  elements: ReceiptElements;
  customLabels: CustomLabels;
  content: ContentSettings;
  logoDataUrl?: string | null;
}) {
  const copy = resolveXReportCopy(customLabels);
  const brand = (content.storeName.trim() || "VYNTEX").toUpperCase();
  const venue = content.venueName.trim() || "Enterprise Test Venue";
  const money = (n: number) => formatContentPrice(n, content);
  const fontFamily =
    design.font === "mono"
      ? 'ui-monospace, "Geist Mono", "Courier New", monospace'
      : "ui-sans-serif, system-ui, Helvetica, Arial, sans-serif";
  const align =
    design.align === "left" ? "left" : design.align === "right" ? "right" : "center";
  const textAlign =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  const rowAlign =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const dots = {
    style: design.dividerStyle,
    thickness: design.lineThickness,
    spacing: design.sectionSpacing,
  };
  const sample = X_PREVIEW_SAMPLE;

  return (
    <ReceiptPaperShell
      bite="#eef8f3"
      size="preview"
      landscape={design.orientation === "landscape"}
      sheetStyle={{
        width: `${paperWidthRem(design)}rem`,
        fontFamily,
        fontSize: `${design.fontSize}px`,
        lineHeight: design.lineHeight,
        textAlign: align,
        transition: "width 200ms ease, font-size 200ms ease",
      }}
    >
      {elements.logo ? (
        <div className={cn("mb-2 flex", rowAlign)}>
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="" className="h-10 w-auto max-w-[5.5rem] object-contain" />
          ) : (
            <span className="grid size-[2.2em] place-items-center rounded-full border border-slate-200 text-[1em] font-bold text-slate-800">
              V
            </span>
          )}
        </div>
      ) : null}
      <p className={cn("text-[1.15em] font-extrabold tracking-[0.16em] text-slate-900", textAlign)}>
        {copy.title}
      </p>
      <p className={cn("mt-1 text-[0.72em] font-extrabold tracking-[0.18em] text-slate-400", textAlign)}>
        MID-DAY
      </p>
      {elements.storeInfo ? (
        <>
          <p className={cn("mt-2 text-[0.72em] tracking-[0.18em] text-slate-400", textAlign)}>{brand}</p>
          <p className={cn("text-[0.78em] text-slate-500", textAlign)}>{venue}</p>
        </>
      ) : null}
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
      <div className="space-y-1 text-[0.82em] text-slate-700">
        {elements.timestamp ? (
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Printed</span>
            <span>{sample.printed}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Orders</span>
          <span>{sample.orders}</span>
        </div>
      </div>
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
      <div className="space-y-1 text-[0.82em] text-slate-700">
        <div className="flex justify-between gap-3">
          <span>Gross sales</span>
          <span className="tabular-nums">{money(sample.revenue)}</span>
        </div>
        {elements.paymentMethod ? (
          <>
            <div className="flex justify-between gap-3 text-slate-500">
              <span>Cash</span>
              <span className="tabular-nums">{money(sample.paidCash)}</span>
            </div>
            <div className="flex justify-between gap-3 text-slate-500">
              <span>Card</span>
              <span className="tabular-nums">{money(sample.paidCard)}</span>
            </div>
          </>
        ) : null}
        {elements.taxSummary ? (
          <div className="flex justify-between gap-3 text-slate-500">
            <span>VAT (20%)</span>
            <span className="tabular-nums">{money(sample.vat)}</span>
          </div>
        ) : null}
      </div>
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
      <p className={cn("text-[0.72em] font-extrabold tracking-[0.14em] text-slate-700", textAlign)}>
        {X_REPORT_NOTICE}
      </p>
      <p className={cn("mt-3 text-[0.68em] text-slate-400", textAlign)}>{PRINT_POWERED_BY}</p>
    </ReceiptPaperShell>
  );
}

const Z_PREVIEW_SAMPLE = {
  zNumber: "Z-014",
  printed: "17.10.2026 22:05",
  closedBy: "Admin",
  orders: 58,
  revenue: 1240,
  paidCash: 680,
  paidCard: 560,
  paidDebt: 0,
  paidComplimentary: 0,
  vat: 206.67,
  openingCash: 50,
  deductions: 110,
  handover: 620,
};

function ZReportPreview({
  design,
  elements,
  customLabels,
  content,
  logoDataUrl,
}: {
  design: DesignSettings;
  elements: ReceiptElements;
  customLabels: CustomLabels;
  content: ContentSettings;
  logoDataUrl?: string | null;
}) {
  const copy = resolveZReportCopy(customLabels);
  const brand = (content.storeName.trim() || "VYNTEX").toUpperCase();
  const venue = content.venueName.trim() || "Enterprise Test Venue";
  const money = (n: number) => formatContentPrice(n, content);
  const fontFamily =
    design.font === "mono"
      ? 'ui-monospace, "Geist Mono", "Courier New", monospace'
      : "ui-sans-serif, system-ui, Helvetica, Arial, sans-serif";
  const align =
    design.align === "left" ? "left" : design.align === "right" ? "right" : "center";
  const textAlign =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  const rowAlign =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const dots = {
    style: design.dividerStyle,
    thickness: design.lineThickness,
    spacing: design.sectionSpacing,
  };
  const sample = Z_PREVIEW_SAMPLE;

  return (
    <ReceiptPaperShell
      bite="#eaf6ef"
      size="preview"
      landscape={design.orientation === "landscape"}
      sheetStyle={{
        width: `${paperWidthRem(design)}rem`,
        fontFamily,
        fontSize: `${design.fontSize}px`,
        lineHeight: design.lineHeight,
        textAlign: align,
        transition: "width 200ms ease, font-size 200ms ease",
      }}
    >
      {elements.logo ? (
        <div className={cn("mb-2 flex", rowAlign)}>
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="" className="h-10 w-auto max-w-[5.5rem] object-contain" />
          ) : (
            <span className="grid size-[2.2em] place-items-center rounded-full border border-slate-200 text-[1em] font-bold text-slate-800">
              V
            </span>
          )}
        </div>
      ) : null}
      <p className={cn("text-[1.15em] font-extrabold tracking-[0.16em] text-slate-900", textAlign)}>
        {copy.title}
      </p>
      <p className={cn("mt-1 text-[0.72em] font-extrabold tracking-[0.18em] text-slate-400", textAlign)}>
        {Z_REPORT_SUBTITLE}
      </p>
      {elements.storeInfo ? (
        <>
          <p className={cn("mt-2 text-[0.72em] tracking-[0.18em] text-slate-400", textAlign)}>{brand}</p>
          <p className={cn("text-[0.78em] text-slate-500", textAlign)}>{venue}</p>
        </>
      ) : null}
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
      <div className="space-y-1 text-[0.82em] text-slate-700">
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Z number</span>
          <span>{sample.zNumber}</span>
        </div>
        {elements.timestamp ? (
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Printed</span>
            <span>{sample.printed}</span>
          </div>
        ) : null}
        {elements.operator ? (
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Closed by</span>
            <span>{sample.closedBy}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Orders</span>
          <span>{sample.orders}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Opening cash</span>
          <span className="tabular-nums">{money(sample.openingCash)}</span>
        </div>
      </div>
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
      <div className="space-y-1 text-[0.82em] text-slate-700">
        <div className="flex justify-between gap-3">
          <span>Gross sales</span>
          <span className="tabular-nums">{money(sample.revenue)}</span>
        </div>
        {elements.paymentMethod ? (
          <>
            <div className="flex justify-between gap-3 text-slate-500">
              <span>Cash</span>
              <span className="tabular-nums">{money(sample.paidCash)}</span>
            </div>
            <div className="flex justify-between gap-3 text-slate-500">
              <span>Card</span>
              <span className="tabular-nums">{money(sample.paidCard)}</span>
            </div>
          </>
        ) : null}
        {elements.taxSummary ? (
          <div className="flex justify-between gap-3 text-slate-500">
            <span>VAT (20%)</span>
            <span className="tabular-nums">{money(sample.vat)}</span>
          </div>
        ) : null}
      </div>
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
      <div className="flex justify-between gap-3 text-[0.82em] text-slate-500">
        <span>Deductions</span>
        <span className="tabular-nums">{money(sample.deductions)}</span>
      </div>
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
      <p className={cn("text-[0.68em] font-extrabold tracking-[0.16em] text-slate-400", textAlign)}>
        HANDOVER
      </p>
      <p className={cn("mt-1 text-[1.35em] font-extrabold tabular-nums text-slate-950", textAlign)}>
        {money(sample.handover)}
      </p>
      {copy.footer ? (
        <p className={cn("mt-3 text-[0.82em] text-slate-500", textAlign)}>{copy.footer}</p>
      ) : null}
      <p className={cn("mt-3 text-[0.68em] text-slate-400", textAlign)}>{PRINT_POWERED_BY}</p>
    </ReceiptPaperShell>
  );
}

const EXPENSE_PREVIEW_SAMPLE = {
  staffName: "Arben",
  approvedBy: "Admin",
  printed: "17.10.2026 14:10",
  lines: [
    { note: "Produce", amount: 24 },
    { note: "Cleaning", amount: 12 },
  ],
};

function ExpenseVoucherPreview({
  design,
  elements,
  customLabels,
  content,
  logoDataUrl,
}: {
  design: DesignSettings;
  elements: ReceiptElements;
  customLabels: CustomLabels;
  content: ContentSettings;
  logoDataUrl?: string | null;
}) {
  const copy = resolveExpenseVoucherCopy(customLabels);
  const brand = (content.storeName.trim() || "VYNTEX").toUpperCase();
  const venue = content.venueName.trim() || "Enterprise Test Venue";
  const money = (n: number) => formatContentPrice(n, content);
  const fontFamily =
    design.font === "mono"
      ? 'ui-monospace, "Geist Mono", "Courier New", monospace'
      : "ui-sans-serif, system-ui, Helvetica, Arial, sans-serif";
  const align =
    design.align === "left" ? "left" : design.align === "right" ? "right" : "center";
  const textAlign =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  const rowAlign =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const dots = {
    style: design.dividerStyle,
    thickness: design.lineThickness,
    spacing: design.sectionSpacing,
  };
  const sample = EXPENSE_PREVIEW_SAMPLE;
  const total = sample.lines.reduce((sum, line) => sum + line.amount, 0);

  return (
    <ReceiptPaperShell
      bite="#f2f7ee"
      size="preview"
      landscape={design.orientation === "landscape"}
      sheetStyle={{
        width: `${paperWidthRem(design)}rem`,
        fontFamily,
        fontSize: `${design.fontSize}px`,
        lineHeight: design.lineHeight,
        textAlign: align,
        transition: "width 200ms ease, font-size 200ms ease",
      }}
    >
      {elements.logo ? (
        <div className={cn("mb-2 flex", rowAlign)}>
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="" className="h-10 w-auto max-w-[5.5rem] object-contain" />
          ) : (
            <span className="grid size-[2.2em] place-items-center rounded-full border border-slate-200 text-[1em] font-bold text-slate-800">
              V
            </span>
          )}
        </div>
      ) : null}
      <p className={cn("text-[1.15em] font-extrabold tracking-[0.16em] text-slate-900", textAlign)}>
        {copy.title}
      </p>
      <p className={cn("mt-1 text-[0.72em] font-extrabold tracking-[0.18em] text-slate-400", textAlign)}>
        {EXPENSE_VOUCHER_SUBTITLE}
      </p>
      {elements.storeInfo ? (
        <>
          <p className={cn("mt-2 text-[0.72em] tracking-[0.18em] text-slate-400", textAlign)}>{brand}</p>
          <p className={cn("text-[0.78em] text-slate-500", textAlign)}>{venue}</p>
        </>
      ) : null}
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
      <div className="space-y-1 text-[0.82em] text-slate-700">
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Staff</span>
          <span>{sample.staffName}</span>
        </div>
        {elements.timestamp ? (
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Printed</span>
            <span>{sample.printed}</span>
          </div>
        ) : null}
        {elements.operator ? (
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Approved by</span>
            <span>{sample.approvedBy}</span>
          </div>
        ) : null}
      </div>
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
      <div className="space-y-1 text-[0.82em] text-slate-700">
        {sample.lines.map((line) => (
          <div key={line.note} className="flex justify-between gap-3">
            <span>{line.note}</span>
            <span className="tabular-nums">{money(line.amount)}</span>
          </div>
        ))}
      </div>
      {elements.divider ? <ReceiptDots {...dots} /> : <div className="h-3" />}
      <p className={cn("text-[0.68em] font-extrabold tracking-[0.16em] text-slate-400", textAlign)}>
        TOTAL
      </p>
      <p className={cn("mt-1 text-[1.35em] font-extrabold tabular-nums text-slate-950", textAlign)}>
        {money(total)}
      </p>
      {copy.footer ? (
        <p className={cn("mt-3 text-[0.82em] text-slate-500", textAlign)}>{copy.footer}</p>
      ) : null}
      <p className={cn("mt-3 text-[0.68em] text-slate-400", textAlign)}>{PRINT_POWERED_BY}</p>
    </ReceiptPaperShell>
  );
}

function CustomizerReceiptPreview({
  type,
  data,
  design,
  elements,
  customLabels,
  content,
  logoDataUrl,
}: {
  type: TemplateTypeId;
  data: TemplateRecord | undefined;
  design?: DesignSettings;
  elements?: ReceiptElements;
  customLabels?: CustomLabels;
  content?: ContentSettings;
  logoDataUrl?: string | null;
}) {
  const vis = elements ?? DEFAULT_ELEMENTS;
  const custom = customLabels ?? DEFAULT_CUSTOM_LABELS;
  const copy = content ?? DEFAULT_CONTENT;
  const header = custom.headerText.trim();
  const footer = custom.footerText.trim() || "Thank you for your visit!";
  const address = custom.address.trim();
  const website = custom.website.trim();
  const now = formatContentStamp(copy);
  const money = (n: number) => formatContentPrice(n, copy);
  const storeName = copy.storeName.trim() || DEFAULT_CONTENT.storeName;
  const venueName = copy.venueName.trim() || DEFAULT_CONTENT.venueName;
  const itemsTitle = copy.itemsTitle.trim() || DEFAULT_CONTENT.itemsTitle;
  const d = design ?? DEFAULT_DESIGN;
  const align =
    d.align === "left" ? "left" : d.align === "right" ? "right" : "center";
  const headerAlign =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  const logoAlign =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const lineGap =
    d.lineHeight <= 1.05 ? "space-y-0" : d.lineHeight >= 1.5 ? "space-y-2" : "space-y-1";
  const qr =
    d.qrSize === "small"
      ? "h-6 w-16"
      : d.qrSize === "large"
        ? "h-11 w-40"
        : "h-8 w-[7.5rem]";
  const qrOpacity = d.qrEcc === "L" ? "opacity-55" : d.qrEcc === "H" ? "opacity-95" : "opacity-80";
  const fontFamily =
    d.font === "sans"
      ? 'ui-sans-serif, system-ui, sans-serif'
      : 'ui-monospace, "Geist Mono", "Courier New", monospace';
  const dots = {
    style: d.dividerStyle,
    thickness: d.lineThickness,
    spacing: d.sectionSpacing,
  };

  if (type === "non_fiscal_receipt") {
    return (
      <PreBillPreview
        design={d}
        elements={vis}
        customLabels={custom}
        content={copy}
        logoDataUrl={logoDataUrl}
      />
    );
  }

  if (type === "complimentary_slip") {
    return (
      <ComplimentarySlipPreview
        design={d}
        elements={vis}
        customLabels={custom}
        content={copy}
        logoDataUrl={logoDataUrl}
      />
    );
  }

  if (type === "debt_voucher") {
    return (
      <DebtVoucherPreview
        design={d}
        elements={vis}
        customLabels={custom}
        content={copy}
        logoDataUrl={logoDataUrl}
      />
    );
  }

  if (type === "kitchen_ticket") {
    return (
      <KitchenTicketPreview
        design={d}
        elements={vis}
        customLabels={custom}
        logoDataUrl={logoDataUrl}
      />
    );
  }

  if (type === "bar_ticket") {
    return (
      <BarTicketPreview
        design={d}
        elements={vis}
        customLabels={custom}
        logoDataUrl={logoDataUrl}
      />
    );
  }

  if (type === "waiter_shift_report") {
    return (
      <WaiterShiftPreview
        design={d}
        elements={vis}
        customLabels={custom}
        content={copy}
        logoDataUrl={logoDataUrl}
      />
    );
  }

  if (type === "x_report") {
    return (
      <XReportPreview
        design={d}
        elements={vis}
        customLabels={custom}
        content={copy}
        logoDataUrl={logoDataUrl}
      />
    );
  }

  if (type === "z_report") {
    return (
      <ZReportPreview
        design={d}
        elements={vis}
        customLabels={custom}
        content={copy}
        logoDataUrl={logoDataUrl}
      />
    );
  }

  if (type === "expense_voucher") {
    return (
      <ExpenseVoucherPreview
        design={d}
        elements={vis}
        customLabels={custom}
        content={copy}
        logoDataUrl={logoDataUrl}
      />
    );
  }

  if (type !== "fiscal_receipt") {
    return (
      <ReceiptPaperMock
        type={type}
        size="preview"
        landscape={d.orientation === "landscape"}
        sheetStyle={{
          width: `${paperWidthRem(d)}rem`,
          fontFamily,
          fontSize: `${d.fontSize}px`,
          lineHeight: d.lineHeight,
          transition: "width 200ms ease, font-size 200ms ease",
        }}
      />
    );
  }

  return (
    <ReceiptPaperShell
      bite="#eef4ff"
      size="preview"
      landscape={d.orientation === "landscape"}
      sheetStyle={{
        width: `${paperWidthRem(d)}rem`,
        fontFamily,
        fontSize: `${d.fontSize}px`,
        lineHeight: d.lineHeight,
        transition: "width 200ms ease, font-size 200ms ease",
      }}
    >
      {vis.logo ? (
        <div className={cn("flex", logoAlign)}>
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="" className="h-10 w-auto max-w-[5.5rem] object-contain" />
          ) : (
            <span className="grid size-[2.4em] place-items-center rounded-full border border-slate-200 text-[1.08em] font-bold text-slate-800">
              V
            </span>
          )}
        </div>
      ) : null}
      {header ? (
        <p className={cn("mt-2 text-[0.92em] font-bold tracking-[0.14em] text-slate-800", headerAlign)}>
          {header.split("\n")[0]}
        </p>
      ) : null}
      {vis.storeInfo ? (
        <>
          <p className={cn("mt-2 text-[0.83em] uppercase tracking-[0.18em] text-slate-500", headerAlign)}>
            {storeName}
          </p>
          <p className={cn("text-[0.83em] text-slate-400", headerAlign)}>{venueName}</p>
        </>
      ) : null}
      {address ? (
        <p className={cn("text-[0.83em] text-slate-400", headerAlign)}>{address}</p>
      ) : null}
      {vis.divider ? <ReceiptDots {...dots} /> : null}
      {vis.timestamp || vis.fiscalNumber || vis.operator || vis.waiterName || vis.tableNumber ? (
        <div className={cn("text-[0.83em] text-slate-600", lineGap)}>
          {vis.timestamp ? (
            <div className="flex justify-between"><span>{copy.dateLabel || DEFAULT_CONTENT.dateLabel}</span><span>{now}</span></div>
          ) : null}
          {vis.fiscalNumber ? (
            <div className="flex justify-between"><span>{copy.fiscalLabel || DEFAULT_CONTENT.fiscalLabel}</span><span>0042</span></div>
          ) : null}
          {vis.operator ? (
            <div className="flex justify-between"><span>{copy.operatorLabel || DEFAULT_CONTENT.operatorLabel}</span><span>Admin</span></div>
          ) : null}
          {vis.waiterName ? (
            <div className="flex justify-between"><span>{copy.waiterLabel || DEFAULT_CONTENT.waiterLabel}</span><span>John D.</span></div>
          ) : null}
          {vis.tableNumber ? (
            <div className="flex justify-between"><span>{copy.tableLabel || DEFAULT_CONTENT.tableLabel}</span><span>T-05</span></div>
          ) : null}
        </div>
      ) : null}
      {vis.itemList ? (
        <>
          {vis.divider ? <ReceiptDots {...dots} /> : null}
          <p className={cn("mb-1.5 text-[0.75em] tracking-[0.2em] text-slate-400", headerAlign)}>
            {itemsTitle}
          </p>
          <div className={cn("text-[0.92em] text-slate-800", lineGap)}>
            {(
              [
                ["Espresso", 2, 3.5, 7],
                ["Caesar Salad", 1, 12, 12],
                ["Sparkling Water", 3, 2.5, 7.5],
                ["Pasta Carbonara", 1, 14, 14],
              ] as const
            ).map(([name, qty, unit, total]) => (
              <div key={name} className="flex justify-between gap-2">
                <span>{copy.showQtyPrefix ? `${qty}x ${name}` : name}</span>
                <span className="shrink-0 tabular-nums">
                  {copy.showUnitPrices ? `${money(unit)} · ${money(total)}` : money(total)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {vis.divider ? <ReceiptDots {...dots} /> : null}
      {vis.taxSummary ? (
        <>
          <div className="flex justify-between text-[0.83em] text-slate-500">
            <span>{copy.subtotalLabel || DEFAULT_CONTENT.subtotalLabel}</span>
            <span className="tabular-nums">{money(33.75)}</span>
          </div>
          <div className="flex justify-between text-[0.83em] text-slate-500">
            <span>{copy.taxLabel || DEFAULT_CONTENT.taxLabel}</span>
            <span className="tabular-nums">{money(6.75)}</span>
          </div>
        </>
      ) : null}
      {vis.discount ? (
        <div className="flex justify-between text-[0.83em] text-slate-500">
          <span>Discount(10%)</span>
          <span className="tabular-nums">-{money(4.05)}</span>
        </div>
      ) : null}
      <div className="mt-1 flex justify-between text-[1.08em] font-bold text-slate-900">
        <span>{copy.totalLabel || DEFAULT_CONTENT.totalLabel}</span>
        <span className="tabular-nums">{money(vis.discount ? 36.45 : 40.5)}</span>
      </div>
      {vis.paymentMethod ? (
        <div className="flex justify-between text-[0.83em] text-slate-500">
          <span>{copy.paymentLabel || DEFAULT_CONTENT.paymentLabel}</span>
          <span>Cash</span>
        </div>
      ) : null}
      {vis.thankYou ? (
        <>
          {vis.divider ? <ReceiptDots {...dots} /> : null}
          <p className={cn("text-[0.83em] text-slate-500", headerAlign)}>{footer}</p>
        </>
      ) : null}
      {website ? (
        <p className={cn("mt-1 text-[0.75em] text-slate-400", headerAlign)}>{website}</p>
      ) : null}
      {custom.motto.trim() ? (
        <p className={cn("mt-1.5 text-[0.62em] tracking-[0.24em] text-slate-400", headerAlign)}>
          {custom.motto.trim()}
        </p>
      ) : null}
      <p className={cn("mt-2 text-[0.72em] text-slate-400", headerAlign)}>{PRINT_POWERED_BY}</p>
      {vis.qrCode ? (
        <div
          className={cn(
            "mt-2.5 bg-[repeating-linear-gradient(90deg,#111827_0_2px,transparent_2px_4px)]",
            qr,
            qrOpacity,
            align === "left" ? "mr-auto" : align === "right" ? "ml-auto" : "mx-auto",
          )}
        />
      ) : null}
    </ReceiptPaperShell>
  );
}

function ReceiptPaperMock({
  type,
  size = "compact",
  landscape = false,
  sheetStyle,
}: {
  type: TemplateTypeId;
  size?: "compact" | "preview";
  landscape?: boolean;
  sheetStyle?: CSSProperties;
}) {
  const large = size === "preview";
  const title = large ? "text-[0.95em] font-bold tracking-[0.18em]" : "text-[10px] font-bold tracking-[0.22em]";
  const sub = large ? "text-[0.83em]" : "text-[8px]";
  const body = large ? "text-[0.92em]" : "text-[8px]";
  const total = large ? "text-[1.08em] font-bold" : "text-[9px] font-bold";
  const gap = large ? "mt-2 space-y-1" : "mt-1 space-y-0.5";

  if (type === "fiscal_receipt") {
    return (
      <ReceiptPaperShell bite="#eef4ff" size={size} landscape={landscape} sheetStyle={sheetStyle}>
        <div className="flex justify-center">
          <span className="grid size-[2.2em] place-items-center rounded-full border border-slate-200 text-[1em] font-bold text-slate-800">
            V
          </span>
        </div>
        <p className={cn("mt-1.5 text-center uppercase tracking-[0.16em] text-slate-500", sub)}>
          Vyntex POS
        </p>
        <p className={cn("text-center text-slate-400", sub)}>Enterprise Test Venue</p>
        <ReceiptDots />
        <p className={cn("text-slate-500", sub)}>Table 12 · 2 guests</p>
        <div className={cn("text-slate-700", gap, body)}>
          <div className="flex justify-between"><span>2x Espresso</span><span>12.00</span></div>
          <div className="flex justify-between"><span>1x Water</span><span>2.00</span></div>
        </div>
        <ReceiptDots />
        <div className={cn("flex justify-between text-slate-900", total)}>
          <span>TOTAL</span><span>26.00</span>
        </div>
        <p className={cn("mt-1.5 text-center uppercase tracking-widest text-slate-400", sub)}>
          Fiscal receipt
        </p>
        <p className={cn("mt-2 text-center text-slate-400", sub)}>{PRINT_POWERED_BY}</p>
        <div className="mx-auto mt-2 size-8 bg-[repeating-linear-gradient(90deg,#111827_0_2px,transparent_2px_4px),repeating-linear-gradient(0deg,#111827_0_2px,transparent_2px_4px)] opacity-80" />
      </ReceiptPaperShell>
    );
  }
  if (type === "non_fiscal_receipt") {
    return (
      <ReceiptPaperShell bite="#f7f4ef" size={size} landscape={landscape} sheetStyle={sheetStyle}>
        <div className="flex items-center justify-center gap-1.5 text-slate-900">
          <p className={cn("font-extrabold tracking-[0.12em]", large ? "text-[1.2em]" : "text-[11px]")}>
            VYNTEX
          </p>
          <CutleryMark className={large ? "size-6" : "size-4"} />
        </div>
        <p className={cn("mt-0.5 text-center tracking-[0.32em] text-slate-400", sub)}>
          RESTAURANT
        </p>
        <ReceiptDots />
        <p className={cn("text-center text-slate-800", title)}>PRE-BILL</p>
        <p className={cn("mt-0.5 text-center tracking-[0.12em] text-slate-400", sub)}>
          PRELIMINARY BILL — NOT A FISCAL RECEIPT
        </p>
        <ReceiptDots />
        <p className={cn("text-slate-500", sub)}>Table 12 · Order #10288</p>
        <div className={cn("text-slate-700", gap, body)}>
          <div className="flex justify-between"><span>2 Caesar Salad</span><span>11.00</span></div>
          <div className="flex justify-between"><span>1 Margherita Pizza</span><span>7.90</span></div>
          {large ? (
            <>
              <div className="flex justify-between"><span>1 Grilled Chicken</span><span>8.50</span></div>
              <div className="flex justify-between"><span>3 Coca-Cola 0.33L</span><span>6.60</span></div>
              <div className="flex justify-between"><span>1 Espresso</span><span>1.50</span></div>
            </>
          ) : null}
        </div>
        <ReceiptDots />
        <div className={cn("flex justify-between text-slate-900", total)}>
          <span>TOTAL</span><span>{large ? "31.95" : "18.90"}</span>
        </div>
        <p className={cn("mt-2 text-center text-slate-400", sub)}>{PRINT_POWERED_BY}</p>
      </ReceiptPaperShell>
    );
  }
  if (type === "complimentary_slip") {
    return (
      <ReceiptPaperShell bite="#fff6ec" size={size} landscape={landscape} sheetStyle={sheetStyle}>
        <div className="flex items-center justify-center gap-1.5 text-slate-900">
          <p className={cn("font-extrabold tracking-[0.12em]", large ? "text-[1.2em]" : "text-[11px]")}>
            VYNTEX
          </p>
          <GiftMark className={large ? "size-6" : "size-4"} />
        </div>
        <p className={cn("mt-0.5 text-center tracking-[0.32em] text-slate-400", sub)}>
          RESTAURANT
        </p>
        <ReceiptDots />
        <p className={cn("text-center text-slate-800", title)}>WITH COMPLIMENTS</p>
        <div className="mt-1.5 flex justify-center">
          <span className={cn(
            "border-2 border-slate-900 font-extrabold tracking-[0.22em] text-slate-950",
            large ? "px-2.5 py-0.5 text-[0.62em]" : "px-1.5 py-px text-[7px]",
          )}>
            ON THE HOUSE
          </span>
        </div>
        <ReceiptDots />
        <p className={cn("text-slate-500", sub)}>Table 8 · Arben</p>
        <div className={cn("text-slate-700", gap, body)}>
          <div className="flex justify-between"><span>1 Tiramisu</span></div>
          <div className="flex justify-between"><span>2 Espresso</span></div>
          {large ? <div className="flex justify-between"><span>1 House Wine</span></div> : null}
        </div>
        <ReceiptDots />
        <div className={cn("flex justify-between text-slate-900", total)}>
          <span>TOTAL</span><span>0.00</span>
        </div>
        <p className={cn("mt-2 text-center tracking-[0.1em] text-slate-500", sub)}>
          COMPLIMENTARY — NOT A SALE
        </p>
        <p className={cn("mt-1.5 text-center text-slate-400", sub)}>Enjoy your treat</p>
        <p className={cn("mt-2 text-center text-slate-400", sub)}>{PRINT_POWERED_BY}</p>
      </ReceiptPaperShell>
    );
  }
  if (type === "kitchen_ticket") {
    return (
      <ReceiptPaperShell bite="#f3faf4" size={size} landscape={landscape} sheetStyle={sheetStyle}>
        <p className={cn("text-center text-slate-800", title)}>KITCHEN</p>
        <p className={cn("mt-0.5 text-center tracking-[0.18em] text-slate-400", sub)}>TABLE 12</p>
        <ReceiptDots />
        <p className={cn("text-slate-500", sub)}>#10820 · Arben</p>
        <div className={cn("text-slate-800", gap, body)}>
          <div>
            <span className="font-bold">2</span> Grilled Chicken
            {large ? <p className="pl-3 text-slate-400">Well done</p> : null}
          </div>
          <div>
            <span className="font-bold">1</span> Pasta Carbonara
            {large ? <p className="pl-3 text-slate-400">No onions</p> : null}
          </div>
          {large ? (
            <div>
              <span className="font-bold">1</span> Caesar Salad
              <p className="pl-3 text-slate-400">Dressing: Caesar</p>
            </div>
          ) : null}
        </div>
        <ReceiptDots />
        <p className={cn("text-center tracking-[0.14em] text-slate-500", sub)}>
          {large ? "3 ITEMS" : "2 ITEMS"}
        </p>
        <p className={cn("mt-2 text-center text-slate-400", sub)}>{PRINT_POWERED_BY}</p>
      </ReceiptPaperShell>
    );
  }
  if (type === "bar_ticket") {
    return (
      <ReceiptPaperShell bite="#eefbf8" size={size} landscape={landscape} sheetStyle={sheetStyle}>
        <p className={cn("text-center text-slate-800", title)}>BAR</p>
        <p className={cn("mt-0.5 text-center tracking-[0.18em] text-slate-400", sub)}>TABLE 12</p>
        <ReceiptDots />
        <p className={cn("text-slate-500", sub)}>#10820 · Arben</p>
        <div className={cn("text-slate-800", gap, body)}>
          <div>
            <span className="font-bold">2</span> Espresso
            {large ? <p className="pl-3 text-slate-400">No sugar</p> : null}
          </div>
          <div>
            <span className="font-bold">3</span> Coca-Cola
            {large ? <p className="pl-3 text-slate-400">No ice</p> : null}
          </div>
          {large ? (
            <div>
              <span className="font-bold">1</span> House Wine
              <p className="pl-3 text-slate-400">Extra shot</p>
            </div>
          ) : null}
        </div>
        <p className={cn("mt-2 text-center text-slate-400", sub)}>{PRINT_POWERED_BY}</p>
      </ReceiptPaperShell>
    );
  }
  if (type === "waiter_shift_report") {
    return (
      <ReceiptPaperShell bite="#f4faf0" size={size} landscape={landscape} sheetStyle={sheetStyle}>
        <p className={cn("text-center text-slate-800", title)}>SHIFT REPORT</p>
        <p className={cn("mt-0.5 text-center text-slate-400", sub)}>Arben · 10:00–18:00</p>
        <ReceiptDots />
        <div className={cn("text-slate-700", gap, body)}>
          <div className="flex justify-between"><span>Sales</span><span>420.00</span></div>
          <div className="flex justify-between"><span>Cash</span><span>210.00</span></div>
          {large ? (
            <>
              <div className="flex justify-between"><span>Card</span><span>180.00</span></div>
              <div className="flex justify-between"><span>Expenses</span><span>−24.00</span></div>
            </>
          ) : null}
        </div>
        <ReceiptDots />
        <div className={cn("flex justify-between text-slate-900", total)}>
          <span>HANDOVER</span><span>220.00</span>
        </div>
        <p className={cn("mt-2 text-center text-slate-400", sub)}>{PRINT_POWERED_BY}</p>
      </ReceiptPaperShell>
    );
  }
  if (type === "x_report") {
    return (
      <ReceiptPaperShell bite="#eef8f3" size={size} landscape={landscape} sheetStyle={sheetStyle}>
        <p className={cn("text-center text-slate-800", title)}>X-REPORT</p>
        <p className={cn("mt-0.5 text-center tracking-[0.12em] text-slate-400", sub)}>MID-DAY</p>
        <ReceiptDots />
        <div className={cn("text-slate-700", gap, body)}>
          <div className="flex justify-between"><span>Gross</span><span>890.00</span></div>
          <div className="flex justify-between"><span>Cash</span><span>400.00</span></div>
          {large ? <div className="flex justify-between"><span>Card</span><span>490.00</span></div> : null}
        </div>
        <ReceiptDots />
        <p className={cn("text-center tracking-[0.12em] text-slate-500", sub)}>NOT A Z CLOSE</p>
        <p className={cn("mt-2 text-center text-slate-400", sub)}>{PRINT_POWERED_BY}</p>
      </ReceiptPaperShell>
    );
  }
  if (type === "z_report") {
    return (
      <ReceiptPaperShell bite="#eaf6ef" size={size} landscape={landscape} sheetStyle={sheetStyle}>
        <p className={cn("text-center text-slate-800", title)}>Z-REPORT</p>
        <p className={cn("mt-0.5 text-center tracking-[0.12em] text-slate-400", sub)}>END OF DAY</p>
        <ReceiptDots />
        <p className={cn("text-slate-500", sub)}>Z-014 · 17.10.2026</p>
        <div className={cn("text-slate-700", gap, body)}>
          <div className="flex justify-between"><span>Gross</span><span>1240.00</span></div>
          <div className="flex justify-between"><span>Deductions</span><span>110.00</span></div>
        </div>
        <ReceiptDots />
        <div className={cn("flex justify-between text-slate-900", total)}>
          <span>HANDOVER</span><span>620.00</span>
        </div>
        <p className={cn("mt-2 text-center text-slate-400", sub)}>{PRINT_POWERED_BY}</p>
      </ReceiptPaperShell>
    );
  }
  if (type === "expense_voucher") {
    return (
      <ReceiptPaperShell bite="#f2f7ee" size={size} landscape={landscape} sheetStyle={sheetStyle}>
        <p className={cn("text-center text-slate-800", title)}>EXPENSE</p>
        <p className={cn("mt-0.5 text-center tracking-[0.12em] text-slate-400", sub)}>CASH OUT</p>
        <p className={cn("mt-0.5 text-center text-slate-500", sub)}>Arben</p>
        <ReceiptDots />
        <div className={cn("text-slate-700", gap, body)}>
          <div className="flex justify-between"><span>Produce</span><span>24.00</span></div>
          <div className="flex justify-between"><span>Cleaning</span><span>12.00</span></div>
        </div>
        <ReceiptDots />
        <div className={cn("flex justify-between text-slate-900", total)}>
          <span>TOTAL</span><span>36.00</span>
        </div>
        <p className={cn("mt-2 text-center text-slate-400", sub)}>{PRINT_POWERED_BY}</p>
      </ReceiptPaperShell>
    );
  }
  return (
    <ReceiptPaperShell bite="#fff1f4" size={size} landscape={landscape} sheetStyle={sheetStyle}>
      <div className="flex items-center justify-center gap-1.5 text-slate-900">
        <p className={cn("font-extrabold tracking-[0.12em]", large ? "text-[1.2em]" : "text-[11px]")}>
          VYNTEX
        </p>
        <LedgerMark className={large ? "size-6" : "size-4"} />
      </div>
      <p className={cn("mt-0.5 text-center tracking-[0.32em] text-slate-400", sub)}>
        RESTAURANT
      </p>
      <ReceiptDots />
      <p className={cn("text-center text-slate-800", title)}>ON ACCOUNT</p>
      <div className="mt-1.5 flex justify-center">
        <span className={cn(
          "border-2 border-slate-900 font-extrabold tracking-[0.22em] text-slate-950",
          large ? "px-2.5 py-0.5 text-[0.62em]" : "px-1.5 py-px text-[7px]",
        )}>
          PAY LATER
        </span>
      </div>
      <ReceiptDots />
      <p className={cn("text-slate-500", sub)}>Arta Krasniqi · Table 12</p>
      <div className={cn("text-slate-700", gap, body)}>
        <div className="flex justify-between"><span>1 Margherita Pizza</span><span>12.00</span></div>
        <div className="flex justify-between"><span>2 Coca-Cola</span><span>4.40</span></div>
        {large ? <div className="flex justify-between"><span>1 Tiramisu</span><span>8.50</span></div> : null}
      </div>
      <ReceiptDots />
      <div className={cn("flex justify-between text-slate-900", total)}>
        <span>TOTAL DUE</span><span>{large ? "24.90" : "16.40"}</span>
      </div>
      <p className={cn("mt-2 text-center tracking-[0.1em] text-slate-500", sub)}>
        BALANCE DUE — NOT A FISCAL RECEIPT
      </p>
      <p className={cn("mt-2 text-center text-slate-400", sub)}>{PRINT_POWERED_BY}</p>
    </ReceiptPaperShell>
  );
}

function SalesReceiptsGallery({
  types,
  templates,
  t,
  onSelect,
}: {
  types: TemplateTypeMeta[];
  templates: Array<{ templateType: string; isCustomized?: boolean }>;
  t: (key: string, options?: Record<string, unknown>) => string;
  onSelect: (id: TemplateTypeId) => void;
}) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eef3ff] text-brand">
            <Receipt className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-tight text-slate-950">
              {t("templates.sales_receipts")}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {t("templates.sales_section_sub")}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-medium text-slate-400">
          <Eye className="size-3.5" />
          {t("templates.view_examples")}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {types.map((type) => {
          const theme = SALES_CARD_THEME[type.id as keyof typeof SALES_CARD_THEME];
          if (!theme) return null;
          const Icon = type.icon;
          const data = templates.find((tm) => tm.templateType === type.id);
          return (
            <div
              key={type.id}
              className={cn(
                "relative flex min-h-[12.5rem] overflow-hidden rounded-[1.15rem] px-3.5 py-3.5",
                theme.panel,
              )}
            >
              <div className="relative z-10 flex min-w-0 flex-1 flex-col pr-2">
                <span className={cn("grid size-7 place-items-center rounded-lg", theme.iconWrap)}>
                  <Icon className={cn("size-3.5", theme.icon)} />
                </span>
                <div className="mt-2 flex items-center gap-1.5">
                  <p className="truncate text-[13px] font-semibold text-slate-950">
                    {templateTypeLabel(t, type.id, "name")}
                  </p>
                  {data?.isCustomized ? (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[8px] font-medium", theme.chip)}>
                      {t("templates.custom_badge")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  {templateTypeLabel(t, type.id, "short")}
                </p>
                <div className="mt-auto">
                  <div className="mb-2 flex flex-wrap gap-1">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", theme.chip)}>
                      {templateTypeLabel(t, type.id, "chip1")}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", theme.chip)}>
                      {templateTypeLabel(t, type.id, "chip2")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(type.id)}
                    className={cn(
                      "inline-flex h-9 w-fit items-center gap-1 rounded-full px-3.5 text-[12px] font-semibold transition",
                      theme.button,
                    )}
                  >
                    {t("templates.customize_template")}
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="pointer-events-none relative w-[6.8rem] shrink-0 self-center">
                <ReceiptPaperMock type={type.id} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const INTERNAL_CARD_THEME: Record<
  | "kitchen_ticket"
  | "bar_ticket"
  | "waiter_shift_report"
  | "x_report"
  | "z_report"
  | "expense_voucher",
  {
    panel: string;
    iconWrap: string;
    icon: string;
    button: string;
    chip: string;
  }
> = {
  kitchen_ticket: {
    panel: "bg-[linear-gradient(180deg,#eefaf2_0%,#f7fdf8_100%)]",
    iconWrap: "bg-[#dcfce7] text-[#16a34a]",
    icon: "text-[#16a34a]",
    button: "bg-[#16a34a] hover:bg-[#15803d] text-[#f8fafc]",
    chip: "bg-[#dcfce7] text-[#15803d]",
  },
  bar_ticket: {
    panel: "bg-[linear-gradient(180deg,#e8fbf6_0%,#f5fdfb_100%)]",
    iconWrap: "bg-[#ccfbf1] text-[#0d9488]",
    icon: "text-[#0d9488]",
    button: "bg-[#0d9488] hover:bg-[#0f766e] text-[#f8fafc]",
    chip: "bg-[#ccfbf1] text-[#0f766e]",
  },
  waiter_shift_report: {
    panel: "bg-[linear-gradient(180deg,#f3fae8_0%,#f9fdf3_100%)]",
    iconWrap: "bg-[#ecfccb] text-[#65a30d]",
    icon: "text-[#65a30d]",
    button: "bg-[#65a30d] hover:bg-[#4d7c0f] text-[#f8fafc]",
    chip: "bg-[#ecfccb] text-[#4d7c0f]",
  },
  x_report: {
    panel: "bg-[linear-gradient(180deg,#e8f8f1_0%,#f4fcf8_100%)]",
    iconWrap: "bg-[#d1fae5] text-[#059669]",
    icon: "text-[#059669]",
    button: "bg-[#059669] hover:bg-[#047857] text-[#f8fafc]",
    chip: "bg-[#d1fae5] text-[#047857]",
  },
  z_report: {
    panel: "bg-[linear-gradient(180deg,#e6f6ec_0%,#f3faf6_100%)]",
    iconWrap: "bg-[#bbf7d0] text-[#047857]",
    icon: "text-[#047857]",
    button: "bg-[#047857] hover:bg-[#065f46] text-[#f8fafc]",
    chip: "bg-[#bbf7d0] text-[#065f46]",
  },
  expense_voucher: {
    panel: "bg-[linear-gradient(180deg,#f2f8ea_0%,#f8fbf4_100%)]",
    iconWrap: "bg-[#e8f5c8] text-[#4d7c0f]",
    icon: "text-[#4d7c0f]",
    button: "bg-[#4d7c0f] hover:bg-[#3f6212] text-[#f8fafc]",
    chip: "bg-[#e8f5c8] text-[#3f6212]",
  },
};

function InternalReportsGallery({
  types,
  templates,
  t,
  onSelect,
}: {
  types: TemplateTypeMeta[];
  templates: Array<{ templateType: string; isCustomized?: boolean }>;
  t: (key: string, options?: Record<string, unknown>) => string;
  onSelect: (id: TemplateTypeId) => void;
}) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eefaf2] text-[#16a34a]">
            <ClipboardList className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-tight text-slate-950">
              {t("templates.internal_reports")}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {t("templates.internal_section_sub")}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-medium text-slate-400">
          <Eye className="size-3.5" />
          {t("templates.view_examples")}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {types.map((type) => {
          const theme = INTERNAL_CARD_THEME[type.id as keyof typeof INTERNAL_CARD_THEME];
          if (!theme) return null;
          const Icon = type.icon;
          const data = templates.find((tm) => tm.templateType === type.id);
          return (
            <div
              key={type.id}
              className={cn(
                "relative flex min-h-[12.5rem] overflow-hidden rounded-[1.15rem] px-3.5 py-3.5",
                theme.panel,
              )}
            >
              <div className="relative z-10 flex min-w-0 flex-1 flex-col pr-2">
                <span className={cn("grid size-7 place-items-center rounded-lg", theme.iconWrap)}>
                  <Icon className={cn("size-3.5", theme.icon)} />
                </span>
                <div className="mt-2 flex items-center gap-1.5">
                  <p className="truncate text-[13px] font-semibold text-slate-950">
                    {templateTypeLabel(t, type.id, "name")}
                  </p>
                  {data?.isCustomized ? (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[8px] font-medium", theme.chip)}>
                      {t("templates.custom_badge")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  {templateTypeLabel(t, type.id, "short")}
                </p>
                <div className="mt-auto">
                  <div className="mb-2 flex flex-wrap gap-1">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", theme.chip)}>
                      {templateTypeLabel(t, type.id, "chip1")}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", theme.chip)}>
                      {templateTypeLabel(t, type.id, "chip2")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(type.id)}
                    className={cn(
                      "inline-flex h-9 w-fit items-center gap-1 rounded-full px-3.5 text-[12px] font-semibold transition",
                      theme.button,
                    )}
                  >
                    {t("templates.customize_template")}
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="pointer-events-none relative w-[6.8rem] shrink-0 self-center">
                <ReceiptPaperMock type={type.id} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Template Card ──────────────────────────────────────

function TemplateCard({
  meta,
  t,
  isCustomized,
  customBadgeLabel,
  onClick,
}: {
  meta: TemplateTypeMeta;
  t: (key: string, options?: Record<string, unknown>) => string;
  isCustomized: boolean;
  customBadgeLabel: string;
  onClick: () => void;
}) {
  const Icon = meta.icon;
  const isSales = meta.category === "sales";
  const title = templateTypeLabel(t, meta.id, "name");
  const description = templateTypeLabel(t, meta.id, "description");

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative text-left rounded-xl border p-4 transition-all cursor-pointer group",
        "bg-[#131A2E] border-[#1e2a45] hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            isSales ? "bg-brand/10" : "bg-brand-accent/10"
          )}
        >
          <Icon
            className={cn(
              "size-5",
              isSales ? "text-brand" : "text-brand-accent"
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">
              {title}
            </p>
            {isCustomized && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand/15 text-brand font-medium shrink-0">
                {customBadgeLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-[#5a6580] mt-0.5 line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── Template Editor ──────────────────────────────────────

function TemplateEditor({
  licenseKey,
  meta,
  data,
  printers,
  t,
  onOpenDevices,
}: {
  licenseKey: string;
  meta: TemplateTypeMeta;
  data: TemplateRecord | undefined;
  printers: PrinterRecord[];
  t: (key: string, options?: Record<string, unknown>) => string;
  onOpenDevices?: () => void;
}) {
  const saveTemplate = useMutation("pos.templates.saveTemplate");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>("design");
  const [design, setDesign] = useState<DesignSettings>(() => readDesign(data?.styles));
  const [elements, setElements] = useState<ReceiptElements>(() =>
    readElements(data?.toggles, data?.styles, meta.id),
  );
  const [customLabels, setCustomLabels] = useState<CustomLabels>(() =>
    readCustomLabels(data?.labels, data?.styles, meta.id),
  );
  const [content, setContent] = useState<ContentSettings>(() =>
    readContent(data?.styles, data?.toggles, meta.id),
  );
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(() =>
    readLogoDataUrl(data?.styles),
  );
  const [printerId, setPrinterId] = useState<string>(data?.printerId ?? "");
  const logoFileRef = useRef<HTMLInputElement>(null);
  const typeName = templateTypeLabel(t, meta.id, "name");
  const liveToggles = {
    ...elementsToToggles(elements, data?.toggles, content),
    ...(meta.id === "waiter_shift_report"
      ? {
          footerText: Boolean(customLabels.footerText.trim()),
          waiterName: true,
        }
      : meta.id === "z_report"
        ? {
            footerText: Boolean(customLabels.footerText.trim()),
            waiterName: false,
          }
        : meta.id === "expense_voucher"
          ? {
              footerText: Boolean(customLabels.footerText.trim()),
              waiterName: true,
            }
          : {}),
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const args: {
        licenseKey: string;
        templateType: TemplateTypeId;
        toggles: TemplateRecord["toggles"];
        labels: TemplateRecord["labels"];
        styles: Record<string, unknown>;
        printerId?: string;
      } = {
        licenseKey,
        templateType: meta.id,
        toggles: liveToggles,
        labels: {
          headerText: customLabels.headerText,
          footerText: customLabels.footerText,
        },
        styles: {
          ...(data.styles ?? {}),
          _design: {
            ...design,
            content: { ...content, motto: customLabels.motto },
            elements,
            website: customLabels.website,
            address: customLabels.address,
            motto: customLabels.motto,
            logoDataUrl,
          },
        },
        printerId: printerId || "",
      };
      await saveTemplate(args);
      toast.success(t("templates.saved"));
    } catch (error) {
      toast.error(errorMessageFromUnknown(error, t("templates.save_failed")));
    }
    setSaving(false);
  };

  const handleTestPrint = async () => {
    if (!data) return;
    setTesting(true);
    try {
      const preBill = meta.id === "non_fiscal_receipt";
      const complimentary = meta.id === "complimentary_slip";
      const debt = meta.id === "debt_voucher";
      const kitchen = meta.id === "kitchen_ticket";
      const bar = meta.id === "bar_ticket";
      const shift = meta.id === "waiter_shift_report";
      const xReport = meta.id === "x_report";
      const zReport = meta.id === "z_report";
      const expense = meta.id === "expense_voucher";
      const lines = debt
        ? [
            { name: "Margherita Pizza", quantity: 1, unitPrice: 12, lineTotal: 12 },
            { name: "Coca-Cola 0.33L", quantity: 2, unitPrice: 2.2, lineTotal: 4.4 },
            { name: "Tiramisu", quantity: 1, unitPrice: 8.5, lineTotal: 8.5 },
          ]
        : complimentary
        ? [
            { name: "Tiramisu", quantity: 1, unitPrice: 8.5, lineTotal: 8.5 },
            { name: "Espresso", quantity: 2, unitPrice: 1.9, lineTotal: 3.8 },
            { name: "House Wine", quantity: 1, unitPrice: 6.1, lineTotal: 6.1 },
          ]
        : preBill
        ? [
            {
              name: "Caesar Salad",
              quantity: 2,
              unitPrice: 5.5,
              lineTotal: 11,
              modifiers: "Dressing: Caesar",
              notes: "No onions",
            },
            {
              name: "Margherita Pizza",
              quantity: 1,
              unitPrice: 7.9,
              lineTotal: 7.9,
              modifiers: "Size: Large",
            },
            { name: "Grilled Chicken", quantity: 1, unitPrice: 8.5, lineTotal: 8.5, notes: "Well done" },
            { name: "Coca-Cola 0.33L", quantity: 3, unitPrice: 2.2, lineTotal: 6.6 },
            { name: "Espresso", quantity: 1, unitPrice: 1.5, lineTotal: 1.5 },
          ]
        : [
            { name: "Espresso", quantity: 2, unitPrice: 3.5, lineTotal: 7 },
            { name: "Caesar Salad", quantity: 1, unitPrice: 12, lineTotal: 12 },
            { name: "Sparkling Water", quantity: 2, unitPrice: 2.5, lineTotal: 5 },
          ];
      const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
      const discount = preBill ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
      const total = Math.round((subtotal - discount) * 100) / 100;
      const tax = preBill || debt ? 0 : Math.round((total * 0.2) / 1.2 * 100) / 100;
      const brand = content.storeName.trim() || "VYNTEX";
      const html = debt
        ? buildDebtVoucherHtml({
            ...resolveDebtVoucherCopy({
              ...customLabels,
              legalText: content.legalText,
              tagline: customLabels.motto,
            }),
            venueLine: content.venueName.trim(),
            itemsHeading: content.itemsTitle,
            dateFormat: content.dateFormat,
            hour12: content.timeFormat === "12h",
            lines,
            subtotal,
            discount,
            total,
            orderRef: "#10820",
            tableName: "12",
            waiterName: "Arben",
            customerName: "Arta Krasniqi",
            printedAt: new Date(),
            formatPrice: (n) => formatContentPrice(n, content),
            logoDataUrl,
            business: {
              name: brand,
              address: customLabels.address.trim(),
              phone: "+383 44 123 456",
              website: customLabels.website.trim(),
            },
            visibility: visibilityFromDebtElements(elements),
            fieldLabels: {
              table: content.tableLabel,
              date: content.dateLabel,
              time: content.timeLabel,
              waiter: content.waiterLabel,
              colQty: content.colQty,
              colItem: content.colItem,
              colPrice: content.colPrice,
              colLineTotal: content.colLineTotal,
            },
            pageTitle: typeName,
            design,
          })
        : complimentary
        ? buildComplimentarySlipHtml({
            ...resolveComplimentaryCopy({
              ...customLabels,
              legalText: content.legalText,
              tagline: customLabels.motto,
            }),
            venueLine: content.venueName.trim(),
            itemsHeading:
              content.itemsTitle.trim() === "ITEMS" || !content.itemsTitle.trim()
                ? "TREAT"
                : content.itemsTitle,
            dateFormat: content.dateFormat,
            hour12: content.timeFormat === "12h",
            lines,
            menuValue: subtotal,
            orderRef: "#10412",
            tableName: "8",
            waiterName: "Arben",
            approvedBy: "Admin",
            printedAt: new Date(),
            formatPrice: (n) => formatContentPrice(n, content),
            logoDataUrl,
            business: {
              name: brand,
              address: customLabels.address.trim(),
              phone: "+383 44 123 456",
              website: customLabels.website.trim(),
            },
            visibility: visibilityFromComplimentaryElements(elements),
            fieldLabels: {
              table: content.tableLabel,
              date: content.dateLabel,
              time: content.timeLabel,
              waiter: content.waiterLabel,
              colQty: content.colQty,
              colItem: content.colItem,
            },
            pageTitle: typeName,
            design,
          })
        : kitchen
        ? buildKitchenTicketHtml({
            lines: [
              { name: "Grilled Chicken", quantity: 2, notes: "Well done" },
              { name: "Pasta Carbonara", quantity: 1, modifiers: "No onions" },
              { name: "Caesar Salad", quantity: 1, modifiers: "Dressing: Caesar" },
            ],
            orderRef: "#10820",
            tableName: "12",
            waiterName: "Arben",
            printedAt: new Date(),
            title: resolveKitchenTicketCopy(customLabels).title,
            pageTitle: typeName,
            logoDataUrl,
            hour12: content.timeFormat === "12h",
            visibility: visibilityFromKitchenElements(elements),
            design,
          })
        : bar
        ? buildBarTicketHtml({
            lines: [
              { name: "Espresso", quantity: 2, notes: "No sugar" },
              { name: "Coca-Cola", quantity: 3, modifiers: "No ice" },
              { name: "House Wine", quantity: 1, modifiers: "Extra shot" },
            ],
            orderRef: "#10820",
            tableName: "12",
            waiterName: "Arben",
            printedAt: new Date(),
            title: resolveBarTicketCopy(customLabels).title,
            pageTitle: typeName,
            logoDataUrl,
            hour12: content.timeFormat === "12h",
            visibility: visibilityFromBarElements(elements),
            design,
          })
        : shift
        ? buildWaiterShiftReportHtml(
            {
              toggles: liveToggles,
              labels: {
                headerText: customLabels.headerText.trim() || "SHIFT REPORT",
                footerText: customLabels.footerText,
              },
              styles: {
                ...(data.styles ?? {}),
                _design: design,
              },
            },
            {
              restaurantName: content.storeName.trim() || "VYNTEX",
              waiterName: SHIFT_PREVIEW_SAMPLE.waiterName,
              closedByName: SHIFT_PREVIEW_SAMPLE.closedBy,
              clockInIso: "2026-10-17T10:00:00",
              clockOutIso: "2026-10-17T18:00:00",
              orders: SHIFT_PREVIEW_SAMPLE.orders,
              revenue: SHIFT_PREVIEW_SAMPLE.revenue,
              paidCash: SHIFT_PREVIEW_SAMPLE.paidCash,
              paidCard: SHIFT_PREVIEW_SAMPLE.paidCard,
              paidDebt: SHIFT_PREVIEW_SAMPLE.paidDebt,
              paidComplimentary: SHIFT_PREVIEW_SAMPLE.paidComplimentary,
              openingCash: SHIFT_PREVIEW_SAMPLE.openingCash,
              expenseTotal: SHIFT_PREVIEW_SAMPLE.expenses,
              expenseLines: [
                { note: SHIFT_PREVIEW_SAMPLE.expenseNote, amount: SHIFT_PREVIEW_SAMPLE.expenses },
              ],
              damagesTotal: SHIFT_PREVIEW_SAMPLE.damages,
            },
            (n) => formatContentPrice(n, content),
            typeName,
          )
        : xReport
        ? buildXReportHtml({
            title: resolveXReportCopy(customLabels).title,
            storeName: content.storeName.trim() || "VYNTEX",
            venueName: content.venueName.trim(),
            printedAt: new Date(),
            totals: X_PREVIEW_SAMPLE,
            formatPrice: (n) => formatContentPrice(n, content),
            logoDataUrl,
            pageTitle: typeName,
            visibility: visibilityFromXElements(elements),
            design,
          })
        : zReport
        ? buildZReportHtml({
            title: resolveZReportCopy(customLabels).title,
            footer: resolveZReportCopy(customLabels).footer,
            storeName: content.storeName.trim() || "VYNTEX",
            venueName: content.venueName.trim(),
            printedAt: new Date(),
            totals: Z_PREVIEW_SAMPLE,
            formatPrice: (n) => formatContentPrice(n, content),
            logoDataUrl,
            pageTitle: typeName,
            visibility: visibilityFromZElements(elements),
            design,
          })
        : expense
        ? buildExpenseVoucherHtml({
            title: resolveExpenseVoucherCopy(customLabels).title,
            footer: resolveExpenseVoucherCopy(customLabels).footer,
            storeName: content.storeName.trim() || "VYNTEX",
            venueName: content.venueName.trim(),
            staffName: EXPENSE_PREVIEW_SAMPLE.staffName,
            approvedBy: EXPENSE_PREVIEW_SAMPLE.approvedBy,
            printedAt: new Date(),
            lines: EXPENSE_PREVIEW_SAMPLE.lines,
            formatPrice: (n) => formatContentPrice(n, content),
            logoDataUrl,
            pageTitle: typeName,
            visibility: visibilityFromExpenseElements(elements),
            design,
          })
        : preBill
        ? buildPreBillHtml({
            ...resolvePreBillCopy({
              ...customLabels,
              legalText: content.legalText,
            }),
            subtitle: "",
            legalText: content.legalText.trim(),
            tagline: customLabels.motto.trim(),
            venueLine: content.venueName.trim(),
            itemsHeading: content.itemsTitle,
            showQtyPrefix: false,
            dateFormat: content.dateFormat,
            hour12: content.timeFormat === "12h",
            lines,
            subtotal,
            discount,
            tax: 0,
            total,
            orderRef: "#10288",
            tableName: "12",
            waiterName: "Arben",
            operatorName: "Admin",
            paymentMethod: "Cash",
            guests: 3,
            printedAt: new Date(),
            formatPrice: (n) => formatContentPrice(n, content),
            logoDataUrl,
            business: {
              name: brand,
              address: customLabels.address.trim(),
              phone: "+383 44 123 456",
              website: customLabels.website.trim(),
            },
            visibility: visibilityFromReceiptElements(elements),
            fieldLabels: {
              table: content.tableLabel,
              date: content.dateLabel,
              time: content.timeLabel,
              guests: content.guestsLabel,
              waiter: content.waiterLabel,
              operator: content.operatorLabel,
              payment: content.paymentLabel,
              tax: content.taxLabel,
              colQty: content.colQty,
              colItem: content.colItem,
              colPrice: content.colPrice,
              colLineTotal: content.colLineTotal,
            },
            pageTitle: typeName,
            design,
          })
        : buildFiscalReceiptHtml({
            toggles: liveToggles,
            labels: {
              headerText: customLabels.headerText,
              footerText: customLabels.footerText,
            },
            styles: data.styles ?? {},
            lines,
            subtotal: total - tax,
            tax,
            total,
            orderRef: "ORD-0042",
            tableName: "T-05",
            waiterName: "Staff",
            printedAt: new Date(),
            formatPrice: (n) => formatContentPrice(n, content),
            strings: {
              orderLabel: t("order.fiscal_lbl_order"),
              tableLabel: t("order.fiscal_lbl_table"),
              waiterLabel: t("order.fiscal_lbl_waiter"),
              dateLabel: t("order.fiscal_lbl_date"),
              itemsSectionTitle: t("order.fiscal_lbl_items"),
              subtotalLabel: t("common.subtotal"),
              taxLabel: t("common.tax"),
              totalLabel: t("common.total"),
              poweredBy: t("order.fiscal_powered_by"),
            },
            logoDataUrl,
            pageTitle: typeName,
            motto: customLabels.motto.trim(),
            website: customLabels.website.trim(),
            design,
          });
      const deviceName = resolvePaperPrinterDeviceName(
        printers,
        licenseKey,
        printerId,
        meta.id,
      );
      const outcome = await tryPrintHtmlDocumentAsync(html, {
        silent: hasElectronSilentPrintIpc(),
        allowInteractiveFallback: true,
        deviceName: deviceName || undefined,
      });
      if (!outcome.ok) {
        toast.error(t("order.print_ticket_silent_failed"));
        return;
      }
      toast.success(t("templates.test_print_sent"));
    } catch (error) {
      toast.error(errorMessageFromUnknown(error, t("order.print_ticket_silent_failed")));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {t("templates.editor_title", { name: typeName })}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#5a6580]">
            {t("templates.editor_why", { name: typeName })}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-[16rem] flex-1">
              <span className="mb-1 block text-[11px] font-medium text-[#8b93a7]">
                {t("templates.printer_assign")}
              </span>
              <Select
                value={printerId || "default"}
                onValueChange={(id) => setPrinterId(id === "default" ? "" : id)}
              >
                <SelectTrigger className="h-9 rounded-xl border-[#1e2a45] bg-[#131A2E] text-white">
                  <SelectValue placeholder={t("templates.printer_default")} />
                </SelectTrigger>
                <SelectContent className="border-[#1e2a45] bg-[#131A2E] text-white">
                  <SelectItem value="default">{t("templates.printer_default")}</SelectItem>
                  {printers.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {onOpenDevices ? (
              <button
                type="button"
                onClick={onOpenDevices}
                className="h-9 shrink-0 text-[12px] font-medium text-brand hover:underline"
              >
                {t("templates.open_devices")}
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void handleTestPrint()}
            disabled={testing || !data}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer className="size-4" />
            {t("templates.test_print")}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !data}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[13px] font-semibold text-[#f8fafc] transition hover:bg-brand-hover disabled:opacity-50"
          >
            <Save className="size-4" />
            {saving ? t("templates.saving") : t("templates.save_template")}
          </button>
        </div>
      </div>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_20rem] gap-6">
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]">
          {meta.id === "kitchen_ticket" || meta.id === "bar_ticket" ? null : (
          <div className="p-3">
            <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {EDITOR_TABS.map((tab) => {
                const active = editorTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setEditorTab(tab)}
                    className={cn(
                      "border-r border-slate-200 px-2 py-2 text-center text-[12px] font-semibold last:border-r-0 transition",
                      active
                        ? "bg-brand text-[#f8fafc]"
                        : "text-slate-500 hover:bg-white hover:text-slate-700",
                    )}
                  >
                    {t(`templates.editor_tab.${tab}`)}
                  </button>
                );
              })}
            </div>
          </div>
          )}
          {meta.id === "kitchen_ticket" || meta.id === "bar_ticket" || editorTab === "design" ? (
            <div className={cn("flex min-h-0 flex-1 flex-col", (meta.id === "kitchen_ticket" || meta.id === "bar_ticket") && "pt-3")}>
            <DesignPanel
              design={design}
              onChange={setDesign}
              t={t}
              hideQr={
                meta.id === "non_fiscal_receipt" ||
                meta.id === "complimentary_slip" ||
                meta.id === "debt_voucher" ||
                meta.id === "kitchen_ticket" ||
                meta.id === "bar_ticket" ||
                meta.id === "waiter_shift_report" ||
                meta.id === "x_report" ||
                meta.id === "z_report" ||
                meta.id === "expense_voucher"
              }
            />
            </div>
          ) : (
            <ContentPanel
              content={content}
              onChange={setContent}
              t={t}
              preBill={meta.id === "non_fiscal_receipt"}
              complimentary={meta.id === "complimentary_slip"}
              debt={meta.id === "debt_voucher"}
              fiscal={meta.id === "fiscal_receipt"}
              shift={meta.id === "waiter_shift_report"}
              xReport={meta.id === "x_report"}
              zReport={meta.id === "z_report"}
              expense={meta.id === "expense_voucher"}
            />
          )}
        </section>
        <section className={cn(
          "flex min-h-0 min-w-0 items-start justify-center overflow-y-auto overscroll-contain rounded-[1.75rem] border border-slate-200/80 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]",
          meta.id === "complimentary_slip"
            ? "bg-[linear-gradient(180deg,#fff4e8_0%,#fffaf4_100%)]"
            : meta.id === "debt_voucher"
              ? "bg-[linear-gradient(180deg,#ffe8ef_0%,#fff6f8_100%)]"
            : meta.id === "kitchen_ticket"
              ? "bg-[linear-gradient(180deg,#e8f8ee_0%,#f4fbf6_100%)]"
            : meta.id === "bar_ticket"
              ? "bg-[linear-gradient(180deg,#e8fbf6_0%,#f5fdfb_100%)]"
            : meta.id === "waiter_shift_report"
              ? "bg-[linear-gradient(180deg,#f3fae8_0%,#f9fdf3_100%)]"
            : meta.id === "x_report"
              ? "bg-[linear-gradient(180deg,#e8f8f1_0%,#f4fcf8_100%)]"
            : meta.id === "z_report"
              ? "bg-[linear-gradient(180deg,#e6f6ec_0%,#f3faf6_100%)]"
            : meta.id === "expense_voucher"
              ? "bg-[linear-gradient(180deg,#f2f8ea_0%,#f8fbf4_100%)]"
            : "bg-[linear-gradient(180deg,#eef4ff_0%,#f7faff_100%)]",
        )}>
          <CustomizerReceiptPreview
            type={meta.id}
            data={data}
            design={design}
            elements={elements}
            customLabels={customLabels}
            content={content}
            logoDataUrl={logoDataUrl}
          />
        </section>
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]">
            <p className="text-[13px] font-semibold text-slate-950">
              {t("templates.design.show_hide")}
            </p>
            <div className="mt-2 flex min-h-0 flex-1 flex-col justify-start overflow-y-auto">
              {(meta.id === "non_fiscal_receipt"
                ? RECEIPT_ELEMENT_ITEMS.filter((item) => PRE_BILL_ELEMENT_IDS.includes(item.id))
                : meta.id === "complimentary_slip"
                  ? COMPLIMENTARY_ELEMENT_IDS.map((id) =>
                      RECEIPT_ELEMENT_ITEMS.find((item) => item.id === id),
                    ).filter((item): item is (typeof RECEIPT_ELEMENT_ITEMS)[number] => Boolean(item))
                : meta.id === "debt_voucher"
                  ? DEBT_ELEMENT_IDS.map((id) =>
                      RECEIPT_ELEMENT_ITEMS.find((item) => item.id === id),
                    ).filter((item): item is (typeof RECEIPT_ELEMENT_ITEMS)[number] => Boolean(item))
                : meta.id === "kitchen_ticket"
                  ? KITCHEN_ELEMENT_IDS.map((id) =>
                      RECEIPT_ELEMENT_ITEMS.find((item) => item.id === id),
                    ).filter((item): item is (typeof RECEIPT_ELEMENT_ITEMS)[number] => Boolean(item))
                : meta.id === "bar_ticket"
                  ? BAR_ELEMENT_IDS.map((id) =>
                      RECEIPT_ELEMENT_ITEMS.find((item) => item.id === id),
                    ).filter((item): item is (typeof RECEIPT_ELEMENT_ITEMS)[number] => Boolean(item))
                : meta.id === "waiter_shift_report"
                  ? SHIFT_ELEMENT_IDS.map((id) =>
                      RECEIPT_ELEMENT_ITEMS.find((item) => item.id === id),
                    ).filter((item): item is (typeof RECEIPT_ELEMENT_ITEMS)[number] => Boolean(item))
                : meta.id === "x_report"
                  ? X_ELEMENT_IDS.map((id) =>
                      RECEIPT_ELEMENT_ITEMS.find((item) => item.id === id),
                    ).filter((item): item is (typeof RECEIPT_ELEMENT_ITEMS)[number] => Boolean(item))
                : meta.id === "z_report"
                  ? Z_ELEMENT_IDS.map((id) =>
                      RECEIPT_ELEMENT_ITEMS.find((item) => item.id === id),
                    ).filter((item): item is (typeof RECEIPT_ELEMENT_ITEMS)[number] => Boolean(item))
                : meta.id === "expense_voucher"
                  ? EXPENSE_ELEMENT_IDS.map((id) =>
                      RECEIPT_ELEMENT_ITEMS.find((item) => item.id === id),
                    ).filter((item): item is (typeof RECEIPT_ELEMENT_ITEMS)[number] => Boolean(item))
                : RECEIPT_ELEMENT_ITEMS.filter(
                    (item) => !PRE_BILL_ONLY_ELEMENT_IDS.has(item.id),
                  )
              ).map((item) => {
                const on = elements[item.id];
                const Icon = item.icon;
                const labelKey =
                  meta.id === "complimentary_slip"
                    ? complimentaryElementLabel(item.id) ?? item.key
                    : meta.id === "debt_voucher"
                      ? debtElementLabel(item.id) ?? item.key
                    : meta.id === "waiter_shift_report"
                      ? shiftElementLabel(item.id) ?? item.key
                    : meta.id === "x_report"
                      ? xReportElementLabel(item.id) ?? item.key
                    : meta.id === "z_report"
                      ? zReportElementLabel(item.id) ?? item.key
                    : meta.id === "expense_voucher"
                      ? expenseElementLabel(item.id) ?? item.key
                    : item.key;
                return (
                  <label
                    key={item.id}
                    className="flex shrink-0 cursor-pointer items-center gap-2.5 border-b border-slate-100 py-2.5 last:border-b-0"
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        on ? "text-brand" : "text-slate-300",
                      )}
                      strokeWidth={1.75}
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-[12px] font-medium leading-snug",
                        on ? "text-slate-800" : "text-slate-400",
                      )}
                    >
                      {t(labelKey)}
                    </span>
                    <Checkbox
                      checked={on}
                      onCheckedChange={(v) =>
                        setElements((prev) => ({ ...prev, [item.id]: v === true }))
                      }
                      className="data-[state=checked]:border-brand data-[state=checked]:bg-brand"
                    />
                  </label>
                );
              })}
            </div>
          </section>
          <section className="shrink-0 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]">
            <p className="text-[13px] font-semibold text-slate-950">
              {t("templates.design.custom_text")}
            </p>
            <div className="mt-3 space-y-2.5">
              {(meta.id === "kitchen_ticket" || meta.id === "bar_ticket" || meta.id === "x_report"
                ? CUSTOM_TEXT_ITEMS.filter((item) => item.id === "headerText")
                : meta.id === "waiter_shift_report" || meta.id === "z_report" || meta.id === "expense_voucher"
                  ? CUSTOM_TEXT_ITEMS.filter((item) => item.id === "headerText" || item.id === "footerText")
                : CUSTOM_TEXT_ITEMS
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="flex w-[7.5rem] shrink-0 items-center gap-1.5">
                      <Icon className="size-3.5 shrink-0 text-brand" strokeWidth={1.75} />
                      <span className="truncate text-[12px] font-medium text-slate-700">
                        {t(item.key)}
                      </span>
                    </div>
                    <input
                      value={customLabels[item.id]}
                      onChange={(e) =>
                        setCustomLabels((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand"
                    />
                  </div>
                );
              })}
            </div>
          </section>
          <section className="shrink-0 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]">
            <p className="text-[13px] font-semibold text-slate-950">
              {t("templates.design.logo")}
            </p>
            <label className="mt-3 flex cursor-pointer items-center gap-2.5">
              <span className="min-w-0 flex-1 text-[12px] font-medium text-slate-700">
                {t("templates.design.logo_image")}
              </span>
              <Checkbox
                checked={elements.logo}
                onCheckedChange={(v) =>
                  setElements((prev) => ({ ...prev, logo: v === true }))
                }
                className="data-[state=checked]:border-brand data-[state=checked]:bg-brand"
              />
            </label>
            <input
              ref={logoFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
                  toast.error(t("templates.design.logo_invalid"));
                  return;
                }
                void fileToLogoDataUrl(file)
                  .then((url) => {
                    setLogoDataUrl(url);
                    setElements((prev) => ({ ...prev, logo: true }));
                  })
                  .catch(() => toast.error(t("templates.design.logo_invalid")));
              }}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => logoFileRef.current?.click()}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Upload className="size-3.5" />
                {t("templates.design.logo_upload")}
              </button>
              <button
                type="button"
                onClick={() => setLogoDataUrl(null)}
                disabled={!logoDataUrl}
                className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                {t("templates.design.logo_remove")}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
