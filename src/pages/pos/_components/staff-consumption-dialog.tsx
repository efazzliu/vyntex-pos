import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import {
  UtensilsCrossed,
  Search,
  X,
  Plus,
  Minus,
  Send,
  ArrowLeft,
  ChefHat,
  Wine,
  Star,
  User,
  KeyRound,
  Delete,
} from "lucide-react";
import { hashString } from "@/lib/local-db.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
import {
  STAFF_PIN_MAX_LEN,
  STAFF_PIN_MIN_LEN,
  isValidStaffPinLength,
} from "../_lib/staff-pin.ts";
import { printStaffMealTickets } from "@/lib/pos-print-sent-order.ts";
import { isSilentPrintQueueableError } from "@/lib/print-html.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";

type StaffPriceMode = "full" | "free" | "discount";

function translatedStaffRole(
  t: (key: string, opts?: Record<string, unknown>) => string,
  role: string,
): string {
  const key = `staff.role_${String(role).toLowerCase()}`;
  const label = t(key);
  return label === key ? role : label;
}

type ConsumptionItem = {
  menuItemId: Id<"menuItems">;
  name: string;
  /** Menu list price per unit */
  listPrice: number;
  quantity: number;
};

function chargedUnitPrice(
  listPrice: number,
  mode: StaffPriceMode,
  discountPercent: number
): number {
  if (mode === "free") return 0;
  if (mode === "full") return listPrice;
  const pct = Math.min(100, Math.max(0, discountPercent));
  return Math.round(listPrice * (1 - pct / 100) * 100) / 100;
}

type StaffConsumptionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  /** The waiter/staff who is logging this (the "logged by" person) */
  loggedByStaffId: Id<"staff">;
  loggedByStaffName: string;
  /** If provided, skip the staff selection step (self-service mode) */
  targetStaffId?: Id<"staff">;
  targetStaffName?: string;
  /** Waiter ordering own meal: jump to items + only menu rows allowed for staff meal */
  selfServiceStaffMeal?: boolean;
};

