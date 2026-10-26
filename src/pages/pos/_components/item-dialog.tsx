import { useState, useEffect, useRef, useMemo, type ComponentType } from "react";
import { useQuery, useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { uploadMenuItemPhoto } from "@/lib/supabase-pos/menu-photo-storage.ts";
import {
  ChefHat,
  Wine,
  ImageIcon,
  X,
  Upload,
  Star,
  UtensilsCrossed,
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
} from "lucide-react";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { MenuItemCustomizationEditor } from "@/components/menu-item-customization-picker.tsx";
import {
  normalizeCustomizationConfig,
  type MenuCustomizationGroup,
} from "@/lib/menu-customizations.ts";
import { MenuItemPrepEditor } from "@/components/menu-item-prep-editor.tsx";
import {
  emptyPrepConfig,
  normalizePrepConfig,
  type PrepConfig,
} from "@/lib/menu-prep-config.ts";
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

type StationValue = "kitchen" | "bar" | undefined;
type StockUnit = "pc" | "lt" | "kg" | "g" | "ml" | "bottle" | "box";
type SupplyStorage = "fridge" | "freezer" | "dry" | "ambient";

type RecipeUiLine = {
  key: string;
  supplyMenuItemId: Id<"menuItems"> | "";
  qty: string;
};

function newRecipeLineKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseRecipeForApi(
  lines: RecipeUiLine[],
): { supplyMenuItemId: Id<"menuItems">; qtyPerUnit: number }[] {
  return lines
    .filter((l) => String(l.supplyMenuItemId).trim())
    .map((l) => ({
      supplyMenuItemId: l.supplyMenuItemId as Id<"menuItems">,
      qtyPerUnit: Math.max(0, parseFloat(l.qty.replace(",", ".")) || 0),
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
  /** Per 1 sold unit: deduct `qtyPerUnit` from each supply row (same unit as that row’s stock). */
  supplyRecipe?: { supplyMenuItemId: Id<"menuItems">; qtyPerUnit: number }[];
  vatRate?: number;
  customizationConfig?: MenuCustomizationGroup[];
  prepConfig?: PrepConfig;
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
};

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
}: ItemDialogProps) {
  const { currency, t } = usePosLocale();
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
  const [vatPct, setVatPct] = useState("20");
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    Id<"menuCategories"> | undefined
  >(undefined);
  const [saving, setSaving] = useState(false);

  const furnizimCategoryId = useMemo(
    () => categories.find((c) => c.name.trim() === "Furnizim")?._id,
    [categories],
  );

  const menus = useQuery("pos.menu.getMenus", { licenseKey });
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
    open && enterpriseSupplyRecipe && !supplyMallContext
      ? { licenseKey }
      : "skip",
  );
  const createItem = useMutation("pos.menu.createItem");
  const updateItem = useMutation("pos.menu.updateItem");
  const ensureSupplyCategory = useMutation("pos.menu.ensureSupplyCategory");

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
  const [prepConfig, setPrepConfig] = useState<PrepConfig>(emptyPrepConfig());

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setDescription(editing.description ?? "");
        setPrice(editing.price.toString());
        const vatRounded = Math.round(Number(editing.vatRate ?? 0.2) * 100);
        setVatPct(String(Number.isFinite(vatRounded) ? vatRounded : 20));
        setAvailable(editing.available);
        setStation(editing.station ?? undefined);
        setMenuId(editing.menuId ?? undefined);
        setIsFavorite(editing.isFavorite ?? false);
        const allowed = editing.staffMealAllowed === true;
        const mealPrice =
          typeof editing.staffMealPrice === "number"
            ? editing.staffMealPrice
            : undefined;
        setStaffMealAllowed(allowed);
        if (mealPrice !== undefined && mealPrice > 0) {
          setStaffMealPricingMode("custom");
          setStaffMealCustomPrice(String(mealPrice));
        } else {
          setStaffMealPricingMode("free");
          setStaffMealCustomPrice("");
        }
        setStaffMealDailyLimit(
          typeof editing.staffMealDailyLimit === "number" &&
            editing.staffMealDailyLimit > 0
            ? String(editing.staffMealDailyLimit)
            : "",
        );
        setStaffMealFreeQty(
          typeof editing.staffMealFreeQty === "number" &&
            editing.staffMealFreeQty > 0
            ? String(editing.staffMealFreeQty)
            : "",
        );
        setTrackStock(editing.trackStock ?? false);
        setStockUnit(editing.stockUnit ?? "pc");
        const mallCtx =
          dialogNewTitleOverride === "supply_kitchen" ||
          dialogNewTitleOverride === "supply_bar";
        if (mallCtx && editing.trackStock) {
          setInitialStock(
            String(editing.currentStock ?? editing.initialStock ?? 0),
          );
        } else {
          setInitialStock(editing.initialStock?.toString() ?? "");
        }
        setLowStockThreshold(editing.lowStockThreshold?.toString() ?? "");
        setImagePreview(editing.imageUrl ?? null);
        setCurrentImageStorageId(editing.imageStorageId);
        setImageFile(null);
        setImageRemoved(false);
        setCustomizationGroups(
          normalizeCustomizationConfig(editing.customizationConfig),
        );
        setPrepConfig(normalizePrepConfig(editing.prepConfig));
        setSelectedCategoryId(nonEmptyCategoryId(editing.categoryId));
        setSupplyVendor(editing.supplyVendor ?? "");
        setSupplyLot(editing.supplyLot ?? "");
        setSupplyExpiryDate(editing.supplyExpiryDate ?? "");
        setSupplyStorage(editing.supplyStorage);
        if (mallCtx) {
          setSupplyDetailsOpen(
            Boolean(
              (editing.supplyVendor ?? "").trim() ||
                (editing.supplyLot ?? "").trim() ||
                (editing.supplyExpiryDate ?? "").trim() ||
                editing.supplyStorage,
            ),
          );
        } else {
          setSupplyDetailsOpen(false);
        }
        if (enterpriseSupplyRecipe && !mallCtx) {
          const r = editing.supplyRecipe;
          if (r?.length) {
            setRecipeLines(
              r.map((row) => ({
                key: newRecipeLineKey(),
                supplyMenuItemId: row.supplyMenuItemId,
                qty: String(row.qtyPerUnit),
              })),
            );
          } else {
            setRecipeLines([]);
          }
        } else {
          setRecipeLines([]);
        }
      } else {
        setName(initialName ?? "");
        setDescription("");
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
        setImageFile(null);
        setImageRemoved(false);
        setCustomizationGroups([]);
        setPrepConfig(emptyPrepConfig());
        setSelectedCategoryId(
          nonEmptyCategoryId(categoryId) ??
            nonEmptyCategoryId(categories[0]?._id),
        );
        setSupplyVendor("");
        setSupplyLot("");
        setSupplyExpiryDate("");
        setSupplyStorage(undefined);
        setSupplyDetailsOpen(false);
        setRecipeLines([]);
      }
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
  ]);

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

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("menu.err_name"));
      return;
    }
    const supplyCreateEarly =
      !editing &&
      (dialogNewTitleOverride === "supply_kitchen" ||
        dialogNewTitleOverride === "supply_bar");
    let categoryForSubmit =
      editing != null
        ? (nonEmptyCategoryId(selectedCategoryId) ??
            nonEmptyCategoryId(editing.categoryId))
        : nonEmptyCategoryId(selectedCategoryId);
    if (!supplyCreateEarly && !categoryForSubmit && supplyMallContext && editing) {
      try {
        categoryForSubmit = await ensureSupplyCategory({ licenseKey });
      } catch {
        /* leave undefined; error below */
      }
    }
    if (!supplyCreateEarly && !categoryForSubmit) {
      toast.error(t("menu.err_category"));
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error(t("menu.err_price"));
      return;
    }
    const resolvedStation =
      !editing && dialogNewTitleOverride === "supply_kitchen"
        ? ("kitchen" as const)
        : !editing && dialogNewTitleOverride === "supply_bar"
          ? ("bar" as const)
          : station;
    if (resolvedStation !== "kitchen" && resolvedStation !== "bar") {
      toast.error(t("menu.item_station_required"));
      return;
    }
    let parsedStaffMealPrice: number | undefined = undefined;
    let parsedStaffMealFreeQty: number | undefined = undefined;
    let parsedStaffMealDailyLimit: number | undefined = undefined;
    if (staffMealAllowed) {
      const parsedLimit = parseInt(staffMealDailyLimit, 10);
      if (staffMealDailyLimit.trim() && (!Number.isFinite(parsedLimit) || parsedLimit < 1)) {
        toast.error(t("menu.err_staff_meal_daily_limit"));
        return;
      }
      parsedStaffMealDailyLimit =
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 0;
      if (staffMealPricingMode === "free") {
        parsedStaffMealPrice = 0;
        parsedStaffMealFreeQty = parsedStaffMealDailyLimit;
      } else {
        const p = parseFloat(staffMealCustomPrice);
        if (isNaN(p) || p < 0) {
          toast.error(t("menu.err_staff_meal_price"));
          return;
        }
        parsedStaffMealPrice = p;
        const parsedFree = parseInt(staffMealFreeQty, 10);
        if (staffMealFreeQty.trim() && (!Number.isFinite(parsedFree) || parsedFree < 0)) {
          toast.error(t("menu.err_staff_meal_free_qty"));
          return;
        }
        parsedStaffMealFreeQty =
          Number.isFinite(parsedFree) && parsedFree > 0 ? parsedFree : 0;
        if (
          parsedStaffMealDailyLimit > 0 &&
          parsedStaffMealFreeQty > parsedStaffMealDailyLimit
        ) {
          toast.error(t("menu.err_staff_meal_free_qty"));
          return;
        }
      }
    }

    setSaving(true);
    try {
      let finalImageUrl: string | null | undefined = undefined;
      if (imageFile) {
        finalImageUrl = await uploadMenuItemPhoto({
          licenseKey,
          file: imageFile,
          itemId: editing?._id ? String(editing._id) : undefined,
        });
      } else if (imageRemoved) {
        finalImageUrl = null;
      } else if (imagePreview && !imagePreview.startsWith("blob:")) {
        finalImageUrl = imagePreview;
      }
      const finalImageStorageId = currentImageStorageId;

      const supplyCreate =
        !editing &&
        (dialogNewTitleOverride === "supply_kitchen" ||
          dialogNewTitleOverride === "supply_bar");
      const isSupplyMallEdit = Boolean(
        editing &&
          supplyMallContext &&
          (dialogNewTitleOverride === "supply_kitchen" ||
            dialogNewTitleOverride === "supply_bar"),
      );
      const qtyFromStockField = Math.max(0, parseFloat(initialStock) || 0);

      const stockArgs =
        supplyCreate || trackStock
          ? {
              trackStock: true as const,
              stockUnit,
              initialStock: isSupplyMallEdit
                ? (editing?.initialStock ?? qtyFromStockField)
                : parseFloat(initialStock) || 0,
              lowStockThreshold: (() => {
                const n = parseFloat(lowStockThreshold);
                return Number.isFinite(n) && n >= 0 ? n : venueLowStock;
              })(),
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
          ? parseRecipeForApi(recipeLines)
          : undefined;
      const vatRatePayload = canEditVat
        ? Number(vatPct) / 100
        : undefined;
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
      const prepSavePayload = !supplyMallContext
        ? normalizePrepConfig(prepConfig)
        : emptyPrepConfig();

      if (editing) {
        await updateItem({
          licenseKey,
          itemId: editing._id,
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceNum,
          available,
          categoryId: categoryForSubmit!,
          menuId,
          station,
          imageStorageId: finalImageStorageId,
          ...(finalImageUrl !== undefined ? { imageUrl: finalImageUrl } : {}),
          isFavorite,
          staffMealAllowed,
          staffMealPrice: parsedStaffMealPrice,
          staffMealFreeQty: parsedStaffMealFreeQty,
          staffMealDailyLimit: parsedStaffMealDailyLimit,
          ...stockArgs,
          currentStock: trackStock
            ? isSupplyMallEdit
              ? qtyFromStockField
              : (editing.currentStock ?? (parseFloat(initialStock) || 0))
            : undefined,
          ...supplyMutationPayload,
          ...(vatRatePayload !== undefined ? { vatRate: vatRatePayload } : {}),
          ...(recipeSavePayload !== undefined
            ? { supplyRecipe: recipeSavePayload }
            : {}),
          customizationConfig: customizationSavePayload,
          prepConfig: prepSavePayload,
        });
        const nextCurrentStock = trackStock
          ? isSupplyMallEdit
            ? qtyFromStockField
            : (editing.currentStock ?? (parseFloat(initialStock) || 0))
          : undefined;
        const updatedItem: EditingItem = {
          ...editing,
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceNum,
          vatRate: vatRatePayload ?? editing.vatRate,
          available,
          categoryId: categoryForSubmit!,
          menuId,
          station,
          imageStorageId: finalImageStorageId,
          imageUrl:
            finalImageUrl === null
              ? null
              : finalImageUrl ?? imagePreview,
          isFavorite,
          staffMealAllowed,
          staffMealPrice: parsedStaffMealPrice,
          staffMealFreeQty: parsedStaffMealFreeQty,
          staffMealDailyLimit: parsedStaffMealDailyLimit,
          trackStock: stockArgs.trackStock,
          stockUnit: stockArgs.stockUnit,
          initialStock: stockArgs.initialStock,
          lowStockThreshold: stockArgs.lowStockThreshold,
          currentStock: nextCurrentStock,
          ...supplyMutationPayload,
          ...(recipeSavePayload !== undefined
            ? { supplyRecipe: recipeSavePayload }
            : {}),
          customizationConfig: customizationSavePayload,
          prepConfig: prepSavePayload,
        };
        const cached = (await getDataCache<EditingItem[]>(`menuItems:${licenseKey}`)) ?? [];
        await saveDataCache(
          `menuItems:${licenseKey}`,
          cached.map((item) =>
            item._id === editing._id
              ? updatedItem
              : item,
          ),
        );
        onSaved?.(updatedItem, "update");
        toast.success(t("menu.toast_updated"));
      } else {
        const categoryIdForCreate = supplyCreate
          ? await ensureSupplyCategory({ licenseKey })
          : selectedCategoryId!;
        const createdId = await createItem({
          licenseKey,
          categoryId: categoryIdForCreate,
          menuId,
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceNum,
          station: resolvedStation,
          imageStorageId: finalImageStorageId,
          ...(finalImageUrl !== undefined ? { imageUrl: finalImageUrl } : {}),
          isFavorite,
          staffMealAllowed,
          staffMealPrice: parsedStaffMealPrice,
          staffMealFreeQty: parsedStaffMealFreeQty,
          staffMealDailyLimit: parsedStaffMealDailyLimit,
          ...stockArgs,
          ...(supplyCreate ? supplyMutationPayload : {}),
          ...(vatRatePayload !== undefined ? { vatRate: vatRatePayload } : {}),
          ...(recipeSavePayload !== undefined
            ? { supplyRecipe: recipeSavePayload }
            : {}),
          customizationConfig: customizationSavePayload,
          prepConfig: prepSavePayload,
        });
        const cached = (await getDataCache<EditingItem[]>(`menuItems:${licenseKey}`)) ?? [];
        const newItem: EditingItem = {
          _id: createdId as Id<"menuItems">,
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceNum,
          vatRate: vatRatePayload,
          available: true,
          categoryId: categoryIdForCreate,
          menuId,
          station: resolvedStation,
          imageStorageId: finalImageStorageId,
          imageUrl: finalImageUrl ?? null,
          isFavorite,
          staffMealAllowed,
          staffMealPrice: parsedStaffMealPrice,
          staffMealFreeQty: parsedStaffMealFreeQty,
          staffMealDailyLimit: parsedStaffMealDailyLimit,
          trackStock: stockArgs.trackStock,
          stockUnit: stockArgs.stockUnit,
          initialStock: stockArgs.initialStock,
          lowStockThreshold: stockArgs.lowStockThreshold,
          currentStock: stockArgs.initialStock,
          ...(supplyCreate ? supplyMutationPayload : {}),
          ...(recipeSavePayload !== undefined
            ? { supplyRecipe: recipeSavePayload }
            : {}),
          customizationConfig: customizationSavePayload,
          prepConfig: prepSavePayload,
        };
        await saveDataCache(`menuItems:${licenseKey}`, [...cached, newItem]);
        onSaved?.(newItem, "create");
        toast.success(
          supplyCreate ? t("menu.toast_supply_created") : t("menu.toast_created"),
        );
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("menu.err_save")));
    } finally {
      setSaving(false);
    }
  };

  const categoryPicker = useMemo(
    () => (
      <div className="space-y-2">
        <Label className="text-slate-600">{t("menu.label_category")}</Label>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat._id}
              type="button"
              onClick={() => setSelectedCategoryId(cat._id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer border",
                selectedCategoryId === cat._id
                  ? "text-white border-transparent"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
              )}
              style={
                selectedCategoryId === cat._id ? { backgroundColor: cat.color } : undefined
              }
            >
              {cat.icon && <span className="text-sm">{cat.icon}</span>}
              {cat.name}
            </button>
          ))}
        </div>
        {categories.length === 0 && (
          <p className="text-xs text-slate-500">{t("menu.no_categories_hint")}</p>
        )}
      </div>
    ),
    [categories, selectedCategoryId, t],
  );

  const supplyAccentKitchen =
    supplyMallContext && dialogNewTitleOverride === "supply_kitchen";
  const supplyAccentBar = supplyMallContext && dialogNewTitleOverride === "supply_bar";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex h-full w-full flex-col gap-0 bg-white p-0 text-slate-900 sm:max-w-xl [&>button]:text-slate-500",
          supplyAccentKitchen && "border-slate-200 border-t-[6px] border-t-emerald-500",
          supplyAccentBar && "border-slate-200 border-t-[6px] border-t-violet-500",
          !supplyMallContext && "border-slate-200",
        )}
      >
        <SheetHeader
          className={cn(
            "shrink-0 border-b px-6 py-5",
            supplyAccentKitchen && "border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white",
            supplyAccentBar && "border-violet-100 bg-gradient-to-br from-violet-50 via-white to-white",
            !supplyMallContext && "border-slate-200 bg-white",
          )}
        >
          {supplyMallContext ? (
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm",
                  supplyAccentKitchen &&
                    "border-emerald-200 bg-white text-emerald-700",
                  supplyAccentBar && "border-violet-200 bg-white text-violet-700",
                )}
              >
                {supplyAccentKitchen ? (
                  <ChefHat className="size-6" strokeWidth={2} />
                ) : (
                  <Wine className="size-6" strokeWidth={2} />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <SheetTitle className="text-left text-2xl font-bold tracking-tight text-slate-900">
                  {editing
                    ? dialogNewTitleOverride === "supply_kitchen"
                      ? t("menu.dialog_edit_supply_kitchen_title")
                      : t("menu.dialog_edit_supply_bar_title")
                    : dialogNewTitleOverride === "supply_kitchen"
                      ? t("menu.dialog_new_supply_kitchen_title")
                      : t("menu.dialog_new_supply_bar_title")}
                </SheetTitle>
                <p className="text-sm leading-snug text-slate-600">
                  {dialogNewTitleOverride === "supply_kitchen"
                    ? t("menu.supply_subtitle_kitchen")
                    : t("menu.supply_subtitle_bar")}
                </p>
              </div>
            </div>
          ) : (
            <SheetTitle className="text-2xl font-bold tracking-tight text-slate-900">
              {editing
                ? t("menu.dialog_edit_title")
                : t("menu.dialog_new_title")}
            </SheetTitle>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {supplyMallContext && (
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3",
                supplyAccentKitchen &&
                  "border-emerald-200/80 bg-emerald-50/60",
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
                  {dialogNewTitleOverride === "supply_kitchen"
                    ? t("menu.station_kitchen")
                    : t("menu.station_bar")}
                </p>
                <p className="text-xs text-slate-600">
                  {dialogNewTitleOverride === "supply_kitchen"
                    ? t("menu.supply_station_hint_kitchen")
                    : t("menu.supply_station_hint_bar")}
                </p>
              </div>
            </div>
          )}

          {supplyQuickPresets.length > 0 && (
            <div
              className={cn(
                "space-y-2 rounded-2xl border p-3 shadow-sm",
                supplyAccentKitchen &&
                  "border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-white",
                supplyAccentBar &&
                  "border-violet-200/70 bg-gradient-to-br from-violet-50/50 to-white",
              )}
            >
              <Label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Sparkles className="size-3.5 shrink-0 text-amber-500" />
                {t("menu.supply_quick_pick_title")}
              </Label>
              <p className="text-[11px] leading-snug text-slate-600">
                {t("menu.supply_quick_pick_hint")}
              </p>
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
                          "border-violet-200/80 bg-white text-violet-900 hover:border-violet-400 hover:bg-violet-50",
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

          {!supplyMallContext ? (
            <>
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
              }}
            />
            <MenuItemPrepEditor
              config={prepConfig}
              onChange={setPrepConfig}
              labels={{
                title: t("menu.prep_title"),
                hint: t("menu.prep_hint"),
                choiceTitle: t("menu.prep_choice_title"),
                choiceHint: t("menu.prep_choice_hint"),
                addChoiceGroup: t("menu.prep_add_choice_group"),
                groupName: t("menu.prep_group_name"),
                addOption: t("menu.prep_add_option"),
                optionName: t("menu.prep_option_name"),
                togglesTitle: t("menu.prep_toggles_title"),
                togglesHint: t("menu.prep_toggles_hint"),
                toggleGroupName: t("menu.prep_toggle_group_name"),
                addToggle: t("menu.prep_add_toggle"),
                paidExtrasTitle: t("menu.prep_paid_extras_title"),
                paidExtrasHint: t("menu.prep_paid_extras_hint"),
                addPaidExtra: t("menu.prep_add_paid_extra"),
                priceDelta: t("menu.customization_price_delta"),
                allowCustomInstructions: t("menu.prep_allow_custom_instructions"),
                allowCustomInstructionsHint: t("menu.prep_allow_custom_instructions_hint"),
                quickTitle: t("menu.prep_quick_title"),
                quickHint: t("menu.prep_quick_hint"),
                addQuick: t("menu.prep_add_quick"),
              }}
            />
            </>
          ) : null}

          {/* Image upload */}
          {!supplyMallContext && (
          <div className="space-y-2">
            <Label className="text-slate-600">{t("menu.label_product_image")}</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt={t("menu.image_preview_alt")}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="size-5 text-slate-400" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-hover">
                  <Upload className="size-3" />
                  {imagePreview ? t("menu.image_change") : t("menu.image_upload")}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="inline-flex w-fit cursor-pointer items-center gap-1 text-xs text-red-500 hover:text-red-600"
                  >
                    <X className="size-3" /> {t("menu.image_remove")}
                  </button>
                )}
              </div>
            </div>
          </div>
          )}

          <div className="space-y-2">
            <Label
              className={cn(
                "flex items-center gap-2 text-slate-600",
                supplyMallContext && "font-medium",
              )}
            >
              {supplyMallContext ? (
                <ClipboardList className="size-4 shrink-0 text-emerald-600" />
              ) : null}
              {t("menu.label_name")}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                supplyMallContext
                  ? t("menu.placeholder_supply_name")
                  : t("menu.placeholder_name_example")
              }
              className={cn(
                "border-slate-200 bg-slate-50 text-slate-900",
                supplyMallContext && "h-11 text-base font-medium",
              )}
            />
          </div>

          {!supplyMallContext && (
            <div className="space-y-2">
              <Label className="text-slate-600">{t("menu.label_description")}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("menu.placeholder_description")}
                rows={2}
                className="resize-none border-slate-200 bg-slate-50 text-slate-900"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label
              className={cn(
                "flex items-center gap-2 text-slate-600",
                supplyMallContext && "font-medium",
              )}
            >
              {supplyMallContext ? (
                <CircleDollarSign className="size-4 shrink-0 text-emerald-600" />
              ) : null}
              {supplyMallContext
                ? t("menu.supply_label_price", { symbol: currency.symbol })
                : t("menu.label_price", { symbol: currency.symbol })}
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="border-slate-200 bg-slate-50 text-slate-900"
            />
          </div>

          {canEditVat && !supplyMallContext ? (
            <div className="space-y-2">
              <Label className="text-slate-600">{t("menu.label_vat")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {(
                  vatChoices.options.some((o) => formatTaxPercent(o.percent) === vatPct)
                    ? vatChoices.options
                    : vatChoices.options.length > 0
                      ? [
                          {
                            id: "current",
                            percent: Number(vatPct) || 0,
                            label: `${vatPct}%`,
                            nameKey: "",
                          },
                          ...vatChoices.options,
                        ]
                      : [{ id: "fallback", percent: Number(vatPct) || 0, label: `${vatPct}%`, nameKey: "" }]
                ).map((opt) => {
                  const n = formatTaxPercent(opt.percent);
                  const selected = vatPct === n || Number(vatPct) === opt.percent;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setVatPct(n)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border",
                        selected
                          ? "bg-brand/20 border-brand/50 text-brand"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {opt.nameKey ? `${t(opt.nameKey)} ${n}%` : `${n}%`}
                    </button>
                  );
                })}
              </div>
              {vatChoices.options.length === 0 ? (
                <p className="text-[11px] text-slate-500">{t("settings.tax_need_country")}</p>
              ) : null}
            </div>
          ) : null}

          {!supplyMallContext && categoryPicker}

          {/* Menu assignment */}
          {menus && menus.length > 0 && !supplyMallContext && (
            <div className="space-y-2">
              <Label className="text-slate-600">{t("menu.label_menu_optional")}</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMenuId(undefined)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                    menuId === undefined
                      ? "bg-brand text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                  )}
                >
                  {t("common.none")}
                </button>
                {menus.map((m) => (
                  <button
                    key={m._id}
                    type="button"
                    onClick={() => setMenuId(m._id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                      menuId === m._id
                        ? "bg-brand text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!supplyMallContext && (
            <div className="space-y-2">
              <Label className="text-slate-600">
                {t("menu.item_station_label")}
                <span className="text-red-500"> *</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStation("kitchen")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer",
                    station === "kitchen"
                      ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                  )}
                >
                  <ChefHat className="size-4" />
                  {t("menu.station_kitchen")}
                </button>
                <button
                  type="button"
                  onClick={() => setStation("bar")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer",
                    station === "bar"
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-400"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                  )}
                >
                  <Wine className="size-4" />
                  {t("menu.station_bar")}
                </button>
              </div>
            </div>
          )}

          {!supplyMallContext && (
            <>
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <Star className="size-4 text-amber-400" />
                  <Label className="text-slate-600">{t("menu.label_favorites")}</Label>
                </div>
                <Switch checked={isFavorite} onCheckedChange={setIsFavorite} />
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <UtensilsCrossed className="size-4 shrink-0 text-amber-400" />
                  <Label className="text-slate-600">
                    {t("menu.label_staff_meal_allow")}
                  </Label>
                </div>
                <Switch
                  checked={staffMealAllowed}
                  onCheckedChange={(next) => {
                    setStaffMealAllowed(next);
                    if (next && !staffMealDailyLimit.trim()) {
                      setStaffMealDailyLimit("1");
                    }
                  }}
                />
              </div>

              {staffMealAllowed && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <Label className="text-slate-600">{t("menu.label_staff_meal_pricing")}</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStaffMealPricingMode("free")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer",
                        staffMealPricingMode === "free"
                          ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-700"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {t("menu.staff_meal_free")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffMealPricingMode("custom")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer",
                        staffMealPricingMode === "custom"
                          ? "bg-brand/15 border-brand/40 text-brand"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {t("menu.staff_meal_custom_price")}
                    </button>
                  </div>
                  {staffMealPricingMode === "custom" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">{t("menu.label_staff_price")}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={staffMealCustomPrice}
                        onChange={(e) => setStaffMealCustomPrice(e.target.value)}
                        placeholder="0.00"
                        className="border-slate-200 bg-white text-slate-900"
                      />
                    </div>
                  )}
                  {staffMealPricingMode === "custom" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">
                        {t("menu.label_staff_meal_free_qty")}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={staffMealFreeQty}
                        onChange={(e) => setStaffMealFreeQty(e.target.value)}
                        placeholder="0"
                        className="border-slate-200 bg-white text-slate-900"
                      />
                      <p className="text-[11px] text-slate-500">
                        {t("menu.hint_staff_meal_first_free")}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">
                      {t("menu.label_staff_meal_daily_limit")}
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={staffMealDailyLimit}
                      onChange={(e) => setStaffMealDailyLimit(e.target.value)}
                      placeholder={t("menu.hint_staff_meal_daily_unlimited")}
                      className="border-slate-200 bg-white text-slate-900"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {supplyMallContext ? (
            <>
            <div
              className={cn(
                "space-y-4 rounded-2xl border p-4 shadow-sm",
                supplyAccentKitchen &&
                  "border-emerald-200/90 bg-gradient-to-b from-emerald-50/80 to-white",
                supplyAccentBar && "border-violet-200/90 bg-gradient-to-b from-violet-50/80 to-white",
              )}
            >
              <div className="flex items-center gap-2">
                <Package className="size-4 shrink-0 text-slate-500" />
                <p className="text-sm font-semibold text-slate-900">
                  {t("menu.supply_section_inventory")}
                </p>
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
                            : supplyAccentBar
                              ? "border-violet-500/60 bg-violet-500/15 text-violet-900"
                              : "bg-brand/20 border-brand/50 text-brand"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">
                    {editing
                      ? t("menu.supply_qty_on_hand")
                      : t("menu.initial_stock")}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={t("menu.supply_qty_minus")}
                      disabled={(parseFloat(initialStock) || 0) <= 0}
                      onClick={() =>
                        setInitialStock((prev) =>
                          String(
                            Math.max(0, (parseFloat(prev) || 0) - 1),
                          ),
                        )
                      }
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer",
                        (parseFloat(initialStock) || 0) <= 0
                          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                          : supplyAccentKitchen
                            ? "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                            : supplyAccentBar
                              ? "border-violet-200 bg-white text-violet-900 hover:bg-violet-50"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      <Minus className="size-4" strokeWidth={2.5} />
                    </button>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      placeholder={t("menu.placeholder_qty_example")}
                      className="min-w-0 flex-1 border-slate-200 bg-white text-center text-slate-900 tabular-nums"
                    />
                    <button
                      type="button"
                      aria-label={t("menu.supply_qty_plus")}
                      onClick={() =>
                        setInitialStock((prev) =>
                          String((parseFloat(prev) || 0) + 1),
                        )
                      }
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer",
                        supplyAccentKitchen
                          ? "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                          : supplyAccentBar
                            ? "border-violet-200 bg-white text-violet-900 hover:bg-violet-50"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      <Plus className="size-4" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">
                    {t("menu.low_stock_alert")}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    placeholder={t("menu.placeholder_low_stock_example")}
                    className="border-slate-200 bg-white text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-4 py-3",
                  supplyAccentKitchen &&
                    "border-emerald-200/80 bg-emerald-50/40",
                  supplyAccentBar && "border-violet-200/80 bg-violet-50/40",
                )}
              >
                <div className="min-w-0 space-y-0.5">
                  <Label
                    htmlFor="supply-details-toggle"
                    className="text-sm font-medium text-slate-900"
                  >
                    {t("menu.supply_details_toggle")}
                  </Label>
                  <p className="text-xs text-slate-600">
                    {t("menu.supply_details_toggle_hint")}
                  </p>
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
                    supplyAccentKitchen &&
                      "border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-white",
                    supplyAccentBar &&
                      "border-violet-200/80 bg-gradient-to-br from-violet-50/70 to-white",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 shrink-0 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-900">
                      {t("menu.supply_section_details")}
                    </p>
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
                          {
                            value: "fridge" as const,
                            Icon: Thermometer,
                            label: t("menu.supply_storage_fridge"),
                          },
                          {
                            value: "freezer" as const,
                            Icon: Snowflake,
                            label: t("menu.supply_storage_freezer"),
                          },
                          {
                            value: "dry" as const,
                            Icon: Warehouse,
                            label: t("menu.supply_storage_dry"),
                          },
                          {
                            value: "ambient" as const,
                            Icon: Sun,
                            label: t("menu.supply_storage_ambient"),
                          },
                        ] as const
                      ).map(({ value, Icon, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setSupplyStorage((s) => (s === value ? undefined : value))
                          }
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center text-[11px] font-semibold transition-all cursor-pointer",
                            supplyStorage === value
                              ? supplyAccentKitchen
                                ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-900"
                                : supplyAccentBar
                                  ? "border-violet-500/70 bg-violet-500/15 text-violet-900"
                                  : "border-slate-400 bg-slate-100"
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
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-slate-600">{t("menu.label_track_stock")}</Label>
                <Switch checked={trackStock} onCheckedChange={setTrackStock} />
              </div>
              {trackStock && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t("menu.label_unit")}</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {stockUnitOptions.map((u) => (
                        <button
                          key={u.value}
                          type="button"
                          onClick={() => setStockUnit(u.value)}
                          className={cn(
                            "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border",
                            stockUnit === u.value
                              ? "bg-brand/20 border-brand/50 text-brand"
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                          )}
                        >
                          {u.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">
                        {t("menu.initial_stock")}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={initialStock}
                        onChange={(e) => setInitialStock(e.target.value)}
                        placeholder={t("menu.placeholder_qty_example")}
                        className="border-slate-200 bg-slate-50 text-slate-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">
                        {t("menu.low_stock_alert")}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={lowStockThreshold}
                        onChange={(e) => setLowStockThreshold(e.target.value)}
                        placeholder={t("menu.placeholder_low_stock_example")}
                        className="border-slate-200 bg-slate-50 text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {canEditRecipe && enterpriseSupplyRecipe && !supplyMallContext && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/90 p-4">
              <div className="flex items-start gap-2">
                <ClipboardList className="mt-0.5 size-4 shrink-0 text-slate-500" />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900">
                    {t("menu.recipe_section_title")}
                  </p>
                  <p className="text-xs text-slate-500 leading-snug">
                    {t("menu.recipe_section_hint")}
                  </p>
                </div>
              </div>
              {recipeIngredientOptions.length === 0 ? (
                <p className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-2 text-xs text-amber-900">
                  {t("menu.recipe_no_supply_items")}
                </p>
              ) : null}
              <div className="space-y-2">
                {recipeLines.map((line) => {
                  const picked = recipeIngredientOptions.find(
                    (i) => i._id === line.supplyMenuItemId,
                  );
                  const unitLabel =
                    picked?.stockUnit != null
                      ? t(`menu.stock_unit_${picked.stockUnit}`)
                      : null;
                  return (
                    <div
                      key={line.key}
                      className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-2"
                    >
                      <div className="min-w-[160px] flex-1 space-y-1">
                        <Label className="text-[11px] text-slate-500">
                          {t("menu.recipe_ingredient")}
                        </Label>
                        <select
                          value={line.supplyMenuItemId}
                          onChange={(e) => {
                            const v = e.target.value as Id<"menuItems"> | "";
                            setRecipeLines((prev) =>
                              prev.map((row) =>
                                row.key === line.key
                                  ? { ...row, supplyMenuItemId: v }
                                  : row,
                              ),
                            );
                          }}
                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900"
                        >
                          <option value="">{t("menu.recipe_pick_ingredient")}</option>
                          {recipeIngredientOptions.map((opt) => (
                            <option key={opt._id} value={opt._id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-[100px] space-y-1">
                        <Label className="text-[11px] text-slate-500">
                          {t("menu.recipe_qty_label")}
                        </Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={line.qty}
                          onChange={(e) =>
                            setRecipeLines((prev) =>
                              prev.map((row) =>
                                row.key === line.key
                                  ? { ...row, qty: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          placeholder={t("menu.recipe_qty_placeholder")}
                          className="h-9 border-slate-200 bg-white text-slate-900"
                        />
                      </div>
                      {unitLabel ? (
                        <span className="pb-2 text-[11px] text-slate-400">
                          {unitLabel}
                        </span>
                      ) : (
                        <span className="pb-2 text-[11px] text-transparent">—</span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-slate-400 hover:text-red-600"
                        aria-label={t("menu.recipe_remove_line")}
                        onClick={() =>
                          setRecipeLines((prev) =>
                            prev.filter((row) => row.key !== line.key),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-slate-200"
                onClick={() =>
                  setRecipeLines((prev) => [
                    ...prev,
                    { key: newRecipeLineKey(), supplyMenuItemId: "", qty: "" },
                  ])
                }
              >
                <Plus className="mr-1.5 size-4" />
                {t("menu.recipe_add_line")}
              </Button>
            </div>
          )}

          {editing && !supplyMallContext && (
            <div className="flex items-center justify-between">
              <Label className="text-slate-600">{t("menu.label_available")}</Label>
              <Switch checked={available} onCheckedChange={setAvailable} />
            </div>
          )}
        </div>

        <SheetFooter
          className={cn(
            "shrink-0 flex-row justify-end gap-2 border-t bg-white px-6 py-4",
            supplyAccentKitchen && "border-emerald-100",
            supplyAccentBar && "border-violet-100",
            !supplyMallContext && "border-slate-200",
          )}
        >
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-500"
          >
            {t("menu.btn_cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className={cn(
              "text-white shadow-sm",
              supplyAccentKitchen && "bg-emerald-600 hover:bg-emerald-700",
              supplyAccentBar && "bg-violet-600 hover:bg-violet-700",
              !supplyMallContext &&
                "bg-gradient-to-r from-brand to-[#22c55e] hover:opacity-95",
            )}
          >
            {editing
              ? t("menu.btn_save_changes")
              : supplyMallContext
                ? t("menu.btn_add_supply")
                : t("menu.btn_add_item")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
