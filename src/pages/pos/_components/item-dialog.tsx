import { useState, useEffect, useRef, useMemo } from "react";
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
import { ChefHat, Wine, ImageIcon, X, Upload, Star, UtensilsCrossed } from "lucide-react";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";

type StationValue = "kitchen" | "bar" | undefined;
type StockUnit = "pc" | "lt" | "kg" | "g" | "ml" | "bottle" | "box";

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
  /** Default true when omitted — false hides item from waiter Staff meal self-service. */
  staffMealAllowed?: boolean;
  /** Optional price used for waiter staff meal (0 = free). */
  staffMealPrice?: number;
  trackStock?: boolean;
  stockUnit?: StockUnit;
  initialStock?: number;
  currentStock?: number;
  lowStockThreshold?: number;
};

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
};

export default function ItemDialog({
  open,
  onOpenChange,
  licenseKey,
  categoryId,
  categories,
  editing,
  onSaved,
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
  const [stockUnit, setStockUnit] = useState<StockUnit>("pc");
  const [initialStock, setInitialStock] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    Id<"menuCategories"> | undefined
  >(undefined);
  const [saving, setSaving] = useState(false);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImageStorageId, setCurrentImageStorageId] = useState<
    Id<"_storage"> | undefined
  >(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const menus = useQuery('pos.menu.getMenus', { licenseKey });
  const createItem = useMutation('pos.menu.createItem');
  const updateItem = useMutation('pos.menu.updateItem');
  const generateUploadUrl = useMutation('pos.menu.generateUploadUrl');

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setDescription(editing.description ?? "");
        setPrice(editing.price.toString());
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
        setTrackStock(editing.trackStock ?? false);
        setStockUnit(editing.stockUnit ?? "pc");
        setInitialStock(editing.initialStock?.toString() ?? "");
        setLowStockThreshold(editing.lowStockThreshold?.toString() ?? "");
        setImagePreview(editing.imageUrl ?? null);
        setCurrentImageStorageId(editing.imageStorageId);
        setImageFile(null);
        setSelectedCategoryId(editing.categoryId);
      } else {
        setName("");
        setDescription("");
        setPrice("");
        setAvailable(true);
        setStation(undefined);
        setMenuId(undefined);
        setIsFavorite(false);
        setStaffMealAllowed(false);
        setStaffMealPricingMode("free");
        setStaffMealCustomPrice("");
        setTrackStock(false);
        setStockUnit("pc");
        setInitialStock("");
        setLowStockThreshold("");
        setImagePreview(null);
        setCurrentImageStorageId(undefined);
        setImageFile(null);
        setSelectedCategoryId(categoryId ?? categories[0]?._id);
      }
    }
  }, [editing, open, categoryId, categories]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setCurrentImageStorageId(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("menu.err_name"));
      return;
    }
    if (!selectedCategoryId) {
      toast.error(t("menu.err_category"));
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error(t("menu.err_price"));
      return;
    }
    if (station !== "kitchen" && station !== "bar") {
      toast.error(t("menu.item_station_required"));
      return;
    }
    let parsedStaffMealPrice: number | undefined = undefined;
    if (staffMealAllowed) {
      if (staffMealPricingMode === "free") {
        parsedStaffMealPrice = 0;
      } else {
        const p = parseFloat(staffMealCustomPrice);
        if (isNaN(p) || p < 0) {
          toast.error(t("menu.err_staff_meal_price"));
          return;
        }
        parsedStaffMealPrice = p;
      }
    }

    setSaving(true);
    try {
      // Upload image if a new file was selected
      let finalImageStorageId = currentImageStorageId;
      if (imageFile) {
        const uploadUrl = await generateUploadUrl({ licenseKey });
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": imageFile.type },
          body: imageFile,
        });
        const json = (await result.json()) as {
          storageId: Id<"_storage">;
        };
        finalImageStorageId = json.storageId;
      }

      const stockArgs = trackStock
        ? {
            trackStock: true as const,
            stockUnit,
            initialStock: parseFloat(initialStock) || 0,
            lowStockThreshold: parseFloat(lowStockThreshold) || 5,
          }
        : {
            trackStock: false as const,
            stockUnit: undefined,
            initialStock: undefined,
            lowStockThreshold: undefined,
          };

      if (editing) {
        await updateItem({
          licenseKey,
          itemId: editing._id,
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceNum,
          available,
          categoryId: selectedCategoryId,
          menuId,
          station,
          imageStorageId: finalImageStorageId,
          isFavorite,
          staffMealAllowed,
          staffMealPrice: parsedStaffMealPrice,
          ...stockArgs,
          currentStock: trackStock
            ? (editing.currentStock ?? (parseFloat(initialStock) || 0))
            : undefined,
        });
        const updatedItem: EditingItem = {
          ...editing,
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceNum,
          available,
          categoryId: selectedCategoryId,
          menuId,
          station,
          imageStorageId: finalImageStorageId,
          imageUrl: imagePreview,
          isFavorite,
          staffMealAllowed,
          staffMealPrice: parsedStaffMealPrice,
          trackStock: stockArgs.trackStock,
          stockUnit: stockArgs.stockUnit,
          initialStock: stockArgs.initialStock,
          lowStockThreshold: stockArgs.lowStockThreshold,
          currentStock: trackStock
            ? (editing.currentStock ?? (parseFloat(initialStock) || 0))
            : undefined,
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
        const createdId = await createItem({
          licenseKey,
          categoryId: selectedCategoryId,
          menuId,
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceNum,
          station,
          imageStorageId: finalImageStorageId,
          isFavorite,
          staffMealAllowed,
          staffMealPrice: parsedStaffMealPrice,
          ...stockArgs,
        });
        const cached = (await getDataCache<EditingItem[]>(`menuItems:${licenseKey}`)) ?? [];
        const newItem: EditingItem = {
          _id: createdId as Id<"menuItems">,
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceNum,
          available: true,
          categoryId: selectedCategoryId,
          menuId,
          station,
          imageStorageId: finalImageStorageId,
          imageUrl: imagePreview,
          isFavorite,
          staffMealAllowed,
          staffMealPrice: parsedStaffMealPrice,
          trackStock: stockArgs.trackStock,
          stockUnit: stockArgs.stockUnit,
          initialStock: stockArgs.initialStock,
          lowStockThreshold: stockArgs.lowStockThreshold,
          currentStock: stockArgs.initialStock,
        };
        await saveDataCache(`menuItems:${licenseKey}`, [...cached, newItem]);
        onSaved?.(newItem, "create");
        toast.success(t("menu.toast_created"));
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("menu.err_save")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 border-slate-200 bg-white p-0 text-slate-900 sm:max-w-xl [&>button]:text-slate-500"
      >
        <SheetHeader className="shrink-0 border-b border-slate-200 px-6 py-5">
          <SheetTitle className="text-2xl font-bold tracking-tight text-slate-900">
            {editing ? t("menu.dialog_edit_title") : t("menu.dialog_new_title")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Image upload */}
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
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0066FF] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0055dd]">
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

          <div className="space-y-2">
            <Label className="text-slate-600">{t("menu.label_name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("menu.placeholder_name_example")}
              className="border-slate-200 bg-slate-50 text-slate-900"
            />
          </div>

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

          <div className="space-y-2">
            <Label className="text-slate-600">
              {t("menu.label_price", { symbol: currency.symbol })}
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

          {/* Category selection */}
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
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                  style={
                    selectedCategoryId === cat._id
                      ? { backgroundColor: cat.color }
                      : undefined
                  }
                >
                  {cat.icon && <span className="text-sm">{cat.icon}</span>}
                  {cat.name}
                </button>
              ))}
            </div>
            {categories.length === 0 && (
              <p className="text-xs text-slate-500">
                {t("menu.no_categories_hint")}
              </p>
            )}
          </div>

          {/* Menu assignment */}
          {menus && menus.length > 0 && (
            <div className="space-y-2">
              <Label className="text-slate-600">{t("menu.label_menu_optional")}</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMenuId(undefined)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                    menuId === undefined
                      ? "bg-[#0066FF] text-white"
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
                        ? "bg-[#0066FF] text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Station selection — required for kitchen/bar tickets */}
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
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
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
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                <Wine className="size-4" />
                {t("menu.station_bar")}
              </button>
            </div>
          </div>

          {/* Show in Favorites */}
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
              onCheckedChange={setStaffMealAllowed}
            />
          </div>

          {staffMealAllowed && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
                      ? "bg-[#0066FF]/15 border-[#0066FF]/40 text-[#0066FF]"
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
            </div>
          )}

          {/* Stock tracking */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-slate-600">{t("menu.label_track_stock")}</Label>
              <Switch checked={trackStock} onCheckedChange={setTrackStock} />
            </div>
            {trackStock && (
              <div className="space-y-3">
                {/* Stock Unit */}
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
                            ? "bg-[#0066FF]/20 border-[#0066FF]/50 text-[#0066FF]"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        )}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Initial Stock & Low Stock Alert */}
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

          {editing && (
            <div className="flex items-center justify-between">
              <Label className="text-slate-600">{t("menu.label_available")}</Label>
              <Switch checked={available} onCheckedChange={setAvailable} />
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 flex-row justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
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
            className="bg-gradient-to-r from-[#0066FF] to-[#22c55e] text-white hover:opacity-95"
          >
            {editing ? t("menu.btn_save_changes") : t("menu.btn_add_item")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