export default function StaffConsumptionDialog({
  open,
  onOpenChange,
  licenseKey,
  loggedByStaffId,
  loggedByStaffName,
  targetStaffId,
  targetStaffName,
  selfServiceStaffMeal = false,
}: StaffConsumptionDialogProps) {
  // Steps: "select-staff" -> "pick-items" (or straight to pick-items if targetStaffId given)
  const [step, setStep] = useState<"select-staff" | "pin-entry" | "pick-items">(
    targetStaffId ? "pick-items" : "select-staff"
  );
  const [selectedStaffId, setSelectedStaffId] = useState<Id<"staff"> | null>(
    targetStaffId ?? null
  );
  const [selectedStaffName, setSelectedStaffName] = useState(
    targetStaffName ?? ""
  );
  const [cart, setCart] = useState<ConsumptionItem[]>([]);
  const [priceMode, setPriceMode] = useState<StaffPriceMode>("full");
  const [discountPercent, setDiscountPercent] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // PIN entry state (for self-service method)
  const [pinStaffId, setPinStaffId] = useState<Id<"staff"> | null>(null);
  const [pinStaffName, setPinStaffName] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const staffList = useQuery('pos.staff.getStaff', open ? { licenseKey } : "skip");
  const menuItems = useQuery('pos.menu.getAllItems', open ? { licenseKey } : "skip");
  const categories = useQuery('pos.menu.getCategories', open ? { licenseKey } : "skip");
  const printersQuery = useQuery("pos.settings.getPrinters", open ? { licenseKey } : "skip");
  const addConsumption = useMutation('pos.staffConsumption.addConsumption');

  // Load existing consumption for selected staff
  const staffConsumption = useQuery(
    'pos.staffConsumption.getStaffConsumption',
    selectedStaffId && open ? { licenseKey, staffId: selectedStaffId } : "skip"
  );

  const { formatPrice, t } = usePosLocale();
  const { theme: posTheme } = usePosTheme();

  const printersList = Array.isArray(printersQuery) ? printersQuery : [];
  const kitchenTicketDeviceName = useMemo(() => {
    const p = printersList.find((x) => x.isActive && x.role === "kitchen");
    if (!p) return undefined;
    const a = (p.address ?? "").trim();
    const n = (p.name ?? "").trim();
    return (a || n) || undefined;
  }, [printersList]);
  const barTicketDeviceName = useMemo(() => {
    const p = printersList.find((x) => x.isActive && x.role === "bar");
    if (!p) return undefined;
    const a = (p.address ?? "").trim();
    const n = (p.name ?? "").trim();
    return (a || n) || undefined;
  }, [printersList]);

  useEffect(() => {
    if (!open) return;
    if (targetStaffId) {
      setStep("pick-items");
      setSelectedStaffId(targetStaffId);
      setSelectedStaffName(targetStaffName ?? "");
      setCart([]);
      setSearchQuery("");
      setPriceMode("full");
      setDiscountPercent(50);
      setActiveCategory("all");
      setPinStaffId(null);
      setPinStaffName("");
      setPin("");
      setPinError("");
    } else {
      setStep("select-staff");
      setSelectedStaffId(null);
      setSelectedStaffName("");
      setCart([]);
      setSearchQuery("");
      setPriceMode("full");
      setDiscountPercent(50);
      setActiveCategory("all");
      setPinStaffId(null);
      setPinStaffName("");
      setPin("");
      setPinError("");
    }
  }, [open, targetStaffId, targetStaffName]);

  const [activeCategory, setActiveCategory] = useState<Id<"menuCategories"> | "all">("all");

  useEffect(() => {
    if (selfServiceStaffMeal && priceMode === "discount") {
      setPriceMode("full");
    }
  }, [selfServiceStaffMeal, priceMode]);

  const availableItems = useMemo(() => {
    if (!menuItems) return [];
    let items = menuItems.filter((i) => i.available);
    if (selfServiceStaffMeal) {
      items = items.filter((i) => {
        const row = i as { staffMealAllowed?: boolean };
        return row.staffMealAllowed !== false;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q));
    } else if (activeCategory !== "all") {
      items = items.filter((i) => i.categoryId === activeCategory);
    }

    return items.sort((a, b) => a.displayOrder - b.displayOrder);
  }, [menuItems, searchQuery, activeCategory, selfServiceStaffMeal]);

  const cartTotal = cart.reduce(
    (sum, i) =>
      sum + chargedUnitPrice(i.listPrice, priceMode, discountPercent) * i.quantity,
    0
  );
  const cartListTotal = cart.reduce((sum, i) => sum + i.listPrice * i.quantity, 0);

  const reset = () => {
    setStep(targetStaffId ? "pick-items" : "select-staff");
    setSelectedStaffId(targetStaffId ?? null);
    setSelectedStaffName(targetStaffName ?? "");
    setCart([]);
    setPriceMode("full");
    setDiscountPercent(50);
    setSearchQuery("");
    setActiveCategory("all");
    setPinStaffId(null);
    setPinStaffName("");
    setPin("");
    setPinError("");
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  // ── Staff selection (Method 1: waiter selects staff) ──
  const handleSelectStaff = (staff: Doc<"staff">) => {
    setSelectedStaffId(staff._id);
    setSelectedStaffName(staff.name);
    setStep("pick-items");
  };

  // ── PIN entry (Method 2: staff self-service) ──
  const handlePinSelect = (staff: Doc<"staff">) => {
    setPinStaffId(staff._id);
    setPinStaffName(staff.name);
    setPin("");
    setPinError("");
    setStep("pin-entry");
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length >= STAFF_PIN_MAX_LEN) return;
    const next = pin + digit;
    setPin(next);
    setPinError("");
  };

  const handlePinSubmit = () => {
    if (!isValidStaffPinLength(pin.length)) {
      setPinError(
        t("staff.err_pin_digits", {
          min: STAFF_PIN_MIN_LEN,
          max: STAFF_PIN_MAX_LEN,
        }),
      );
      return;
    }
    void verifyPin(pin);
  };

  const handlePinBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setPinError("");
  };

  useEffect(() => {
    if (step !== "pin-entry") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
        e.preventDefault();
        handlePinDigit(e.key);
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        handlePinBackspace();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handlePinSubmit();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, pin]);

  const verifyPin = async (enteredPin: string) => {
    if (!pinStaffId || !staffList) return;
    const staff = staffList.find((s) => s._id === pinStaffId);
    if (!staff) return;

    const hashed = await hashString(enteredPin);
    if (hashed === staff.pinHash) {
      // PIN correct — proceed to item selection
      setSelectedStaffId(staff._id);
      setSelectedStaffName(staff.name);
      setStep("pick-items");
    } else {
      setPinError(t("staff_consumption.err_pin_incorrect"));
      setPin("");
    }
  };

  // ── Cart management ──
  const addToCart = (item: Doc<"menuItems">) => {
    const selfServiceUnitPrice =
      selfServiceStaffMeal &&
      typeof (item as Doc<"menuItems"> & { staffMealPrice?: number }).staffMealPrice === "number"
        ? Number((item as Doc<"menuItems"> & { staffMealPrice?: number }).staffMealPrice)
        : item.price;
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item._id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item._id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          menuItemId: item._id,
          name: item.name,
          listPrice: selfServiceUnitPrice,
          quantity: 1,
        },
      ];
    });
  };

  const updateQty = (menuItemId: Id<"menuItems">, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!selectedStaffId || cart.length === 0) return;
    setIsSubmitting(true);
    try {
      await addConsumption({
        licenseKey,
        staffId: selectedStaffId,
        staffName: selectedStaffName,
        loggedByStaffId,
        loggedByStaffName,
        items: cart.map((i) => {
          const unit = chargedUnitPrice(i.listPrice, priceMode, discountPercent);
          return {
            menuItemId: i.menuItemId,
            name: i.name,
            price: unit,
            quantity: i.quantity,
            listPrice: i.listPrice,
          };
        }),
      });
      toast.success(
        t("staff_consumption.toast_logged", { name: selectedStaffName }),
      );

      const linesForPrint = cart.map((c) => {
        const meta = menuItems?.find((m) => m._id === c.menuItemId);
        const unit = chargedUnitPrice(c.listPrice, priceMode, discountPercent);
        return {
          name: c.name,
          quantity: c.quantity,
          station: meta?.station,
          price: unit,
        };
      });
      void (async () => {
        try {
          const pr = await printStaffMealTickets({
            title: t("staff_meal.ticket_title"),
            forLabel: t("staff_meal.ticket_for"),
            consumerName: selectedStaffName,
            loggedByLabel: t("staff_meal.ticket_logged_by"),
            loggedByName: loggedByStaffName,
            orderRefLabel: t("staff_meal.ticket_ref_label"),
            orderRefValue: t("staff_meal.ticket_ref_value"),
            printedLabel: t("order.ticket_printed"),
            stationKitchen: t("order.ticket_station_kitchen"),
            stationBar: t("order.ticket_station_bar"),
            lines: linesForPrint,
            formatPrice,
            kitchenDevice: kitchenTicketDeviceName,
            barDevice: barTicketDeviceName,
          });
          if (!pr.ok) {
            const electronApp = Boolean(
              typeof window !== "undefined" &&
                (window as Window & { desktop?: { isElectron?: boolean } })
                  .desktop?.isElectron,
            );
            const queued = electronApp && isSilentPrintQueueableError(pr.error);
            if (!queued) {
              toast.error(
                electronApp
                  ? t("order.print_ticket_silent_failed")
                  : t("order.print_popup_blocked"),
              );
            }
          }
        } catch (e) {
          console.error("Staff meal print:", e);
          toast.error(t("order.print_ticket_error"));
        }
      })();

      handleOpenChange(false);
    } catch (err) {
      toast.error(
        errorMessageFromUnknown(
          err,
          t("staff_meal.save_failed"),
        ),
      );
      console.error("[POS] addConsumption", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        data-pos-theme={posTheme}
        side="right"
        className="flex h-full w-full max-w-full flex-col gap-0 border-slate-200 bg-white p-0 text-slate-900 sm:max-w-2xl lg:max-w-[min(100vw,44rem)]"
      >
        {/* ── Step: Select Staff ── */}
        {step === "select-staff" && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SheetHeader className="space-y-1 border-b border-slate-200 p-4 pr-12 text-left">
              <SheetTitle className="flex items-center gap-2 text-slate-900">
                <UtensilsCrossed className="size-5 text-amber-400" />
                {t("staff_consumption.title")}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500">
                {t("staff_consumption.description_select")}
              </SheetDescription>
            </SheetHeader>

            <div className="px-6 pb-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">
                {t("staff_consumption.select_staff_prompt")}
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {/* Method 1: Waiter selects staff directly */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <User className="size-4 text-[#0066FF]" />
                  <span className="text-sm text-slate-800 font-medium">
                    {t("staff_consumption.pick_from_list")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {staffList
                    ?.filter((s) => s.isActive)
                    .map((staff) => (
                      <button
                        key={staff._id}
                        onClick={() => handleSelectStaff(staff)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-[#0066FF]/50 hover:bg-[#0066FF]/5 transition-all cursor-pointer text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#0066FF]/10 flex items-center justify-center text-[#0066FF] text-sm font-bold">
                          {staff.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-900 font-medium truncate">{staff.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {translatedStaffRole(t, staff.role)}
                          </p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>

              {/* Method 2: Staff enters their own PIN */}
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="size-4 text-amber-400" />
                  <span className="text-sm text-slate-800 font-medium">
                    {t("staff_consumption.self_service_pin")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {staffList
                    ?.filter((s) => s.isActive)
                    .map((staff) => (
                      <button
                        key={`pin-${staff._id}`}
                        onClick={() => handlePinSelect(staff)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-amber-500/50 hover:bg-amber-500/5 transition-all cursor-pointer text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-sm font-bold">
                          {staff.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-900 font-medium truncate">{staff.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {t("staff_consumption.enter_pin")}
                          </p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: PIN Entry ── */}
        {step === "pin-entry" && (
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-8">
            <button
              onClick={() => { setStep("select-staff"); setPin(""); setPinError(""); }}
              className="self-start mb-4 flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer text-sm"
            >
              <ArrowLeft className="size-4" />
              {t("staff_consumption.back")}
            </button>

            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-xl font-bold mb-3">
              {pinStaffName[0]}
            </div>
            <p className="text-slate-900 font-semibold">{pinStaffName}</p>
            <p className="text-slate-500 text-sm mb-6 text-center px-2">
              {t("staff_consumption.pin_instructions")}
            </p>

            <p
              className="font-mono text-center text-lg tracking-normal text-slate-900 mb-6 min-h-7 max-w-[280px] break-all px-1"
              aria-live="polite"
            >
              {pin.length > 0 ? "\u2022".repeat(pin.length) : "\u00a0"}
            </p>

            {pinError && (
              <p className="text-red-400 text-sm mb-4">{pinError}</p>
            )}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 w-56">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map(
                (key) => {
                  if (key === "") return <div key="empty" />;
                  if (key === "del") {
                    return (
                      <button
                        key="del"
                        onClick={handlePinBackspace}
                        className="h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors cursor-pointer"
                      >
                        <Delete className="size-5" />
                      </button>
                    );
                  }
                  return (
                    <button
                      key={key}
                      onClick={() => handlePinDigit(key)}
                      className="h-14 rounded-xl bg-white border border-slate-200 text-slate-900 text-lg font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {key}
                    </button>
                  );
                }
              )}
            </div>
            <button
              type="button"
              onClick={handlePinSubmit}
              disabled={!isValidStaffPinLength(pin.length)}
              className="mt-4 w-56 h-12 rounded-xl font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              {t("staff_consumption.pin_ok")}
            </button>
          </div>
        )}

        {/* ── Step: Pick Items ── */}
        {step === "pick-items" && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-4 pr-12 pt-5">
              <button
                onClick={() => {
                  if (targetStaffId || selfServiceStaffMeal) {
                    handleOpenChange(false);
                  } else {
                    setStep("select-staff");
                    setCart([]);
                    setSearchQuery("");
                    setPriceMode("full");
                    setDiscountPercent(50);
                  }
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="size-4 text-amber-400" />
                  <h3 className="text-slate-900 font-semibold text-sm">
                    {t("staff_consumption.pick_title", { name: selectedStaffName })}
                  </h3>
                </div>
                {staffConsumption && staffConsumption.total > 0 && (
                  <p className="text-[10px] text-amber-400 mt-0.5">
                    {t("staff_consumption.today_summary", {
                      total: formatPrice(staffConsumption.total),
                      count: staffConsumption.entries.length,
                    })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-[10px] text-slate-500 uppercase font-semibold shrink-0">
                {t("staff_consumption.staff_charge")}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPriceMode("full")}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all cursor-pointer",
                    priceMode === "full"
                      ? "bg-[#0066FF] border-[#0066FF] text-white"
                      : "border-slate-200 text-slate-600 hover:text-slate-900 bg-white"
                  )}
                >
                  {t("staff_consumption.full_price")}
                </button>
                <button
                  type="button"
                  onClick={() => setPriceMode("free")}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all cursor-pointer",
                    priceMode === "free"
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-slate-200 text-slate-600 hover:text-slate-900 bg-white"
                  )}
                >
                  {t("staff_consumption.free")}
                </button>
                {!selfServiceStaffMeal && (
                  <button
                    type="button"
                    onClick={() => setPriceMode("discount")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all cursor-pointer",
                      priceMode === "discount"
                        ? "bg-amber-600 border-amber-600 text-white"
                        : "border-slate-200 text-slate-600 hover:text-slate-900 bg-white"
                    )}
                  >
                    {t("staff_consumption.discount")}
                  </button>
                )}
              </div>
              {!selfServiceStaffMeal && priceMode === "discount" && (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-7 w-14 text-[11px] bg-white border-slate-200 text-slate-900 px-2"
                    value={discountPercent}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (Number.isNaN(n)) setDiscountPercent(0);
                      else setDiscountPercent(Math.min(100, Math.max(0, n)));
                    }}
                  />
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {t("staff_consumption.percent_off")}
                  </span>
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* Left: Menu */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-slate-200">
                {/* Search */}
                <div className="px-3 pt-3 pb-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t("staff_consumption.search_placeholder")}
                      className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#0066FF] transition-colors"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Category chips: wrap to new rows below — no horizontal scroll */}
                <div className="flex flex-wrap content-start gap-1.5 px-3 pb-2">
                  <button
                    type="button"
                    onClick={() => { setActiveCategory("all"); setSearchQuery(""); }}
                    className={cn(
                      "px-3 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all cursor-pointer shrink-0",
                      activeCategory === "all"
                        ? "bg-[#0066FF] text-white"
                        : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                    )}
                  >
                    {t("staff_consumption.all_categories")}
                  </button>
                  {categories?.map((cat) => (
                    <button
                      type="button"
                      key={cat._id}
                      onClick={() => { setActiveCategory(cat._id); setSearchQuery(""); }}
                      className={cn(
                        "px-3 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all cursor-pointer shrink-0",
                        activeCategory === cat._id
                          ? "text-white"
                          : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                      )}
                      style={
                        activeCategory === cat._id
                          ? { backgroundColor: cat.color }
                          : undefined
                      }
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Items grid */}
                <div className="flex-1 overflow-auto px-3 pb-3">
                  {availableItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 h-28 text-[#5a6580] text-xs text-center px-4">
                      <p>
                        {selfServiceStaffMeal
                          ? t("staff_meal.no_allowed_items")
                          : t("staff_consumption.no_items_found")}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {availableItems.map((item) => {
                        const inCart = cart.find((c) => c.menuItemId === item._id);
                        return (
                          <button
                            key={item._id}
                            onClick={() => addToCart(item)}
                            className={cn(
                              "relative text-left rounded-lg border p-2.5 transition-all cursor-pointer",
                              inCart
                                ? "border-amber-500/50 bg-amber-500/10"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            )}
                          >
                            {item.station && (
                              <span className={cn(
                                "text-[8px] font-medium",
                                item.station === "kitchen" ? "text-orange-400" : "text-purple-400"
                              )}>
                                {item.station === "kitchen" ? <ChefHat className="size-2.5 inline" /> : <Wine className="size-2.5 inline" />}
                              </span>
                            )}
                            <p className="text-xs font-medium text-slate-900 truncate">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-amber-400 font-semibold mt-0.5">
                              {formatPrice(item.price)}
                            </p>
                            {inCart && (
                              <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white text-[9px] font-bold">
                                {inCart.quantity}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Cart */}
              <div className="flex w-[11.5rem] shrink-0 flex-col bg-slate-50 sm:w-60">
                <div className="px-3 py-2 border-b border-slate-200">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    {t("staff_consumption.selected_items")}
                  </p>
                </div>

                <div className="flex-1 overflow-auto p-2 space-y-1">
                  {cart.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-slate-400 text-[10px]">
                      {t("staff_consumption.tap_to_add")}
                    </div>
                  ) : (
                    cart.map((item) => {
                      const unit = chargedUnitPrice(
                        item.listPrice,
                        priceMode,
                        discountPercent
                      );
                      const showList = unit < item.listPrice - 0.001;
                      return (
                      <div
                        key={item.menuItemId}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white border border-slate-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-900 truncate">{item.name}</p>
                          <p className="text-[9px]">
                            <span
                              className={
                                showList
                                  ? "text-amber-400 font-medium"
                                  : "text-slate-500"
                              }
                            >
                              {formatPrice(unit)}
                            </span>
                            {showList && (
                              <span className="text-slate-400 line-through ml-1">
                                {formatPrice(item.listPrice)}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => updateQty(item.menuItemId, -1)}
                            className="p-0.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="text-[11px] text-slate-900 w-5 text-center font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.menuItemId, 1)}
                            className="p-0.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                      </div>
                    );
                    })
                  )}
                </div>

                {/* Total + submit */}
                <div className="border-t border-slate-200 p-3 space-y-2 bg-white">
                  {cartListTotal > cartTotal + 0.005 && (
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{t("staff_consumption.menu_value")}</span>
                      <span className="line-through tabular-nums">
                        {formatPrice(cartListTotal)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">{t("staff_consumption.total")}</span>
                    <span className="text-slate-900 font-bold">{formatPrice(cartTotal)}</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-gradient-to-r from-[#0066FF] to-[#22c55e] text-white hover:opacity-95"
                    onClick={handleSubmit}
                    disabled={cart.length === 0 || isSubmitting}
                  >
                    <Send className="size-3.5 mr-1.5" />
                    {isSubmitting
                      ? t("staff_consumption.saving")
                      : t("staff_consumption.log_button")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
