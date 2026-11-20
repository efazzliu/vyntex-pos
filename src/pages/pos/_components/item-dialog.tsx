import { useState, useEffect, useRef, useMemo, type ComponentType, type ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { resolveMenuItemPhotoForSave } from "@/lib/supabase-pos/menu-photo-storage.ts";
import {
  MENU_BARCODE_TAKEN,
  MENU_ID_FIELDS_NEED_COLUMN,
  MENU_SKU_TAKEN,
} from "@/lib/supabase-pos/menu-ops.ts";
import { isStockPhotoUrl } from "@/lib/menu-item-photo-urls.ts";
import {
  ChefHat,
  Wine,
  ImageIcon,
  X,
  Star,
  Package,
  Truck,
  Hash,
  CalendarDays,
  Warehouse,
  Snowflake,
  Thermometer,
  Sun,
  ClipboardList,
  CircleDollarSign,
  Sparkles,
  Plus,
  Minus,
  Beef,
  Bird,
  Drumstick,
  Fish,
  Droplets,
  CookingPot,
  Wheat,
  Candy,
  Milk,
  Cloud,
  Egg,
  Nut,
  Soup,
  Carrot,
  Sprout,
  GlassWater,
  Beer,
  Grape,
  Blend,
  Cherry,
  Zap,
  Leaf,
  Cylinder,
  Citrus,
  Coffee,
  Trash2,
  Check,
  ChevronDown,
  Eye,
  Layers,
  LayoutGrid,
  Lock,
  Pencil,
  Box,
  Bookmark,
  Settings,
  Users,
  UtensilsCrossed,
  GripVertical,
  Archive,
  Bell,
  Barcode,
  ChevronRight,
  Printer,
  ScanLine,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { emojiForCategoryName } from "@/lib/pos-category-icons.ts";
import { compatibleUnits, ingredientEmoji, type StockUnit } from "@/lib/stock-units.ts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { FormSection, NumberStepper, Segmented, ToggleSwitch, variantGroupIcon } from "./drawer-form-kit.tsx";
import { MenuItemCustomizationEditor } from "@/components/menu-item-customization-picker.tsx";
import {
  normalizeCustomizationConfig,
  selectionLimits,
  type MenuCustomizationGroup,
} from "@/lib/menu-customizations.ts";
import {
  defaultVatFraction,
  enabledCatalogRates,
  formatTaxPercent,
  fractionToPercent,
  getCountryTaxCatalog,
  parsePosTaxSettings,
  ratePercent,
} from "@/lib/pos-tax-config.ts";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  parsePosStockRules,
} from "@/lib/pos-order-availability.ts";
import {
  parseDecimal,
  staffMealPayload,
  stockEditMode,
  validateProductForm,
  vatFractionFromPercent,
  vatPercentFromFraction,
  type ProductField,
} from "@/lib/product-form.ts";

type StationValue = "kitchen" | "bar" | undefined;
type SupplyStorage = "fridge" | "freezer" | "dry" | "ambient";

type RecipeUiLine = {
  key: string;
  supplyMenuItemId: Id<"menuItems"> | "";
  qty: string;
  /** Unit the quantity is written in; "" = the ingredient's own stock unit. */
  unit: StockUnit | "";
};

function newRecipeLineKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type RecipeApiLine = { supplyMenuItemId: Id<"menuItems">; qtyPerUnit: number; unit?: StockUnit };

function parseRecipeForApi(lines: RecipeUiLine[]): RecipeApiLine[] {
  return lines
    .filter((l) => String(l.supplyMenuItemId).trim())
    .map((l) => ({
      supplyMenuItemId: l.supplyMenuItemId as Id<"menuItems">,
      qtyPerUnit: Math.max(0, parseDecimal(l.qty) || 0),
      ...(l.unit ? { unit: l.unit } : {}),
    }))
    .filter((l) => l.qtyPerUnit > 0);
}

type SupplyPresetDef = {
  id: string;
  labelKey: string;
  unit: StockUnit;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

const KITCHEN_SUPPLY_PRESETS: ReadonlyArray<SupplyPresetDef> = [
  { id: "white_meat", labelKey: "menu.supply_preset_white_meat", unit: "kg", Icon: Bird },
  { id: "red_meat", labelKey: "menu.supply_preset_red_meat", unit: "kg", Icon: Beef },
  { id: "poultry", labelKey: "menu.supply_preset_poultry", unit: "kg", Icon: Drumstick },
  { id: "fish", labelKey: "menu.supply_preset_fish", unit: "kg", Icon: Fish },
  { id: "oil", labelKey: "menu.supply_preset_oil", unit: "lt", Icon: Droplets },
  { id: "butter", labelKey: "menu.supply_preset_butter", unit: "kg", Icon: CookingPot },
  { id: "flour", labelKey: "menu.supply_preset_flour", unit: "kg", Icon: Wheat },
  { id: "sugar", labelKey: "menu.supply_preset_sugar", unit: "kg", Icon: Candy },
  { id: "salt", labelKey: "menu.supply_preset_salt", unit: "kg", Icon: Star },
  { id: "milk", labelKey: "menu.supply_preset_milk", unit: "lt", Icon: Milk },
  { id: "cream", labelKey: "menu.supply_preset_cream", unit: "lt", Icon: Cloud },
  { id: "eggs", labelKey: "menu.supply_preset_eggs", unit: "pc", Icon: Egg },
  { id: "cheese", labelKey: "menu.supply_preset_cheese", unit: "kg", Icon: Nut },
  { id: "tomato_base", labelKey: "menu.supply_preset_tomato_base", unit: "kg", Icon: Soup },
  { id: "vegetables", labelKey: "menu.supply_preset_vegetables", unit: "kg", Icon: Carrot },
  { id: "potatoes", labelKey: "menu.supply_preset_potatoes", unit: "kg", Icon: Sprout },
];

const BAR_SUPPLY_PRESETS: ReadonlyArray<SupplyPresetDef> = [
  { id: "coffee", labelKey: "menu.supply_preset_coffee_bar", unit: "kg", Icon: Coffee },
  { id: "tonic", labelKey: "menu.supply_preset_tonic", unit: "lt", Icon: GlassWater },
  { id: "soda", labelKey: "menu.supply_preset_soda", unit: "lt", Icon: Beer },
  { id: "juice", labelKey: "menu.supply_preset_juice_bar", unit: "lt", Icon: Grape },
  { id: "syrup", labelKey: "menu.supply_preset_syrup", unit: "lt", Icon: Blend },
  { id: "grenadine", labelKey: "menu.supply_preset_grenadine", unit: "lt", Icon: Cherry },
  { id: "energy", labelKey: "menu.supply_preset_energy", unit: "pc", Icon: Zap },
  { id: "water", labelKey: "menu.supply_preset_water", unit: "pc", Icon: Droplets },
  { id: "ice", labelKey: "menu.supply_preset_ice", unit: "kg", Icon: Snowflake },
  { id: "lemons", labelKey: "menu.supply_preset_lemons", unit: "kg", Icon: Citrus },
  { id: "limes", labelKey: "menu.supply_preset_limes", unit: "kg", Icon: Leaf },
  { id: "napkins", labelKey: "menu.supply_preset_napkins", unit: "box", Icon: Package },
  { id: "straws", labelKey: "menu.supply_preset_straws", unit: "box", Icon: Cylinder },
];

/** Order the drawer checks fields in, top to bottom, when Save finds errors. */
type ProductTab = "general" | "variants" | "stock" | "advanced";

/** Tab that holds each validated field (name sits above the tabs). */
const FIELD_TAB: Partial<Record<ProductField, ProductTab>> = {
  price: "general",
  category: "general",
  station: "general",
  staffPrice: "advanced",
  staffFreeQty: "advanced",
  staffDailyLimit: "advanced",
  stock: "stock",
  lowStock: "stock",
  recipe: "stock",
  sku: "advanced",
  barcode: "advanced",
};

const FIELD_ORDER: ProductField[] = [
  "name",
  "price",
  "category",
  "station",
  "staffPrice",
  "staffFreeQty",
  "staffDailyLimit",
  "stock",
  "lowStock",
  "recipe",
  "sku",
  "barcode",
];

const BRAND = "#1d5ff0";
const DESCRIPTION_MAX = 250;

// Exported so menu-management can reference it for state typing
export type EditingItem = {
  _id: Id<"menuItems">;
  name: string;
  description?: string;
  price: number;
  available: boolean;
  categoryId: Id<"menuCategories">;
  menuId?: Id<"menus">;
  station?: "kitchen" | "bar";
  imageStorageId?: Id<"_storage">;
  imageUrl?: string | null;
  isFavorite?: boolean;
  /** When true, this item appears in staff meal. */
  staffMealAllowed?: boolean;
  /** Staff unit price after freeQty (0 = free). */
  staffMealPrice?: number;
  /** First N units per staff per day are free. */
  staffMealFreeQty?: number;
  /** Max units per staff per day (0/omit = unlimited). */
  staffMealDailyLimit?: number;
  trackStock?: boolean;
  stockUnit?: StockUnit;
  initialStock?: number;
  currentStock?: number;
  lowStockThreshold?: number;
  supplyVendor?: string;
  supplyLot?: string;
  supplyExpiryDate?: string;
  supplyStorage?: SupplyStorage;
  /** Per 1 sold unit: deduct `qtyPerUnit` (in `unit`, default the supply's stock unit) from each supply row. */
  supplyRecipe?: RecipeApiLine[];
  vatRate?: number;
  customizationConfig?: MenuCustomizationGroup[];
  sku?: string;
  barcode?: string;
  internalNotes?: string;
};

/** DB / mappers sometimes emit "" for null category_id; `??` does not treat "" as missing. */
function nonEmptyCategoryId(
  id: Id<"menuCategories"> | undefined | null,
): Id<"menuCategories"> | undefined {
  if (id == null) return undefined;
  const s = String(id).trim();
  return s ? (s as Id<"menuCategories">) : undefined;
}

type CategoryOption = {
  _id: Id<"menuCategories">;
  name: string;
  color: string;
  icon?: string;
};

type ItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  categoryId?: Id<"menuCategories">;
  categories: CategoryOption[];
  editing?: EditingItem | null;
  onSaved?: (item: EditingItem, mode: "create" | "update") => void;
  /**
   * Defaults for CREATE mode (when `editing` is not provided).
   * Useful for inventory ("mall") items so users don't have to re-select station/stock switches.
   */
  initialStation?: "kitchen" | "bar";
  initialTrackStock?: boolean;
  initialStockUnit?: StockUnit;
  initialAvailable?: boolean;
  /** Prefill name for create mode (optional, e.g. from a search query). */
  initialName?: string;
  /** Create-mode sheet title (Stock mall flow); default is generic "New product". */
  dialogNewTitleOverride?: "supply_kitchen" | "supply_bar";
  /** Enterprise: optional supply recipe (BOM) on sellable items. */
  enterpriseSupplyRecipe?: boolean;
  canEditVat?: boolean;
  canEditRecipe?: boolean;
  /** Logged as the author of stock changes made from this drawer. */
  stockActorName?: string;
};

const inputCls = (invalid?: boolean) =>
  cn(
    "h-11 rounded-xl bg-white text-[14px] text-[#0b1220] placeholder:text-[#94a3b8]",
    invalid ? "border-red-400 focus-visible:ring-red-200" : "border-[#e3ebf7]",
  );

function FieldLabel({
  children,
  required,
  optionalLabel,
}: {
  children: ReactNode;
  required?: boolean;
  optionalLabel?: string;
}) {
  return (
    <span className="mb-1.5 block text-[13px] font-semibold text-[#0b1220]">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
      {optionalLabel ? <span className="font-medium text-[#2563eb]"> ({optionalLabel})</span> : null}
    </span>
  );
}

function FieldMessage({ error, help }: { error?: string; help?: string }) {
  if (!error && !help) return null;
  return (
    <p
      className="mt-1.5 text-[12px]"
      style={{ color: error ? "#dc2626" : "#64748b" }}
      role={error ? "alert" : undefined}
    >
      {error ?? help}
    </p>
  );
}

/** Pill-style choice; `solid` fills with the given colour (category chips), otherwise a soft tint. */
function Chip({
  active,
  onClick,
  children,
  color = BRAND,
  solid = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  color?: string;
  solid?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition",
        !active && "border-[#e3ebf7] bg-white text-[#334155] hover:border-[#c7d6f5]",
      )}
      style={
        active
          ? solid
            ? { backgroundColor: color, borderColor: color, color: "#ffffff" }
            : { backgroundColor: "#eef4ff", borderColor: color, color: "#1d4ed8" }
          : undefined
      }
    >
      {children}
    </button>
  );
}

