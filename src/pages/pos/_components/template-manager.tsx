import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import {
  errorMessageFromUnknown,
  isMissingSupabaseTableError,
} from "@/lib/supabase-pos/db-errors.ts";
import ensureReceiptTemplatesSql from "../../../../supabase/ensure_receipt_templates.sql?raw";
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
  ArrowLeft,
  RotateCcw,
  Save,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CaseSensitive,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { usePosLocale } from "./pos-locale-provider.tsx";

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
  field: "name" | "description"
) {
  return t(`templates.type.${id}.${field}`);
}

const TOGGLE_LABELS: Record<string, { label: string; description: string }> = {
  logo: { label: "Business Logo", description: "Show logo at the top" },
  headerText: { label: "Header Text", description: "Custom header line" },
  footerText: { label: "Footer Message", description: "Custom footer line" },
  waiterName: { label: "Waiter Name", description: "Show who served" },
  tableNumber: { label: "Table Number", description: "Show table info" },
  timestamp: { label: "Timestamp", description: "Date & time of print" },
  unitPrices: { label: "Unit Prices", description: "Show price per item" },
  taxDetails: { label: "Tax Details", description: "Show tax breakdown" },
  orderNumber: { label: "Order Number", description: "Show order #" },
};

type Toggles = {
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

type Labels = {
  headerText: string;
  footerText: string;
};

type ElementStyle = {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  uppercase?: boolean;
  textAlign?: "left" | "center" | "right";
};

type StylesMap = Record<string, ElementStyle>;

type TemplateData = {
  templateType: TemplateTypeId;
  toggles: Toggles;
  labels: Labels;
  styles: StylesMap;
  printerId: string | null;
  isCustomized: boolean;
};

// ── Main Component ──────────────────────────────────────

export default function TemplateManager({
  licenseKey,
}: {
  licenseKey: string;
}) {
  const { t } = usePosLocale();
  const templates = useQuery('pos.templates.listTemplates', { licenseKey });
  const printers = useQuery('pos.settings.getPrinters', { licenseKey });
  const [selectedType, setSelectedType] = useState<TemplateTypeId | null>(null);

  if (templates === undefined) {
    return (
      <div className="p-6 space-y-6">
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
    const data = templates.find((t) => t.templateType === selectedType)!;
    return (
      <TemplateEditor
        licenseKey={licenseKey}
        meta={meta}
        data={data}
        printers={printers ?? []}
        onBack={() => setSelectedType(null)}
        t={t}
      />
    );
  }

  const salesTemplates = TEMPLATE_TYPES.filter((t) => t.category === "sales");
  const internalTemplates = TEMPLATE_TYPES.filter(
    (t) => t.category === "internal"
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {t("templates.page_title")}
        </h1>
        <p className="text-sm text-[#5a6580] mt-1">
          {t("templates.page_description")}
        </p>
        <p className="text-xs text-[#5a6580]/90 mt-2 max-w-2xl">
          {t("templates.admin_hint")}
        </p>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-[#0066FF] uppercase tracking-widest mb-3">
          {t("templates.sales_receipts")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {salesTemplates.map((type) => {
            const data = templates.find((tm) => tm.templateType === type.id);
            return (
              <TemplateCard
                key={type.id}
                meta={type}
                t={t}
                isCustomized={data?.isCustomized ?? false}
                customBadgeLabel={t("templates.custom_badge")}
                onClick={() => setSelectedType(type.id)}
              />
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-[#44CC00] uppercase tracking-widest mb-3">
          {t("templates.internal_reports")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {internalTemplates.map((type) => {
            const data = templates.find((tm) => tm.templateType === type.id);
            return (
              <TemplateCard
                key={type.id}
                meta={type}
                t={t}
                isCustomized={data?.isCustomized ?? false}
                customBadgeLabel={t("templates.custom_badge")}
                onClick={() => setSelectedType(type.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
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
        "bg-[#131A2E] border-[#1e2a45] hover:border-[#0066FF]/40 hover:shadow-lg hover:shadow-[#0066FF]/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            isSales ? "bg-[#0066FF]/10" : "bg-[#44CC00]/10"
          )}
        >
          <Icon
            className={cn(
              "size-5",
              isSales ? "text-[#0066FF]" : "text-[#44CC00]"
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">
              {title}
            </p>
            {isCustomized && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0066FF]/15 text-[#0066FF] font-medium shrink-0">
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
  onBack,
  t,
}: {
  licenseKey: string;
  meta: TemplateTypeMeta;
  data: TemplateData;
  printers: Array<{ _id: string; name: string; role: string }>;
  onBack: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const saveTemplate = useMutation('pos.templates.saveTemplate');
  const resetTemplate = useMutation('pos.templates.resetTemplate');

  const [toggles, setToggles] = useState<Toggles>(data.toggles);
  const [labels, setLabels] = useState<Labels>(data.labels);
  const [styles, setStyles] = useState<StylesMap>(data.styles ?? {});
  const [printerId, setPrinterId] = useState<string>(
    data.printerId ?? "none"
  );
  const [saving, setSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [activeElement, setActiveElement] = useState<string | null>(null);

  const Icon = meta.icon;
  const isSales = meta.category === "sales";
  const typeName = templateTypeLabel(t, meta.id, "name");
  const typeDescription = templateTypeLabel(t, meta.id, "description");

  const handleToggle = (key: keyof Toggles) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getStyle = useCallback(
    (key: string): ElementStyle => styles[key] ?? {},
    [styles]
  );

  const updateStyle = useCallback(
    (key: string, update: Partial<ElementStyle>) => {
      setStyles((prev) => ({
        ...prev,
        [key]: { ...(prev[key] ?? {}), ...update },
      }));
    },
    []
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const args: Parameters<typeof saveTemplate>[0] = {
        licenseKey,
        templateType: meta.id,
        toggles,
        labels,
        styles,
      };
      if (printerId !== "none") {
        args.printerId = printerId as typeof args.printerId;
      }
      await saveTemplate(args);
      toast.success(t("templates.saved"));
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        const msg = errorMessageFromUnknown(error, t("templates.save_failed"));
        if (isMissingSupabaseTableError(msg, "receipt_templates")) {
          toast.error(t("templates.table_missing_title"), {
            description: t("templates.table_missing_steps"),
            duration: 25_000,
            action: {
              label: t("templates.copy_sql"),
              onClick: () => {
                void navigator.clipboard.writeText(ensureReceiptTemplatesSql).then(
                  () => toast.success(t("templates.sql_copied")),
                  () => toast.error(t("templates.sql_copy_failed")),
                );
              },
            },
          });
        } else {
          toast.error(msg);
        }
      }
    }
    setSaving(false);
  };

  const handleReset = async () => {
    try {
      await resetTemplate({ licenseKey, templateType: meta.id });
      toast.success(t("templates.reset_success"));
      onBack();
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        const msg = errorMessageFromUnknown(error, t("templates.reset_failed"));
        if (isMissingSupabaseTableError(msg, "receipt_templates")) {
          toast.error(t("templates.table_missing_title"), {
            description: t("templates.table_missing_steps"),
            duration: 25_000,
            action: {
              label: t("templates.copy_sql"),
              onClick: () => {
                void navigator.clipboard.writeText(ensureReceiptTemplatesSql).then(
                  () => toast.success(t("templates.sql_copied")),
                  () => toast.error(t("templates.sql_copy_failed")),
                );
              },
            },
          });
        } else {
          toast.error(msg);
        }
      }
    }
    setResetDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button
          size="icon"
          variant="ghost"
          onClick={onBack}
          className="text-[#8b93a7] hover:text-white hover:bg-[#1e2a45] shrink-0"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
            isSales ? "bg-[#0066FF]/10" : "bg-[#44CC00]/10"
          )}
        >
          <Icon
            className={cn(
              "size-5",
              isSales ? "text-[#0066FF]" : "text-[#44CC00]"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">
            {typeName}
          </h1>
          <p className="text-xs text-[#5a6580]">{typeDescription}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setResetDialogOpen(true)}
            disabled={!data.isCustomized}
            className="text-[#8b93a7] hover:text-white hover:bg-[#1e2a45]"
          >
            <RotateCcw className="size-4 mr-1.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-[#0066FF] hover:bg-[#0055DD] text-white"
          >
            <Save className="size-4 mr-1.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Live Receipt Preview */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 self-start">
            <p className="text-xs text-[#5a6580]">
              Click any element to select it, then use the toolbar to format
            </p>
          </div>
          <ReceiptTemplatePreview
            templateType={meta.id}
            templateName={typeName}
            toggles={toggles}
            labels={labels}
            styles={styles}
            activeElement={activeElement}
            onSelectElement={setActiveElement}
            onLabelsChange={setLabels}
          />
        </div>

        {/* Right: Controls */}
        <div className="space-y-5">
          {/* Formatting Toolbar */}
          <FormatToolbar
            activeElement={activeElement}
            style={activeElement ? getStyle(activeElement) : {}}
            onStyleChange={(update) => {
              if (activeElement) updateStyle(activeElement, update);
            }}
            onClear={() => setActiveElement(null)}
          />

          {/* Toggle Fields */}
          <section className="rounded-xl border border-[#1e2a45] bg-[#131A2E] p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              Visible Fields
            </h2>
            <div className="space-y-2">
              {(Object.keys(TOGGLE_LABELS) as (keyof Toggles)[]).map((key) => {
                const info = TOGGLE_LABELS[key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-2 border-b border-[#1e2a45] last:border-0"
                  >
                    <div>
                      <p className="text-sm text-white">{info.label}</p>
                      <p className="text-xs text-[#5a6580]">
                        {info.description}
                      </p>
                    </div>
                    <Switch
                      checked={toggles[key]}
                      onCheckedChange={() => handleToggle(key)}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Printer Routing */}
          <section className="rounded-xl border border-[#1e2a45] bg-[#131A2E] p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              Printer Assignment
            </h2>
            <Select value={printerId} onValueChange={setPrinterId}>
              <SelectTrigger className="bg-[#0D1326] border-[#1e2a45] text-white w-full">
                <SelectValue placeholder="Select a printer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No printer assigned</SelectItem>
                {printers.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name} ({p.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {printers.length === 0 && (
              <p className="text-xs text-[#5a6580] mt-2">
                No printers configured. Add printers in Settings.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Reset confirmation */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="bg-[#131A2E] border-[#1e2a45]">
          <DialogHeader>
            <DialogTitle className="text-white">Reset Template</DialogTitle>
            <DialogDescription className="text-[#5a6580]">
              This will reset the {typeName} template back to its default
              settings. All your customizations will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setResetDialogOpen(false)}
              className="text-[#8b93a7] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleReset}
            >
              Reset to Default
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Format Toolbar ──────────────────────────────────────

const ELEMENT_NAMES: Record<string, string> = {
  header: "Header",
  subheader: "Subtitle",
  sectionTitle: "Section Title",
  infoRow: "Info Row",
  itemRow: "Item Text",
  itemPrice: "Item Price",
  note: "Note",
  totalLabel: "Total Label",
  totalValue: "Total Value",
  footer: "Footer",
  timestamp: "Timestamp",
  reportValue: "Report Value",
  handoverLabel: "Handover Label",
  handoverValue: "Handover Amount",
};

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32];
const DEFAULT_FONT_SIZE = 12;

function FormatToolbar({
  activeElement,
  style,
  onStyleChange,
  onClear,
}: {
  activeElement: string | null;
  style: ElementStyle;
  onStyleChange: (update: Partial<ElementStyle>) => void;
  onClear: () => void;
}) {
  const currentSize = style.fontSize ?? DEFAULT_FONT_SIZE;

  const adjustSize = (delta: number) => {
    const idx = FONT_SIZES.indexOf(currentSize);
    if (idx === -1) {
      // Find closest
      const closest = FONT_SIZES.reduce((prev, curr) =>
        Math.abs(curr - currentSize) < Math.abs(prev - currentSize)
          ? curr
          : prev
      );
      const closestIdx = FONT_SIZES.indexOf(closest);
      const newIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, closestIdx + delta));
      onStyleChange({ fontSize: FONT_SIZES[newIdx] });
    } else {
      const newIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta));
      onStyleChange({ fontSize: FONT_SIZES[newIdx] });
    }
  };

  if (!activeElement) {
    return (
      <section className="rounded-xl border border-[#1e2a45] bg-[#131A2E] p-5">
        <h2 className="text-sm font-semibold text-white mb-2">
          Text Formatting
        </h2>
        <p className="text-xs text-[#5a6580]">
          Click any text element on the receipt to select it and format it
        </p>
      </section>
    );
  }

  const elementName = ELEMENT_NAMES[activeElement] ?? activeElement;

  return (
    <section className="rounded-xl border border-[#0066FF]/40 bg-[#131A2E] p-5 ring-1 ring-[#0066FF]/20">
      {/* Toolbar header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Formatting: <span className="text-[#0066FF]">{elementName}</span>
          </h2>
          <p className="text-[10px] text-[#5a6580] mt-0.5">
            Changes are shown live on the receipt
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClear}
          className="size-7 text-[#5a6580] hover:text-white hover:bg-[#1e2a45]"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Font Size */}
      <div className="mb-4">
        <p className="text-xs text-[#8b93a7] mb-2 font-medium">Font Size</p>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => adjustSize(-1)}
            disabled={currentSize <= FONT_SIZES[0]}
            className="size-8 text-[#8b93a7] hover:text-white hover:bg-[#1e2a45] border border-[#1e2a45]"
          >
            <Minus className="size-3.5" />
          </Button>
          <Select
            value={String(currentSize)}
            onValueChange={(val) =>
              onStyleChange({ fontSize: Number(val) })
            }
          >
            <SelectTrigger className="w-20 h-8 bg-[#0D1326] border-[#1e2a45] text-white text-center text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => adjustSize(1)}
            disabled={currentSize >= FONT_SIZES[FONT_SIZES.length - 1]}
            className="size-8 text-[#8b93a7] hover:text-white hover:bg-[#1e2a45] border border-[#1e2a45]"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Style toggles */}
      <div className="mb-4">
        <p className="text-xs text-[#8b93a7] mb-2 font-medium">Style</p>
        <div className="flex gap-1.5">
          <ToolbarToggle
            icon={<Bold className="size-4" />}
            active={!!style.bold}
            label="Bold"
            onClick={() => onStyleChange({ bold: !style.bold })}
          />
          <ToolbarToggle
            icon={<Italic className="size-4" />}
            active={!!style.italic}
            label="Italic"
            onClick={() => onStyleChange({ italic: !style.italic })}
          />
          <ToolbarToggle
            icon={<CaseSensitive className="size-4" />}
            active={!!style.uppercase}
            label="Uppercase"
            onClick={() => onStyleChange({ uppercase: !style.uppercase })}
          />
        </div>
      </div>

      {/* Alignment */}
      <div>
        <p className="text-xs text-[#8b93a7] mb-2 font-medium">Alignment</p>
        <div className="flex gap-1.5">
          <ToolbarToggle
            icon={<AlignLeft className="size-4" />}
            active={style.textAlign === "left"}
            label="Left"
            onClick={() => onStyleChange({ textAlign: "left" })}
          />
          <ToolbarToggle
            icon={<AlignCenter className="size-4" />}
            active={!style.textAlign || style.textAlign === "center"}
            label="Center"
            onClick={() => onStyleChange({ textAlign: "center" })}
          />
          <ToolbarToggle
            icon={<AlignRight className="size-4" />}
            active={style.textAlign === "right"}
            label="Right"
            onClick={() => onStyleChange({ textAlign: "right" })}
          />
        </div>
      </div>
    </section>
  );
}

function ToolbarToggle({
  icon,
  active,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "size-9 rounded-lg flex items-center justify-center transition-all cursor-pointer",
        active
          ? "bg-[#0066FF] text-white"
          : "bg-[#0D1326] text-[#8b93a7] hover:text-white border border-[#1e2a45] hover:border-[#0066FF]/40"
      )}
    >
      {icon}
    </button>
  );
}

// ── Inline Editable Text ──────────────────────────────────

function InlineEditable({
  value,
  onChange,
  className,
  placeholder,
  styleOverride,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  styleOverride?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) {
      onChange(draft.trim());
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={cn(
          "bg-yellow-50 border border-yellow-300 rounded px-1 py-0 outline-none text-black w-full",
          className
        )}
        style={styleOverride}
      />
    );
  }

  return (
    <span
      onDoubleClick={() => setEditing(true)}
      className={cn("inline-block", className)}
      style={styleOverride}
      title="Double-click to edit text"
    >
      {value || placeholder || "Click to edit"}
    </span>
  );
}

// ── Styled Receipt Element ──────────────────────────────

function StyledElement({
  elementKey,
  activeElement,
  onSelect,
  style,
  children,
  className,
  defaultAlign,
}: {
  elementKey: string;
  activeElement: string | null;
  onSelect: (key: string) => void;
  style: ElementStyle;
  children: React.ReactNode;
  className?: string;
  defaultAlign?: "left" | "center" | "right";
}) {
  const isActive = activeElement === elementKey;

  const computedStyle: React.CSSProperties = {
    fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
    fontWeight: style.bold ? "bold" : undefined,
    fontStyle: style.italic ? "italic" : undefined,
    textTransform: style.uppercase ? "uppercase" : undefined,
    textAlign: style.textAlign ?? defaultAlign,
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect(elementKey);
      }}
      className={cn(
        "cursor-pointer rounded transition-all px-1 -mx-1",
        isActive
          ? "ring-2 ring-[#0066FF] bg-blue-50"
          : "hover:bg-yellow-50/50 hover:ring-1 hover:ring-yellow-300",
        className
      )}
      style={computedStyle}
    >
      {children}
    </div>
  );
}

// ── Thermal Receipt Preview ──────────────────────────────

const SAMPLE_ITEMS_ALL = [
  { name: "Espresso", qty: 2, price: 3.5, station: "bar" as const },
  { name: "Caesar Salad", qty: 1, price: 12.0, station: "kitchen" as const },
  { name: "Grilled Chicken", qty: 1, price: 18.5, station: "kitchen" as const },
  { name: "Sparkling Water", qty: 3, price: 2.5, station: "bar" as const },
  { name: "Pasta Carbonara", qty: 1, price: 14.0, station: "kitchen" as const },
  { name: "Mojito", qty: 2, price: 8.0, station: "bar" as const },
];

const SAMPLE_ITEMS_KITCHEN = SAMPLE_ITEMS_ALL.filter((i) => i.station === "kitchen");
const SAMPLE_ITEMS_BAR = SAMPLE_ITEMS_ALL.filter((i) => i.station === "bar");

function ReceiptTemplatePreview({
  templateType,
  templateName,
  toggles,
  labels,
  styles,
  activeElement,
  onSelectElement,
  onLabelsChange,
}: {
  templateType: TemplateTypeId;
  templateName: string;
  toggles: Toggles;
  labels: Labels;
  styles: StylesMap;
  activeElement: string | null;
  onSelectElement: (key: string) => void;
  onLabelsChange: (labels: Labels) => void;
}) {
  const now = format(new Date(), "dd/MM/yyyy HH:mm");
  const headerLines = labels.headerText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const headerSubtitleFromLabel = headerLines.slice(1).join(" · ");

  const isReport =
    templateType === "z_report" ||
    templateType === "x_report" ||
    templateType === "waiter_shift_report";

  const isKitchenOrBar =
    templateType === "kitchen_ticket" || templateType === "bar_ticket";

  // Pick sample items based on template type
  const sampleItems =
    templateType === "kitchen_ticket"
      ? SAMPLE_ITEMS_KITCHEN
      : templateType === "bar_ticket"
        ? SAMPLE_ITEMS_BAR
        : SAMPLE_ITEMS_ALL;

  const taxRate = 0.2;
  const rawTotal = sampleItems.reduce(
    (sum, item) => sum + item.qty * item.price,
    0
  );
  const taxAmount = (rawTotal * taxRate) / (1 + taxRate);
  const subtotal = rawTotal - taxAmount;
  const total = rawTotal;

  const getStyle = (key: string): ElementStyle => styles[key] ?? {};

  // Deselect when clicking the receipt background
  const handleBgClick = () => onSelectElement("");

  return (
    <div
      className="w-full max-w-sm bg-white text-black font-mono text-xs p-6 rounded shadow-lg"
      onClick={handleBgClick}
    >
      {/* Logo placeholder */}
      {toggles.logo && (
        <div className="text-center mb-2">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-1">
            <span className="text-gray-400 text-[8px] font-sans font-medium">
              LOGO
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
        <StyledElement
          elementKey="header"
          activeElement={activeElement}
          onSelect={onSelectElement}
          style={getStyle("header")}
          defaultAlign="center"
        >
          <InlineEditable
            value={labels.headerText}
            onChange={(val) =>
              onLabelsChange({ ...labels, headerText: val })
            }
            styleOverride={{
              fontSize: getStyle("header").fontSize
                ? `${getStyle("header").fontSize}px`
                : "14px",
              fontWeight: getStyle("header").bold !== false ? "bold" : "normal",
              textAlign: getStyle("header").textAlign ?? "center",
              whiteSpace: "pre-line",
            }}
          />
        </StyledElement>
        <StyledElement
          elementKey="subheader"
          activeElement={activeElement}
          onSelect={onSelectElement}
          style={getStyle("subheader")}
          defaultAlign="center"
        >
          <p className="text-gray-500 mt-1">
            {headerSubtitleFromLabel || templateName}
          </p>
        </StyledElement>
      </div>

      {/* Order info */}
      {!isReport && (
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3 space-y-0.5">
          <StyledElement
            elementKey="infoRow"
            activeElement={activeElement}
            onSelect={onSelectElement}
            style={getStyle("infoRow")}
          >
            {toggles.orderNumber && (
              <ReceiptRow label="Order #" value="ORD-0042" />
            )}
            {toggles.tableNumber && (
              <ReceiptRow label="Table" value="T-05" />
            )}
            {toggles.waiterName && (
              <ReceiptRow label="Waiter" value="John D." />
            )}
            {toggles.timestamp && <ReceiptRow label="Date" value={now} />}
          </StyledElement>
        </div>
      )}

      {/* Report-specific info */}
      {isReport && (
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3 space-y-0.5">
          <StyledElement
            elementKey="infoRow"
            activeElement={activeElement}
            onSelect={onSelectElement}
            style={getStyle("infoRow")}
          >
            {toggles.timestamp && <ReceiptRow label="Date" value={now} />}
            {toggles.waiterName && (
              <ReceiptRow label="Staff" value="John D." />
            )}
            <ReceiptRow label="Shift" value="08:00 - 16:00" />
            <ReceiptRow label="Orders" value="47" />
          </StyledElement>
        </div>
      )}

      {/* Items */}
      {!isReport && (
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <StyledElement
            elementKey="sectionTitle"
            activeElement={activeElement}
            onSelect={onSelectElement}
            style={getStyle("sectionTitle")}
            defaultAlign="center"
          >
            <p className="tracking-wider text-gray-500 mb-2">
              {isKitchenOrBar ? "ORDER ITEMS" : "ITEMS"}
            </p>
          </StyledElement>
          {sampleItems.map((item, i) => (
            <StyledElement
              key={i}
              elementKey="itemRow"
              activeElement={activeElement}
              onSelect={onSelectElement}
              style={getStyle("itemRow")}
            >
              <div className="flex justify-between py-0.5">
                <span>
                  {item.qty}x {item.name}
                </span>
                {toggles.unitPrices && (
                  <span>${(item.qty * item.price).toFixed(2)}</span>
                )}
              </div>
            </StyledElement>
          ))}
          {isKitchenOrBar && (
            <StyledElement
              elementKey="note"
              activeElement={activeElement}
              onSelect={onSelectElement}
              style={getStyle("note")}
            >
              <p className="text-gray-400 mt-1">
                {templateType === "bar_ticket"
                  ? "Note: Extra ice for water"
                  : "Note: No onions on salad"}
              </p>
            </StyledElement>
          )}
        </div>
      )}

      {/* Report breakdown */}
      {isReport && (
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <StyledElement
            elementKey="sectionTitle"
            activeElement={activeElement}
            onSelect={onSelectElement}
            style={getStyle("sectionTitle")}
            defaultAlign="center"
          >
            <p className="tracking-wider text-gray-500 mb-2">
              REVENUE BREAKDOWN
            </p>
          </StyledElement>
          <StyledElement
            elementKey="reportValue"
            activeElement={activeElement}
            onSelect={onSelectElement}
            style={getStyle("reportValue")}
          >
            <ReceiptRow label="Cash" value="$1,240.00" />
            <ReceiptRow label="Card" value="$860.00" />
            <ReceiptRow label="Debt" value="$120.00" />
            {toggles.taxDetails && (
              <ReceiptRow label="Tax Collected" value="$399.60" />
            )}
          </StyledElement>
          <div className="border-t border-gray-300 mt-1 pt-1">
            <StyledElement
              elementKey="totalValue"
              activeElement={activeElement}
              onSelect={onSelectElement}
              style={getStyle("totalValue")}
            >
              <ReceiptRow label="GROSS TOTAL" value="$2,220.00" bold />
            </StyledElement>
          </div>
        </div>
      )}

      {/* Totals (for non-kitchen/bar, non-report) */}
      {!isReport && !isKitchenOrBar && (
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          {toggles.unitPrices && (
            <StyledElement
              elementKey="totalLabel"
              activeElement={activeElement}
              onSelect={onSelectElement}
              style={getStyle("totalLabel")}
            >
              <ReceiptRow
                label="Subtotal"
                value={`$${subtotal.toFixed(2)}`}
              />
            </StyledElement>
          )}
          {toggles.taxDetails && (
            <StyledElement
              elementKey="totalLabel"
              activeElement={activeElement}
              onSelect={onSelectElement}
              style={getStyle("totalLabel")}
            >
              <ReceiptRow
                label="TVSH (20%)"
                value={`$${taxAmount.toFixed(2)}`}
              />
            </StyledElement>
          )}
          <div className="border-t border-gray-300 mt-1 pt-1">
            <StyledElement
              elementKey="totalValue"
              activeElement={activeElement}
              onSelect={onSelectElement}
              style={getStyle("totalValue")}
            >
              <ReceiptRow
                label="TOTAL"
                value={`$${total.toFixed(2)}`}
                bold
              />
            </StyledElement>
          </div>
        </div>
      )}

      {/* Report hand-over */}
      {isReport && (
        <div className="text-center py-3">
          <StyledElement
            elementKey="handoverLabel"
            activeElement={activeElement}
            onSelect={onSelectElement}
            style={getStyle("handoverLabel")}
            defaultAlign="center"
          >
            <p className="text-gray-500 tracking-wider mb-1">
              TOTAL TO HAND OVER
            </p>
          </StyledElement>
          <StyledElement
            elementKey="handoverValue"
            activeElement={activeElement}
            onSelect={onSelectElement}
            style={getStyle("handoverValue")}
            defaultAlign="center"
          >
            <p className="text-2xl font-black tracking-tight">$1,240.00</p>
          </StyledElement>
        </div>
      )}

      {/* Footer */}
      {toggles.footerText && (
        <div className="border-t border-dashed border-gray-400 pt-3 mt-3">
          <StyledElement
            elementKey="footer"
            activeElement={activeElement}
            onSelect={onSelectElement}
            style={getStyle("footer")}
            defaultAlign="center"
          >
            <InlineEditable
              value={labels.footerText}
              onChange={(val) =>
                onLabelsChange({ ...labels, footerText: val })
              }
              placeholder="Add footer message"
              styleOverride={{
                fontSize: getStyle("footer").fontSize
                  ? `${getStyle("footer").fontSize}px`
                  : "10px",
                textAlign: getStyle("footer").textAlign ?? "center",
              }}
            />
          </StyledElement>
        </div>
      )}

      {/* Timestamp footer */}
      <div className="border-t border-dashed border-gray-400 pt-3 mt-3">
        <StyledElement
          elementKey="timestamp"
          activeElement={activeElement}
          onSelect={onSelectElement}
          style={getStyle("timestamp")}
          defaultAlign="center"
        >
          <p className="text-gray-400">{now}</p>
          <p className="text-gray-400 mt-0.5">Powered by Vyntex POS</p>
        </StyledElement>
      </div>
    </div>
  );
}

// ── Receipt Row Helper ────────────────────────────────────

function ReceiptRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={cn("flex justify-between py-0.5", bold && "font-bold")}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