function ToggleRow({
  icon,
  title,
  help,
  checked,
  onChange,
  flat = false,
}: {
  icon: ReactNode;
  title: string;
  help: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Row inside a grouped list (no own border). */
  flat?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 bg-white",
        flat ? "px-4 py-3.5" : "rounded-xl border border-[#eef2f8] px-3.5 py-3",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f5ff] text-[#2563eb]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[#0b1220]">{title}</p>
        <p className="text-[12px] text-[#64748b]">{help}</p>
      </div>
      <ToggleSwitch checked={checked} label={title} onChange={() => onChange(!checked)} />
    </div>
  );
}

function Disclosure({
  title,
  meta,
  open,
  onToggle,
  children,
}: {
  title: string;
  meta?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#eef2f8] bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3.5 py-3 text-left hover:bg-[#f9fbff]"
      >
        <span className="min-w-0 flex-1 text-[14px] font-semibold text-[#0b1220]">{title}</span>
        {meta ? <span className="text-[12px] font-medium text-[#64748b]">{meta}</span> : null}
        <ChevronDown
          className={cn("size-4 text-[#64748b] transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? <div className="border-t border-[#eef2f8] p-3">{children}</div> : null}
    </div>
  );
}

const formatQty = (n: number) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function ItemDialog({
  open,
  onOpenChange,
  licenseKey,
  categoryId,
  categories,
  editing,
  onSaved,
  initialStation,
  initialTrackStock,
  initialStockUnit,
  initialAvailable,
  initialName,
  dialogNewTitleOverride,
  enterpriseSupplyRecipe = false,
  canEditVat = true,
  canEditRecipe = true,
  stockActorName = "",
}: ItemDialogProps) {
  const { currency, formatPrice, t } = usePosLocale();
  const stockUnitOptions = useMemo(
    () =>
      (["pc", "kg", "g", "lt", "ml", "bottle", "box"] as const).map((value) => ({
        value: value as StockUnit,
        label: t(`menu.stock_unit_${value}`),
      })),
    [t],
  );

  /** Kuzhinë / shank mall tab — applies to both new supply and editing a row from that tab. */
  const supplyMallContext =
    dialogNewTitleOverride === "supply_kitchen" ||
    dialogNewTitleOverride === "supply_bar";
  const supplyCreateLayout = !editing && supplyMallContext;

  const supplyQuickPresets = useMemo(() => {
    if (!supplyCreateLayout) return [];
    if (dialogNewTitleOverride === "supply_kitchen") return [...KITCHEN_SUPPLY_PRESETS];
    if (dialogNewTitleOverride === "supply_bar") return [...BAR_SUPPLY_PRESETS];
    return [];
  }, [supplyCreateLayout, dialogNewTitleOverride]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [price, setPrice] = useState("");
  const [available, setAvailable] = useState(true);
  const [station, setStation] = useState<StationValue>(undefined);
  const [menuId, setMenuId] = useState<Id<"menus"> | undefined>(undefined);
  const [trackStock, setTrackStock] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [staffMealAllowed, setStaffMealAllowed] = useState(false);
  const [staffMealPricingMode, setStaffMealPricingMode] = useState<"free" | "custom">("free");
  const [staffMealCustomPrice, setStaffMealCustomPrice] = useState("");
  const [staffMealDailyLimit, setStaffMealDailyLimit] = useState("1");
  const [staffMealFreeQty, setStaffMealFreeQty] = useState("");
  const [stockUnit, setStockUnit] = useState<StockUnit>("pc");
  const [initialStock, setInitialStock] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [supplyVendor, setSupplyVendor] = useState("");
  const [supplyLot, setSupplyLot] = useState("");
  const [supplyExpiryDate, setSupplyExpiryDate] = useState("");
  const [supplyStorage, setSupplyStorage] = useState<SupplyStorage | undefined>(
    undefined,
  );
  const [supplyDetailsOpen, setSupplyDetailsOpen] = useState(false);
  const [recipeLines, setRecipeLines] = useState<RecipeUiLine[]>([]);
  /** Off = this product deducts no ingredients (the recipe is saved empty). */
  const [recipeEnabled, setRecipeEnabled] = useState(false);
  const [dragRecipeKey, setDragRecipeKey] = useState<string | null>(null);
  const [vatPct, setVatPct] = useState("20");
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    Id<"menuCategories"> | undefined
  >(undefined);
  const [saving, setSaving] = useState(false);
  /** Defaults that may load after the drawer opened only fill in while untouched. */
  const [vatTouched, setVatTouched] = useState(false);
  const [lowStockTouched, setLowStockTouched] = useState(false);
  const [stockQtyTouched, setStockQtyTouched] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<ProductField>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [tab, setTab] = useState<ProductTab>("general");
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());
  const [dragGroupId, setDragGroupId] = useState<string | null>(null);
  const furnizimCategoryId = useMemo(
    () => categories.find((c) => c.name.trim() === "Furnizim")?._id,
    [categories],
  );

  const menus = useQuery("pos.menu.getMenus", { licenseKey });
  /** Groups made in Settings → Variants; ticking one copies it onto this product. */
  const variantLibrary = (useQuery(
    "pos.menu.getVariantLibrary",
    open ? { licenseKey } : "skip",
  ) ?? []) as MenuCustomizationGroup[];
  const companyQuery = useQuery(
    "pos.settings.getCompanyDetails",
    open ? { licenseKey } : "skip",
  );
  const vatChoices = useMemo(() => {
    const company =
      companyQuery && typeof companyQuery === "object" && !Array.isArray(companyQuery)
        ? (companyQuery as Record<string, unknown>)
        : null;
    const country = String(company?.country ?? "");
    const businessType = String(company?.type ?? "restaurant");
    const fallback = Number(company?.defaultVatRate ?? 0.2);
    const settings = parsePosTaxSettings(company?.taxSettings, {
      country,
      businessType,
      fallbackVatFraction: fallback,
    });
    const catalog = getCountryTaxCatalog(country);
    const rates = enabledCatalogRates(catalog, settings);
    const options = rates.map((rate) => {
      const percent = ratePercent(rate, settings);
      return {
        id: rate.id,
        percent,
        label: `${percent}%`,
        nameKey: rate.nameKey,
      };
    });
    return {
      options,
      defaultPercent: formatTaxPercent(
        fractionToPercent(defaultVatFraction(settings, { country, businessType, fallbackVatFraction: fallback })),
      ),
    };
  }, [companyQuery]);
  const venueLowStock = useMemo(() => {
    const company =
      companyQuery && typeof companyQuery === "object" && !Array.isArray(companyQuery)
        ? (companyQuery as Record<string, unknown>)
        : null;
    return parsePosStockRules(company?.stockRules).defaultLowStockThreshold;
  }, [companyQuery]);
  const allMenuForRecipe = useQuery(
    "pos.menu.getAllItems",
    open && !supplyMallContext ? { licenseKey } : "skip",
  );
  /** Codes already used by the venue's other products, for the duplicate check. */
  const takenCodes = useMemo(() => {
    const skus = new Set<string>();
    const barcodes = new Set<string>();
    if (Array.isArray(allMenuForRecipe)) {
      for (const row of allMenuForRecipe as { _id: string; sku?: string; barcode?: string }[]) {
        if (editing && row._id === editing._id) continue;
        if (row.sku?.trim()) skus.add(row.sku.trim().toLowerCase());
        if (row.barcode?.trim()) barcodes.add(row.barcode.trim().toLowerCase());
      }
    }
    return { skus, barcodes };
  }, [allMenuForRecipe, editing]);
  const createItem = useMutation("pos.menu.createItem");
  const updateItem = useMutation("pos.menu.updateItem");
  const ensureSupplyCategory = useMutation("pos.menu.ensureSupplyCategory");
  const setStockMut = useMutation("pos.stock.setStock");

  const recipeIngredientOptions = useMemo(() => {
    if (!allMenuForRecipe || !Array.isArray(allMenuForRecipe)) return [];
    const selfId = editing?._id;
    return allMenuForRecipe.filter((row) => {
      if (selfId && row._id === selfId) return false;
      if (!row.trackStock) return false;
      if (furnizimCategoryId) return row.categoryId === furnizimCategoryId;
      return true;
    });
  }, [allMenuForRecipe, editing?._id, furnizimCategoryId]);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [currentImageStorageId, setCurrentImageStorageId] = useState<
    Id<"_storage"> | undefined
  >(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customizationGroups, setCustomizationGroups] = useState<MenuCustomizationGroup[]>([]);
  /**
   * The form loads once per opening (or when a different product is opened). Re-running on every
   * parent render would wipe what the user is typing whenever the product list refreshes.
   */
  const loadedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      loadedForRef.current = null;
      return;
    }
    const loadKey = editing ? `edit:${editing._id}` : `new:${dialogNewTitleOverride ?? ""}`;
    if (loadedForRef.current === loadKey) return;
    loadedForRef.current = loadKey;

    setTab("general");
    setCollapsedGroups(new Set());
    setTouched(new Set());
    setSubmitted(false);
    setVatTouched(false);
    setLowStockTouched(false);
    setStockQtyTouched(false);
    setImageFile(null);
    setImageRemoved(false);
    const mallCtx =
      dialogNewTitleOverride === "supply_kitchen" ||
      dialogNewTitleOverride === "supply_bar";

    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setSku(editing.sku ?? "");
      setBarcode(editing.barcode ?? "");
      setInternalNotes(editing.internalNotes ?? "");
      setPrice(editing.price.toFixed(currency.decimals));
      setVatPct(vatPercentFromFraction(editing.vatRate));
      setAvailable(editing.available);
      setStation(editing.station ?? undefined);
      setMenuId(editing.menuId ?? undefined);
      setIsFavorite(editing.isFavorite ?? false);
      const mealPrice =
        typeof editing.staffMealPrice === "number" ? editing.staffMealPrice : undefined;
      setStaffMealAllowed(editing.staffMealAllowed === true);
      if (mealPrice !== undefined && mealPrice > 0) {
        setStaffMealPricingMode("custom");
        setStaffMealCustomPrice(String(mealPrice));
      } else {
        setStaffMealPricingMode("free");
        setStaffMealCustomPrice("");
      }
      setStaffMealDailyLimit(
        typeof editing.staffMealDailyLimit === "number" && editing.staffMealDailyLimit > 0
          ? String(editing.staffMealDailyLimit)
          : "",
      );
      setStaffMealFreeQty(
        typeof editing.staffMealFreeQty === "number" && editing.staffMealFreeQty > 0
          ? String(editing.staffMealFreeQty)
          : "",
      );
      setTrackStock(editing.trackStock ?? false);
      setStockUnit(editing.stockUnit ?? "pc");
      setInitialStock(
        editing.trackStock
          ? String(editing.currentStock ?? editing.initialStock ?? (mallCtx ? 0 : ""))
          : "",
      );
      setLowStockThreshold(editing.lowStockThreshold?.toString() ?? "");
      setImagePreview(editing.imageUrl ?? null);
      setCurrentImageStorageId(editing.imageStorageId);
      const groups = normalizeCustomizationConfig(editing.customizationConfig);
      setCustomizationGroups(groups);
      setOptionsOpen(false);
      setSelectedCategoryId(nonEmptyCategoryId(editing.categoryId));
      setSupplyVendor(editing.supplyVendor ?? "");
      setSupplyLot(editing.supplyLot ?? "");
      setSupplyExpiryDate(editing.supplyExpiryDate ?? "");
      setSupplyStorage(editing.supplyStorage);
      setSupplyDetailsOpen(
        mallCtx &&
          Boolean(
            (editing.supplyVendor ?? "").trim() ||
              (editing.supplyLot ?? "").trim() ||
              (editing.supplyExpiryDate ?? "").trim() ||
              editing.supplyStorage,
          ),
      );
      const savedRecipe =
        enterpriseSupplyRecipe && !mallCtx && editing.supplyRecipe?.length
          ? editing.supplyRecipe.map((row) => ({
              key: newRecipeLineKey(),
              supplyMenuItemId: row.supplyMenuItemId,
              qty: String(row.qtyPerUnit),
              unit: row.unit ?? ("" as const),
            }))
          : [];
      setRecipeLines(savedRecipe);
      setRecipeEnabled(savedRecipe.length > 0);
    } else {
      setName(initialName ?? "");
      setDescription("");
      setSku("");
      setBarcode("");
      setInternalNotes("");
      setPrice("");
      setVatPct(vatChoices.defaultPercent);
      setAvailable(initialAvailable ?? true);
      setStation(initialStation);
      setMenuId(undefined);
      setIsFavorite(false);
      setStaffMealAllowed(false);
      setStaffMealPricingMode("free");
      setStaffMealCustomPrice("");
      setStaffMealDailyLimit("1");
      setStaffMealFreeQty("");
      setTrackStock(initialTrackStock ?? false);
      setStockUnit(initialStockUnit ?? "pc");
      setInitialStock("");
      setLowStockThreshold(String(venueLowStock || DEFAULT_LOW_STOCK_THRESHOLD));
      setImagePreview(null);
      setCurrentImageStorageId(undefined);
      setCustomizationGroups([]);
      setOptionsOpen(false);
      setSelectedCategoryId(
        nonEmptyCategoryId(categoryId) ?? nonEmptyCategoryId(categories[0]?._id),
      );
      setSupplyVendor("");
      setSupplyLot("");
      setSupplyExpiryDate("");
      setSupplyStorage(undefined);
      setSupplyDetailsOpen(false);
      setRecipeLines([]);
      setRecipeEnabled(false);
    }
  }, [
    editing,
    open,
    categoryId,
    categories,
    initialStation,
    initialTrackStock,
    initialStockUnit,
    initialAvailable,
    initialName,
    dialogNewTitleOverride,
    enterpriseSupplyRecipe,
    venueLowStock,
    vatChoices.defaultPercent,
    currency.decimals,
  ]);

  // Venue defaults arrive after the drawer opens; apply them to a new product until edited.
  useEffect(() => {
    if (open && !editing && !vatTouched) setVatPct(vatChoices.defaultPercent);
  }, [open, editing, vatTouched, vatChoices.defaultPercent]);
  useEffect(() => {
    if (open && !editing && !lowStockTouched) {
      setLowStockThreshold(String(venueLowStock || DEFAULT_LOW_STOCK_THRESHOLD));
    }
  }, [open, editing, lowStockTouched, venueLowStock]);
  useEffect(() => {
    if (open && !editing && !selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(nonEmptyCategoryId(categoryId) ?? categories[0]._id);
    }
  }, [open, editing, selectedCategoryId, categories, categoryId]);

  useEffect(
    () => () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setImageRemoved(false);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(true);
    setCurrentImageStorageId(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const touch = (field: ProductField) =>
    setTouched((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));

  const supplyCreate = !editing && supplyMallContext;
  const resolvedStation: StationValue =
    supplyCreate && dialogNewTitleOverride === "supply_kitchen"
      ? "kitchen"
      : supplyCreate && dialogNewTitleOverride === "supply_bar"
        ? "bar"
        : station;
  const stockMode = supplyMallContext ? "opening" : stockEditMode(editing);
  const trackStockOn = supplyCreate || trackStock;

  const errors = useMemo(
    () =>
      validateProductForm({
        name,
        price,
        categoryId: selectedCategoryId ?? (editing ? nonEmptyCategoryId(editing.categoryId) : undefined),
        needsCategory: !supplyMallContext,
        station: resolvedStation,
        needsStation: true,
        staffMealAllowed,
        staffMealPricingMode,
        staffMealCustomPrice,
        staffMealFreeQty,
        staffMealDailyLimit,
        trackStock: trackStockOn,
        stockMode,
        initialStock,
        lowStockThreshold,
        recipeLines:
          canEditRecipe && enterpriseSupplyRecipe && !supplyMallContext && recipeEnabled
            ? recipeLines.map((l) => ({ supplyMenuItemId: String(l.supplyMenuItemId), qty: l.qty }))
            : [],
        sku: supplyMallContext ? "" : sku,
        barcode: supplyMallContext ? "" : barcode,
        takenSkus: takenCodes.skus,
        takenBarcodes: takenCodes.barcodes,
      }),
    [
      name,
      price,
      selectedCategoryId,
      editing,
      supplyMallContext,
      resolvedStation,
      staffMealAllowed,
      staffMealPricingMode,
      staffMealCustomPrice,
      staffMealFreeQty,
      staffMealDailyLimit,
      trackStockOn,
      stockMode,
      initialStock,
      lowStockThreshold,
      canEditRecipe,
      enterpriseSupplyRecipe,
      recipeEnabled,
      recipeLines,
      sku,
      barcode,
      takenCodes,
    ],
  );
  /** Errors show once the field was used, or after Save was pressed. */
  const errorFor = (field: ProductField): string | undefined => {
    const key = errors[field];
    return key && (submitted || touched.has(field)) ? t(key) : undefined;
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    const firstError = FIELD_ORDER.find((f) => errors[f]);
    if (firstError) {
      toast.error(t(errors[firstError]!));
      const errorTab = FIELD_TAB[firstError];
      if (errorTab && !supplyMallContext) setTab(errorTab);
      window.setTimeout(() => {
        document
          .querySelector(`[data-product-field="${firstError}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
      return;
    }

    let categoryForSubmit =
      editing != null
        ? (nonEmptyCategoryId(selectedCategoryId) ?? nonEmptyCategoryId(editing.categoryId))
        : nonEmptyCategoryId(selectedCategoryId);
    if (!supplyCreate && !categoryForSubmit && supplyMallContext && editing) {
      try {
        categoryForSubmit = await ensureSupplyCategory({ licenseKey });
      } catch {
        /* leave undefined; error below */
      }
    }
    if (!supplyCreate && !categoryForSubmit) {
      toast.error(t("menu.err_category"));
      return;
    }
    const priceNum = parseDecimal(price);
    const staffMeal = staffMealPayload({
      staffMealAllowed,
      staffMealPricingMode,
      staffMealCustomPrice,
      staffMealFreeQty,
      staffMealDailyLimit,
    });

    setSaving(true);
    try {
      let finalImageUrl: string | null | undefined = undefined;
      if (imageFile) {
        const photo = await resolveMenuItemPhotoForSave({
          licenseKey,
          file: imageFile,
          itemId: editing?._id ? String(editing._id) : undefined,
        });
        finalImageUrl = photo.imageUrl;
        // Offline saves already toast via the mutation queue; only tip when
        // upload failed while the browser still reported online.
        if (photo.deferredUpload && navigator.onLine) {
          toast.info(t("common.need_online_for_upload"), { duration: 2500 });
        }
      } else if (imageRemoved) {
        finalImageUrl = null;
      }
      const finalImageStorageId = currentImageStorageId;

      const isSupplyMallEdit = Boolean(editing && supplyMallContext);
      const qtyFromStockField = Math.max(0, parseDecimal(initialStock) || 0);
      const lowParsed = parseDecimal(lowStockThreshold);

      const stockArgs = trackStockOn
        ? {
            trackStock: true as const,
            stockUnit,
            initialStock: qtyFromStockField,
            lowStockThreshold:
              Number.isFinite(lowParsed) && lowParsed >= 0 ? lowParsed : venueLowStock,
          }
        : {
            trackStock: false as const,
            stockUnit: undefined,
            initialStock: undefined,
            lowStockThreshold: undefined,
          };

      const supplyMutationPayload = {
        supplyVendor: supplyVendor.trim() || undefined,
        supplyLot: supplyLot.trim() || undefined,
        supplyExpiryDate: supplyExpiryDate.trim() || undefined,
        supplyStorage,
      };

      const recipeSavePayload =
        canEditRecipe && enterpriseSupplyRecipe && !supplyMallContext
          ? recipeEnabled
            ? parseRecipeForApi(recipeLines)
            : []
          : undefined;
      // An unchanged rate is not re-sent, so a rate the venue later disabled never blocks saving.
      const vatRatePayload =
        canEditVat && (!editing || vatTouched) ? vatFractionFromPercent(vatPct) : undefined;
      const customizationSavePayload = !supplyMallContext
        ? customizationGroups
            .map((group) => ({
              ...group,
              name: group.name.trim(),
              options: group.options
                .map((option) => ({
                  ...option,
                  name: option.name.trim(),
                }))
                .filter((option) => option.name),
            }))
            .filter((group) => group.name && group.options.length > 0)
        : [];
      if (editing) {
        // Existing stock is never re-sent with the product (sales may have moved it since the
        // drawer opened); a quantity the user changed is applied below as a logged stock set.
        const stockAdjustTo =
          !isSupplyMallEdit &&
          trackStockOn &&
          stockMode === "adjust" &&
          stockQtyTouched &&
          qtyFromStockField !== Number(editing.currentStock ?? 0)
            ? qtyFromStockField
            : undefined;
        const currentStockPayload = !trackStockOn
          ? undefined
          : isSupplyMallEdit
            ? stockQtyTouched || editing.currentStock == null
              ? qtyFromStockField
              : undefined
            : stockMode === "opening"
              ? qtyFromStockField
              : undefined;
        await updateItem({
          licenseKey,
          itemId: editing._id,
          name: name.trim(),
          description: description.trim() || null,
          ...(!supplyMallContext
            ? {
                sku: sku.trim() || null,
                barcode: barcode.trim() || null,
                internalNotes: internalNotes.trim() || null,
              }
            : {}),
          price: priceNum,
          available,
          categoryId: categoryForSubmit!,
          menuId: menuId ?? null,
          station: resolvedStation,
          imageStorageId: finalImageStorageId,
          ...(finalImageUrl !== undefined ? { imageUrl: finalImageUrl } : {}),
          isFavorite,
          staffMealAllowed,
          ...staffMeal,
          ...stockArgs,
          ...(currentStockPayload !== undefined ? { currentStock: currentStockPayload } : {}),
          ...supplyMutationPayload,
          ...(vatRatePayload !== undefined ? { vatRate: vatRatePayload } : {}),
          ...(recipeSavePayload !== undefined
            ? { supplyRecipe: recipeSavePayload }
            : {}),
          customizationConfig: customizationSavePayload,
        });
        if (stockAdjustTo !== undefined) {
          await setStockMut({
            licenseKey,
            itemId: editing._id,
            newStock: stockAdjustTo,
            staffName: stockActorName.trim() || "Menu",
            note: t("menu.stock_set_note"),
          });
        }
        const updatedItem: EditingItem = {
          ...editing,
          name: name.trim(),
          description: description.trim() || undefined,
          ...(!supplyMallContext
            ? {
                sku: sku.trim() || undefined,
                barcode: barcode.trim() || undefined,
                internalNotes: internalNotes.trim() || undefined,
              }
            : {}),
          price: priceNum,
          vatRate: vatRatePayload ?? editing.vatRate,
          available,
          categoryId: categoryForSubmit!,
          menuId,
          station: resolvedStation,
          imageStorageId: finalImageStorageId,
          imageUrl: finalImageUrl === undefined ? editing.imageUrl : finalImageUrl,
          isFavorite,
          staffMealAllowed,
          staffMealPrice: staffMeal.staffMealPrice,
          staffMealFreeQty: staffMeal.staffMealFreeQty,
          staffMealDailyLimit: staffMeal.staffMealDailyLimit,
          trackStock: stockArgs.trackStock,
          stockUnit: stockArgs.stockUnit,
          initialStock: stockArgs.initialStock,
          lowStockThreshold: stockArgs.lowStockThreshold,
          currentStock: stockAdjustTo ?? currentStockPayload ?? editing.currentStock,
          ...supplyMutationPayload,
          ...(recipeSavePayload !== undefined
            ? { supplyRecipe: recipeSavePayload }
            : {}),
          customizationConfig: customizationSavePayload,
        };
        const cached = (await getDataCache<EditingItem[]>(`menuItems:${licenseKey}`)) ?? [];
        await saveDataCache(
          `menuItems:${licenseKey}`,
          cached.map((item) => (item._id === editing._id ? updatedItem : item)),
        );
        onSaved?.(updatedItem, "update");
        toast.success(t("menu.toast_updated"));
      } else {
        const categoryIdForCreate = supplyCreate
          ? await ensureSupplyCategory({ licenseKey })
          : selectedCategoryId!;
        const openingStock = trackStockOn ? qtyFromStockField : undefined;
        const createdId = await createItem({
          licenseKey,
          categoryId: categoryIdForCreate,
          menuId,
          name: name.trim(),
          description: description.trim() || undefined,
          sku: sku.trim() || undefined,
          barcode: barcode.trim() || undefined,
          internalNotes: internalNotes.trim() || undefined,
          price: priceNum,
          available,
          station: resolvedStation,
          imageStorageId: finalImageStorageId,
          ...(finalImageUrl !== undefined ? { imageUrl: finalImageUrl } : {}),
          isFavorite,
          staffMealAllowed,
          ...staffMeal,
          ...stockArgs,
          ...(openingStock !== undefined ? { currentStock: openingStock } : {}),
          ...(supplyCreate ? supplyMutationPayload : {}),
          ...(vatRatePayload !== undefined ? { vatRate: vatRatePayload } : {}),
          ...(recipeSavePayload !== undefined
            ? { supplyRecipe: recipeSavePayload }
            : {}),
          customizationConfig: customizationSavePayload,
        });
        const cached = (await getDataCache<EditingItem[]>(`menuItems:${licenseKey}`)) ?? [];
        const newItem: EditingItem = {
          _id: createdId as Id<"menuItems">,
          name: name.trim(),
          description: description.trim() || undefined,
          sku: sku.trim() || undefined,
          barcode: barcode.trim() || undefined,
          internalNotes: internalNotes.trim() || undefined,
          price: priceNum,
          vatRate: vatRatePayload,
          available,
          categoryId: categoryIdForCreate,
          menuId,
          station: resolvedStation,
          imageStorageId: finalImageStorageId,
          imageUrl: finalImageUrl ?? null,
          isFavorite,
          staffMealAllowed,
          staffMealPrice: staffMeal.staffMealPrice,
          staffMealFreeQty: staffMeal.staffMealFreeQty,
          staffMealDailyLimit: staffMeal.staffMealDailyLimit,
          trackStock: stockArgs.trackStock,
          stockUnit: stockArgs.stockUnit,
          initialStock: stockArgs.initialStock,
          lowStockThreshold: stockArgs.lowStockThreshold,
          currentStock: openingStock,
          ...(supplyCreate ? supplyMutationPayload : {}),
          ...(recipeSavePayload !== undefined
            ? { supplyRecipe: recipeSavePayload }
            : {}),
          customizationConfig: customizationSavePayload,
        };
        await saveDataCache(`menuItems:${licenseKey}`, [...cached, newItem]);
        onSaved?.(newItem, "create");
        toast.success(
          supplyCreate ? t("menu.toast_supply_created") : t("menu.toast_created"),
        );
      }
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? "");
      if (message.includes(MENU_ID_FIELDS_NEED_COLUMN)) {
        toast.error(t("menu.id_fields_need_db"), { duration: 8000 });
      } else if (message.includes(MENU_SKU_TAKEN)) {
        setTab("advanced");
        toast.error(t("menu.err_sku_taken"));
      } else if (message.includes(MENU_BARCODE_TAKEN)) {
        setTab("advanced");
        toast.error(t("menu.err_barcode_taken"));
      } else {
        toast.error(errorMessageFromUnknown(err, t("menu.err_save")));
      }
    } finally {
      setSaving(false);
    }
  };

  const supplyAccentKitchen =
    supplyMallContext && dialogNewTitleOverride === "supply_kitchen";
  const supplyAccentBar = supplyMallContext && dialogNewTitleOverride === "supply_bar";
  const saveColor = supplyAccentKitchen ? "#059669" : supplyAccentBar ? "#7c3aed" : BRAND;

  const libraryKeys = useMemo(
    () => ({
      ids: new Set(variantLibrary.map((g) => g.id)),
      names: new Set(variantLibrary.map((g) => g.name.trim().toLowerCase())),
    }),
    [variantLibrary],
  );
  const productOnlyGroupCount = customizationGroups.filter(
    (g) => !libraryKeys.ids.has(g.id) && !libraryKeys.names.has(g.name.trim().toLowerCase()),
  ).length;
  const autoPhoto = !imageFile && isStockPhotoUrl(imagePreview);
  const showRecipe = canEditRecipe && enterpriseSupplyRecipe && !supplyMallContext;
  const unitLabel = t(`menu.stock_unit_${stockUnit}`);

  const vatOptions = vatChoices.options.some((o) => formatTaxPercent(o.percent) === vatPct)
    ? vatChoices.options
    : [
        { id: "current", percent: parseDecimal(vatPct) || 0, label: `${vatPct}%`, nameKey: "" },
        ...vatChoices.options,
      ];

  const selectTrigger = (invalid?: boolean) =>
    cn(
      "h-11 w-full rounded-xl bg-white text-[14px] font-medium text-[#0b1220]",
      invalid ? "border-red-400" : "border-[#e3ebf7]",
    );
  const selectContent = "max-h-72 rounded-xl border-[#e3ebf7] bg-white text-[#0b1220]";
  const selectItem = "text-[14px] text-[#0b1220] focus:bg-[#f1f5ff] focus:text-[#0b1220]";
  const card = "rounded-[18px] border border-[#e3ebf7] bg-white/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

  const tabs: { id: ProductTab; label: string; icon: ReactNode }[] = [
    { id: "general", label: t("menu.tab_general"), icon: <Box className="size-5" strokeWidth={1.9} /> },
    { id: "variants", label: t("menu.tab_variants"), icon: <Layers className="size-5" strokeWidth={1.9} /> },
    { id: "stock", label: t("menu.tab_stock"), icon: <Soup className="size-5" strokeWidth={1.9} /> },
    { id: "advanced", label: t("menu.tab_advanced"), icon: <Settings className="size-5" strokeWidth={1.9} /> },
  ];

  const photoCard = (
    <div className={cn(card, "p-4")}>
      <div className="grid gap-5 sm:grid-cols-[168px_minmax(0,1fr)]">
        <div
          className="group relative size-[168px] shrink-0 overflow-hidden rounded-[18px] border border-[#e3ebf7] bg-[#f7f9fd] shadow-[0_6px_18px_-12px_rgba(15,23,42,0.45)]"
          title={autoPhoto ? t("menu.image_auto") : t("menu.image_hint")}
        >
          {imagePreview ? (
            <img src={imagePreview} alt={t("menu.image_preview_alt")} className="size-full object-cover" />
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex size-full flex-col items-center justify-center gap-2 text-[#64748b] hover:bg-[#f1f5ff]"
            >
              <ImageIcon className="size-7 text-[#94a3b8]" />
              <span className="text-[12px] font-semibold">{t("menu.image_upload")}</span>
            </button>
          )}
          <button
            type="button"
            aria-label={imagePreview ? t("menu.image_change") : t("menu.image_upload")}
            title={imagePreview ? t("menu.image_change") : t("menu.image_upload")}
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-2.5 top-2.5 flex size-9 items-center justify-center rounded-xl backdrop-blur-sm transition hover:scale-105"
            style={{ backgroundColor: "rgba(11,18,32,0.72)", color: "#ffffff" }}
          >
            <Pencil className="size-[17px]" strokeWidth={2} />
          </button>
          {imagePreview && !autoPhoto ? (
            <button
              type="button"
              aria-label={t("menu.image_remove")}
              title={t("menu.image_remove")}
              onClick={removeImage}
              className="absolute bottom-2.5 right-2.5 flex size-9 items-center justify-center rounded-xl backdrop-blur-sm transition hover:scale-105"
              style={{ backgroundColor: "rgba(11,18,32,0.72)", color: "#ffffff" }}
            >
              <Trash2 className="size-[17px]" strokeWidth={2} />
            </button>
          ) : null}
          {autoPhoto ? (
            <span
              className="absolute bottom-2.5 left-2.5 rounded-lg px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm"
              style={{ backgroundColor: "rgba(11,18,32,0.72)", color: "#ffffff" }}
            >
              {t("menu.image_auto_badge")}
            </span>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <div data-product-field="name">
            <FieldLabel required>{t("menu.label_product_name")}</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => touch("name")}
              placeholder={t("menu.placeholder_name_example")}
              className={cn(inputCls(Boolean(errorFor("name"))), "text-[15px] font-medium")}
            />
            <FieldMessage error={errorFor("name")} />
          </div>
          <div>
            <FieldLabel>{t("menu.label_description_short")}</FieldLabel>
            <div className="relative">
              <textarea
                value={description}
                maxLength={DESCRIPTION_MAX}
                onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
                placeholder={t("menu.placeholder_description")}
                rows={3}
                className="block w-full resize-none rounded-xl border border-[#e3ebf7] bg-white px-3.5 pb-7 pt-2.5 text-[14px] leading-relaxed text-[#0b1220] outline-none placeholder:text-[#94a3b8] focus:border-[#1d5ff0] focus:ring-2 focus:ring-[#1d5ff0]/15"
              />
              <span className="pointer-events-none absolute bottom-2 right-3 text-[12px] tabular-nums text-[#64748b]">
                {description.length} / {DESCRIPTION_MAX}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const generalPanel = (
    <div className="space-y-4">
      <div className={cn(card, "p-4")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div data-product-field="price">
            <FieldLabel required>{t("menu.label_price", { symbol: currency.symbol })}</FieldLabel>
            <div
              className={cn(
                "flex h-11 items-center overflow-hidden rounded-xl border bg-white focus-within:ring-2",
                errorFor("price")
                  ? "border-red-400 focus-within:ring-red-200"
                  : "border-[#e3ebf7] focus-within:border-[#1d5ff0] focus-within:ring-[#1d5ff0]/15",
              )}
            >
              <span className="flex h-full items-center bg-[#f7f9fd] px-3.5 text-[15px] font-semibold text-[#0b1220]">
                {currency.symbol}
              </span>
              <input
                value={price}
                inputMode="decimal"
                onChange={(e) => setPrice(e.target.value)}
                onBlur={() => {
                  touch("price");
                  const n = parseDecimal(price);
                  if (Number.isFinite(n) && n >= 0) setPrice(n.toFixed(currency.decimals));
                }}
                placeholder="0.00"
                className="h-full min-w-0 flex-1 bg-white px-3 text-[15px] font-medium tabular-nums text-[#0b1220] outline-none placeholder:text-[#94a3b8]"
              />
            </div>
            <FieldMessage error={errorFor("price")} />
          </div>

          <div>
            <FieldLabel required>{t("menu.label_vat_rate")}</FieldLabel>
            <Select
              value={vatPct}
              disabled={!canEditVat}
              onValueChange={(v) => {
                setVatPct(v);
                setVatTouched(true);
              }}
            >
              <SelectTrigger className={selectTrigger()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContent}>
                {vatOptions.map((opt) => {
                  const n = formatTaxPercent(opt.percent);
                  return (
                    <SelectItem key={opt.id} value={n} className={selectItem}>
                      {opt.nameKey ? `${t(opt.nameKey)} ${n}%` : `${n}%`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {vatChoices.options.length === 0 ? <FieldMessage help={t("settings.tax_need_country")} /> : null}
          </div>

          <div data-product-field="category">
            <FieldLabel required>{t("menu.label_category")}</FieldLabel>
            <Select
              value={selectedCategoryId ?? ""}
              onValueChange={(v) => {
                setSelectedCategoryId(v as Id<"menuCategories">);
                touch("category");
              }}
            >
              <SelectTrigger className={selectTrigger(Boolean(errorFor("category")))}>
                <SelectValue placeholder={t("menu.select_category")} />
              </SelectTrigger>
              <SelectContent className={selectContent}>
                {categories.map((cat) => {
                  const glyph = (cat.icon && String(cat.icon).trim()) || emojiForCategoryName(cat.name ?? "");
                  return (
                    <SelectItem key={cat._id} value={cat._id} className={selectItem}>
                      <span className="flex items-center gap-2.5">
                        <span className="flex size-6 items-center justify-center">
                          {glyph ? (
                            <span className="text-[18px] leading-none">{glyph}</span>
                          ) : (
                            <UtensilsCrossed className="size-4 text-[#2563eb]" />
                          )}
                        </span>
                        {cat.name}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <FieldMessage
              error={errorFor("category")}
              help={categories.length === 0 ? t("menu.no_categories_hint") : undefined}
            />
          </div>

          <div data-product-field="station">
            <FieldLabel required>{t("menu.label_station_short")}</FieldLabel>
            <Select
              value={station ?? ""}
              onValueChange={(v) => {
                setStation(v as "kitchen" | "bar");
                touch("station");
              }}
            >
              <SelectTrigger className={selectTrigger(Boolean(errorFor("station")))}>
                <SelectValue placeholder={t("menu.select_station")} />
              </SelectTrigger>
              <SelectContent className={selectContent}>
                <SelectItem value="kitchen" className={selectItem}>
                  <span className="flex items-center gap-2.5">
                    <ChefHat className="size-[18px]" strokeWidth={1.9} />
                    {t("menu.station_kitchen")}
                  </span>
                </SelectItem>
                <SelectItem value="bar" className={selectItem}>
                  <span className="flex items-center gap-2.5">
                    <Wine className="size-[18px]" strokeWidth={1.9} />
                    {t("menu.station_bar")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldMessage error={errorFor("station")} />
          </div>
        </div>
      </div>

      <div className={cn(card, "divide-y divide-[#eef2f8] overflow-hidden")}>
        <ToggleRow
          flat
          icon={<Bookmark className="size-5" strokeWidth={1.9} />}
          title={t("menu.label_favorites")}
          help={t("menu.favorites_help")}
          checked={isFavorite}
          onChange={setIsFavorite}
        />
        <ToggleRow
          flat
          icon={<Users className="size-5" strokeWidth={1.9} />}
          title={t("menu.label_staff_meal_allow")}
          help={t("menu.staff_meal_help")}
          checked={staffMealAllowed}
          onChange={(next) => {
            setStaffMealAllowed(next);
            if (next && !staffMealDailyLimit.trim()) setStaffMealDailyLimit("1");
          }}
        />
        {staffMealAllowed ? (
          <button
            type="button"
            onClick={() => setTab("advanced")}
            className="flex w-full items-center justify-between gap-2 bg-[#f9fbff] px-4 py-2.5 text-left text-[13px] font-semibold text-[#1d4ed8] hover:bg-[#f1f5ff]"
          >
            {t("menu.staff_meal_settings_link")}
            <ChevronRight className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );

  const attachedKeys = {
    ids: new Set(customizationGroups.map((g) => g.id)),
    names: new Set(customizationGroups.map((g) => g.name.trim().toLowerCase())),
  };
  const addableLibrary = variantLibrary.filter(
    (lib) => !attachedKeys.ids.has(lib.id) && !attachedKeys.names.has(lib.name.trim().toLowerCase()),
  );
  const signedPrice = (delta: number) =>
    delta < 0 ? `− ${formatPrice(Math.abs(delta))}` : `+ ${formatPrice(delta)}`;
  const moveGroup = (fromId: string, toId: string) =>
    setCustomizationGroups((groups) => {
      const list = [...groups];
      const from = list.findIndex((g) => g.id === fromId);
      const to = list.findIndex((g) => g.id === toId);
      if (from < 0 || to < 0 || from === to) return groups;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return list;
    });

  const variantsPanel = (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-[#2563eb]">
          <Layers className="size-6" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold text-[#0b1220]">{t("menu.vg_title")}</p>
          <p className="text-[13px] text-[#64748b]">{t("menu.vg_subtitle")}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-4 text-[14px] font-semibold shadow-[0_8px_18px_-10px_rgba(37,99,235,0.9)]"
              style={{ backgroundColor: BRAND, color: "#ffffff" }}
            >
              <Plus className="size-4" strokeWidth={2.2} />
              {t("menu.vg_add")}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-72 rounded-xl border-[#e3ebf7] bg-white p-1.5 text-[#0b1220]"
          >
            {addableLibrary.length > 0 ? (
              addableLibrary.map((lib) => {
                const Icon = variantGroupIcon(lib.name);
                return (
                  <DropdownMenuItem
                    key={lib.id}
                    onSelect={() => setCustomizationGroups((groups) => [...groups, { ...lib }])}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] focus:bg-[#f1f5ff] focus:text-[#0b1220]"
                  >
                    <Icon className="size-4 text-[#2563eb]" />
                    <span className={cn("min-w-0 flex-1 truncate font-medium", lib.active === false && "opacity-60")}>
                      {lib.name}
                    </span>
                    <span className="text-[12px] text-[#64748b]">
                      {t(lib.options.length === 1 ? "menu.vg_option_count_one" : "menu.vg_option_count", {
                        count: lib.options.length,
                      })}
                    </span>
                  </DropdownMenuItem>
                );
              })
            ) : (
              <p className="px-2.5 py-2 text-[13px] text-[#64748b]">
                {variantLibrary.length === 0 ? t("menu.variant_library_empty") : t("menu.vg_all_added")}
              </p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {customizationGroups.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-[#c7d6f5] bg-white/70 px-4 py-6 text-center text-[13px] text-[#64748b]">
          {t("menu.vg_none_attached")}
        </div>
      ) : (
        <div className="space-y-3">
          {customizationGroups.map((group) => {
            const Icon = variantGroupIcon(group.name);
            const multi = group.selectionType === "multi";
            const { min, max } = selectionLimits(group);
            const collapsed = collapsedGroups.has(group.id);
            const fromLibrary =
              libraryKeys.ids.has(group.id) || libraryKeys.names.has(group.name.trim().toLowerCase());
            return (
              <div
                key={group.id}
                onDragOver={(e) => {
                  if (dragGroupId && dragGroupId !== group.id) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragGroupId) moveGroup(dragGroupId, group.id);
                  setDragGroupId(null);
                }}
                className={cn(
                  "overflow-hidden rounded-[18px] border border-[#e3ebf7] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
                  dragGroupId === group.id && "opacity-50",
                )}
              >
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragGroupId(group.id);
                    }}
                    onDragEnd={() => setDragGroupId(null)}
                    title={t("menu.vg_drag")}
                    className="cursor-grab text-[#94a3b8]"
                  >
                    <GripVertical className="size-5" />
                  </span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f5ff] text-[#2563eb]">
                    <Icon className="size-5" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-[#0b1220]">
                      {group.name}
                      {!fromLibrary ? (
                        <span className="ml-2 align-middle text-[11px] font-semibold text-[#64748b]">
                          {t("menu.vg_product_only")}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[12px] text-[#64748b]">
                      {group.required ? t("menu.vg_required") : t("menu.vg_optional")}
                      {" • "}
                      {multi ? t("menu.vg_multi", { min, max }) : t("menu.vg_single")}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-[12px] font-semibold"
                    style={
                      group.required
                        ? { backgroundColor: "#f1edff", color: "#6d28d9" }
                        : { backgroundColor: "#eaf2ff", color: "#1d4ed8" }
                    }
                  >
                    {group.required ? t("menu.vg_required") : t("menu.vg_optional")}
                  </span>
                  <button
                    type="button"
                    aria-label={collapsed ? t("menu.vg_expand") : t("menu.vg_collapse")}
                    aria-expanded={!collapsed}
                    onClick={() =>
                      setCollapsedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.id)) next.delete(group.id);
                        else next.add(group.id);
                        return next;
                      })
                    }
                    className="flex size-8 items-center justify-center rounded-lg text-[#0b1220] hover:bg-[#f1f5fb]"
                  >
                    <ChevronDown className={cn("size-4 transition-transform", !collapsed && "rotate-180")} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("menu.vg_remove")}
                    title={t("menu.vg_remove")}
                    onClick={() => setCustomizationGroups((groups) => groups.filter((g) => g.id !== group.id))}
                    className="flex size-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="size-[18px]" />
                  </button>
                </div>

                {!collapsed ? (
                  <div className="border-t border-[#eef2f8]">
                    <div className="grid grid-cols-[1fr_140px] gap-2 bg-[#f7f9fd] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#334155]">
                      <span className="pl-7">{t("menu.vg_col_option")}</span>
                      <span>{t("menu.vg_col_price")}</span>
                    </div>
                    {group.options.map((o) => {
                      const isDefault = !multi && o.isDefault === true;
                      return (
                        <div
                          key={o.id}
                          className={cn(
                            "grid grid-cols-[1fr_140px] items-center gap-2 border-t border-[#f1f4f9] px-4 py-2",
                            isDefault && "bg-[#f5f8ff]",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            {multi ? (
                              <span className="size-[18px] shrink-0 rounded-[5px] border-2 border-[#cbd5e1] bg-white" />
                            ) : (
                              <span
                                className="flex size-[18px] shrink-0 items-center justify-center rounded-full border-2"
                                style={{ borderColor: isDefault ? BRAND : "#cbd5e1" }}
                              >
                                {isDefault ? (
                                  <span className="size-2 rounded-full" style={{ backgroundColor: BRAND }} />
                                ) : null}
                              </span>
                            )}
                            <span className="truncate text-[14px] text-[#0b1220]">{o.name}</span>
                            {isDefault ? (
                              <span
                                className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                                style={{ backgroundColor: "#e8f0ff", color: "#1d4ed8" }}
                              >
                                {t("menu.vg_default")}
                              </span>
                            ) : null}
                          </span>
                          <span className="w-fit rounded-lg border border-[#e3ebf7] bg-white px-2.5 py-1 text-[13px] font-semibold tabular-nums text-[#0b1220]">
                            {signedPrice(Number(o.priceDelta ?? 0))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[12px] text-[#64748b]">{t("menu.vg_edit_hint")}</p>

      <div>
        <Disclosure
          title={t("menu.product_options_title")}
          meta={productOnlyGroupCount > 0 ? String(productOnlyGroupCount) : undefined}
          open={optionsOpen}
          onToggle={() => setOptionsOpen((v) => !v)}
        >
          <MenuItemCustomizationEditor
            groups={customizationGroups}
            onChange={setCustomizationGroups}
            labels={{
              title: t("menu.customization_title"),
              addGroup: t("menu.customization_add_group"),
              groupName: t("menu.customization_group_name"),
              required: t("menu.customization_required"),
              multi: t("menu.customization_multi"),
              addOption: t("menu.customization_add_option"),
              optionName: t("menu.customization_option_name"),
              priceDelta: t("menu.customization_price_delta"),
              defaultOption: t("menu.customization_default"),
              emptyHint: t("menu.customization_empty_hint"),
            }}
          />
        </Disclosure>
      </div>
    </div>
  );

  const unitSelect = (
    value: string,
    onChange: (unit: StockUnit) => void,
    units: readonly StockUnit[],
    className?: string,
  ) => (
    <Select value={value} onValueChange={(v) => onChange(v as StockUnit)}>
      <SelectTrigger className={cn(selectTrigger(), className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={selectContent}>
        {units.map((u) => (
          <SelectItem key={u} value={u} className={selectItem}>
            {t(`menu.stock_unit_${u}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  /** Field with a leading icon tile, as in the stock row of the design. */
  const iconInput = (icon: ReactNode, input: ReactNode, invalid?: boolean) => (
    <div
      className={cn(
        "flex h-11 items-center overflow-hidden rounded-xl border bg-white focus-within:ring-2",
        invalid
          ? "border-red-400 focus-within:ring-red-200"
          : "border-[#e3ebf7] focus-within:border-[#1d5ff0] focus-within:ring-[#1d5ff0]/15",
      )}
    >
      <span className="flex h-full w-11 shrink-0 items-center justify-center border-r border-[#e3ebf7] bg-[#f7f9fd] text-[#334155]">
        {icon}
      </span>
      {input}
    </div>
  );

  const ingredientById = new Map(recipeIngredientOptions.map((i) => [String(i._id), i]));
  const moveRecipeLine = (fromKey: string, toKey: string) =>
    setRecipeLines((prev) => {
      const list = [...prev];
      const from = list.findIndex((l) => l.key === fromKey);
      const to = list.findIndex((l) => l.key === toKey);
      if (from < 0 || to < 0 || from === to) return prev;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return list;
    });
  const addRecipeLine = () =>
    setRecipeLines((prev) => [...prev, { key: newRecipeLineKey(), supplyMenuItemId: "", qty: "", unit: "" }]);

  const stockPanel = (
    <div className="space-y-4">
      <div className={cn(card, "p-4")}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-[#2563eb]">
            <Package className="size-6" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold text-[#0b1220]">{t("menu.stock_title")}</p>
            <p className="text-[13px] text-[#64748b]">{t("menu.stock_subtitle")}</p>
          </div>
          <ToggleSwitch checked={trackStock} label={t("menu.label_track_stock")} onChange={() => setTrackStock(!trackStock)} />
        </div>

        {trackStock ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel>{t("menu.label_unit")}</FieldLabel>
                {unitSelect(stockUnit, setStockUnit, stockUnitOptions.map((u) => u.value))}
              </div>
              <div data-product-field="stock">
                <FieldLabel>{t("menu.label_initial_stock")}</FieldLabel>
                {iconInput(
                  <Archive className="size-[18px]" strokeWidth={1.9} />,
                  <input
                    value={initialStock}
                    inputMode="decimal"
                    onChange={(e) => {
                      setInitialStock(e.target.value);
                      setStockQtyTouched(true);
                    }}
                    onBlur={() => touch("stock")}
                    placeholder={t("menu.placeholder_qty_example")}
                    className="h-full min-w-0 flex-1 bg-white px-3 text-[15px] font-medium tabular-nums text-[#0b1220] outline-none placeholder:text-[#94a3b8]"
                  />,
                  Boolean(errorFor("stock")),
                )}
                <FieldMessage error={errorFor("stock")} />
              </div>
              <div data-product-field="lowStock">
                <FieldLabel>{t("menu.low_stock_alert")}</FieldLabel>
                {iconInput(
                  <Bell className="size-[18px]" strokeWidth={1.9} />,
                  <input
                    value={lowStockThreshold}
                    inputMode="decimal"
                    onChange={(e) => {
                      setLowStockThreshold(e.target.value);
                      setLowStockTouched(true);
                    }}
                    onBlur={() => touch("lowStock")}
                    placeholder={String(venueLowStock)}
                    className="h-full min-w-0 flex-1 bg-white px-3 text-[15px] font-medium tabular-nums text-[#0b1220] outline-none placeholder:text-[#94a3b8]"
                  />,
                  Boolean(errorFor("lowStock")),
                )}
                <FieldMessage error={errorFor("lowStock")} />
              </div>
            </div>
            <p className="mt-2 text-[12px] text-[#64748b]">
              {stockMode === "adjust" ? t("menu.stock_adjust_help") : t("menu.stock_opening_help")}
            </p>
          </>
        ) : null}
      </div>

      {showRecipe ? (
        <div className={cn(card, "p-4")} data-product-field="recipe">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-[#2563eb]">
              <Soup className="size-6" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold text-[#0b1220]">
                {t("menu.recipe_title")}{" "}
                <span className="text-[13px] font-medium text-[#64748b]">({t("variants_page.optional_label")})</span>
              </p>
              <p className="text-[13px] text-[#64748b]">{t("menu.recipe_subtitle")}</p>
            </div>
            <ToggleSwitch
              checked={recipeEnabled}
              label={t("menu.recipe_title")}
              onChange={() => {
                const next = !recipeEnabled;
                setRecipeEnabled(next);
                if (next && recipeLines.length === 0) addRecipeLine();
              }}
            />
          </div>

          {recipeEnabled ? (
            <div className="mt-3">
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={addRecipeLine}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dbe7ff] bg-white px-3.5 text-[13px] font-semibold text-[#1d4ed8] shadow-sm hover:bg-[#f5f8ff]"
                >
                  <Plus className="size-4" strokeWidth={2.2} />
                  {t("menu.recipe_add_ingredient")}
                </button>
              </div>

              {recipeIngredientOptions.length === 0 ? (
                <p className="mb-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  {t("menu.recipe_no_supply_items")}
                </p>
              ) : null}

              <div className="overflow-hidden rounded-xl border border-[#e3ebf7] bg-white">
                <div className="grid grid-cols-[52px_minmax(0,1fr)_112px_140px_32px] items-center gap-2 bg-[#f7f9fd] px-3 py-2 text-[12px] font-semibold text-[#334155]">
                  <span className="text-center">#</span>
                  <span>{t("menu.recipe_ingredient")}</span>
                  <span>{t("menu.label_unit")}</span>
                  <span>
                    {t("menu.recipe_qty_short")}{" "}
                    <span className="font-medium text-[#64748b]">({t("menu.recipe_per_portion")})</span>
                  </span>
                  <span />
                </div>
                {recipeLines.map((line, idx) => {
                  const picked = ingredientById.get(String(line.supplyMenuItemId));
                  const stockUnitOfPick = (picked?.stockUnit as StockUnit | undefined) ?? undefined;
                  const units = compatibleUnits(stockUnitOfPick);
                  const lineUnit = line.unit || stockUnitOfPick || "pc";
                  const lineInvalid =
                    Boolean(errorFor("recipe")) &&
                    (!String(line.supplyMenuItemId) || !(parseDecimal(line.qty) > 0));
                  return (
                    <div
                      key={line.key}
                      onDragOver={(e) => {
                        if (dragRecipeKey && dragRecipeKey !== line.key) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragRecipeKey) moveRecipeLine(dragRecipeKey, line.key);
                        setDragRecipeKey(null);
                      }}
                      className={cn(
                        "grid grid-cols-[52px_minmax(0,1fr)_112px_140px_32px] items-center gap-2 border-t border-[#eef2f8] px-3 py-2",
                        dragRecipeKey === line.key && "opacity-50",
                      )}
                    >
                      <span className="flex items-center gap-1">
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            setDragRecipeKey(line.key);
                          }}
                          onDragEnd={() => setDragRecipeKey(null)}
                          title={t("menu.recipe_drag")}
                          className="cursor-grab text-[#94a3b8]"
                        >
                          <GripVertical className="size-4" />
                        </span>
                        <span className="flex size-7 items-center justify-center rounded-full border border-[#e3ebf7] bg-[#f7f9fd] text-[13px] font-bold text-[#0b1220]">
                          {idx + 1}
                        </span>
                      </span>

                      <Select
                        value={String(line.supplyMenuItemId)}
                        onValueChange={(v) => {
                          const next = ingredientById.get(v);
                          setRecipeLines((prev) =>
                            prev.map((row) =>
                              row.key === line.key
                                ? {
                                    ...row,
                                    supplyMenuItemId: v as Id<"menuItems">,
                                    unit: (next?.stockUnit as StockUnit | undefined) ?? "",
                                  }
                                : row,
                            ),
                          );
                        }}
                      >
                        <SelectTrigger
                          className={cn(selectTrigger(lineInvalid && !line.supplyMenuItemId), "h-10")}
                          aria-label={t("menu.recipe_ingredient")}
                        >
                          <SelectValue placeholder={t("menu.recipe_pick_ingredient")} />
                        </SelectTrigger>
                        <SelectContent className={selectContent}>
                          {recipeIngredientOptions.map((opt) => {
                            const g = ingredientEmoji(opt.name) ?? emojiForCategoryName(opt.name);
                            return (
                              <SelectItem key={opt._id} value={String(opt._id)} className={selectItem}>
                                <span className="flex items-center gap-2.5">
                                  <span className="flex size-6 items-center justify-center">
                                    {g ? (
                                      <span className="text-[18px] leading-none">{g}</span>
                                    ) : (
                                      <Package className="size-4 text-[#2563eb]" />
                                    )}
                                  </span>
                                  {opt.name}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>

                      {unitSelect(
                        lineUnit,
                        (unit) =>
                          setRecipeLines((prev) =>
                            prev.map((row) => (row.key === line.key ? { ...row, unit } : row)),
                          ),
                        units,
                        "h-10",
                      )}

                      <Input
                        value={line.qty}
                        inputMode="decimal"
                        aria-label={t("menu.recipe_qty_label")}
                        onChange={(e) =>
                          setRecipeLines((prev) =>
                            prev.map((row) => (row.key === line.key ? { ...row, qty: e.target.value } : row)),
                          )
                        }
                        onBlur={() => touch("recipe")}
                        placeholder={t("menu.recipe_qty_placeholder")}
                        className={cn(
                          inputCls(lineInvalid && !(parseDecimal(line.qty) > 0)),
                          "h-10 tabular-nums",
                        )}
                      />

                      <button
                        type="button"
                        aria-label={t("menu.recipe_remove_line")}
                        onClick={() => setRecipeLines((prev) => prev.filter((row) => row.key !== line.key))}
                        className="flex size-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="size-[18px]" />
                      </button>
                    </div>
                  );
                })}
                {recipeLines.length === 0 ? (
                  <p className="border-t border-[#eef2f8] px-3 py-4 text-center text-[13px] text-[#64748b]">
                    {t("menu.recipe_empty")}
                  </p>
                ) : null}
              </div>
              <FieldMessage error={errorFor("recipe")} help={t("menu.recipe_timing_help")} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const cardHeader = (icon: ReactNode, title: ReactNode, subtitle: string, action?: ReactNode) => (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-[#2563eb]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-bold text-[#0b1220]">{title}</p>
        <p className="text-[13px] text-[#64748b]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
  const settingRow = (icon: ReactNode, label: string, control: ReactNode) => (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-[#334155]">{icon}</span>
      <span className="min-w-0 flex-1 text-[14px] font-semibold text-[#0b1220]">{label}</span>
      {control}
    </div>
  );
  const comingSoon = (
    <span className="rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-[11px] font-semibold text-[#64748b]">
      {t("menu.coming_soon")}
    </span>
  );

  const limitN = /^\d+$/.test(staffMealDailyLimit.trim()) ? Number(staffMealDailyLimit) : 0;
  const freeN = /^\d+$/.test(staffMealFreeQty.trim()) ? Number(staffMealFreeQty) : 0;
  const freeCap = limitN > 0 ? limitN : 999;
  const setDailyLimit = (next: number) => {
    const n = Math.min(999, Math.max(0, next));
    setStaffMealDailyLimit(n > 0 ? String(n) : "");
    if (n > 0 && freeN > n) setStaffMealFreeQty(String(n));
  };

  const advancedPanel = (
    <div className="space-y-4">
      <div className={cn(card, "p-4")}>
        {cardHeader(
          <Barcode className="size-6" strokeWidth={1.9} />,
          t("menu.id_title"),
          t("menu.id_subtitle"),
        )}
        <div className="mt-4 space-y-3">
          <div className="grid items-start gap-2 sm:grid-cols-[150px_minmax(0,1fr)]" data-product-field="sku">
            <span className="pt-3 text-[13px] font-semibold text-[#0b1220]">{t("menu.label_sku")}</span>
            <div>
              <Input
                value={sku}
                maxLength={32}
                onChange={(e) => setSku(e.target.value)}
                onBlur={() => touch("sku")}
                placeholder={t("menu.placeholder_sku")}
                className={inputCls(Boolean(errorFor("sku")))}
              />
              <FieldMessage error={errorFor("sku")} />
            </div>
          </div>
          <div className="grid items-start gap-2 sm:grid-cols-[150px_minmax(0,1fr)]" data-product-field="barcode">
            <span className="pt-3 text-[13px] font-semibold text-[#0b1220]">{t("menu.label_barcode")}</span>
            <div>
              <div
                className={cn(
                  "flex h-11 items-center overflow-hidden rounded-xl border bg-white focus-within:ring-2",
                  errorFor("barcode")
                    ? "border-red-400 focus-within:ring-red-200"
                    : "border-[#e3ebf7] focus-within:border-[#1d5ff0] focus-within:ring-[#1d5ff0]/15",
                )}
              >
                <input
                  ref={barcodeInputRef}
                  value={barcode}
                  maxLength={32}
                  onChange={(e) => setBarcode(e.target.value.trim())}
                  onBlur={() => touch("barcode")}
                  onKeyDown={(e) => {
                    // Scanners finish with Enter; keep it from reaching other controls.
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  placeholder={t("menu.placeholder_barcode")}
                  className="h-full min-w-0 flex-1 bg-white px-3 text-[14px] tabular-nums text-[#0b1220] outline-none placeholder:text-[#94a3b8]"
                />
                <button
                  type="button"
                  title={t("menu.barcode_scan_hint")}
                  aria-label={t("menu.barcode_scan_hint")}
                  onClick={() => {
                    barcodeInputRef.current?.focus();
                    barcodeInputRef.current?.select();
                  }}
                  className="mr-1.5 flex size-8 items-center justify-center rounded-lg bg-[#eef4ff] text-[#1d4ed8] hover:bg-[#e2ebff]"
                >
                  <ScanLine className="size-[18px]" strokeWidth={1.9} />
                </button>
              </div>
              <FieldMessage error={errorFor("barcode")} help={t("menu.barcode_help")} />
            </div>
          </div>
        </div>
      </div>

      <div className={cn(card, "p-4")}>
        {cardHeader(
          <Layers className="size-6" strokeWidth={1.9} />,
          t("menu.status_display_title"),
          t("menu.status_display_subtitle"),
        )}
        <div className="mt-2 divide-y divide-[#eef2f8]">
          {settingRow(
            <ShoppingCart className="size-5" strokeWidth={1.9} />,
            t("menu.available_for_sale"),
            <ToggleSwitch checked={available} label={t("menu.available_for_sale")} onChange={() => setAvailable(!available)} />,
          )}
          {settingRow(
            <Bookmark className="size-5" strokeWidth={1.9} />,
            t("menu.label_favorites"),
            <ToggleSwitch checked={isFavorite} label={t("menu.label_favorites")} onChange={() => setIsFavorite(!isFavorite)} />,
          )}
        </div>
      </div>

      <div className={cn(card, "p-4")}>
        {cardHeader(
          <Users className="size-6" strokeWidth={1.9} />,
          t("menu.section_staff"),
          t("menu.staff_meal_help"),
          <ToggleSwitch
            checked={staffMealAllowed}
            label={t("menu.label_staff_meal_allow")}
            onChange={() => {
              const next = !staffMealAllowed;
              setStaffMealAllowed(next);
              if (next && !staffMealDailyLimit.trim()) setStaffMealDailyLimit("1");
            }}
          />,
        )}
        {staffMealAllowed ? (
          <div className="mt-4 space-y-4">
            <div className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
              <Segmented
                value={staffMealPricingMode}
                onChange={(v) => setStaffMealPricingMode(v as "free" | "custom")}
                options={[
                  { value: "free", label: t("menu.staff_meal_free") },
                  { value: "custom", label: t("menu.staff_meal_special_price") },
                ]}
              />
              <div data-product-field="staffPrice">
                <div
                  className={cn(
                    "flex h-11 items-center overflow-hidden rounded-xl border bg-white",
                    staffMealPricingMode !== "custom" && "bg-[#f7f9fd] opacity-60",
                    errorFor("staffPrice") && staffMealPricingMode === "custom" ? "border-red-400" : "border-[#e3ebf7]",
                  )}
                >
                  <span className="flex h-full items-center px-3 text-[14px] font-semibold text-[#64748b]">
                    {currency.symbol}
                  </span>
                  <input
                    value={staffMealPricingMode === "custom" ? staffMealCustomPrice : ""}
                    disabled={staffMealPricingMode !== "custom"}
                    inputMode="decimal"
                    aria-label={t("menu.label_staff_price")}
                    onChange={(e) => setStaffMealCustomPrice(e.target.value)}
                    onBlur={() => touch("staffPrice")}
                    placeholder="0.00"
                    className="h-full min-w-0 flex-1 bg-transparent pr-3 text-[14px] tabular-nums text-[#0b1220] outline-none placeholder:text-[#94a3b8] disabled:cursor-not-allowed"
                  />
                </div>
                {staffMealPricingMode === "custom" ? <FieldMessage error={errorFor("staffPrice")} /> : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div data-product-field="staffFreeQty">
                <FieldLabel>{t("menu.label_free_quantity")}</FieldLabel>
                <NumberStepper
                  value={staffMealPricingMode === "free" ? staffMealDailyLimit : staffMealFreeQty}
                  placeholder={staffMealPricingMode === "free" ? "∞" : "0"}
                  disabled={staffMealPricingMode === "free"}
                  invalid={Boolean(errorFor("staffFreeQty"))}
                  canDecrease={staffMealPricingMode === "custom" && freeN > 0}
                  canIncrease={staffMealPricingMode === "custom" && freeN < freeCap}
                  decreaseLabel={t("variants_page.decrease")}
                  increaseLabel={t("variants_page.increase")}
                  onStep={(d) => setStaffMealFreeQty(String(Math.min(freeCap, Math.max(0, freeN + d))))}
                  onType={(v) => setStaffMealFreeQty(v === "" ? "" : String(Math.min(freeCap, Number(v))))}
                  onBlur={() => touch("staffFreeQty")}
                />
                <FieldMessage
                  error={errorFor("staffFreeQty")}
                  help={
                    staffMealPricingMode === "free"
                      ? t("menu.staff_free_all_help")
                      : t("menu.hint_staff_meal_first_free")
                  }
                />
              </div>
              <div data-product-field="staffDailyLimit">
                <FieldLabel>{t("menu.label_daily_limit")}</FieldLabel>
                <NumberStepper
                  value={staffMealDailyLimit}
                  placeholder="∞"
                  invalid={Boolean(errorFor("staffDailyLimit"))}
                  canDecrease={limitN > 0}
                  canIncrease={limitN < 999}
                  decreaseLabel={t("variants_page.decrease")}
                  increaseLabel={t("variants_page.increase")}
                  onStep={(d) => setDailyLimit(limitN + d)}
                  onType={(v) => (v === "" ? setStaffMealDailyLimit("") : setDailyLimit(Number(v)))}
                  onBlur={() => touch("staffDailyLimit")}
                />
                <FieldMessage error={errorFor("staffDailyLimit")} help={t("menu.daily_limit_help")} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className={cn(card, "p-4")}>
        {cardHeader(
          <SlidersHorizontal className="size-6" strokeWidth={1.9} />,
          t("menu.additional_title"),
          t("menu.additional_subtitle"),
        )}
        <div className="mt-2 divide-y divide-[#eef2f8] opacity-80">
          {settingRow(<Printer className="size-5" strokeWidth={1.9} />, t("menu.print_station_only"), comingSoon)}
          {settingRow(<Layers className="size-5" strokeWidth={1.9} />, t("menu.allow_modifiers"), comingSoon)}
        </div>
      </div>

      <div className={cn(card, "p-4")}>
        {cardHeader(
          <ClipboardList className="size-6" strokeWidth={1.9} />,
          <>
            {t("menu.internal_notes")}{" "}
            <span className="text-[13px] font-medium text-[#64748b]">({t("variants_page.optional_label")})</span>
          </>,
          t("menu.internal_notes_help"),
        )}
        <div className="relative mt-3">
          <textarea
            value={internalNotes}
            maxLength={DESCRIPTION_MAX}
            onChange={(e) => setInternalNotes(e.target.value.slice(0, DESCRIPTION_MAX))}
            placeholder={t("menu.internal_notes_placeholder")}
            rows={3}
            className="block w-full resize-none rounded-xl border border-[#e3ebf7] bg-white px-3.5 pb-7 pt-2.5 text-[14px] leading-relaxed text-[#0b1220] outline-none placeholder:text-[#94a3b8] focus:border-[#1d5ff0] focus:ring-2 focus:ring-[#1d5ff0]/15"
          />
          <span className="pointer-events-none absolute bottom-2 right-3 text-[12px] tabular-nums text-[#64748b]">
            {internalNotes.length} / {DESCRIPTION_MAX}
          </span>
        </div>
      </div>

      {menus && menus.length > 0 ? (
        <FormSection icon={<LayoutGrid className="size-[18px]" strokeWidth={2} />} title={t("menu.label_menu")}>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={menuId === undefined} onClick={() => setMenuId(undefined)}>
              {t("common.none")}
            </Chip>
            {menus.map((m) => (
              <Chip key={m._id} active={menuId === m._id} onClick={() => setMenuId(m._id)}>
                {m.name}
              </Chip>
            ))}
          </div>
        </FormSection>
      ) : null}
    </div>
  );

  const productBody = (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
      {photoCard}

      <div role="tablist" aria-label={t("menu.dialog_edit_title")} className="grid grid-cols-4 gap-2">
        {tabs.map((tb) => {
          const active = tab === tb.id;
          const hasError =
            submitted && FIELD_ORDER.some((f) => FIELD_TAB[f] === tb.id && errors[f]);
          return (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tb.id)}
              className={cn(
                "relative flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-2 text-[14px] font-semibold transition",
                active
                  ? "shadow-[0_10px_22px_-12px_rgba(37,99,235,0.9)]"
                  : "border border-[#e3ebf7] bg-white text-[#0b1220] shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:bg-[#f7f9fd]",
              )}
              style={active ? { backgroundColor: BRAND, color: "#ffffff" } : undefined}
            >
              {tb.icon}
              <span className="truncate">{tb.label}</span>
              {hasError ? (
                <span className="absolute right-2 top-2 size-2 rounded-full" style={{ backgroundColor: "#ef4444" }} />
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "general" ? generalPanel : null}
      {tab === "variants" ? variantsPanel : null}
      {tab === "stock" ? stockPanel : null}
      {tab === "advanced" ? advancedPanel : null}
    </div>
  );

  const supplyBody = (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border px-4 py-3",
          supplyAccentKitchen && "border-emerald-200/80 bg-emerald-50/60",
          supplyAccentBar && "border-violet-200/80 bg-violet-50/60",
        )}
      >
        {supplyAccentKitchen ? (
          <ChefHat className="size-5 shrink-0 text-emerald-700" />
        ) : (
          <Wine className="size-5 shrink-0 text-violet-700" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {supplyAccentKitchen ? t("menu.station_kitchen") : t("menu.station_bar")}
          </p>
          <p className="text-xs text-slate-600">
            {supplyAccentKitchen ? t("menu.supply_station_hint_kitchen") : t("menu.supply_station_hint_bar")}
          </p>
        </div>
      </div>

      {supplyQuickPresets.length > 0 && (
        <div
          className={cn(
            "space-y-2 rounded-2xl border p-3 shadow-sm",
            supplyAccentKitchen && "border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-white",
            supplyAccentBar && "border-violet-200/70 bg-gradient-to-br from-violet-50/50 to-white",
          )}
        >
          <Label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <Sparkles className="size-3.5 shrink-0 text-amber-500" />
            {t("menu.supply_quick_pick_title")}
          </Label>
          <p className="text-[11px] leading-snug text-slate-600">{t("menu.supply_quick_pick_hint")}</p>
          <div className="flex max-h-[9.5rem] flex-wrap gap-1.5 overflow-y-auto overscroll-contain pr-0.5">
            {supplyQuickPresets.map((p) => {
              const PresetIcon = p.Icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setName(t(p.labelKey));
                    setStockUnit(p.unit);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-left text-[11px] font-semibold transition-colors cursor-pointer",
                    supplyAccentKitchen &&
                      "border-emerald-200/80 bg-white text-emerald-900 hover:border-emerald-400 hover:bg-emerald-50",
                    supplyAccentBar &&
                      "border-violet-200/80 bg-white text-violet-950 hover:border-violet-400 hover:bg-violet-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full",
                      supplyAccentKitchen && "bg-emerald-500/15 text-emerald-800",
                      supplyAccentBar && "bg-violet-500/15 text-violet-900",
                    )}
                  >
                    <PresetIcon className="size-3.5" strokeWidth={2} />
                  </span>
                  <span className="leading-tight">{t(p.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2" data-product-field="name">
        <Label className="flex items-center gap-2 font-medium text-slate-600">
          <ClipboardList className="size-4 shrink-0 text-emerald-600" />
          {t("menu.label_name")}
        </Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => touch("name")}
          placeholder={t("menu.placeholder_supply_name")}
          className={cn(
            "h-11 border-slate-200 bg-slate-50 text-base font-medium text-slate-900",
            errorFor("name") && "border-red-400",
          )}
        />
        <FieldMessage error={errorFor("name")} />
      </div>

      <div className="space-y-2" data-product-field="price">
        <Label className="flex items-center gap-2 font-medium text-slate-600">
          <CircleDollarSign className="size-4 shrink-0 text-emerald-600" />
          {t("menu.supply_label_price", { symbol: currency.symbol })}
        </Label>
        <Input
          value={price}
          inputMode="decimal"
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => touch("price")}
          placeholder="0.00"
          className={cn("border-slate-200 bg-slate-50 text-slate-900", errorFor("price") && "border-red-400")}
        />
        <FieldMessage error={errorFor("price")} />
      </div>

      <div
        className={cn(
          "space-y-4 rounded-2xl border p-4 shadow-sm",
          supplyAccentKitchen && "border-emerald-200/90 bg-gradient-to-b from-emerald-50/80 to-white",
          supplyAccentBar && "border-violet-200/90 bg-gradient-to-b from-violet-50/80 to-white",
        )}
      >
        <div className="flex items-center gap-2">
          <Package className="size-4 shrink-0 text-slate-500" />
          <p className="text-sm font-semibold text-slate-900">{t("menu.supply_section_inventory")}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-600">{t("menu.label_unit")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {stockUnitOptions.map((u) => (
              <button
                key={u.value}
                type="button"
                onClick={() => setStockUnit(u.value)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border",
                  stockUnit === u.value
                    ? supplyAccentKitchen
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-800"
                      : "border-violet-500/60 bg-violet-500/15 text-violet-900"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                )}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1" data-product-field="stock">
            <Label className="text-xs font-medium text-slate-600">
              {editing ? t("menu.supply_qty_on_hand") : t("menu.initial_stock")}
            </Label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={t("menu.supply_qty_minus")}
                disabled={(parseDecimal(initialStock) || 0) <= 0}
                onClick={() => {
                  setStockQtyTouched(true);
                  setInitialStock((prev) => String(Math.max(0, (parseDecimal(prev) || 0) - 1)));
                }}
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer",
                  (parseDecimal(initialStock) || 0) <= 0
                    ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                    : supplyAccentKitchen
                      ? "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                      : "border-violet-200 bg-white text-violet-900 hover:bg-violet-50",
                )}
              >
                <Minus className="size-4" strokeWidth={2.5} />
              </button>
              <Input
                value={initialStock}
                inputMode="decimal"
                onChange={(e) => {
                  setStockQtyTouched(true);
                  setInitialStock(e.target.value);
                }}
                onBlur={() => touch("stock")}
                placeholder={t("menu.placeholder_qty_example")}
                className={cn(
                  "min-w-0 flex-1 border-slate-200 bg-white text-center text-slate-900 tabular-nums",
                  errorFor("stock") && "border-red-400",
                )}
              />
              <button
                type="button"
                aria-label={t("menu.supply_qty_plus")}
                onClick={() => {
                  setStockQtyTouched(true);
                  setInitialStock((prev) => String((parseDecimal(prev) || 0) + 1));
                }}
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer",
                  supplyAccentKitchen
                    ? "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                    : "border-violet-200 bg-white text-violet-900 hover:bg-violet-50",
                )}
              >
                <Plus className="size-4" strokeWidth={2.5} />
              </button>
            </div>
            <FieldMessage error={errorFor("stock")} />
          </div>
          <div className="space-y-1" data-product-field="lowStock">
            <Label className="text-xs font-medium text-slate-600">{t("menu.low_stock_alert")}</Label>
            <Input
              value={lowStockThreshold}
              inputMode="decimal"
              onChange={(e) => {
                setLowStockThreshold(e.target.value);
                setLowStockTouched(true);
              }}
              onBlur={() => touch("lowStock")}
              placeholder={t("menu.placeholder_low_stock_example")}
              className={cn("border-slate-200 bg-white text-slate-900", errorFor("lowStock") && "border-red-400")}
            />
            <FieldMessage error={errorFor("lowStock")} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3",
            supplyAccentKitchen && "border-emerald-200/80 bg-emerald-50/40",
            supplyAccentBar && "border-violet-200/80 bg-violet-50/40",
          )}
        >
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="supply-details-toggle" className="text-sm font-medium text-slate-900">
              {t("menu.supply_details_toggle")}
            </Label>
            <p className="text-xs text-slate-600">{t("menu.supply_details_toggle_hint")}</p>
          </div>
          <Switch
            id="supply-details-toggle"
            checked={supplyDetailsOpen}
            onCheckedChange={setSupplyDetailsOpen}
          />
        </div>
        {supplyDetailsOpen ? (
          <div
            className={cn(
              "space-y-4 rounded-2xl border p-4 shadow-sm",
              supplyAccentKitchen && "border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-white",
              supplyAccentBar && "border-violet-200/80 bg-gradient-to-br from-violet-50/70 to-white",
            )}
          >
            <div className="flex items-center gap-2">
              <Truck className="size-4 shrink-0 text-slate-600" />
              <p className="text-sm font-semibold text-slate-900">{t("menu.supply_section_details")}</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <Truck className="size-3.5 text-slate-500" />
                {t("menu.supply_label_vendor")}
              </Label>
              <Input
                value={supplyVendor}
                onChange={(e) => setSupplyVendor(e.target.value)}
                placeholder={t("menu.supply_placeholder_vendor")}
                className="border-slate-200 bg-white text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <Hash className="size-3.5 text-slate-500" />
                {t("menu.supply_label_lot")}
              </Label>
              <Input
                value={supplyLot}
                onChange={(e) => setSupplyLot(e.target.value)}
                placeholder={t("menu.supply_placeholder_lot")}
                className="border-slate-200 bg-white text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <CalendarDays className="size-3.5 text-slate-500" />
                {t("menu.supply_label_expiry")}
              </Label>
              <Input
                type="date"
                value={supplyExpiryDate}
                onChange={(e) => setSupplyExpiryDate(e.target.value)}
                className="border-slate-200 bg-white text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <Warehouse className="size-3.5 text-slate-500" />
                {t("menu.supply_storage_label")}
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    { value: "fridge" as const, Icon: Thermometer, label: t("menu.supply_storage_fridge") },
                    { value: "freezer" as const, Icon: Snowflake, label: t("menu.supply_storage_freezer") },
                    { value: "dry" as const, Icon: Warehouse, label: t("menu.supply_storage_dry") },
                    { value: "ambient" as const, Icon: Sun, label: t("menu.supply_storage_ambient") },
                  ] as const
                ).map(({ value, Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSupplyStorage((s) => (s === value ? undefined : value))}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center text-[11px] font-semibold transition-all cursor-pointer",
                      supplyStorage === value
                        ? supplyAccentKitchen
                          ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-900"
                          : "border-violet-500/70 bg-violet-500/15 text-violet-900"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    )}
                  >
                    <Icon className="size-4 shrink-0 opacity-90" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(next) => (!next && saving ? undefined : onOpenChange(next))}>
      <SheetContent
        side="right"
        className={cn(
          "flex h-full w-full flex-col gap-0 overflow-hidden p-0 [&>button:last-child]:hidden",
          supplyMallContext
            ? "bg-white text-slate-900 sm:max-w-xl"
            : "border-l border-[#e3ebf7] bg-[linear-gradient(180deg,#f7f9ff,#ffffff)] text-[#0b1220] sm:max-w-[640px]",
          supplyAccentKitchen && "border-slate-200 border-t-[6px] border-t-emerald-500",
          supplyAccentBar && "border-slate-200 border-t-[6px] border-t-violet-500",
        )}
      >
        <SheetHeader
          className={cn(
            "flex-row items-center gap-3.5 space-y-0 border-b px-6 py-4 text-left",
            supplyAccentKitchen && "border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white",
            supplyAccentBar && "border-violet-100 bg-gradient-to-br from-violet-50 via-white to-white",
            !supplyMallContext && "border-[#eef2f8]",
          )}
        >
          <span
            className={cn(
              "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border",
              supplyAccentKitchen && "border-emerald-200 bg-white text-emerald-700",
              supplyAccentBar && "border-violet-200 bg-white text-violet-700",
              !supplyMallContext && "border-[#dbe7ff] bg-[linear-gradient(145deg,#f5f9ff,#e4eeff)] text-[#2563eb]",
            )}
          >
            {supplyMallContext ? (
              supplyAccentKitchen ? (
                <ChefHat className="size-6" strokeWidth={2} />
              ) : (
                <Wine className="size-6" strokeWidth={2} />
              )
            ) : imagePreview ? (
              <img src={imagePreview} alt="" className="size-full object-cover" />
            ) : (
              <Package className="size-6" strokeWidth={1.9} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <SheetTitle className="truncate text-[22px] font-bold tracking-tight text-[#0b1220]">
                {supplyMallContext
                  ? editing
                    ? supplyAccentKitchen
                      ? t("menu.dialog_edit_supply_kitchen_title")
                      : t("menu.dialog_edit_supply_bar_title")
                    : supplyAccentKitchen
                      ? t("menu.dialog_new_supply_kitchen_title")
                      : t("menu.dialog_new_supply_bar_title")
                  : editing
                    ? t("menu.dialog_edit_title")
                    : t("menu.dialog_new_title")}
              </SheetTitle>
            </div>
            <SheetDescription className="truncate text-[13px] text-[#475569]">
              {supplyMallContext
                ? supplyAccentKitchen
                  ? t("menu.supply_subtitle_kitchen")
                  : t("menu.supply_subtitle_bar")
                : editing
                  ? t("menu.dialog_edit_desc")
                  : t("menu.dialog_new_desc")}
            </SheetDescription>
          </div>
          {!supplyMallContext ? (
            <Select value={available ? "on" : "off"} onValueChange={(v) => setAvailable(v === "on")}>
              <SelectTrigger
                aria-label={t("menu.label_available")}
                title={available ? t("menu.available_help_on") : t("menu.available_help_off")}
                className="h-10 w-auto shrink-0 gap-2 rounded-xl border-[#e3ebf7] bg-white px-3.5 text-[14px] font-semibold text-[#0b1220] shadow-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: available ? "#16a34a" : "#ef4444" }}
                  />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent align="end" className={selectContent}>
                <SelectItem value="on" className={selectItem}>
                  {t("menu.status_available")}
                </SelectItem>
                <SelectItem value="off" className={selectItem}>
                  {t("menu.status_unavailable")}
                </SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          <button
            type="button"
            aria-label={t("menu.btn_cancel")}
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e3ebf7] bg-white text-[#0b1220] shadow-sm hover:bg-[#f1f5fb]"
          >
            <X className="size-[18px]" strokeWidth={2.2} />
          </button>
        </SheetHeader>

        {supplyMallContext ? supplyBody : productBody}

        <div className="flex gap-3 border-t border-[#eef2f8] bg-white px-6 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="h-12 flex-1 rounded-2xl border border-[#e3ebf7] bg-white text-[15px] font-semibold text-[#0b1220] shadow-sm hover:bg-[#f7f9fd]"
          >
            {t("menu.btn_cancel")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="inline-flex h-12 flex-[1.6] items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold shadow-[0_10px_22px_-12px_rgba(37,99,235,0.9)] disabled:opacity-60"
            style={{ backgroundColor: saveColor, color: "#ffffff" }}
          >
            <Check className="size-5" strokeWidth={2.4} />
            {saving
              ? t("common.loading")
              : editing
                ? t("menu.btn_save_changes")
                : supplyMallContext
                  ? t("menu.btn_add_supply")
                  : t("menu.btn_add_item")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
