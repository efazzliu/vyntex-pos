import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  ArrowLeft,
  Plus,
  Minus,
  Send,
  Receipt,
  CreditCard,
  X,
  ChefHat,
  Wine,
  Pencil,
  Trash2,
  LogOut,
  FileText,
  FileX,
  HandCoins,
  Gift,
  UserPlus,
  AlertTriangle,
  Star,
  Search,
  ArrowLeftRight,
  Undo2,
  UtensilsCrossed,
  Clock,
  ChevronDown,
  ChevronRight,
  Wallet,
  Droplets,
  Ban,
  UserX,
  MessageSquare,
  Check,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { hashString } from "@/lib/local-db.ts";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { useOfflineData } from "@/hooks/use-offline-data.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { verifyAdminPin } from "@/lib/supabase-pos.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { emojiForCategoryName } from "@/lib/pos-category-icons.ts";
import MenuItemCustomizationPicker from "@/components/menu-item-customization-picker.tsx";
import {
  cartLineKey,
  defaultSelectionsForGroups,
  formatCustomizationsForDisplay,
  getMenuItemCustomizationGroups,
  hasMenuItemCustomizations,
  resolvedMenuItemUnitPrice,
  type SelectedCustomization,
} from "@/lib/menu-customizations.ts";
import { uuidOrNull, staffIdsEqual } from "@/lib/supabase-pos/uuid.ts";
import { posTablesIndexedDbKey } from "@/lib/supabase-pos/cache-keys.ts";
import { displayOrderNumber } from "@/lib/supabase-pos/mappers.ts";
import {
  printPosBill,
  printSentOrderTicket,
  type PrintPosBillOptions,
} from "@/lib/pos-print-sent-order.ts";
import { isSilentPrintQueueableError } from "@/lib/print-html.ts";
import { runPosQuery } from "@/lib/supabase-pos/pos-router.ts";
import {
  STAFF_PIN_MAX_LEN,
  STAFF_PIN_MIN_LEN,
  isValidStaffPinLength,
  sanitizeStaffPinInput,
} from "../_lib/staff-pin.ts";
import {
  printFiscalReceiptForPay,
  printNonFiscalReceiptForPay,
} from "@/lib/print-fiscal-receipt.ts";
import {
  printComplimentarySlipForPay,
  printDebtVoucherForPay,
} from "@/lib/print-live-papers.ts";
import { hasSplitBills } from "../_lib/plan-features.ts";
import SplitBillItemPicker, {
  type SplitBillUnit,
  type SplitSelectedLine,
} from "./split-bill-item-picker.tsx";
import CashPaymentScreen, {
  type CashPaymentConfirmed,
} from "./cash-payment-screen.tsx";
import PaymentMethodCards from "./payment-method-cards.tsx";
import PaymentBillTypeCards from "./payment-bill-type-cards.tsx";
import PremiumMoneyKeypad from "./premium-money-keypad.tsx";
import CardPaymentScreen, {
  CardPaymentDetails,
} from "./card-payment-screen.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
import {
  enabledPaymentMethods,
  parsePosPaymentSettings,
  posTerminalCanProcessPayment,
  roleCanRefund,
  type PaymentMethodId,
} from "@/lib/pos-payment-handling.ts";
import {
  getOrderBlockReason,
  isMenuItemShownForOrdering,
  parseOrderBlockError,
  resolveOrderAvailabilityRulesFromCompany,
  type OrderAvailabilityRules,
  type OrderBlockReason,
} from "@/lib/pos-order-availability.ts";
import { printerDeviceNameForRole } from "@/lib/pos-printer-routing.ts";
import {
  parsePosCustomerDisplay,
  publishCustomerDisplaySnapshot,
  readLocalCustomerDisplay,
  writeLocalCustomerDisplay,
} from "@/lib/pos-customer-display.ts";

type PaymentType =
  | "fiscal"
  | "non_fiscal"
  | "no_receipt"
  | "debt"
  | "complimentary";
type PaymentMethod = "cash" | "card" | "other";

type OrderScreenProps = {
  licenseKey: string;
  /** License plan — gates split-bill / partial pay (Professional+). */
  plan: string;
  tableId: Id<"tables">;
  staffId: string;
  staffName: string;
  staffRole: string;
  /** Admin, manager, or staff with “Transfer tables” permission (move bill to an empty table). */
  canTransferTables?: boolean;
  /** Admin, manager, or staff with “Merge tables” (or legacy transfer-only) permission. */
  canMergeTables?: boolean;
  /** Admin/manager or staff with explicit permission can use split bill (still plan-gated). */
  canSplitBillsQuick?: boolean;
  /** Show “Debt” next to sent items and omit it from the payment drawer (admin/manager or staff toggle). */
  canChargeDebtQuick?: boolean;
  /** If true: show complimentary (“On the house”) beside sent items only. If false: hide it entirely (not in the payment drawer). */
  canMarkComplimentaryQuick?: boolean;
  /** After transfer/merge, open the target table’s order screen */
  onOrderMovedToTable?: (tableId: Id<"tables">) => void;
  onBack: () => void;
  onLogout?: () => void;
};

type CartItem = {
  menuItemId: Id<"menuItems">;
  name: string;
  price: number;
  quantity: number;
  station?: "kitchen" | "bar";
  notes?: string;
  vatRate?: number;
  selectedCustomizations?: SelectedCustomization[];
};

type MenuItemWithCustomizations = Doc<"menuItems"> & {
  customizationConfig?: unknown;
};

function MenuCategoryGlyph({
  icon,
  muted,
}: {
  icon?: string | null;
  muted?: boolean;
}) {
  const g = icon?.trim();
  if (g)
    return (
      <span className="text-[1.35rem] leading-none select-none shrink-0" aria-hidden>
        {g}
      </span>
    );
  return (
    <UtensilsCrossed
      className={cn("size-5 shrink-0 opacity-80", muted ? "text-[#8b93a7]" : "text-white")}
      aria-hidden
    />
  );
}

function OrderNewCartLines({
  cart,
  showNewItemsLabel,
  formatPrice,
  t,
  onReplace,
  onNote,
  onQty,
  onRemove,
}: {
  cart: CartItem[];
  showNewItemsLabel: boolean;
  formatPrice: (n: number) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
  onReplace: (lineKey: string) => void;
  onNote: (item: CartItem) => void;
  onQty: (lineKey: string, delta: number) => void;
  onRemove: (lineKey: string) => void;
}) {
  if (cart.length === 0) return null;
  return (
    <>
      {showNewItemsLabel ? (
        <div className="py-2">
          <p className="text-[10px] uppercase tracking-wider text-brand font-medium">
            {t("order.new_items")}
          </p>
        </div>
      ) : null}
      {cart.map((item) => {
        const lineKey = cartLineKey(item);
        const customLabel = formatCustomizationsForDisplay(
          item.selectedCustomizations,
        );
        return (
          <div
            key={lineKey}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#131A2E] border border-[#1e2a45]"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-white truncate">{item.name}</p>
                {item.station && (
                  <span
                    className={cn(
                      "shrink-0",
                      item.station === "kitchen"
                        ? "text-orange-400"
                        : "text-purple-400",
                    )}
                  >
                    {item.station === "kitchen" ? (
                      <ChefHat className="size-3" />
                    ) : (
                      <Wine className="size-3" />
                    )}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5a6580]">{formatPrice(item.price)}</p>
              {customLabel ? (
                <p className="text-[10px] text-sky-300 mt-0.5">{customLabel}</p>
              ) : null}
              {item.notes && (
                <p className="text-[10px] text-amber-400 mt-0.5 italic">
                  {item.notes}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onReplace(lineKey)}
                className="p-1 rounded hover:bg-brand/10 text-[#5a6580] hover:text-brand-sky cursor-pointer"
                title={t("order.replace_item")}
              >
                <ArrowLeftRight className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => onNote(item)}
                className={cn(
                  "p-1 rounded transition-colors cursor-pointer",
                  item.notes
                    ? "text-amber-400 hover:bg-amber-500/10"
                    : "text-[#5a6580] hover:bg-[#1e2a45] hover:text-[#8b93a7]",
                )}
              >
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => onQty(lineKey, -1)}
                className="p-1 rounded hover:bg-[#1e2a45] text-[#8b93a7] cursor-pointer"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="text-sm text-white w-6 text-center font-medium">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onQty(lineKey, 1)}
                className="p-1 rounded hover:bg-[#1e2a45] text-[#8b93a7] cursor-pointer"
              >
                <Plus className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRemove(lineKey)}
                className="p-1 rounded hover:bg-red-500/10 text-[#5a6580] hover:text-red-400 ml-1 cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function OrderScreen({
  licenseKey,
  plan,
  tableId,
  staffId,
  staffName,
  staffRole,
  canTransferTables = false,
  canMergeTables = false,
  canSplitBillsQuick = false,
  canChargeDebtQuick = false,
  canMarkComplimentaryQuick = false,
  onOrderMovedToTable,
  onBack,
  onLogout,
}: OrderScreenProps) {
  const isOnline = useOnlineStatus();
  const { theme: posTheme } = usePosTheme();
  const isLightPos = posTheme === "light";

  // Wrap queries with offline fallback
  const categoriesQuery = useQuery('pos.menu.getCategories', { licenseKey });
  const menuItemsQuery = useQuery('pos.menu.getAllItems', { licenseKey });
  const activeOrdersQuery = useQuery('pos.orders.getOrdersByTable', {
    licenseKey,
    tableId,
  });
  const tableQuery = useQuery('pos.tables.getTables', { licenseKey });
  const tableSummariesQuery = useQuery('pos.tables.getTableOrderSummaries', {
    licenseKey,
  });
  const staffListQuery = useQuery('pos.staff.getStaff', { licenseKey });
  const printersQuery = useQuery("pos.settings.getPrinters", { licenseKey });
  const companyQuery = useQuery("pos.settings.getCompanyDetails", { licenseKey });
  const { t, formatPrice, currency } = usePosLocale();

  const { data: categoriesRaw, isHydrated: categoriesHydrated } =
    useOfflineData<Doc<"menuCategories">[]>(
      `categories:${licenseKey}`,
      categoriesQuery,
      isOnline,
    );
  const { data: menuItemsRaw, isHydrated: menuItemsHydrated } =
    useOfflineData<Doc<"menuItems">[]>(
      `menuItems:${licenseKey}`,
      menuItemsQuery,
      isOnline,
    );
  const { data: activeOrdersRaw, isHydrated: activeOrdersHydrated } =
    useOfflineData<Doc<"orders">[]>(
      `orders:${licenseKey}:${tableId}`,
      activeOrdersQuery,
      isOnline,
    );
  const { data: tablesRaw, isHydrated: tablesHydrated } = useOfflineData<
    Doc<"tables">[]
  >(posTablesIndexedDbKey(licenseKey), tableQuery, isOnline);

  const categories = categoriesRaw ?? [];
  const menuItems = menuItemsRaw ?? [];
  const activeOrders = activeOrdersRaw ?? [];
  const tablesList = tablesRaw ?? [];
  const printersList = Array.isArray(printersQuery) ? printersQuery : [];

  /** OS printer name for Electron silent print: Address field if set, else Name (must match Windows list). */
  const kitchenTicketDeviceName = useMemo(
    () => printerDeviceNameForRole(printersList, "kitchen", licenseKey),
    [printersList, licenseKey],
  );

  const barTicketDeviceName = useMemo(
    () => printerDeviceNameForRole(printersList, "bar", licenseKey),
    [printersList, licenseKey],
  );

  const receiptPrinterDeviceName = useMemo(
    () => printerDeviceNameForRole(printersList, "receipt", licenseKey),
    [printersList, licenseKey],
  );

  const submitCartOrder = useMutation("pos.orders.submitCartOrder");
  const payOrder = useMutation("pos.orders.payOrder");
  const printBill = useMutation("pos.orders.printBill");
  const transferOrders = useMutation("pos.orders.transferOrdersToTable");
  const mergeOrders = useMutation("pos.orders.mergeTableOrders");

  const [activeCategory, setActiveCategory] =
    useState<Id<"menuCategories"> | "favorites" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartReplaceKey, setCartReplaceKey] = useState<string | null>(null);
  const [cartReplaceQty, setCartReplaceQty] = useState(1);
  const [cartReplaceQuery, setCartReplaceQuery] = useState("");
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bouncedWrongOwnerRef = useRef(false);
  const payDrawerRootRef = useRef<HTMLDivElement>(null);
  /** Prevents double-send while the Supabase mutation is in flight (cart is cleared optimistically when online). */
  const sendOrderInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      sendOrderInFlightRef.current = false;
    };
  }, []);

  // Payment flow state
  const [payStep, setPayStep] = useState<
    | "type"
    | "customer"
    | "admin-pin"
    | "split-amount"
    | "split-items"
    | "cash"
    | "cash-done"
    | "card"
  >("type");
  const [pendingCashType, setPendingCashType] = useState<PaymentType | null>(
    null,
  );
  const [cashConfirmed, setCashConfirmed] =
    useState<CashPaymentConfirmed | null>(null);
  const [cashSnapshot, setCashSnapshot] = useState<{
    orderId: string;
    orderNumber?: number | string | null;
    tableName: string;
    waiterName: string;
    subtotal: number;
    tax: number;
    orderTotal: number;
    paidSoFar: number;
  } | null>(null);
  const [pendingPayAmount, setPendingPayAmount] = useState<number | null>(null);
  /** Sale lines (id + qty) covered by the next split payment. */
  const [pendingSettledSaleItems, setPendingSettledSaleItems] = useState<
    { id: string; quantity: number }[] | null
  >(null);
  const [splitAmountInput, setSplitAmountInput] = useState("");
  /** Tendered cash (numpad) — change helper only; does not affect payment API. */
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [splitDraft, setSplitDraft] = useState<{
    amount: number;
    settled: SplitBillUnit[];
    lines: SplitSelectedLine[];
  }>({ amount: 0, settled: [], lines: [] });
  const handleSplitSelectionChange = useCallback(
    (amount: number, settled: SplitBillUnit[], lines: SplitSelectedLine[]) => {
      setSplitDraft((prev) => {
        if (
          prev.amount === amount &&
          prev.settled === settled &&
          prev.lines === lines
        ) {
          return prev;
        }
        return { amount, settled, lines };
      });
    },
    [],
  );
  const [splitPayMethod, setSplitPayMethod] = useState<PaymentMethodId | null>(
    null,
  );
  const [splitCardRunning, setSplitCardRunning] = useState(false);
  const [splitPickerEpoch, setSplitPickerEpoch] = useState(0);
  const [splitKeypadReplaceNext, setSplitKeypadReplaceNext] = useState(true);

  // Customer state for debt
  const [customerStep, setCustomerStep] = useState<"select" | "create">(
    "select"
  );
  const [selectedCustomerId, setSelectedCustomerId] =
    useState<Id<"customers"> | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");

  // Note editing state
  const [noteCartKey, setNoteCartKey] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [customizationPickerItem, setCustomizationPickerItem] =
    useState<MenuItemWithCustomizations | null>(null);

  const [tableMoveOpen, setTableMoveOpen] = useState(false);
  const [tableMoveMode, setTableMoveMode] = useState<"transfer" | "merge">(
    "transfer",
  );
  const [tableMoveBusy, setTableMoveBusy] = useState(false);
  const [tableMoveRoom, setTableMoveRoom] = useState<string | null>(null);
  const tableMoveListRef = useRef<HTMLDivElement>(null);

  const isLoading =
    !categoriesHydrated ||
    !menuItemsHydrated ||
    !activeOrdersHydrated ||
    !tablesHydrated;

  const currentTable = tablesList.find((t) => t._id === tableId);
  const existingOrder = activeOrders[0];
  const orderWithItemsQuery = useQuery(
    existingOrder ? "pos.orders.getOrderWithItems" : "skip",
    existingOrder
      ? { licenseKey, orderId: existingOrder._id }
      : "skip",
  );
  const paymentSettings = parsePosPaymentSettings(
    (companyQuery as { paymentSettings?: unknown } | undefined)?.paymentSettings,
  );
  const canProcessPayment = posTerminalCanProcessPayment(staffRole, paymentSettings);
  const availabilityRules = resolveOrderAvailabilityRulesFromCompany(
    companyQuery as
      | { enforceOrderAvailability?: unknown; stockRules?: unknown }
      | undefined,
    licenseKey,
  );
  const enforceAvailability = availabilityRules.honorKitchenStop;

  const toastOrderBlocked = (reason: OrderBlockReason, name: string) => {
    toast.error(
      reason === "stock"
        ? t("order.blocked_stock", { name })
        : t("order.blocked_stopped", { name }),
    );
  };

  const orderBalanceDue =
    existingOrder &&
    typeof (existingOrder as { balanceDue?: number }).balanceDue === "number"
      ? (existingOrder as { balanceDue: number }).balanceDue
      : (existingOrder?.total ?? 0);
  const orderPaidSoFar =
    existingOrder &&
    typeof (existingOrder as { paidAmount?: number }).paidAmount === "number"
      ? (existingOrder as { paidAmount: number }).paidAmount
      : 0;
  const splitBillsEnabled =
    hasSplitBills(plan) &&
    canSplitBillsQuick &&
    paymentSettings.allowSplitBill !== false &&
    orderBalanceDue > 0.009;

  const payDueNow = pendingPayAmount ?? orderBalanceDue;
  const tenderedCash =
    parseFloat(String(cashReceivedInput).replace(",", ".")) || 0;

  const payDrawerHeading = useMemo(() => {
    switch (payStep) {
      case "type":
        return t("order.pay_drawer_title");
      case "cash":
      case "cash-done":
        return t("order.cash_screen_title");
      case "card":
        return t("order.card_title");
      case "split-amount":
      case "split-items":
        return t("order.split_bill");
      case "customer":
        return t("order.pay_debt_step");
      case "admin-pin":
        return t("order.pay_complimentary_step");
      default:
        return t("order.pay_drawer_title");
    }
  }, [payStep, t]);

  const payDrawerCanGoBack =
    payStep === "split-items" ||
    payStep === "split-amount" ||
    payStep === "customer" ||
    payStep === "admin-pin" ||
    payStep === "cash" ||
    payStep === "card" ||
    (payStep === "type" && pendingPayAmount != null);

  const handlePayDrawerBack = () => {
    if (isSubmitting) return;
    if (payStep === "cash" || payStep === "card") {
      setPendingCashType(null);
      setPayStep("type");
      return;
    }
    if (payStep === "type" && pendingPayAmount != null) {
      setPayStep(
        pendingSettledSaleItems && pendingSettledSaleItems.length > 0
          ? "split-items"
          : "split-amount",
      );
      return;
    }
    if (payStep === "customer" || payStep === "admin-pin") {
      setPayStep("type");
      return;
    }
    if (payStep === "split-items" || payStep === "split-amount") {
      setPendingPayAmount(null);
      setPendingSettledSaleItems(null);
      setSplitAmountInput("");
      setSplitDraft({ amount: 0, settled: [], lines: [] });
      setSplitPayMethod(null);
      setSplitCardRunning(false);
      setPayStep("type");
    }
  };
  const [orderBodyEl, setOrderBodyEl] = useState<HTMLDivElement | null>(null);

  type TableOrderSummary = {
    staffId: string;
    staffName: string;
    total: number;
  };
  const tableSummaries = (tableSummariesQuery ?? {}) as Record<
    string,
    TableOrderSummary
  >;

  const sortedOtherTables = useMemo(() => {
    return [...tablesList]
      .filter((t) => t._id !== tableId)
      .sort((a, b) => {
        const z = a.zone.localeCompare(b.zone);
        if (z !== 0) return z;
        return a.name.localeCompare(b.name);
      });
  }, [tablesList, tableId]);

  const transferTargetTables = useMemo(
    () => sortedOtherTables.filter((t) => !tableSummaries[t._id]),
    [sortedOtherTables, tableSummaries],
  );
  const mergeTargetTables = useMemo(
    () => sortedOtherTables.filter((t) => Boolean(tableSummaries[t._id])),
    [sortedOtherTables, tableSummaries],
  );

  const floorRooms = useMemo(() => {
    const names = new Set<string>();
    for (const tbl of tablesList) {
      names.add(tbl.zone?.trim() || "—");
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [tablesList]);

  const transferRooms = useMemo(
    () =>
      floorRooms.map((room) => ({
        room,
        tables: transferTargetTables.filter(
          (tbl) => (tbl.zone?.trim() || "—") === room,
        ),
      })),
    [floorRooms, transferTargetTables],
  );
  const mergeRooms = useMemo(
    () =>
      floorRooms.map((room) => ({
        room,
        tables: mergeTargetTables.filter(
          (tbl) => (tbl.zone?.trim() || "—") === room,
        ),
      })),
    [floorRooms, mergeTargetTables],
  );

  const openTableMoveDialog = (mode: "transfer" | "merge") => {
    if (cart.length > 0) {
      toast.error(t("order.cart_blocks_table_move"));
      return;
    }
    setTableMoveMode(mode);
    const currentRoom = currentTable?.zone?.trim() || floorRooms[0] || null;
    setTableMoveRoom(currentRoom);
    setTableMoveOpen(true);
  };

  const handleConfirmTableMove = async (targetId: Id<"tables">) => {
    if (cart.length > 0) {
      toast.error(t("order.cart_blocks_table_move"));
      return;
    }
    const targetName =
      tablesList.find((x) => x._id === targetId)?.name ?? String(targetId);
    setTableMoveBusy(true);
    try {
      if (tableMoveMode === "transfer") {
        const tr = await transferOrders({
          licenseKey,
          fromTableId: String(tableId),
          toTableId: String(targetId),
          staffId,
          staffName,
        });
        if (!tr) {
          setTableMoveOpen(false);
          onOrderMovedToTable?.(targetId);
          return;
        }
        toast.success(t("order.transfer_success", { name: targetName }));
      } else {
        const mr = await mergeOrders({
          licenseKey,
          fromTableId: String(tableId),
          toTableId: String(targetId),
          staffId,
          staffName,
        });
        if (!mr) {
          setTableMoveOpen(false);
          onOrderMovedToTable?.(targetId);
          return;
        }
        toast.success(t("order.merge_success", { name: targetName }));
      }
      setTableMoveOpen(false);
      onOrderMovedToTable?.(targetId);
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("common.error")));
    } finally {
      setTableMoveBusy(false);
    }
  };

  // Default to "favorites" if no category is actively selected
  const selectedCategory = activeCategory ?? "favorites";

  // Check if there are any manually-flagged favorites
  const manualFavorites = useMemo(
    () =>
      menuItems.filter(
        (i) => i.isFavorite && isMenuItemShownForOrdering(i, enforceAvailability),
      ),
    [menuItems, enforceAvailability],
  );

  // Auto-populate: top 10 most sold if no manual favorites
  const autoFavorites = useMemo(() => {
    if (manualFavorites.length > 0) return [];
    if (!menuItems) return [];
    return [...menuItems]
      .filter(
        (i) =>
          isMenuItemShownForOrdering(i, enforceAvailability) &&
          (i.totalSold ?? 0) > 0,
      )
      .sort((a, b) => (b.totalSold ?? 0) - (a.totalSold ?? 0))
      .slice(0, 10);
  }, [menuItems, manualFavorites, enforceAvailability]);

  const filteredItems = useMemo(() => {
    if (!menuItems) return [];

    // When searching, filter across all items regardless of category
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return menuItems
        .filter(
          (i) =>
            isMenuItemShownForOrdering(i, enforceAvailability) &&
            i.name.toLowerCase().includes(q),
        )
        .sort((a, b) => a.displayOrder - b.displayOrder);
    }

    if (!selectedCategory) return [];
    if (selectedCategory === "favorites") {
      return manualFavorites.length > 0
        ? manualFavorites.sort((a, b) => a.displayOrder - b.displayOrder)
        : autoFavorites;
    }
    return menuItems
      .filter(
        (i) =>
          i.categoryId === selectedCategory &&
          isMenuItemShownForOrdering(i, enforceAvailability),
      )
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [
    menuItems,
    selectedCategory,
    manualFavorites,
    autoFavorites,
    searchQuery,
    enforceAvailability,
  ]);

  // Cart totals — tax-inclusive: prices already include TVSH
  const DEFAULT_VAT = 0.20;
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartTax = cart.reduce((sum, i) => {
    const lineTotal = i.price * i.quantity;
    const rate = i.vatRate ?? DEFAULT_VAT;
    return sum + lineTotal * rate / (1 + rate);
  }, 0);
  const total = Math.round(cartTotal * 100) / 100;
  const tax = Math.round(cartTax * 100) / 100;
  const subtotal = Math.round((total - tax) * 100) / 100;

  useEffect(() => {
    try {
      localStorage.setItem("vyntex.pos.lastLicenseKey", licenseKey);
    } catch {
      /* ignore */
    }
    const fromCompany = parsePosCustomerDisplay(
      (companyQuery as { customerDisplay?: unknown } | undefined)?.customerDisplay,
    );
    const settings = companyQuery ? fromCompany : readLocalCustomerDisplay(licenseKey);
    if (companyQuery) writeLocalCustomerDisplay(licenseKey, settings);
    if (!settings.enabled) return;
    const venueName =
      typeof (companyQuery as { name?: string } | undefined)?.name === "string"
        ? (companyQuery as { name: string }).name
        : "";
    const payingCash = payStep === "cash" || payStep === "cash-done";
    const grouped = new Map<
      string,
      { name: string; quantity: number; price: number }
    >();
    const addLine = (name: string, quantity: number, price: number) => {
      if (quantity <= 0) return;
      const key = `${name.trim().toLowerCase()}|${Math.round(price * 100)}`;
      const prev = grouped.get(key);
      if (prev) prev.quantity += quantity;
      else grouped.set(key, { name, quantity, price });
    };
    const sentItems = ((orderWithItemsQuery as { items?: Array<{
      name: string;
      price: number;
      quantity: number;
      status: string;
    }> } | undefined)?.items ?? []);
    for (const item of sentItems) {
      if (item.status === "cancelled" || item.status === "voided") continue;
      addLine(item.name, item.quantity, item.price);
    }
    for (const row of cart) addLine(row.name, row.quantity, row.price);
    const sourceItems = [...grouped.values()].map((row) => ({
      name: row.name,
      quantity: row.quantity,
      lineTotal: formatPrice(row.price * row.quantity),
    }));
    publishCustomerDisplaySnapshot({
      v: 1,
      kind: "snapshot",
      licenseKey,
      at: Date.now(),
      phase: payingCash && cashConfirmed ? "change" : sourceItems.length ? "order" : "welcome",
      venueName,
      settings,
      items: sourceItems,
      subtotal: formatPrice((existingOrder?.subtotal ?? 0) + subtotal),
      tax: formatPrice((existingOrder?.tax ?? 0) + tax),
      total: formatPrice((existingOrder?.total ?? 0) + total),
      change: cashConfirmed ? formatPrice(cashConfirmed.change) : "",
    });
  }, [
    licenseKey,
    companyQuery,
    cart,
    subtotal,
    tax,
    total,
    existingOrder,
    orderWithItemsQuery,
    payStep,
    cashConfirmed,
    formatPrice,
  ]);

  useEffect(() => {
    return () => {
      const displaySettings = readLocalCustomerDisplay(licenseKey);
      if (!displaySettings.enabled) return;
      publishCustomerDisplaySnapshot({
        v: 1,
        kind: "snapshot",
        licenseKey,
        at: Date.now(),
        phase: "welcome",
        venueName: "",
        settings: displaySettings,
        items: [],
        subtotal: "",
        tax: "",
        total: "",
        change: "",
      });
    };
  }, [licenseKey]);

  // Count items by station in cart
  const kitchenCount = cart
    .filter((i) => !i.station || i.station === "kitchen")
    .reduce((sum, i) => sum + i.quantity, 0);
  const barCount = cart
    .filter((i) => i.station === "bar")
    .reduce((sum, i) => sum + i.quantity, 0);

  const addToCartWithOptions = (
    item: MenuItemWithCustomizations,
    selectedCustomizations?: SelectedCustomization[],
    notes?: string,
  ) => {
    const lineKey = cartLineKey({
      menuItemId: String(item._id),
      selectedCustomizations,
      notes,
    });
    const existingQty =
      cart.find((c) => cartLineKey(c) === lineKey)?.quantity ?? 0;
    const blocked = getOrderBlockReason(
      item,
      existingQty + 1,
      availabilityRules,
    );
    if (blocked) {
      toastOrderBlocked(blocked, item.name);
      return;
    }
    const unitPrice = resolvedMenuItemUnitPrice(item.price, selectedCustomizations);
    setCart((prev) => {
      const existing = prev.find((c) => cartLineKey(c) === lineKey);
      if (existing) {
        return prev.map((c) =>
          cartLineKey(c) === lineKey
            ? { ...c, quantity: c.quantity + 1 }
            : c,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item._id,
          name: item.name,
          price: unitPrice,
          quantity: 1,
          station: item.station,
          vatRate: item.vatRate,
          notes,
          selectedCustomizations,
        },
      ];
    });
  };

  const addToCart = (item: MenuItemWithCustomizations) => {
    const blocked = getOrderBlockReason(item, 1, availabilityRules);
    if (blocked) {
      toastOrderBlocked(blocked, item.name);
      return;
    }
    if (hasMenuItemCustomizations(item)) {
      setCustomizationPickerItem(item);
      return;
    }
    addToCartWithOptions(item);
  };

  const updateCartQty = (
    lineKey: string,
    delta: number,
  ) => {
    if (delta > 0) {
      const line = cart.find((c) => cartLineKey(c) === lineKey);
      const item = menuItems.find((i) => i._id === line?.menuItemId);
      const nextQty = (line?.quantity ?? 0) + delta;
      if (item) {
        const blocked = getOrderBlockReason(item, nextQty, availabilityRules);
        if (blocked) {
          toastOrderBlocked(blocked, item.name);
          return;
        }
      }
    }
    setCart((prev) =>
      prev
        .map((c) =>
          cartLineKey(c) === lineKey
            ? { ...c, quantity: c.quantity + delta }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  const removeFromCart = (lineKey: string) => {
    setCart((prev) => prev.filter((c) => cartLineKey(c) !== lineKey));
  };

  const cartReplaceSource = cartReplaceKey
    ? cart.find((c) => cartLineKey(c) === cartReplaceKey)
    : undefined;

  const cartReplaceOptions = useMemo(() => {
    const q = cartReplaceQuery.trim().toLowerCase();
    return menuItems.filter((mi) => {
      if (cartReplaceSource && String(mi._id) === String(cartReplaceSource.menuItemId)) {
        return false;
      }
      if (!isMenuItemShownForOrdering(mi, enforceAvailability)) return false;
      if (!q) return true;
      return mi.name.toLowerCase().includes(q);
    });
  }, [menuItems, cartReplaceQuery, cartReplaceSource, enforceAvailability]);

  const closeCartReplaceDialog = () => {
    setCartReplaceKey(null);
    setCartReplaceQuery("");
    setCartReplaceQty(1);
  };

  const applyCartReplace = (
    sourceKey: string,
    takeQty: number,
    item: MenuItemWithCustomizations,
  ) => {
    const selections = hasMenuItemCustomizations(item)
      ? defaultSelectionsForGroups(getMenuItemCustomizationGroups(item))
      : undefined;
    const unitPrice = resolvedMenuItemUnitPrice(item.price, selections);
    setCart((prev) => {
      const source = prev.find((c) => cartLineKey(c) === sourceKey);
      if (!source) return prev;
      const take = Math.min(Math.max(1, takeQty), source.quantity);
      const keep = source.quantity - take;
      const incoming: CartItem = {
        menuItemId: item._id,
        name: item.name,
        price: unitPrice,
        quantity: take,
        station: item.station,
        vatRate: item.vatRate,
        notes: source.notes,
        selectedCustomizations: selections,
      };
      const incomingKey = cartLineKey(incoming);
      const withoutSource =
        keep <= 0
          ? prev.filter((c) => cartLineKey(c) !== sourceKey)
          : prev.map((c) =>
              cartLineKey(c) === sourceKey ? { ...c, quantity: keep } : c,
            );
      const mergeIdx = withoutSource.findIndex(
        (c) => cartLineKey(c) === incomingKey,
      );
      if (mergeIdx >= 0) {
        return withoutSource.map((c, i) =>
          i === mergeIdx ? { ...c, quantity: c.quantity + take } : c,
        );
      }
      if (keep <= 0) {
        return prev.map((c) =>
          cartLineKey(c) === sourceKey ? incoming : c,
        );
      }
      return [...withoutSource, incoming];
    });
  };

  const handleCartReplaceWith = (item: MenuItemWithCustomizations) => {
    if (!cartReplaceKey || !cartReplaceSource) return;
    const blocked = getOrderBlockReason(
      item,
      cartReplaceQty,
      availabilityRules,
    );
    if (blocked) {
      toastOrderBlocked(blocked, item.name);
      return;
    }
    applyCartReplace(cartReplaceKey, cartReplaceQty, item);
    toast.success(t("order.item_replaced_toast"));
    closeCartReplaceDialog();
  };

  const openNoteDialog = (line: CartItem) => {
    setNoteCartKey(cartLineKey(line));
    setNoteText(line.notes ?? "");
  };

  const saveNote = () => {
    if (!noteCartKey) return;
    setCart((prev) =>
      prev.map((c) =>
        cartLineKey(c) === noteCartKey
          ? { ...c, notes: noteText.trim() || undefined }
          : c,
      ),
    );
    setNoteCartKey(null);
    setNoteText("");
  };

  // Send order
  const handleSendOrder = async () => {
    if (sendOrderInFlightRef.current || isSubmitting) {
      toast.info(t("order.send_in_progress"));
      return;
    }
    if (cart.length === 0 && !existingOrder) {
      toast.error(t("order.err_add_items_first"));
      return;
    }
    if (cart.length === 0) {
      toast.error(t("order.err_no_new_items"));
      return;
    }

    const lines = cart.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      notes: item.notes,
      name: item.name,
      price: item.price,
      station: item.station,
      vatRate: item.vatRate,
      selectedCustomizations: item.selectedCustomizations,
    }));
    const ticketLines = lines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      notes: l.notes,
      modifiers: formatCustomizationsForDisplay(l.selectedCustomizations) || undefined,
      station: l.station,
      price: l.price,
    }));

    const runTicketPrint = (orderRefForPrint: string) => {
      const tableNameForPrint = currentTable?.name ?? "—";
      const kitchenDevice = kitchenTicketDeviceName;
      const barDevice = barTicketDeviceName;

      void (async () => {
        try {
          const kitchenTicketLines = ticketLines.filter(
            (l) => l.station !== "bar",
          );
          const barTicketLines = ticketLines.filter((l) => l.station === "bar");

          const printTicket = (
            linesArg: typeof ticketLines,
            titleKey: string,
            deviceName?: string,
          ) =>
            printSentOrderTicket({
              title: t(titleKey),
              tableLabel: t("order.ticket_table"),
              tableName: tableNameForPrint,
              orderLabel: t("order.ticket_order_ref"),
              orderValue: orderRefForPrint,
              staffLabel: t("order.ticket_staff"),
              staffName,
              printedLabel: t("order.ticket_printed"),
              stationKitchen: t("order.ticket_station_kitchen"),
              stationBar: t("order.ticket_station_bar"),
              lines: linesArg,
              formatPrice,
              deviceName,
              licenseKey,
            });

          let printFailed = false;
          let printAttempted = false;
          let printErrorCode: string | undefined;
          if (kitchenTicketLines.length > 0) {
            printAttempted = true;
            const pr = await printTicket(
              kitchenTicketLines,
              "order.ticket_title_kitchen",
              kitchenDevice,
            );
            if (!pr.ok) {
              printFailed = true;
              printErrorCode = pr.error ?? printErrorCode;
            }
          }
          if (barTicketLines.length > 0) {
            printAttempted = true;
            const pr = await printTicket(
              barTicketLines,
              "order.ticket_title_bar",
              barDevice,
            );
            if (!pr.ok) {
              printFailed = true;
              printErrorCode = pr.error ?? printErrorCode;
            }
          }
          if (printAttempted && printFailed) {
            const electronApp = Boolean(
              typeof window !== "undefined" &&
                (window as Window & { desktop?: { isElectron?: boolean } })
                  .desktop?.isElectron,
            );

            const queued =
              electronApp && isSilentPrintQueueableError(printErrorCode);

            // When queued locally, do not interrupt the waiter (no toast / no modal path).
            if (!queued) {
              toast.error(
                electronApp
                  ? t("order.print_ticket_silent_failed")
                  : t("order.print_popup_blocked"),
              );
            }
          }
        } catch (printErr) {
          console.error("POS ticket print:", printErr);
          toast.error(t("order.print_ticket_error"));
        }
      })();
    };

    const ticketRefForPrint = (
      result: { ticketOrderRef?: string } | null | undefined,
    ) => {
      if (result?.ticketOrderRef) return result.ticketOrderRef;
      if (existingOrder) {
        return `#${displayOrderNumber(
          String(existingOrder._id),
          existingOrder.orderNumber,
        )}`;
      }
      return `#${t("order.offline_ticket_ref_new")}`;
    };

    if (!isOnline) {
      sendOrderInFlightRef.current = true;
      setIsSubmitting(true);
      try {
        const result = await submitCartOrder({
          licenseKey,
          tableId,
          staffId,
          staffName,
          existingOrderId: existingOrder?._id ?? null,
          lines,
        });

        // Queued offline (null) or immediate success — always print locally.
        runTicketPrint(ticketRefForPrint(result));
        setCart([]);
        onBack();
      } catch (error) {
        toast.error(
          (() => {
            const blocked = parseOrderBlockError(error);
            if (blocked) {
              return blocked.reason === "stock"
                ? t("order.blocked_stock", { name: blocked.name })
                : t("order.blocked_stopped", { name: blocked.name });
            }
            return errorMessageFromUnknown(error, t("order.err_send_order"));
          })(),
        );
      } finally {
        sendOrderInFlightRef.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    sendOrderInFlightRef.current = true;
    setIsSubmitting(true);
    const cartBackup: CartItem[] = cart.map((c) => ({ ...c }));
    setCart([]);

    try {
      const result = await submitCartOrder({
        licenseKey,
        tableId,
        staffId,
        staffName,
        existingOrderId: existingOrder?._id ?? null,
        lines,
      });

      if (!result) {
        setCart(cartBackup);
        toast.error(t("order.err_send_server"));
        return;
      }

      runTicketPrint(result.ticketOrderRef);
      onBack();
    } catch (error) {
      setCart(cartBackup);
      const blocked = parseOrderBlockError(error);
      toast.error(
        blocked
          ? blocked.reason === "stock"
            ? t("order.blocked_stock", { name: blocked.name })
            : t("order.blocked_stopped", { name: blocked.name })
          : errorMessageFromUnknown(error, t("order.err_send_order")),
      );
    } finally {
      sendOrderInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handlePrintBill = async () => {
    if (!existingOrder) return;
    if (!isOnline) {
      toast.error(t("order.bill_offline"));
      return;
    }
    try {
      const raw = (await runPosQuery("pos.orders.getOrderWithItems", {
        licenseKey,
        orderId: existingOrder._id,
      })) as {
        items: Array<{
          name: string;
          price: number;
          quantity: number;
          notes?: string;
          station?: string;
          status: string;
        }>;
        tableName?: string;
        staffName?: string;
        orderNumber?: number;
        subtotal: number;
        tax: number;
        total: number;
        _id: string;
      };

      const mergeKey = (item: (typeof raw.items)[number]) => {
        const notes = (item.notes ?? "").trim().toLowerCase();
        const name = item.name.trim().toLowerCase();
        const price = Math.round(Number(item.price) * 100) / 100;
        const station = item.station ?? "";
        return `${name}|${price}|${notes}|${station}`;
      };

      const activeItems = raw.items.filter(
        (i) => i.status !== "cancelled" && i.status !== "voided",
      );

      type Grouped = {
        key: string;
        name: string;
        unitPrice: number;
        qty: number;
        notes?: string;
      };
      const grouped: Grouped[] = [];
      for (const item of activeItems) {
        const key = mergeKey(item);
        const ex = grouped.find((g) => g.key === key);
        if (ex) ex.qty += item.quantity;
        else {
          grouped.push({
            key,
            name: item.name,
            unitPrice: Number(item.price),
            qty: item.quantity,
            notes: item.notes?.trim() || undefined,
          });
        }
      }

      const lines = grouped.map((g) => ({
        name: g.name,
        quantity: g.qty,
        unitPrice: g.unitPrice,
        lineTotal: Math.round(g.unitPrice * g.qty * 100) / 100,
        notes: g.notes,
      }));

      const pendingLines =
        cart.length > 0
          ? cart.map((c) => ({
              name: c.name,
              quantity: c.quantity,
              unitPrice: c.price,
              lineTotal: Math.round(c.price * c.quantity * 100) / 100,
              notes: c.notes,
            }))
          : undefined;

      const orderSubtotal = Number(raw.subtotal);
      const orderTax = Number(raw.tax);
      const orderTotal = Number(raw.total);

      const orderRef =
        raw.orderNumber != null
          ? `#${String(raw.orderNumber)}`
          : String(raw._id).slice(0, 8);

      const company = companyQuery as
        | {
            name?: string;
            address?: string;
            city?: string;
            phone?: string;
          }
        | undefined;
      const printOpts: PrintPosBillOptions = {
        title: t("order.bill_title"),
        tableLabel: t("order.ticket_table"),
        tableName: raw.tableName ?? currentTable?.name ?? "—",
        orderLabel: t("order.ticket_order_ref"),
        orderValue: orderRef,
        staffLabel: t("order.ticket_staff"),
        staffName: raw.staffName ?? staffName,
        printedLabel: t("order.ticket_printed"),
        linesSectionTitle: t("order.bill_lines_section"),
        pendingSectionTitle:
          cart.length > 0 ? t("order.new_items") : undefined,
        columnItem: t("order.bill_col_item"),
        columnUnitPrice: t("order.bill_col_unit"),
        columnLineTotal: t("order.bill_col_line"),
        subtotalLabel: t("common.subtotal"),
        taxLabel: t("common.tax"),
        totalLabel: t("common.total"),
        lines,
        pendingLines,
        subtotal: orderSubtotal,
        tax: orderTax,
        total: orderTotal,
        formatPrice,
        licenseKey,
        business: {
          name: company?.name || "VYNTEX",
          address: company?.address,
          city: company?.city,
          phone: company?.phone,
          website: "www.vyntexpos.net",
        },
      };

      if (cart.length > 0) {
        printOpts.combinedTotalLabel = t("order.bill_combined");
        printOpts.combinedSubtotal =
          Math.round((orderSubtotal + subtotal) * 100) / 100;
        printOpts.combinedTax = Math.round((orderTax + tax) * 100) / 100;
        printOpts.combinedTotal =
          Math.round((orderTotal + total) * 100) / 100;
      }

      const billPr = await printPosBill(printOpts);
      if (!billPr.ok) {
        const electronApp = Boolean(
          typeof window !== "undefined" &&
            (window as Window & { desktop?: { isElectron?: boolean } })
              .desktop?.isElectron,
        );
        const queued = electronApp && isSilentPrintQueueableError(billPr.error);
        if (!queued) {
          toast.error(t("order.bill_print_failed"));
        }
        return;
      }
      try {
        await printBill({
          licenseKey,
          orderId: existingOrder._id,
          tableId,
        });
      } catch {
        /* table status is best-effort after a successful print */
      }
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, t("order.bill_load_failed")));
    }
  };

  const closePayDrawer = useCallback(() => {
    setPayDialogOpen(false);
    setPendingPayAmount(null);
    setPendingSettledSaleItems(null);
    setPendingCashType(null);
    setCashConfirmed(null);
    setCashSnapshot(null);
    setSplitAmountInput("");
    setCashReceivedInput("");
    setSplitDraft({ amount: 0, settled: [], lines: [] });
    setSplitPayMethod(null);
    setSplitCardRunning(false);
    setPayStep("type");
    setCustomerStep("select");
    setSelectedCustomerId(null);
    setNewCustomerName("");
  }, []);

  // Open payment drawer (right column slide-over)
  const openPayDialog = () => {
    if (!canProcessPayment) {
      toast.error(t("order.pay_not_allowed"));
      return;
    }
    setPayStep("type");
    setPendingPayAmount(null);
    setPendingSettledSaleItems(null);
    setPendingCashType(null);
    setCashConfirmed(null);
    setCashSnapshot(null);
    setSplitAmountInput("");
    setCashReceivedInput("");
    setCustomerStep("select");
    setSelectedCustomerId(null);
    setNewCustomerName("");
    setPayDialogOpen(true);
  };

  /** Debt / complimentary shortcuts beside “Sent items” (when admin granted permissions). */
  const openDebtFromSentItems = useCallback(() => {
    setPendingPayAmount(null);
    setPendingSettledSaleItems(null);
    setPendingCashType(null);
    setCashConfirmed(null);
    setCashSnapshot(null);
    setSplitAmountInput("");
    setCashReceivedInput("");
    setCustomerStep("select");
    setSelectedCustomerId(null);
    setNewCustomerName("");
    setPayDialogOpen(true);
    setPayStep("customer");
  }, []);

  const openComplimentaryFromSentItems = useCallback(() => {
    setPendingPayAmount(null);
    setPendingSettledSaleItems(null);
    setPendingCashType(null);
    setCashConfirmed(null);
    setCashSnapshot(null);
    setSplitAmountInput("");
    setCashReceivedInput("");
    setCustomerStep("select");
    setSelectedCustomerId(null);
    setNewCustomerName("");
    setPayDialogOpen(true);
    setPayStep("admin-pin");
  }, []);

  const paymentTypesHiddenFromDrawer = useMemo((): PaymentType[] => {
    const hidden: PaymentType[] = ["complimentary"];
    if (canChargeDebtQuick) hidden.push("debt");
    return hidden;
  }, [canChargeDebtQuick]);

  const sentItemsHeaderActions = useMemo((): ReactNode => {
    if (
      !existingOrder ||
      !canProcessPayment ||
      (!canChargeDebtQuick && !canMarkComplimentaryQuick)
    ) {
      return null;
    }
    const quickBtn =
      "inline-flex items-center justify-center gap-1 h-8 px-2 rounded-md text-[11px] font-medium border transition-colors shrink-0 cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";
    const debtLight =
      "border-orange-400 bg-white text-orange-900 hover:bg-orange-100 hover:text-orange-950";
    const debtDark =
      "border-orange-500/45 bg-[#0A0F1E] text-orange-200 hover:bg-orange-500/25 hover:text-orange-50";
    const compLight =
      "border-violet-400 bg-white text-violet-900 hover:bg-violet-100 hover:text-violet-950";
    const compDark =
      "border-violet-500/45 bg-[#0A0F1E] text-violet-200 hover:bg-violet-500/25 hover:text-violet-50";
    return (
      <>
        {canChargeDebtQuick ? (
          <button
            type="button"
            className={cn(quickBtn, isLightPos ? debtLight : debtDark)}
            disabled={isSubmitting || payDialogOpen}
            onClick={openDebtFromSentItems}
          >
            <HandCoins className="size-3.5 shrink-0" />
            <span className="truncate max-w-[5.5rem] sm:max-w-[7rem]">
              {t("dashboard.pay_debt")}
            </span>
          </button>
        ) : null}
        {canMarkComplimentaryQuick ? (
          <button
            type="button"
            className={cn(quickBtn, isLightPos ? compLight : compDark)}
            disabled={isSubmitting || payDialogOpen}
            onClick={openComplimentaryFromSentItems}
          >
            <Gift className="size-3.5 shrink-0" />
            <span className="truncate max-w-[5.5rem] sm:max-w-[7rem]">
              {t("dashboard.pay_complimentary")}
            </span>
          </button>
        ) : null}
      </>
    );
  }, [
    existingOrder,
    canProcessPayment,
    canChargeDebtQuick,
    canMarkComplimentaryQuick,
    isLightPos,
    isSubmitting,
    payDialogOpen,
    t,
    openDebtFromSentItems,
    openComplimentaryFromSentItems,
  ]);

  // Handle payment type selection
  const handleSelectPaymentType = (
    type: PaymentType,
    method: PaymentMethodId = "cash",
  ) => {
    if (type === "debt") {
      setPayStep("customer");
    } else if (type === "complimentary") {
      setPayStep("admin-pin");
    } else if (method === "cash") {
      setPendingCashType(type);
      setCashConfirmed(null);
      if (existingOrder) {
        setCashSnapshot({
          orderId: String(existingOrder._id),
          orderNumber: existingOrder.orderNumber,
          tableName: currentTable?.name ?? "—",
          waiterName: staffName,
          subtotal: existingOrder.subtotal,
          tax: existingOrder.tax,
          orderTotal: existingOrder.total,
          paidSoFar: orderPaidSoFar,
        });
      }
      setPayStep("cash");
    } else if (method === "card") {
      void handleFinalPay(type, "card");
    } else {
      const payMethod: PaymentMethod = method === "qr" ? "other" : method;
      void handleFinalPay(type, payMethod);
    }
  };

  // Process the final payment
  const receiptPrintStrings = {
    orderLabel: t("order.fiscal_lbl_order"),
    tableLabel: t("order.fiscal_lbl_table"),
    waiterLabel: t("order.fiscal_lbl_waiter"),
    dateLabel: t("order.fiscal_lbl_date"),
    itemsSectionTitle: t("order.fiscal_lbl_items"),
    subtotalLabel: t("common.subtotal"),
    taxLabel: t("common.tax"),
    totalLabel: t("common.total"),
    poweredBy: t("order.fiscal_powered_by"),
  };

  const printPaidReceipt = (
    type: PaymentType,
    paidOrderId: string,
    extra?: { customerName?: string },
  ) => {
    if (
      type !== "fiscal" &&
      type !== "non_fiscal" &&
      type !== "complimentary" &&
      type !== "debt"
    ) {
      return;
    }
    if (!isOnline) return;
    void (async () => {
      try {
        const pr =
          type === "fiscal"
            ? await printFiscalReceiptForPay({
                licenseKey,
                orderId: paidOrderId,
                formatPrice,
                strings: receiptPrintStrings,
                deviceName: receiptPrinterDeviceName,
              })
            : type === "non_fiscal"
            ? await printNonFiscalReceiptForPay({
                licenseKey,
                orderId: paidOrderId,
                formatPrice,
                strings: receiptPrintStrings,
                deviceName: receiptPrinterDeviceName,
              })
            : type === "complimentary"
            ? await printComplimentarySlipForPay({
                licenseKey,
                orderId: paidOrderId,
                formatPrice,
                deviceName: receiptPrinterDeviceName,
                approvedBy: staffName,
              })
            : await printDebtVoucherForPay({
                licenseKey,
                orderId: paidOrderId,
                formatPrice,
                deviceName: receiptPrinterDeviceName,
                customerName: extra?.customerName,
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
                ? t("order.fiscal_print_failed")
                : t("order.print_popup_blocked"),
            );
          }
        }
      } catch (receiptPrintErr) {
        console.error("Receipt print:", receiptPrintErr);
        toast.error(t("order.fiscal_print_failed"));
      }
    })();
  };

  const handleFinalPay = async (
    type: PaymentType,
    method: PaymentMethod,
    custId?: Id<"customers">,
    custName?: string,
    options?: {
      confirmCash?: boolean;
      amount?: number;
      settledSaleItems?: { id: string; quantity: number }[];
    },
  ) => {
    if (!existingOrder) return;
    setIsSubmitting(true);
    try {
      const paidOrderId = existingOrder._id;
      const balanceBefore = orderBalanceDue;
      const payAmount = options?.amount ?? pendingPayAmount;
      const settledItems =
        options?.settledSaleItems ?? pendingSettledSaleItems;
      const payingPartial =
        payAmount != null &&
        payAmount > 0 &&
        payAmount < balanceBefore - 0.009;

      const payPayload: Record<string, unknown> = {
        licenseKey,
        orderId: paidOrderId,
        paymentMethod: method,
        paymentType: type,
        customerId: custId,
        customerName: custName,
        staffId: staffId as Id<"staff">,
        staffName,
        tableId,
      };
      if (
        payAmount != null &&
        payAmount > 0 &&
        payAmount <= balanceBefore + 0.009
      ) {
        payPayload.amount = Math.min(payAmount, balanceBefore);
      }
      if (Array.isArray(settledItems) && settledItems.length > 0) {
        payPayload.settledSaleItems = settledItems;
        payPayload.settledSaleItemIds = settledItems.map((line) => line.id);
      }

      await payOrder(payPayload);

      const resetSplitSelection = () => {
        setPendingPayAmount(null);
        setPendingSettledSaleItems(null);
        setSplitAmountInput("");
        setCashReceivedInput("");
        setSplitDraft({ amount: 0, settled: [], lines: [] });
        setSplitPayMethod(null);
        setSplitCardRunning(false);
        setSplitPickerEpoch((n) => n + 1);
      };

      if (options?.confirmCash) {
        printPaidReceipt(type, paidOrderId, { customerName: custName });
      }

      if (payingPartial) {
        resetSplitSelection();
        if (settledItems && settledItems.length > 0) {
          setPayStep("split-items");
        } else {
          setPayDialogOpen(false);
          setPayStep("type");
        }
        return;
      }

      setPayDialogOpen(false);
      setPendingPayAmount(null);
      setPendingSettledSaleItems(null);
      setCashReceivedInput("");
      onBack();

      if (!options?.confirmCash) {
        printPaidReceipt(type, paidOrderId, { customerName: custName });
      }
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, t("order.err_payment_process")));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle debt customer confirm
  const handleDebtConfirm = (
    custId: Id<"customers"> | null,
    custName: string
  ) => {
    handleFinalPay("debt", "other", custId ?? undefined, custName);
  };

  useEffect(() => {
    if (bouncedWrongOwnerRef.current) return;
    if (staffRole !== "waiter" || !existingOrder) return;
    const ownerUuid = uuidOrNull(existingOrder.staffId);
    const myUuid = uuidOrNull(staffId);
    if (!ownerUuid || !myUuid || staffIdsEqual(existingOrder.staffId, staffId)) {
      return;
    }
    bouncedWrongOwnerRef.current = true;
    const ownerName =
      staffListQuery?.find((s) => staffIdsEqual(s._id, existingOrder.staffId))
        ?.name ?? t("order.err_table_owner_unknown");
    toast.error(t("order.err_table_in_use", { owner: ownerName }));
    onBack();
  }, [
    staffRole,
    existingOrder,
    existingOrder?.staffId,
    staffId,
    staffListQuery,
    onBack,
    t,
  ]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-4 gap-4">
        <Skeleton className="h-12 w-full bg-[#131A2E]" />
        <div className="flex-1 flex gap-4">
          <Skeleton className="flex-1 bg-[#131A2E] rounded-xl" />
          <Skeleton className="w-80 bg-[#131A2E] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#0D1326] border-b border-[#1e2a45]">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white">
            {currentTable?.name ?? "Table"}
          </h1>
          <p className="text-xs text-[#5a6580]">
            {currentTable?.zone} · Waiter: {staffName}
            {existingOrder && (
              <span className="ml-2 text-brand">
                · Order #{existingOrder.orderNumber}
              </span>
            )}
          </p>
        </div>
        {(canTransferTables || canMergeTables) && existingOrder && (
          <div className="flex items-center gap-1 shrink-0">
            {canTransferTables && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[#1e2a45] bg-[#131A2E] text-[#8b93a7] hover:text-white hover:bg-[#1e2a45] h-9"
                onClick={() => openTableMoveDialog("transfer")}
              >
                {t("order.transfer_mode")}
              </Button>
            )}
            {canMergeTables && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[#1e2a45] bg-[#131A2E] text-[#8b93a7] hover:text-white hover:bg-[#1e2a45] h-9 gap-1.5"
                onClick={() => openTableMoveDialog("merge")}
              >
                <ArrowLeftRight className="size-3.5" />
                {t("order.merge_mode")}
              </Button>
            )}
          </div>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-sm font-medium cursor-pointer"
          >
            <LogOut className="size-4" />
            {t("nav.logout")}
          </button>
        )}
      </div>

      <div
        ref={setOrderBodyEl}
        className="relative flex-1 flex min-h-0 overflow-hidden"
      >
        {/* Left: Menu */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Category tabs */}
          <div className="flex items-stretch gap-2 px-4 py-3 overflow-x-auto border-b border-[#1e2a45] bg-[#0A0F1E]">
            {/* Favorites tab - always first */}
            <button
              type="button"
              onClick={() => setActiveCategory("favorites")}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[4.75rem] max-w-[6rem] px-2 py-2 rounded-xl text-center transition-all cursor-pointer shrink-0",
                selectedCategory === "favorites"
                  ? "bg-amber-500 text-white shadow-lg"
                  : "bg-[#131A2E] text-[#8b93a7] hover:bg-[#1e2a45] hover:text-white border border-[#1e2a45]"
              )}
            >
              <Star
                className={cn(
                  "size-5 shrink-0",
                  selectedCategory === "favorites" ? "text-white" : "text-amber-400",
                )}
              />
              <span
                className={cn(
                  "text-[10px] sm:text-[11px] font-medium leading-snug line-clamp-2 w-full break-words",
                  selectedCategory === "favorites" ? "text-white" : "text-[#8b93a7]",
                )}
              >
                {t("order.favorites")}
              </span>
            </button>
            {categories.map((cat) => {
              const sel = selectedCategory === cat._id;
              return (
                <button
                  type="button"
                  key={cat._id}
                  onClick={() => setActiveCategory(cat._id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 min-w-[4.75rem] max-w-[6.25rem] px-2 py-2 rounded-xl text-center transition-all cursor-pointer shrink-0 border",
                    sel
                      ? "text-white shadow-lg border-transparent"
                      : "bg-[#131A2E] text-[#8b93a7] hover:bg-[#1e2a45] hover:text-white border-[#1e2a45]",
                  )}
                  style={sel ? { backgroundColor: cat.color } : undefined}
                >
                  <MenuCategoryGlyph
                    icon={
                      (cat.icon && String(cat.icon).trim()) ||
                      emojiForCategoryName(cat.name)
                    }
                    muted={!sel}
                  />
                  <span
                    className={cn(
                      "text-[10px] sm:text-[11px] font-medium leading-snug line-clamp-2 w-full break-words",
                      sel ? "text-white" : "text-[#8b93a7]",
                    )}
                  >
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="px-4 pt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#5a6580]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("common.search") ?? "Search menu..."}
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-[#131A2E] border border-[#1e2a45] text-white text-sm placeholder:text-[#5a6580] focus:outline-none focus:border-brand transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5a6580] hover:text-white cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          {/* Menu items grid */}
          <div className="flex-1 min-h-0 overflow-auto p-4">
            {filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[#5a6580] text-sm">
                {searchQuery.trim()
                  ? `No items matching "${searchQuery}"`
                  : selectedCategory === "favorites"
                    ? "No favorites yet — mark items as favorite or sell items to auto-populate"
                    : "No items in this category"}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredItems.map((item) => {
                  const cartItem = cart.find(
                    (c) => c.menuItemId === item._id
                  );
                  const visualBlock = getOrderBlockReason(
                    item,
                    1,
                    availabilityRules,
                  );
                  return (
                    <button
                      key={item._id}
                      type="button"
                      disabled={Boolean(visualBlock)}
                      onClick={() => {
                        if (visualBlock) return;
                        addToCart(item);
                      }}
                      className={cn(
                        "relative text-left rounded-xl border p-3.5 transition-all",
                        visualBlock === "stock"
                          ? cn(
                              "cursor-not-allowed border-red-300",
                              isLightPos
                                ? "bg-red-50/40 opacity-95"
                                : "bg-red-950/15 opacity-90",
                            )
                          : visualBlock
                          ? "cursor-not-allowed border-[#1e2a45] bg-[#0c101c] opacity-60"
                          : cartItem
                          ? "cursor-pointer border-brand/50 bg-brand/10"
                          : "cursor-pointer border-[#1e2a45] bg-[#131A2E] hover:border-[#2a3a5a]"
                      )}
                    >
                      {item.station && (
                        <div
                          className={cn(
                            "absolute top-2 left-2 flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded",
                            item.station === "kitchen"
                              ? "bg-orange-500/20 text-orange-400"
                              : "bg-purple-500/20 text-purple-400"
                          )}
                        >
                          {item.station === "kitchen" ? (
                            <ChefHat className="size-2.5" />
                          ) : (
                            <Wine className="size-2.5" />
                          )}
                        </div>
                      )}
                      {item.isFavorite && selectedCategory !== "favorites" && (
                        <Star className="absolute bottom-2 right-2 size-3 text-amber-400 fill-amber-400" />
                      )}
                      <p
                        className={cn(
                          "text-sm font-semibold truncate",
                          item.station && "mt-4",
                          visualBlock === "stock" && isLightPos
                            ? "text-red-900"
                            : "text-white",
                        )}
                      >
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="text-[11px] text-[#5a6580] mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <p className="text-sm font-bold text-brand mt-2">
                        {formatPrice(item.price)}
                      </p>
                      {visualBlock ? (
                        <p
                          className={cn(
                            "text-[10px] font-semibold mt-1",
                            visualBlock === "stock"
                              ? "text-red-500"
                              : "text-amber-400",
                          )}
                        >
                          {visualBlock === "stock"
                            ? t("order.out_of_stock")
                            : t("order.stopped_badge")}
                        </p>
                      ) : null}
                      {cartItem && !visualBlock && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold">
                          {cartItem.quantity}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {payDialogOpen ? (
          <button
            type="button"
            aria-label={t("order.pay_back_to_order")}
            onClick={() => {
              if (!isSubmitting) closePayDrawer();
            }}
            className="absolute inset-0 z-[15] cursor-default border-0 bg-slate-950/20 backdrop-blur-sm"
          />
        ) : null}
        {payDialogOpen ? (
          <div
            className={cn(
              "absolute inset-y-0 right-80 z-20 flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-[#f4f7fb] shadow-[-24px_0_60px_rgba(15,23,42,0.16)] lg:right-96",
              payStep === "cash" || payStep === "cash-done"
                ? "w-[min(980px,calc(100%-20rem))] min-w-[320px] max-w-none bg-[#eef3f9]/92 backdrop-blur-xl"
                : payStep === "card"
                  ? "w-[min(980px,calc(100%-20rem))] min-w-[320px] max-w-none border-white/10 bg-[#05080f]"
                : "w-[min(420px,38vw)] min-w-[280px] max-w-[520px]",
            )}
          >
            <div
              ref={payDrawerRootRef}
              className={cn(
                "relative flex min-h-0 flex-1 flex-col overflow-hidden",
                payStep === "card" ? "bg-transparent" : "bg-[#f4f7fb]",
              )}
            >
              {payStep !== "card" ? (
              <div className="flex shrink-0 items-start justify-between gap-2 px-5 pb-1 pt-4">
                <div className="min-w-0">
                  {payStep === "type" && pendingPayAmount == null ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isSubmitting) closePayDrawer();
                      }}
                      disabled={isSubmitting}
                      className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 transition hover:text-slate-950 disabled:opacity-40"
                    >
                      <ArrowLeft className="size-4 shrink-0" />
                      <span>{t("order.pay_back_to_order")}</span>
                    </button>
                  ) : payDrawerCanGoBack ? (
                    <button
                      type="button"
                      onClick={handlePayDrawerBack}
                      disabled={isSubmitting}
                      className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 transition hover:text-slate-950 disabled:opacity-40"
                    >
                      <ArrowLeft className="size-4 shrink-0" />
                      <span>{t("btn.back")}</span>
                    </button>
                  ) : null}
                  <div className="flex min-w-0 items-start gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {payStep === "type" ? (
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20">
                        <Wallet className="size-4.5" strokeWidth={1.75} />
                      </span>
                    ) : null}
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold tracking-tight text-slate-950">
                        {payDrawerHeading}
                      </h2>
                      {payStep === "type" ? (
                        <p className="mt-0.5 text-[12px] leading-snug text-slate-400">
                          {t("order.pay_drawer_choose_method")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  </div>
                </div>
              </div>
              ) : null}

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {payStep === "type" && (
                  <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-4">
                      <PaymentTypeStep
                        overlayHostRef={payDrawerRootRef}
                        amountLabel={payDueNow}
                        receivedAmount={cashReceivedInput}
                        onQuickCash={(amount) =>
                          setCashReceivedInput(
                            amount.toFixed(currency.decimals),
                          )
                        }
                        onReceivedChange={setCashReceivedInput}
                        onCompletePayment={(type, method) => {
                          if (method === "cash") {
                            void handleFinalPay(
                              type,
                              "cash",
                              undefined,
                              undefined,
                              { confirmCash: true },
                            );
                            return;
                          }
                          if (method === "card") {
                            void handleFinalPay(type, "card");
                            return;
                          }
                          void handleFinalPay(
                            type,
                            method === "qr" ? "other" : method,
                          );
                        }}
                        onSelect={handleSelectPaymentType}
                        isSubmitting={isSubmitting}
                        cashLikeOnly={
                          pendingPayAmount != null &&
                          pendingPayAmount < orderBalanceDue - 0.009
                        }
                        excludeTypes={paymentTypesHiddenFromDrawer}
                        methods={enabledPaymentMethods(paymentSettings)}
                        splitLabel={
                          splitBillsEnabled && pendingPayAmount == null
                            ? t("order.split_bill")
                            : undefined
                        }
                        onSplit={
                          splitBillsEnabled && pendingPayAmount == null
                            ? () => {
                                if (orderPaidSoFar < 0.009) {
                                  setSplitDraft({ amount: 0, settled: [], lines: [] });
                                  setSplitPayMethod(null);
                                  setSplitCardRunning(false);
                                  setPayStep("split-items");
                                } else {
                                  setSplitAmountInput(
                                    orderBalanceDue > 0
                                      ? String(
                                          Math.round(orderBalanceDue * 100) /
                                            100,
                                        )
                                      : "",
                                  );
                                  setSplitKeypadReplaceNext(true);
                                  setPayStep("split-amount");
                                }
                              }
                            : undefined
                        }
                      />
                  </div>
                )}
                {(payStep === "cash" || payStep === "cash-done") &&
                  pendingCashType &&
                  (existingOrder || cashSnapshot) && (
                    <CashPaymentScreen
                      licenseKey={licenseKey}
                      orderId={
                        cashConfirmed?.orderId ??
                        cashSnapshot?.orderId ??
                        String(existingOrder?._id ?? "")
                      }
                      orderNumber={
                        existingOrder?.orderNumber ?? cashSnapshot?.orderNumber
                      }
                      tableName={
                        currentTable?.name ?? cashSnapshot?.tableName ?? "—"
                      }
                      waiterName={staffName || cashSnapshot?.waiterName || "—"}
                      amountDue={
                        cashConfirmed?.amount ??
                        payDueNow
                      }
                      subtotal={
                        existingOrder?.subtotal ?? cashSnapshot?.subtotal ?? 0
                      }
                      tax={existingOrder?.tax ?? cashSnapshot?.tax ?? 0}
                      orderTotal={
                        existingOrder?.total ?? cashSnapshot?.orderTotal ?? 0
                      }
                      paidSoFar={
                        existingOrder
                          ? orderPaidSoFar
                          : (cashSnapshot?.paidSoFar ?? 0)
                      }
                      receiptTypeLabel={t(
                        pendingCashType === "fiscal"
                          ? "order.pay_type_fiscal_label"
                          : pendingCashType === "non_fiscal"
                            ? "order.pay_type_non_fiscal_label"
                            : "order.pay_type_no_receipt_label",
                      )}
                      cashReceivedInput={cashReceivedInput}
                      onCashReceivedChange={setCashReceivedInput}
                      isSubmitting={isSubmitting}
                      confirmed={cashConfirmed}
                      onComplete={() => {
                        if (
                          cashReceivedInput.trim() !== "" &&
                          tenderedCash + 0.0001 < payDueNow
                        ) {
                          toast.error(t("order.cash_need_received"));
                          return;
                        }
                        void handleFinalPay(
                          pendingCashType,
                          "cash",
                          undefined,
                          undefined,
                          { confirmCash: true },
                        );
                      }}
                      onCancel={closePayDrawer}
                      onPrint={
                        cashConfirmed &&
                        (pendingCashType === "fiscal" ||
                          pendingCashType === "non_fiscal")
                          ? () =>
                              printPaidReceipt(
                                pendingCashType,
                                cashConfirmed.orderId,
                              )
                          : undefined
                      }
                      onDone={() => {
                        const partial = cashConfirmed?.wasPartial ?? false;
                        closePayDrawer();
                        if (!partial) onBack();
                      }}
                    />
                  )}
                {payStep === "card" ? (
                  <CardPaymentScreen
                    amount={payDueNow}
                    isSubmitting={isSubmitting}
                    onCancel={() => {
                      if (isSubmitting) return;
                      setPendingCashType(null);
                      setPayStep("type");
                    }}
                    onApproved={() => {
                      void handleFinalPay(
                        pendingCashType ?? "fiscal",
                        "card",
                      );
                    }}
                  />
                ) : null}
                {payStep === "split-items" && existingOrder && (
                  <SplitBillItemPicker
                    key={splitPickerEpoch}
                    licenseKey={licenseKey}
                    orderId={existingOrder._id}
                    orderBalanceDue={orderBalanceDue}
                    onBack={() => setPayStep("type")}
                    onSelectionChange={handleSplitSelectionChange}
                  />
                )}
                {payStep === "split-amount" && existingOrder
                  ? (() => {
                      const keypad = (
                        <PremiumMoneyKeypad
                          value={splitAmountInput}
                          amountDue={orderBalanceDue}
                          maxDecimals={currency.decimals}
                          replaceNext={splitKeypadReplaceNext}
                          onConsumedReplace={() =>
                            setSplitKeypadReplaceNext(false)
                          }
                          onChange={setSplitAmountInput}
                          onClose={() => {
                            setSplitAmountInput("");
                            setPendingSettledSaleItems(null);
                            setPayStep(
                              orderPaidSoFar < 0.009 ? "split-items" : "type",
                            );
                          }}
                          isSubmitting={isSubmitting}
                          onComplete={() => {
                            const n = parseFloat(
                              String(splitAmountInput).replace(",", "."),
                            );
                            if (!Number.isFinite(n) || n <= 0) {
                              toast.error(t("order.split_enter_amount"));
                              return;
                            }
                            if (n > orderBalanceDue + 0.009) {
                              toast.error(t("order.split_restrict_hint"));
                              return;
                            }
                            const rounded = Math.round(n * 100) / 100;
                            setPendingPayAmount(rounded);
                            setCashReceivedInput(
                              rounded.toFixed(currency.decimals),
                            );
                            setSplitDraft({ amount: rounded, settled: [], lines: [] });
                            setPendingSettledSaleItems(null);
                            setPayStep("type");
                          }}
                        />
                      );
                      return payDrawerRootRef.current
                        ? createPortal(keypad, payDrawerRootRef.current)
                        : keypad;
                    })()
                  : null}
                {payStep === "customer" && (
                  <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
                    <CustomerSelectStep
                      licenseKey={licenseKey}
                      total={orderBalanceDue}
                      customerStep={customerStep}
                      setCustomerStep={setCustomerStep}
                      selectedCustomerId={selectedCustomerId}
                      setSelectedCustomerId={setSelectedCustomerId}
                      newCustomerName={newCustomerName}
                      setNewCustomerName={setNewCustomerName}
                      onConfirm={handleDebtConfirm}
                      onBack={() => setPayStep("type")}
                      isSubmitting={isSubmitting}
                    />
                  </div>
                )}
                {payStep === "admin-pin" && (
                  <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
                    <AdminPinStep
                      licenseKey={licenseKey}
                      total={orderBalanceDue}
                      onApproved={() => handleFinalPay("complimentary", "other")}
                      onBack={() => setPayStep("type")}
                      isSubmitting={isSubmitting}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Right: Order panel; Split covers it with payment method */}
        <div
          className={cn(
            "relative z-[80] w-80 lg:w-96 shrink-0 border-l flex flex-col min-h-0 overflow-hidden",
            payStep === "split-items"
              ? "border-slate-200 bg-[#f4f7fb]"
              : "border-[#1e2a45] bg-[#0D1326]",
          )}
        >
          {payStep === "split-items" ? (
            <div className="flex h-full min-h-0 flex-1 flex-col px-4 pb-4 pt-4">
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
                {t("order.pay_method_title")}
              </h2>
              <div className="mt-3">
                <PaymentMethodCards
                  methods={enabledPaymentMethods(paymentSettings).filter(
                    (method) => method !== "qr",
                  )}
                  selected={splitPayMethod}
                  compact
                  disabled={isSubmitting || splitCardRunning}
                  onSelect={(method) => {
                    setSplitPayMethod(method);
                    if (method !== "card") setSplitCardRunning(false);
                  }}
                />
              </div>
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {t("order.split_pick_selected_items")}
                  </p>
                  {splitDraft.lines.length === 0 ? (
                    <p className="mt-2 text-[12px] text-slate-400">
                      {t("order.split_pick_selected_empty")}
                    </p>
                  ) : (
                    <>
                      <div className="mt-2 space-y-1.5">
                        {splitDraft.lines.map((row) => (
                          <div
                            key={row.key}
                            className="flex items-center gap-2 text-[12px]"
                          >
                            <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
                              {row.name}
                            </span>
                            <span className="shrink-0 tabular-nums text-slate-400">
                              ×{Number.isInteger(row.qty) ? row.qty : Math.round(row.qty * 1000) / 1000}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-slate-950">
                              {formatPrice(row.lineTotal)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                        <span className="text-[12px] font-medium text-slate-500">
                          {t("common.total")}
                        </span>
                        <span className="text-[14px] font-semibold tabular-nums text-brand">
                          {formatPrice(splitDraft.amount)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                {splitPayMethod === "card" ? (
                  <div className="mt-3">
                    <CardPaymentDetails
                      amount={splitDraft.amount}
                      active={splitCardRunning}
                      onApproved={() => {
                        if (splitDraft.amount <= 0) {
                          toast.error(t("order.split_pick_empty"));
                          setSplitCardRunning(false);
                          return;
                        }
                        void handleFinalPay("fiscal", "card", undefined, undefined, {
                          amount: splitDraft.amount,
                          settledSaleItems: splitDraft.settled,
                        });
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={isSubmitting || splitCardRunning}
                onClick={() => {
                  if (splitDraft.amount <= 0) {
                    toast.error(t("order.split_pick_empty"));
                    return;
                  }
                  if (splitPayMethod !== "cash" && splitPayMethod !== "card") {
                    toast.error(t("order.pay_complete_need_method"));
                    return;
                  }
                  if (splitPayMethod === "card") {
                    setSplitCardRunning(true);
                    return;
                  }
                  void handleFinalPay("fiscal", "cash", undefined, undefined, {
                    confirmCash: true,
                    amount: splitDraft.amount,
                    settledSaleItems: splitDraft.settled,
                  });
                }}
                className={cn(
                  "mt-3 flex h-12 w-full shrink-0 items-center justify-center gap-2.5 rounded-xl px-5 transition",
                  splitPayMethod === "cash" || splitPayMethod === "card"
                    ? "bg-brand text-[#f8fafc] shadow-[0_12px_28px_-12px_rgba(0,91,214,0.7)] hover:bg-brand-hover disabled:opacity-50"
                    : "bg-slate-200 text-slate-500 shadow-none",
                )}
              >
                <Wallet
                  className={cn(
                    "size-4",
                    splitPayMethod === "cash" || splitPayMethod === "card"
                      ? "text-[#f8fafc]"
                      : "text-slate-500",
                  )}
                  strokeWidth={1.75}
                />
                <span
                  className={cn(
                    "text-[14px] font-semibold",
                    splitPayMethod === "cash" || splitPayMethod === "card"
                      ? "text-[#f8fafc]"
                      : "text-slate-500",
                  )}
                >
                  {isSubmitting ? t("common.loading") : t("order.pay_complete")}
                </span>
                <ChevronRight
                  className={cn(
                    "size-4",
                    splitPayMethod === "cash" || splitPayMethod === "card"
                      ? "text-[#f8fafc]"
                      : "text-slate-500",
                  )}
                />
              </button>
            </div>
          ) : (
            <>
          <div className="px-4 py-3 border-b border-[#1e2a45] shrink-0">
            <h2 className="text-sm font-semibold text-white">{t("order.current_order")}</h2>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {existingOrder ? (
              <ExistingOrderItems
                licenseKey={licenseKey}
                orderId={existingOrder._id}
                tableId={tableId}
                staffId={staffId}
                staffName={staffName}
                staffRole={staffRole}
                allowRefund={roleCanRefund(staffRole, paymentSettings)}
                availabilityRules={availabilityRules}
                menuItems={menuItems}
                panelHost={orderBodyEl}
                headerActions={sentItemsHeaderActions}
                extraScrollContent={
                  <OrderNewCartLines
                    cart={cart}
                    showNewItemsLabel
                    formatPrice={formatPrice}
                    t={t}
                    onReplace={(lineKey) => {
                      setCartReplaceQty(1);
                      setCartReplaceQuery("");
                      setCartReplaceKey(lineKey);
                    }}
                    onNote={openNoteDialog}
                    onQty={updateCartQty}
                    onRemove={removeFromCart}
                  />
                }
              />
            ) : (
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2">
                <OrderNewCartLines
                  cart={cart}
                  showNewItemsLabel={false}
                  formatPrice={formatPrice}
                  t={t}
                  onReplace={(lineKey) => {
                    setCartReplaceQty(1);
                    setCartReplaceQuery("");
                    setCartReplaceKey(lineKey);
                  }}
                  onNote={openNoteDialog}
                  onQty={updateCartQty}
                  onRemove={removeFromCart}
                />
                {cart.length === 0 && (
                  <div className="flex items-center justify-center h-40 text-[#5a6580] text-sm">
                    {t("common.no_items")}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Totals + actions */}
          <div className="border-t border-[#1e2a45] p-4 space-y-3 shrink-0">
            {(cart.length > 0 || existingOrder) && (
              <div className="space-y-1.5 text-sm">
                {existingOrder && (
                  <>
                    <div className="flex justify-between text-[#8b93a7]">
                      <span>{t("common.subtotal")}</span>
                      <span>{formatPrice(existingOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[#8b93a7]">
                      <span>{t("common.tax")}</span>
                      <span>{formatPrice(existingOrder.tax)}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-[#1e2a45]">
                      <span>{t("common.total")}</span>
                      <span>{formatPrice(existingOrder.total)}</span>
                    </div>
                    {orderPaidSoFar > 0.009 && (
                      <>
                        <div className="flex justify-between text-emerald-400/90 text-xs pt-1">
                          <span>{t("order.paid_so_far")}</span>
                          <span>{formatPrice(orderPaidSoFar)}</span>
                        </div>
                        <div className="flex justify-between text-amber-400 text-sm font-semibold">
                          <span>{t("order.balance_due")}</span>
                          <span>{formatPrice(orderBalanceDue)}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
                {cart.length > 0 && (
                  <>
                    <div className="flex justify-between text-[#5a6580] text-xs pt-1">
                      <span>{t("order.new_items")}</span>
                      <span>+{formatPrice(total)}</span>
                    </div>
                    {!existingOrder && (
                      <>
                        <div className="flex justify-between text-[#8b93a7]">
                          <span>{t("common.tax")}</span>
                          <span>{formatPrice(tax)}</span>
                        </div>
                        <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-[#1e2a45]">
                          <span>{t("common.total")}</span>
                          <span>{formatPrice(total)}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Action buttons grid - below total */}
            <div className="grid grid-cols-2 gap-2">
              {cart.length > 0 && (
                <div className="col-span-2">
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => void handleSendOrder()}
                    disabled={isSubmitting}
                  >
                    <Send className="size-4 mr-2" />
                    {isSubmitting ? t("common.loading") : t("order.send_to_kitchen")}
                    {(kitchenCount > 0 || barCount > 0) && (
                      <span className="ml-2 text-xs opacity-80">
                        ({kitchenCount > 0 ? `${kitchenCount} Kitchen` : ""}
                        {kitchenCount > 0 && barCount > 0 ? " · " : ""}
                        {barCount > 0 ? `${barCount} Bar` : ""})
                      </span>
                    )}
                  </Button>
                </div>
              )}
              {existingOrder && (
                <>
                  {canProcessPayment ? (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={openPayDialog}
                  >
                    <CreditCard className="size-4 mr-1.5" />
                    {t("btn.pay")}
                  </Button>
                  ) : null}
                  <Button variant="secondary" onClick={handlePrintBill} className={canProcessPayment ? "" : "col-span-2"}>
                    <Receipt className="size-4 mr-1.5" />
                    {t("btn.print_bill")}
                  </Button>
                </>
              )}

            </div>
          </div>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={tableMoveOpen}
        onOpenChange={(o) => {
          if (!tableMoveBusy) setTableMoveOpen(o);
        }}
      >
        <DialogContent className="bg-[#131A2E] border-[#1e2a45] max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">
              {tableMoveMode === "transfer"
                ? t("order.transfer_mode")
                : t("order.merge_mode")}
            </DialogTitle>
            <DialogDescription className="text-[#8b93a7]">
              {tableMoveMode === "transfer"
                ? t("order.transfer_help")
                : t("order.merge_help")}
            </DialogDescription>
          </DialogHeader>
          {floorRooms.length > 0 ? (
            <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-1">
              {floorRooms.map((room) => {
                const count = (
                  tableMoveMode === "transfer"
                    ? transferTargetTables
                    : mergeTargetTables
                ).filter((tbl) => (tbl.zone?.trim() || "—") === room).length;
                const on = (tableMoveRoom ?? floorRooms[0]) === room;
                return (
                  <button
                    key={room}
                    type="button"
                    onClick={() => {
                      setTableMoveRoom(room);
                      const node = tableMoveListRef.current?.querySelector(
                        `[data-move-room="${CSS.escape(room)}"]`,
                      );
                      node?.scrollIntoView({ block: "start", behavior: "smooth" });
                    }}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition",
                      on
                        ? "border-brand bg-[#f4f8ff] text-brand"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-950",
                    )}
                  >
                    {room}
                    <span
                      className={cn(
                        "min-w-[1.15rem] rounded-full px-1 text-center text-[10px] tabular-nums",
                        on ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-400",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <p className="text-[10px] uppercase tracking-wider text-[#5a6580]">
            {tableMoveMode === "transfer"
              ? t("order.transfer_targets")
              : t("order.merge_targets")}
          </p>
          <div
            ref={tableMoveListRef}
            className="h-[50vh] overflow-y-auto flex-1 min-h-0 space-y-3 pr-1"
          >
            {(tableMoveMode === "transfer" ? transferRooms : mergeRooms).map(
              (group) => (
                <div
                  key={group.room}
                  data-move-room={group.room}
                  className="space-y-1"
                >
                  <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5a6580]">
                    {group.room}
                  </p>
                  {group.tables.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-[#5a6580]">
                      {t("floor.no_tables_in_zone", { zone: group.room })}
                    </p>
                  ) : (
                    group.tables.map((tbl) => {
                      const sum = tableSummaries[tbl._id];
                      return (
                        <button
                          key={tbl._id}
                          type="button"
                          disabled={tableMoveBusy}
                          onClick={() => void handleConfirmTableMove(tbl._id)}
                          className="w-full text-left px-3 py-2.5 rounded-lg border border-[#1e2a45] bg-[#0A0F1E] hover:border-brand/50 hover:bg-[#131A2E] text-white text-sm transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <span className="font-medium">{tbl.name}</span>
                          {sum ? (
                            <span className="block text-xs text-[#8b93a7] mt-0.5">
                              {formatPrice(sum.total)}
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              ),
            )}
            {(tableMoveMode === "transfer"
              ? transferTargetTables
              : mergeTargetTables
            ).length === 0 ? (
              <p className="text-sm text-[#5a6580] py-4 text-center">
                {tableMoveMode === "transfer"
                  ? t("order.no_transfer_targets")
                  : t("order.no_merge_targets")}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-[#8b93a7]"
              disabled={tableMoveBusy}
              onClick={() => setTableMoveOpen(false)}
            >
              {t("btn.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customization dialog */}
      <Dialog
        open={customizationPickerItem !== null}
        onOpenChange={(open) => {
          if (!open) setCustomizationPickerItem(null);
        }}
      >
        <DialogContent className="bg-[#131A2E] border-[#1e2a45] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {customizationPickerItem?.name}
            </DialogTitle>
            <DialogDescription className="text-[#8b93a7]">
              {t("order.customization_desc")}
            </DialogDescription>
          </DialogHeader>
          {customizationPickerItem ? (
            <MenuItemCustomizationPicker
              groups={getMenuItemCustomizationGroups(customizationPickerItem)}
              basePrice={customizationPickerItem.price}
              formatPrice={formatPrice}
              accentClassName="border-brand bg-brand/10 text-brand-soft"
              labels={{
                title: t("order.customization_title"),
                optionalNote: t("order.customization_note"),
                notePlaceholder: t("order.customization_note_ph"),
                requiredError: t("order.customization_required"),
                confirm: t("order.customization_add"),
                cancel: t("btn.cancel"),
              }}
              onCancel={() => setCustomizationPickerItem(null)}
              onConfirm={(selections, notes) => {
                addToCartWithOptions(customizationPickerItem, selections, notes);
                setCustomizationPickerItem(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ReplaceProductDialog
        open={cartReplaceKey !== null}
        onClose={closeCartReplaceDialog}
        sourceName={cartReplaceSource?.name ?? ""}
        maxQty={cartReplaceSource?.quantity ?? 1}
        qty={cartReplaceQty}
        onQtyChange={setCartReplaceQty}
        query={cartReplaceQuery}
        onQueryChange={setCartReplaceQuery}
        options={cartReplaceOptions}
        busy={false}
        mode="swap"
        onPick={(item) => handleCartReplaceWith(item)}
        formatPrice={formatPrice}
        availabilityRules={availabilityRules}
        t={t}
      />

      {/* Note dialog */}
      <Dialog
        open={noteCartKey !== null}
        onOpenChange={(open) => {
          if (!open) setNoteCartKey(null);
        }}
      >
        <DialogContent className="bg-[#131A2E] border-[#1e2a45] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Special Request</DialogTitle>
            <DialogDescription className="text-[#8b93a7]">
              Add a note for the kitchen/bar staff
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g., No sugar, Extra cold, Well done..."
              className="bg-[#0A0F1E] border-[#1e2a45] text-white"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              {[
                "No sugar",
                "Extra cold",
                "Well done",
                "No ice",
                "Extra hot",
                "Mild",
              ].map((note) => (
                <button
                  key={note}
                  onClick={() => setNoteText(note)}
                  className="px-2.5 py-1 rounded-lg bg-[#0A0F1E] border border-[#1e2a45] text-xs text-[#8b93a7] hover:text-white hover:border-[#2a3a5a] transition-colors cursor-pointer"
                >
                  {note}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setNoteCartKey(null)}
              className="text-[#8b93a7]"
            >
              Cancel
            </Button>
            <Button onClick={saveNote}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Step 1: Payment Type Selection ──

function appendMoneyKey(
  prev: string,
  key: string,
  maxDecimals: number,
): string {
  if (key === "clear") return "";
  if (key === "bksp") return prev.slice(0, -1);
  if (key === ".") {
    if (maxDecimals <= 0) return prev;
    if (prev.includes(".")) return prev;
    return prev === "" ? "0." : prev + ".";
  }
  if (!/^\d$/.test(key)) return prev;
  const next = prev + key;
  const parts = next.split(".");
  const frac = parts[1];
  if (frac !== undefined && frac.length > maxDecimals) return prev;
  if (prev === "0" && !prev.includes(".")) return key;
  return next;
}

function sanitizeMoneyInput(raw: string, maxDecimals: number): string {
  let out = "";
  let sawDot = false;
  for (const ch of raw.replace(",", ".")) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && maxDecimals > 0 && !sawDot) {
      out += ".";
      sawDot = true;
    }
  }
  if (!out.includes(".")) return out;
  const [intPart, frac = ""] = out.split(".");
  return `${intPart}.${frac.slice(0, maxDecimals)}`;
}

function CurrencyNumpad({
  value,
  onChange,
  maxDecimals,
  clearLabel,
  listenKeyboard = false,
  fill = false,
}: {
  value: string;
  onChange: (v: string) => void;
  maxDecimals: number;
  clearLabel: string;
  listenKeyboard?: boolean;
  fill?: boolean;
}) {
  const press = (key: string) =>
    onChange(appendMoneyKey(value, key, maxDecimals));

  useEffect(() => {
    if (!listenKeyboard) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          "[data-cash-received-input], textarea, select, [contenteditable='true']",
        )
      ) {
        return;
      }
      const key = event.key;
      if (/^\d$/.test(key)) {
        event.preventDefault();
        onChange(appendMoneyKey(value, key, maxDecimals));
        return;
      }
      if (key === "." || key === ",") {
        event.preventDefault();
        onChange(appendMoneyKey(value, ".", maxDecimals));
        return;
      }
      if (key === "Backspace") {
        event.preventDefault();
        onChange(appendMoneyKey(value, "bksp", maxDecimals));
        return;
      }
      if (key === "Delete") {
        event.preventDefault();
        onChange("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listenKeyboard, maxDecimals, onChange, value]);

  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ] as const;
  const keyBtn =
    "h-11 rounded-xl bg-[#eef2f6] text-lg font-medium tracking-tight text-slate-900 hover:bg-[#e4e9ef] active:scale-[0.98] active:bg-slate-900 active:text-[#f8fafc] cursor-pointer transition-colors touch-manipulation";
  return (
    <div className={cn("relative z-30", fill ? "flex min-h-0 flex-1 flex-col gap-2" : "space-y-2")}>
      {rows.map((r) => (
        <div key={r.join("")} className={cn("grid grid-cols-3 gap-2", fill ? "min-h-0 flex-1" : undefined)}>
          {r.map((d) => (
            <button
              key={d}
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                press(d);
              }}
              className={cn(keyBtn, fill && "h-full min-h-9")}
            >
              {d}
            </button>
          ))}
        </div>
      ))}
      <div className={cn("grid grid-cols-3 gap-2", fill ? "min-h-0 flex-1" : undefined)}>
        {maxDecimals > 0 ? (
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              press(".");
            }}
            className={cn(keyBtn, fill && "h-full min-h-9")}
          >
            .
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            press("0");
          }}
          className={cn(keyBtn, fill && "h-full min-h-9")}
        >
          0
        </button>
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            press("bksp");
          }}
          className={cn(keyBtn, fill && "h-full min-h-9")}
        >
          ⌫
        </button>
      </div>
      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          press("clear");
        }}
        className="mt-1 h-8 w-full shrink-0 rounded-xl text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 hover:text-slate-700 cursor-pointer touch-manipulation"
      >
        {clearLabel}
      </button>
    </div>
  );
}

function PaymentTypeStep({
  overlayHostRef,
  amountLabel,
  onSelect,
  isSubmitting,
  cashLikeOnly = false,
  excludeTypes = [],
  methods = ["cash", "card"],
  onSplit,
  splitLabel,
  receivedAmount = "",
  onQuickCash,
  onReceivedChange,
  onCompletePayment,
}: {
  overlayHostRef?: RefObject<HTMLDivElement | null>;
  amountLabel: number;
  onSelect: (type: PaymentType, method: PaymentMethodId) => void;
  isSubmitting: boolean;
  /** Split bill: only methods allowed before the order is fully paid. */
  cashLikeOnly?: boolean;
  /** Shown as quick actions beside sent items when staff has those permissions. */
  excludeTypes?: PaymentType[];
  methods?: PaymentMethodId[];
  onSplit?: () => void;
  splitLabel?: string;
  receivedAmount?: string;
  onQuickCash?: (amount: number) => void;
  onReceivedChange?: (value: string) => void;
  onCompletePayment?: (type: PaymentType, method: PaymentMethodId) => void;
}) {
  const { t, formatPrice, currency } = usePosLocale();
  const quickCash = [10, 20, 50, 100];
  const receivedNow = parseFloat(String(receivedAmount).replace(",", ".")) || 0;
  const [selectedType, setSelectedType] = useState<PaymentType>("fiscal");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId | null>(
    null,
  );
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [replaceNextKey, setReplaceNextKey] = useState(true);
  const [cardRunning, setCardRunning] = useState(false);
  const showCashFields = selectedMethod === "cash";
  const showCardFields = selectedMethod === "card";
  const allOptions: {
    type: PaymentType;
    labelKey: string;
    sublabelKey: string;
    icon: typeof FileText;
    well: string;
  }[] = [
    {
      type: "fiscal",
      labelKey: "order.pay_type_fiscal_label",
      sublabelKey: "order.pay_type_fiscal_desc",
      icon: FileText,
      well: "bg-emerald-50 text-emerald-600",
    },
    {
      type: "non_fiscal",
      labelKey: "order.pay_type_non_fiscal_label",
      sublabelKey: "order.pay_type_non_fiscal_desc",
      icon: Receipt,
      well: "bg-sky-50 text-sky-600",
    },
    {
      type: "no_receipt",
      labelKey: "order.pay_type_no_receipt_label",
      sublabelKey: "order.pay_type_no_receipt_desc",
      icon: FileX,
      well: "bg-amber-50 text-amber-600",
    },
    {
      type: "debt",
      labelKey: "order.pay_type_debt_label",
      sublabelKey: "order.pay_type_debt_desc",
      icon: HandCoins,
      well: "bg-orange-50 text-orange-600",
    },
    {
      type: "complimentary",
      labelKey: "order.pay_type_complimentary_label",
      sublabelKey: "order.pay_type_complimentary_desc",
      icon: Gift,
      well: "bg-violet-50 text-violet-600",
    },
  ];

  const excluded = new Set(excludeTypes);
  let options = allOptions.filter((o) => !excluded.has(o.type));
  if (cashLikeOnly) {
    options = options.filter((o) => o.type === "no_receipt" || o.type === "non_fiscal");
  }
  const visibleMethods: PaymentMethodId[] = (
    methods.includes("card")
      ? methods
      : [
          ...methods.slice(0, methods[0] === "cash" ? 1 : 0),
          "card",
          ...methods.slice(methods[0] === "cash" ? 1 : 0),
        ]
  ).filter((method) => method !== "qr");

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {cashLikeOnly ? (
        <span className="mb-3 block text-[11px] font-medium text-amber-600">
          {t("order.split_restrict_hint")}
        </span>
      ) : null}
      {!cashLikeOnly ? (
        <div className={cn(showCardFields ? "mb-3" : "mb-6")}>
          <h3 className="text-[15px] font-semibold tracking-tight text-slate-950">
            {t("order.pay_bill_type_title")}
          </h3>
          <div className="mt-3">
            <PaymentBillTypeCards
              selected="full"
              splitEnabled={Boolean(onSplit)}
              disabled={isSubmitting}
              onSelect={(kind) => {
                if (kind === "split") {
                  if (onSplit) onSplit();
                  else toast.error(t("order.split_restrict_hint"));
                }
              }}
            />
          </div>
        </div>
      ) : null}
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-slate-950">
          {t("order.pay_method_title")}
        </h3>
        <div className="mt-3">
          <PaymentMethodCards
            methods={visibleMethods}
            selected={selectedMethod}
            disabled={isSubmitting}
            compact={showCardFields}
            onSelect={(method) => {
              setSelectedMethod(method);
              if (method !== "cash") setKeypadOpen(false);
              if (method !== "card") setCardRunning(false);
            }}
          />
        </div>
      </div>
      <div className={cn(showCardFields ? "mt-3" : "mt-6")}>
        {showCardFields ? null : (
          <>
            <h3 className="text-[15px] font-semibold tracking-tight text-slate-950">
              {t("order.pay_details_title")}
            </h3>
            <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2">
              <span className="shrink-0 text-[14px] font-medium text-slate-500">
                {currency.symbol}
              </span>
              <span className="min-w-0 flex-1 text-[12px] font-medium text-slate-500">
                {t("order.pay_total_amount")}
              </span>
              <span className="text-[14px] font-medium tabular-nums text-slate-950">
                {amountLabel.toFixed(currency.decimals)}
              </span>
            </div>
          </>
        )}
        {showCardFields ? (
          <CardPaymentDetails
            amount={amountLabel}
            active={cardRunning}
            onApproved={() => {
              if (onCompletePayment) {
                onCompletePayment(selectedType, "card");
                return;
              }
              onSelect(selectedType, "card");
            }}
          />
        ) : null}
        {showCashFields ? (
          <>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {quickCash.map((n) => {
                const on = Math.abs(receivedNow - n) < 0.001;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => onQuickCash?.(n)}
                    className={cn(
                      "box-border h-10 rounded-xl border-2 border-slate-200/80 bg-white text-[13px] font-semibold tabular-nums text-slate-700 transition hover:border-brand/40 hover:text-brand disabled:opacity-40",
                      on && "border-brand bg-[#f4f8ff] text-brand",
                    )}
                  >
                    {formatPrice(n)}
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              <p className="mb-1.5 text-[12px] font-medium text-slate-500">
                {t("order.cash_received_amount")}
              </p>
              <button
                type="button"
                data-cash-received-input=""
                disabled={isSubmitting}
                onClick={() => {
                  setReplaceNextKey(true);
                  setKeypadOpen(true);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border bg-white px-3.5 py-2 text-left transition",
                  keypadOpen
                    ? "border-brand"
                    : "border-slate-200 hover:border-slate-300",
                )}
              >
                <span className="shrink-0 text-[14px] font-medium text-slate-500">
                  {currency.symbol}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-[14px] font-medium tabular-nums",
                    receivedAmount.trim()
                      ? "text-slate-950"
                      : "text-slate-400",
                  )}
                >
                  {receivedAmount.trim() || t("order.cash_enter_amount")}
                </span>
              </button>
            </div>
            <div className="mt-3">
              <p className="mb-1.5 text-[12px] font-medium text-slate-500">
                {t("order.pay_change")}
              </p>
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2">
                <span className="shrink-0 text-[14px] font-medium text-emerald-600">
                  {currency.symbol}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-[14px] font-medium tabular-nums",
                    receivedNow + 0.0001 >= amountLabel
                      ? "text-emerald-600"
                      : "text-slate-400",
                  )}
                >
                  {(receivedNow + 0.0001 >= amountLabel
                    ? Math.round((receivedNow - amountLabel) * 100) / 100
                    : 0
                  ).toFixed(currency.decimals)}
                </span>
              </div>
            </div>
          </>
        ) : null}
      </div>
      </div>
      {keypadOpen
        ? (() => {
            const keypad = (
              <PremiumMoneyKeypad
                value={receivedAmount}
                amountDue={amountLabel}
                maxDecimals={currency.decimals}
                replaceNext={replaceNextKey}
                onConsumedReplace={() => setReplaceNextKey(false)}
                onChange={(next) => onReceivedChange?.(next)}
                onClose={() => setKeypadOpen(false)}
                isSubmitting={isSubmitting}
                onComplete={() => {
                  if (!selectedMethod) {
                    toast.error(t("order.pay_complete_need_method"));
                    return;
                  }
                  if (!selectedType) {
                    toast.error(t("order.pay_complete_need_type"));
                    return;
                  }
                  if (
                    receivedAmount.trim() !== "" &&
                    receivedNow + 0.0001 < amountLabel
                  ) {
                    toast.error(t("order.cash_need_received"));
                    return;
                  }
                  if (onCompletePayment) {
                    onCompletePayment(selectedType, selectedMethod);
                    return;
                  }
                  onSelect(selectedType, selectedMethod);
                }}
              />
            );
            return overlayHostRef?.current
              ? createPortal(keypad, overlayHostRef.current)
              : keypad;
          })()
        : null}
      <div className="shrink-0 bg-[#f4f7fb] pt-4">
        <button
          type="button"
          disabled={isSubmitting || cardRunning}
          onClick={() => {
            if (!selectedMethod) {
              toast.error(t("order.pay_complete_need_method"));
              return;
            }
            if (!selectedType) {
              toast.error(t("order.pay_complete_need_type"));
              return;
            }
            if (
              selectedMethod === "cash" &&
              receivedAmount.trim() !== "" &&
              receivedNow + 0.0001 < amountLabel
            ) {
              toast.error(t("order.cash_need_received"));
              return;
            }
            if (selectedMethod === "card") {
              setCardRunning(true);
              return;
            }
            if (onCompletePayment) {
              onCompletePayment(selectedType, selectedMethod);
              return;
            }
            onSelect(selectedType, selectedMethod);
          }}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2.5 rounded-xl px-5 transition",
            selectedMethod === "cash" || selectedMethod === "card"
              ? "bg-brand text-[#f8fafc] shadow-[0_12px_28px_-12px_rgba(0,91,214,0.7)] hover:bg-brand-hover disabled:opacity-50"
              : "bg-slate-200 text-slate-500 shadow-none",
          )}
        >
          <Wallet
            className={cn(
              "size-4",
              selectedMethod === "cash" || selectedMethod === "card"
                ? "text-[#f8fafc]"
                : "text-slate-500",
            )}
            strokeWidth={1.75}
          />
          <span
            className={cn(
              "text-[14px] font-semibold",
              selectedMethod === "cash" || selectedMethod === "card"
                ? "text-[#f8fafc]"
                : "text-slate-500",
            )}
          >
            {isSubmitting ? t("common.loading") : t("order.pay_complete")}
          </span>
          <ChevronRight
            className={cn(
              "size-4",
              selectedMethod === "cash" || selectedMethod === "card"
                ? "text-[#f8fafc]"
                : "text-slate-500",
            )}
          />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Customer Selection (for debt) ──

function CustomerSelectStep({
  licenseKey,
  total,
  customerStep,
  setCustomerStep,
  selectedCustomerId,
  setSelectedCustomerId,
  newCustomerName,
  setNewCustomerName,
  onConfirm,
  onBack,
  isSubmitting,
}: {
  licenseKey: string;
  total: number;
  customerStep: "select" | "create";
  setCustomerStep: (step: "select" | "create") => void;
  selectedCustomerId: Id<"customers"> | null;
  setSelectedCustomerId: (id: Id<"customers"> | null) => void;
  newCustomerName: string;
  setNewCustomerName: (name: string) => void;
  onConfirm: (id: Id<"customers"> | null, name: string) => void;
  onBack: () => void;
  isSubmitting: boolean;
}) {
  const { theme } = usePosTheme();
  const isLight = theme === "light";
  const titleCls = isLight ? "text-slate-900" : "text-white";
  const bodyCls = isLight ? "text-slate-600" : "text-[#8b93a7]";
  const subtextCls = isLight ? "text-slate-500" : "text-[#5a6580]";
  const rowDefault = isLight
    ? "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
    : "border-[#1e2a45] bg-[#0A0F1E] hover:border-[#2a3a5a]";
  const rowWarn = isLight
    ? "border-amber-200 bg-amber-50/90 hover:border-amber-300"
    : "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50";
  const rowSelected = isLight
    ? "border-orange-400 bg-orange-50"
    : "border-orange-500 bg-orange-500/10";
  const dashedAdd = isLight
    ? "border-dashed border-slate-300 bg-slate-50 hover:border-orange-400/60"
    : "border-dashed border-[#2a3a5a] hover:border-orange-500/50 bg-[#0A0F1E]";
  const inputCls = isLight
    ? "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
    : "bg-[#0A0F1E] border-[#1e2a45] text-white placeholder:text-[#3a4560]";
  const nameCls = isLight ? "text-slate-900" : "text-white";

  // Use the debt ledger query to get balance info alongside customer data
  const ledger = useQuery('pos.customers.getDebtLedger', { licenseKey });
  const createCustomer = useMutation('pos.customers.createCustomer');
  const [newPhone, setNewPhone] = useState("");
  const [newCreditLimit, setNewCreditLimit] = useState("");
  const { formatPrice, t } = usePosLocale();

  const handleSelectExisting = (
    custId: Id<"customers">,
    custName: string,
    balance: number,
    creditLimit?: number
  ) => {
    // Warn if this order will push them over their credit limit
    if (creditLimit && balance + total > creditLimit) {
      const newBalance = balance + total;
      toast.warning(
        t("order.debt_credit_warning", {
          name: custName,
          newBalance: formatPrice(newBalance),
          limit: formatPrice(creditLimit),
        }),
        { duration: 5000 },
      );
    }
    setSelectedCustomerId(custId);
    onConfirm(custId, custName);
  };

  const handleCreateAndConfirm = async () => {
    if (!newCustomerName.trim()) {
      toast.error(t("order.err_customer_name"));
      return;
    }
    try {
      const id = await createCustomer({
        licenseKey,
        name: newCustomerName.trim(),
        phone: newPhone.trim() || undefined,
        creditLimit: newCreditLimit ? parseFloat(newCreditLimit) : undefined,
      });
      onConfirm(id, newCustomerName.trim());
    } catch {
      toast.error(t("order.err_customer_create"));
    }
  };

  return (
    <>
      <div
        className={cn(
          "space-y-1 pb-2 border-b",
          isLight ? "border-slate-200" : "border-[#1e2a45]",
        )}
      >
        <h3 className={cn("text-lg font-semibold leading-tight", titleCls)}>
          {t("order.debt_title")}
        </h3>
        <p className={cn("text-sm", bodyCls)}>
          {t("order.debt_total_label")}{" "}
          <span className={cn("font-bold", titleCls)}>{formatPrice(total)}</span>
          {" · "}
          {t("order.debt_select_hint")}
        </p>
      </div>

      {customerStep === "select" && (
        <div className="space-y-3 pt-1">
          {/* Existing customer list with balances */}
          <div className="max-h-56 overflow-auto space-y-1.5">
            {ledger === undefined ? (
              <div className={cn("text-center text-sm py-4", subtextCls)}>
                {t("order.debt_loading")}
              </div>
            ) : ledger.length === 0 ? (
              <div className={cn("text-center text-sm py-4", subtextCls)}>
                {t("order.debt_no_customers")}
              </div>
            ) : (
              ledger.map((c) => {
                const wouldExceedLimit =
                  c.creditLimit !== undefined &&
                  c.creditLimit > 0 &&
                  c.balance + total > c.creditLimit;

                return (
                  <button
                    key={c._id}
                    onClick={() =>
                      handleSelectExisting(c._id, c.name, c.balance, c.creditLimit)
                    }
                    disabled={isSubmitting}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer text-left",
                      selectedCustomerId === c._id
                        ? rowSelected
                        : wouldExceedLimit
                          ? rowWarn
                          : rowDefault,
                      isSubmitting && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <HandCoins className="size-4 text-orange-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={cn("text-sm font-medium truncate", nameCls)}>
                          {c.name}
                        </p>
                        {wouldExceedLimit && (
                          <AlertTriangle className="size-3 text-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.phone && (
                          <span className={cn("text-[11px]", subtextCls)}>
                            {c.phone}
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            c.balance > 0 ? "text-red-500" : "text-emerald-600"
                          )}
                        >
                          {t("order.debt_balance_short")} {formatPrice(c.balance)}
                        </span>
                        {c.creditLimit !== undefined && c.creditLimit > 0 && (
                          <span className={cn("text-[10px]", subtextCls)}>
                            {t("order.debt_limit_short")}{" "}
                            {formatPrice(c.creditLimit)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Add new customer button */}
          <button
            type="button"
            onClick={() => setCustomerStep("create")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer text-left",
              dashedAdd,
            )}
          >
            <UserPlus className="size-4 text-orange-400" />
            <span className={cn("text-sm", bodyCls)}>{t("order.debt_add_new")}</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className={cn(
              "text-xs cursor-pointer",
              isLight
                ? "text-slate-500 hover:text-slate-800"
                : "text-[#5a6580] hover:text-white",
            )}
          >
            {t("order.debt_back")}
          </button>
        </div>
      )}

      {customerStep === "create" && (
        <div className="space-y-3 pt-1">
          <div>
            <label className={cn("text-xs mb-1 block", bodyCls)}>
              {t("order.debt_name_label")}
            </label>
            <Input
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder={t("order.debt_placeholder_name")}
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <label className={cn("text-xs mb-1 block", bodyCls)}>
              {t("order.debt_phone_label")}
            </label>
            <Input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder={t("order.debt_placeholder_phone")}
              className={inputCls}
            />
          </div>
          <div>
            <label className={cn("text-xs mb-1 block", bodyCls)}>
              {t("order.debt_credit_limit_label")}
            </label>
            <Input
              type="number"
              value={newCreditLimit}
              onChange={(e) => setNewCreditLimit(e.target.value)}
              placeholder={t("order.debt_placeholder_no_limit")}
              className={inputCls}
              min={0}
              step={0.01}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setCustomerStep("select")}
              className={cn("flex-1", isLight ? "text-slate-600" : "text-[#8b93a7]")}
            >
              {t("order.debt_cancel")}
            </Button>
            <Button
              onClick={handleCreateAndConfirm}
              disabled={!newCustomerName.trim() || isSubmitting}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSubmitting ? t("order.debt_saving") : t("order.debt_add_confirm")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Admin PIN Step (for complimentary approval) ──

function AdminPinStep({
  licenseKey,
  total,
  onApproved,
  onBack,
  isSubmitting,
}: {
  licenseKey: string;
  total: number;
  onApproved: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}) {
  const { theme } = usePosTheme();
  const isLight = theme === "light";
  const titleCls = isLight ? "text-slate-900" : "text-white";
  const bodyCls = isLight ? "text-slate-600" : "text-[#8b93a7]";
  const inputCls = isLight
    ? "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
    : "bg-[#0A0F1E] border-[#1e2a45] text-white placeholder:text-[#3a4560]";
  const { formatPrice, t } = usePosLocale();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (!isValidStaffPinLength(pin.length)) {
      setError(
        t("staff.err_pin_digits", {
          min: STAFF_PIN_MIN_LEN,
          max: STAFF_PIN_MAX_LEN,
        }),
      );
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const hashed = await hashString(pin);
      const result = await verifyAdminPin(licenseKey, hashed);
      if (result) {
        onApproved();
      } else {
        setError("Invalid admin PIN");
        setPin("");
      }
    } catch {
      setError("Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "space-y-1 pb-2 border-b",
          isLight ? "border-slate-200" : "border-[#1e2a45]",
        )}
      >
        <h3 className={cn("text-lg font-semibold leading-tight", titleCls)}>
          Admin Approval Required
        </h3>
        <p className={cn("text-sm", bodyCls)}>
          On the House · {formatPrice(total)} value will be given away free.
          <br />
          Enter admin PIN to approve.
        </p>
      </div>
      <div className="space-y-3 pt-1">
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => {
            setPin(sanitizeStaffPinInput(e.target.value));
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleVerify();
          }}
          placeholder="Enter admin PIN"
          className={cn(
            "text-center text-xl tracking-[0.3em]",
            inputCls,
          )}
          maxLength={STAFF_PIN_MAX_LEN}
          autoFocus
        />
        {error && (
          <p className="text-red-500 text-xs text-center">{error}</p>
        )}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={onBack}
            className={cn("flex-1", isLight ? "text-slate-600" : "text-[#8b93a7]")}
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={!isValidStaffPinLength(pin.length) || verifying || isSubmitting}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {verifying ? "Verifying..." : "Approve"}
          </Button>
        </div>
      </div>
    </>
  );
}

function ReplaceProductDialog({
  open,
  onClose,
  sourceName,
  maxQty,
  qty,
  onQtyChange,
  query,
  onQueryChange,
  options,
  busy,
  mode,
  onPick,
  formatPrice,
  availabilityRules,
  t,
}: {
  open: boolean;
  onClose: () => void;
  sourceName: string;
  maxQty: number;
  qty: number;
  onQtyChange: (n: number) => void;
  query: string;
  onQueryChange: (q: string) => void;
  options: Doc<"menuItems">[];
  busy: boolean;
  mode: "swap" | "return";
  onPick: (item: Doc<"menuItems">) => void;
  formatPrice: (amount: number) => string;
  availabilityRules: OrderAvailabilityRules;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="bg-[#131A2E] border-[#1e2a45] max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">
            {t("order.replace_item")}
          </DialogTitle>
          <DialogDescription className="text-[#8b93a7]">
            {sourceName
              ? t(
                  mode === "swap"
                    ? "order.replace_item_desc_swap"
                    : "order.replace_item_desc_return",
                  { name: sourceName },
                )
              : t("order.replace_item_hint")}
          </DialogDescription>
        </DialogHeader>
        {maxQty > 1 && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[#1e2a45] bg-[#0A0F1E] px-3 py-2">
            <span className="text-xs text-[#8b93a7]">
              {t("order.replace_qty_label")}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={busy || qty <= 1}
                onClick={() => onQtyChange(Math.max(1, qty - 1))}
                className="flex size-7 items-center justify-center rounded-md text-[#8b93a7] hover:bg-[#1e2a45] disabled:opacity-40 cursor-pointer"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="min-w-10 text-center text-sm font-semibold tabular-nums text-white">
                {qty}/{maxQty}
              </span>
              <button
                type="button"
                disabled={busy || qty >= maxQty}
                onClick={() => onQtyChange(Math.min(maxQty, qty + 1))}
                className="flex size-7 items-center justify-center rounded-md text-[#8b93a7] hover:bg-[#1e2a45] disabled:opacity-40 cursor-pointer"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#5a6580]" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("order.replace_search_ph")}
            className="pl-8 bg-[#0A0F1E] border-[#1e2a45] text-white"
            disabled={busy}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto space-y-1 pr-0.5">
          {options.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#5a6580]">
              {t("order.replace_empty")}
            </p>
          ) : (
            options.map((item) => {
              const blocked = getOrderBlockReason(item, qty, availabilityRules);
              return (
              <button
                key={String(item._id)}
                type="button"
                disabled={busy || Boolean(blocked)}
                onClick={() => {
                  if (blocked) return;
                  onPick(item);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                  blocked === "stock"
                    ? "cursor-not-allowed border-red-400/60 bg-red-950/15"
                    : blocked
                    ? "cursor-not-allowed border-amber-400/40 bg-amber-950/10"
                    : "cursor-pointer border-[#1e2a45] bg-[#0A0F1E] hover:border-brand-sky/40 disabled:opacity-50",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">
                    {item.name}
                  </span>
                  <span className="block text-[11px] text-[#5a6580]">
                    {blocked === "stock"
                      ? t("order.out_of_stock")
                      : blocked
                      ? t("order.stopped_badge")
                      : formatPrice(item.price)}
                  </span>
                </span>
                {item.station === "bar" ? (
                  <Wine className="size-3.5 shrink-0 text-purple-400" />
                ) : (
                  <ChefHat className="size-3.5 shrink-0 text-orange-400" />
                )}
              </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Existing order items sub-component (with auto-grouping) ──

const DELETE_REASON_CODES = [
  "spilled",
  "spoiled",
  "kitchen_error",
  "customer_refused",
  "expired",
  "other",
] as const;

const DELETE_REASON_ICONS: Record<
  (typeof DELETE_REASON_CODES)[number],
  LucideIcon
> = {
  spilled: Droplets,
  spoiled: Ban,
  kitchen_error: ChefHat,
  customer_refused: UserX,
  expired: Clock,
  other: MessageSquare,
};

function ExistingOrderItems({
  licenseKey,
  orderId,
  tableId,
  staffId,
  staffName,
  staffRole,
  allowRefund = false,
  availabilityRules,
  menuItems,
  panelHost,
  headerActions,
  extraScrollContent,
}: {
  licenseKey: string;
  orderId: Id<"orders">;
  tableId: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  allowRefund?: boolean;
  availabilityRules: OrderAvailabilityRules;
  menuItems: Doc<"menuItems">[];
  panelHost?: HTMLElement | null;
  headerActions?: ReactNode | null;
  extraScrollContent?: ReactNode;
}) {
  const { formatPrice, t, language } = usePosLocale();
  const [sendsOpen, setSendsOpen] = useState(false);
  const sendsPanelRef = useRef<HTMLElement>(null);
  const [openSendIndexes, setOpenSendIndexes] = useState<number[]>([]);
  const [replaceTarget, setReplaceTarget] = useState<{
    itemIds: Id<"orderItems">[];
    name: string;
    quantity: number;
    notes?: string;
    menuItemId: string;
    mode: "swap" | "return";
  } | null>(null);
  const [replaceQuery, setReplaceQuery] = useState("");
  const [replaceQty, setReplaceQty] = useState(1);
  const [replaceBusy, setReplaceBusy] = useState(false);
  const [returnTarget, setReturnTarget] = useState<{
    itemIds: Id<"orderItems">[];
    name: string;
    quantity: number;
  } | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnBusy, setReturnBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    itemIds: Id<"orderItems">[];
    name: string;
  } | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>("");
  const [deleteOtherNote, setDeleteOtherNote] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const allowReplaceSent = staffRole === "admin" || staffRole === "manager";

  const orderLineStatusLabel = (status: string) => {
    const key = `order.status_${status}`;
    const tr = t(key);
    return tr === key ? status : tr;
  };

  const stationByMenuId = useMemo(() => {
    const m = new Map<string, "kitchen" | "bar">();
    for (const mi of menuItems) {
      if (mi.station === "kitchen" || mi.station === "bar") {
        m.set(String(mi._id), mi.station);
      }
    }
    return m;
  }, [menuItems]);

  const orderData = useQuery('pos.orders.getOrderWithItems', {
    licenseKey,
    orderId,
  });
  const voidItemMutation = useMutation('pos.orders.voidItem');
  const replaceOrderItemUnits = useMutation("pos.orders.replaceOrderItemUnits");
  const returnOrderItemUnits = useMutation("pos.orders.returnOrderItemUnits");

  const replaceOptions = useMemo(() => {
    const q = replaceQuery.trim().toLowerCase();
    return menuItems.filter((mi) => {
      if (replaceTarget && String(mi._id) === replaceTarget.menuItemId) {
        return false;
      }
      if (!isMenuItemShownForOrdering(mi, availabilityRules.honorKitchenStop)) {
        return false;
      }
      if (!q) return true;
      return mi.name.toLowerCase().includes(q);
    });
  }, [menuItems, replaceQuery, replaceTarget, availabilityRules.honorKitchenStop]);

  useEffect(() => {
    if (!sendsOpen) return;
    const closeIfOutside = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (sendsPanelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-sends-toggle]")) {
        return;
      }
      setSendsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSendsOpen(false);
    };
    document.addEventListener("pointerdown", closeIfOutside, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sendsOpen]);

  const renderOrderListShell = (
    header: ReactNode | null,
    list: ReactNode,
    dialogs?: ReactNode,
  ) => (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {header}
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-2">
          {list}
        </div>
      </div>
      {dialogs}
    </>
  );

  if (!orderData) {
    if (!extraScrollContent) return null;
    return renderOrderListShell(null, extraScrollContent);
  }

  const activeItems = orderData.items.filter(
    (i) => i.status !== "cancelled" && i.status !== "voided"
  );
  const voidedItems = orderData.items.filter(
    (i) => i.status === "voided" && !(i as { replaced?: boolean }).replaced,
  );
  if (activeItems.length === 0 && voidedItems.length === 0) {
    if (!extraScrollContent) return null;
    return renderOrderListShell(null, extraScrollContent);
  }

  const statusRank: Record<string, number> = {
    pending: 0,
    sent: 1,
    preparing: 2,
    ready: 3,
    served: 4,
  };

  type GroupedItem = {
    key: string;
    name: string;
    price: number;
    totalQuantity: number;
    menuItemId: string;
    station?: "kitchen" | "bar";
    notes?: string;
    displayStatus: string;
    allUnsent: boolean;
    itemIds: Id<"orderItems">[];
  };

  /**
   * Merge rows that are the same product for the ticket: name, unit price, notes, station.
   * (Avoids splitting "Ice Tea" across sends when menu_item_id differs or is missing.)
   */
  const mergeKey = (item: (typeof activeItems)[number]) => {
    const notes = (item.notes ?? "").trim().toLowerCase();
    const name = item.name.trim().toLowerCase();
    const price = Math.round(Number(item.price) * 100) / 100;
    const station = item.station ?? "";
    return `${name}|${price}|${notes}|${station}`;
  };

  const grouped: GroupedItem[] = [];
  for (const item of activeItems) {
    const key = mergeKey(item);
    const existing = grouped.find((g) => g.key === key);
    if (existing) {
      existing.totalQuantity += item.quantity;
      existing.itemIds.push(item._id);
      existing.allUnsent =
        existing.allUnsent && (item.status === "pending" || !item.status);
      const currentRank = statusRank[existing.displayStatus] ?? 0;
      const newRank = statusRank[item.status] ?? 0;
      if (newRank > currentRank) {
        existing.displayStatus = item.status;
      }
    } else {
      grouped.push({
        key,
        name: item.name,
        price: item.price,
        totalQuantity: item.quantity,
        menuItemId: item.menuItemId ? String(item.menuItemId) : "",
        station: item.station,
        notes: item.notes,
        displayStatus: item.status,
        allUnsent: item.status === "pending" || !item.status,
        itemIds: [item._id],
      });
    }
  }

  /**
   * Rebuild each "send" (round) the table made while staying open: rows written
   * within the same short window belong to the same trip to the kitchen/bar.
   */
  type SendLine = {
    key: string;
    name: string;
    price: number;
    quantity: number;
    notes?: string;
    voided: boolean;
  };
  type SendBatch = { timeMs: number; lastMs: number; lines: SendLine[] };
  const SEND_GAP_MS = 90_000;

  const timeOf = (item: { createdAt?: string }) =>
    item.createdAt ? Date.parse(item.createdAt) : Number.NaN;

  const sendSource = [...activeItems, ...voidedItems].sort((a, b) => {
    const at = timeOf(a);
    const bt = timeOf(b);
    if (!Number.isFinite(at)) return Number.isFinite(bt) ? -1 : 0;
    if (!Number.isFinite(bt)) return 1;
    return at - bt;
  });

  const sendBatches: SendBatch[] = [];
  for (const item of sendSource) {
    const ms = timeOf(item);
    let batch = sendBatches[sendBatches.length - 1];
    const fits =
      batch !== undefined &&
      (Number.isFinite(ms) && Number.isFinite(batch.lastMs)
        ? ms - batch.lastMs <= SEND_GAP_MS
        : !Number.isFinite(ms) && !Number.isFinite(batch.lastMs));
    if (!batch || !fits) {
      batch = { timeMs: ms, lastMs: ms, lines: [] };
      sendBatches.push(batch);
    }
    if (Number.isFinite(ms)) batch.lastMs = ms;
    const voided = item.status === "voided";
    const lineKey = `${mergeKey(item)}|${voided ? "v" : "a"}`;
    const line = batch.lines.find((l) => l.key === lineKey);
    if (line) {
      line.quantity += item.quantity;
    } else {
      batch.lines.push({
        key: lineKey,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes,
        voided,
      });
    }
  }

  const sendClock = (ms: number) =>
    Number.isFinite(ms)
      ? new Date(ms).toLocaleTimeString(language === "sq" ? "sq-AL" : "en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : t("order.send_time_unknown");

  const sendQuantity = (batch: SendBatch) =>
    batch.lines.reduce((sum, l) => (l.voided ? sum : sum + l.quantity), 0);
  const sendTotal = (batch: SendBatch) =>
    batch.lines.reduce(
      (sum, l) => (l.voided ? sum : sum + l.price * l.quantity),
      0
    );
  const toggleSend = (index: number) =>
    setOpenSendIndexes((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );

  const handleReturnConfirm = async () => {
    if (!returnTarget || returnBusy) return;
    const qty = Math.min(Math.max(1, returnQty), returnTarget.quantity);
    setReturnBusy(true);
    try {
      await returnOrderItemUnits({
        licenseKey,
        orderId,
        tableId,
        itemIds: returnTarget.itemIds.map((id) => String(id)),
        quantity: qty,
        staffId: staffId as Id<"staff">,
        staffName,
      });
      toast.success(t("order.item_returned_toast"));
      setReturnTarget(null);
      setReturnQty(1);
    } catch {
      toast.error(t("order.item_return_fail"));
    } finally {
      setReturnBusy(false);
    }
  };

  const handleVoid = async () => {
    if (!deleteTarget || deleteBusy || !deleteReason) return;
    if (deleteReason === "other" && !deleteOtherNote.trim()) return;
    const reasonLabel = t(`order.delete_reason_${deleteReason}`);
    setDeleteBusy(true);
    try {
      await voidItemMutation({
        licenseKey,
        orderId,
        tableId,
        itemIds: deleteTarget.itemIds.map((id) => String(id)),
        staffId: staffId as Id<"staff">,
        staffName,
        reasonCode: deleteReason,
        reasonLabel,
        reasonNote:
          deleteReason === "other" ? deleteOtherNote.trim() : undefined,
      });
      toast.success(t("order.item_removed_toast"));
      setDeleteTarget(null);
      setDeleteReason("");
      setDeleteOtherNote("");
    } catch {
      toast.error(t("order.item_remove_fail"));
    } finally {
      setDeleteBusy(false);
    }
  };

  const closeReplaceDialog = () => {
    if (replaceBusy) return;
    setReplaceTarget(null);
    setReplaceQuery("");
    setReplaceQty(1);
  };

  const handleReplaceWith = async (item: Doc<"menuItems">) => {
    if (!replaceTarget || replaceBusy) return;
    const qty = Math.min(
      Math.max(1, replaceQty),
      replaceTarget.quantity,
    );
    const blocked = getOrderBlockReason(item, qty, availabilityRules);
    if (blocked) {
      toast.error(
        blocked === "stock"
          ? t("order.blocked_stock", { name: item.name })
          : t("order.blocked_stopped", { name: item.name }),
      );
      return;
    }
    setReplaceBusy(true);
    try {
      await replaceOrderItemUnits({
        licenseKey,
        orderId,
        tableId,
        itemIds: replaceTarget.itemIds.map((id) => String(id)),
        quantity: qty,
        staffId: staffId as Id<"staff">,
        staffName,
        replacement: {
          menuItemId: item._id,
          quantity: qty,
          notes: replaceTarget.notes,
          name: item.name,
          price: item.price,
          station: item.station,
          vatRate: item.vatRate,
        },
      });
      toast.success(t("order.item_replaced_toast"));
      setReplaceTarget(null);
      setReplaceQuery("");
      setReplaceQty(1);
    } catch {
      toast.error(t("order.item_replace_fail"));
    } finally {
      setReplaceBusy(false);
    }
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-3 pt-2 pb-1 flex flex-col gap-2 min-w-0">
        <div className="flex flex-wrap justify-start items-center gap-1.5 w-full">
          {sendBatches.length > 0 && (
            <button
              type="button"
              data-sends-toggle=""
              onClick={() => setSendsOpen((open) => !open)}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-brand-sky/35 bg-brand-sky/10 px-2.5 text-[11px] font-semibold text-[#79adff] transition-colors hover:border-brand-sky/60 hover:bg-brand-sky/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky/40"
            >
              <Clock className="size-3.5" />
              {t("order.sends_button")}
              <span className="flex min-w-4 items-center justify-center rounded-full bg-brand-sky/20 px-1 text-[9px] font-bold">
                {sendBatches.length}
              </span>
            </button>
          )}
          {headerActions}
        </div>
        <p className="text-[10px] uppercase tracking-wider text-[#5a6580] font-medium">
          {t("order.sent_items")}
        </p>
      </div>

      {sendsOpen &&
        sendBatches.length > 0 &&
        panelHost &&
        createPortal(
        <>
          <button
            type="button"
            aria-label={t("btn.close")}
            onClick={() => setSendsOpen(false)}
            className="absolute inset-y-0 left-0 z-40 cursor-default bg-[#14213d]/20 backdrop-blur-[1px] right-80 lg:right-96"
          />
          <aside
            ref={sendsPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("order.sends_title")}
            className="pointer-events-auto absolute inset-y-0 z-50 flex w-[min(420px,38vw)] min-w-[280px] max-w-[520px] flex-col border-r border-[#dce4ef] bg-[#f5f7fb] shadow-[-20px_0_48px_rgba(15,23,42,0.12)] right-80 lg:right-96"
          >
          <div className="relative flex items-center gap-3 border-b border-[#e2e8f0] bg-white px-3 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#d6e5ff] bg-[#edf4ff] shadow-[0_4px_12px_rgba(37,99,235,0.08)]">
              <Clock className="size-4 text-brand" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold tracking-[-0.01em] text-[#172033]">
                {t("order.sends_title")}
              </span>
              <span className="mt-1 block text-[11px] text-[#718096]">
                {t("order.sends_hint")}
              </span>
            </span>
            <span className="flex min-w-7 items-center justify-center rounded-full border border-[#d6e5ff] bg-[#edf4ff] px-2 py-1 text-[11px] font-bold text-brand">
              {sendBatches.length}
            </span>
            <button
              type="button"
              onClick={() => setSendsOpen(false)}
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] transition-colors hover:border-[#cbd5e1] hover:bg-[#eef2f7] hover:text-[#172033]"
              aria-label={t("btn.close")}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto px-5 py-4">
              <div className="absolute bottom-10 left-[36px] top-8 w-px bg-gradient-to-b from-[#9ec5ff] via-[#dbe8f8] to-transparent" />
              {sendBatches.map((batch, index) => {
                const expanded = openSendIndexes.includes(index);
                return (
                  <div
                    key={`${batch.timeMs}-${index}`}
                    className={cn(
                      "relative ml-6 rounded-xl border transition-all",
                      index > 0 && "mt-2",
                      expanded
                        ? "border-[#b8d3fb] bg-white shadow-[0_10px_30px_rgba(37,99,235,0.10)]"
                        : "border-[#e0e7f0] bg-white shadow-[0_2px_8px_rgba(26,39,64,0.04)] hover:border-[#c8d5e5] hover:shadow-[0_5px_16px_rgba(26,39,64,0.07)]"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute -left-[25px] top-3.5 z-10 flex size-3 items-center justify-center rounded-full border-[3px] border-[#f5f7fb]",
                        expanded
                          ? "bg-brand shadow-[0_0_0_4px_rgba(37,99,235,0.11)]"
                          : "bg-[#a9b9ce]"
                      )}
                    />
                    <button
                      onClick={() => toggleSend(index)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-brand">
                            {t("order.send_number", { number: index + 1 })}
                          </span>
                          <span className="rounded-md border border-[#e5eaf1] bg-[#f5f7fa] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#596579]">
                            {sendClock(batch.timeMs)}
                          </span>
                        </span>
                        <span className="mt-1 block text-[11px] text-[#7a879a]">
                          {t("order.send_items", {
                            count: sendQuantity(batch),
                          })}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-[#172033]">
                        {formatPrice(sendTotal(batch))}
                      </span>
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#f0f3f7] text-[#718096]">
                        {expanded ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </span>
                    </button>

                    {expanded && (
                      <div className="mx-3 border-t border-[#e8edf3] pb-2 pt-1">
                        {batch.lines.map((line) => (
                          <div
                            key={line.key}
                            className="flex items-start gap-2 border-b border-[#edf1f5] py-2.5 last:border-0"
                          >
                            <span
                              className={cn(
                                "flex min-w-7 shrink-0 items-center justify-center rounded-md px-1 py-0.5 text-[10px] font-bold tabular-nums",
                                line.voided
                                  ? "bg-red-50 text-red-500/70"
                                  : "bg-[#edf4ff] text-brand"
                              )}
                            >
                              {line.quantity}×
                            </span>
                            <span className="flex-1 min-w-0">
                              <span
                                className={cn(
                                  "block truncate text-[11px] font-medium",
                                  line.voided
                                    ? "text-red-500/65 line-through"
                                    : "text-[#253044]"
                                )}
                              >
                                {line.name}
                              </span>
                              {line.notes && (
                                <span className="mt-1 block rounded-md bg-[#fff8e8] px-1.5 py-1 text-[9px] leading-3.5 text-[#a16207] italic">
                                  {line.notes}
                                </span>
                              )}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 text-[10px] font-semibold tabular-nums",
                                line.voided
                                  ? "text-red-500/60"
                                  : "text-[#657186]"
                              )}
                            >
                              {formatPrice(line.price * line.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </aside>
        </>,
        panelHost,
      )}

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-2">
      {grouped.map((group) => {
        const stationForIcon =
          group.station ??
          (group.menuItemId
            ? stationByMenuId.get(group.menuItemId)
            : undefined);
        const statusColor =
          {
            pending: "text-amber-400",
            sent: "text-brand",
            preparing: "text-purple-400",
            ready: "text-emerald-400",
            served: "text-[#5a6580]",
          }[group.displayStatus] ?? "text-[#5a6580]";
        return (
        <div
          key={group.key}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0A0F1E] border border-[#1e2a45]"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] leading-4 text-white truncate">{group.name}</p>
              {stationForIcon && (
                <span
                  className={cn(
                    "shrink-0",
                    stationForIcon === "kitchen"
                      ? "text-orange-400"
                      : "text-purple-400"
                  )}
                >
                  {stationForIcon === "kitchen" ? (
                    <ChefHat className="size-2.5" />
                  ) : (
                    <Wine className="size-2.5" />
                  )}
                </span>
              )}
              <span className={cn("text-[9px] uppercase font-medium", statusColor)}>
                {orderLineStatusLabel(group.displayStatus)}
              </span>
            </div>
            <p className="text-[10px] leading-3.5 text-[#5a6580]">
              {formatPrice(group.price)} x {group.totalQuantity}
            </p>
            {group.notes && (
              <p className="text-[9px] text-amber-400 mt-0.5 italic truncate">
                {group.notes}
              </p>
            )}
          </div>

          {(allowReplaceSent || allowRefund || group.allUnsent) && (
            <div className="flex items-center shrink-0">
              {!group.allUnsent && (allowReplaceSent || allowRefund) && (
                <button
                  type="button"
                  onClick={() => {
                    setReturnQty(1);
                    setReturnTarget({
                      itemIds: group.itemIds,
                      name: group.name,
                      quantity: group.totalQuantity,
                    });
                  }}
                  className="p-1 rounded hover:bg-emerald-500/10 text-[#5a6580] hover:text-emerald-400 cursor-pointer"
                  title={t("order.return_item")}
                >
                  <Undo2 className="size-3" />
                </button>
              )}
              {(allowReplaceSent || group.allUnsent) && (
                <button
                  type="button"
                  onClick={() => {
                    setReplaceQty(1);
                    setReplaceTarget({
                      itemIds: group.itemIds,
                      name: group.name,
                      quantity: group.totalQuantity,
                      notes: group.notes,
                      menuItemId: group.menuItemId,
                      mode: group.allUnsent ? "swap" : "return",
                    });
                  }}
                  className="p-1 rounded hover:bg-brand/10 text-[#5a6580] hover:text-brand-sky cursor-pointer"
                  title={t("order.replace_item")}
                >
                  <ArrowLeftRight className="size-3" />
                </button>
              )}
              {allowRefund && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteReason("");
                    setDeleteOtherNote("");
                    setDeleteTarget({
                      itemIds: group.itemIds,
                      name: group.name,
                    });
                  }}
                  className="p-1 rounded hover:bg-red-500/10 text-[#5a6580] hover:text-red-400 cursor-pointer"
                  title={t("order.delete_item")}
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          )}
        </div>
        );
      })}
      {extraScrollContent}
      </div>
      </div>

      <ReplaceProductDialog
        open={replaceTarget !== null}
        onClose={closeReplaceDialog}
        sourceName={replaceTarget?.name ?? ""}
        maxQty={replaceTarget?.quantity ?? 1}
        qty={replaceQty}
        onQtyChange={setReplaceQty}
        query={replaceQuery}
        onQueryChange={setReplaceQuery}
        options={replaceOptions}
        busy={replaceBusy}
        mode={replaceTarget?.mode ?? "return"}
        onPick={(item) => void handleReplaceWith(item)}
        formatPrice={formatPrice}
        availabilityRules={availabilityRules}
        t={t}
      />

      <Dialog
        open={returnTarget !== null}
        onOpenChange={(open) => {
          if (!open && !returnBusy) {
            setReturnTarget(null);
            setReturnQty(1);
          }
        }}
      >
        <DialogContent className="bg-[#131A2E] border-[#1e2a45] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              {t("order.return_item")}
            </DialogTitle>
            <DialogDescription className="text-[#8b93a7]">
              {returnTarget
                ? t("order.return_item_desc", { name: returnTarget.name })
                : t("order.return_item_hint")}
            </DialogDescription>
          </DialogHeader>
          {returnTarget && returnTarget.quantity > 1 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[#1e2a45] bg-[#0A0F1E] px-3 py-2">
              <span className="text-xs text-[#8b93a7]">
                {t("order.return_qty_label")}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={returnBusy || returnQty <= 1}
                  onClick={() => setReturnQty((n) => Math.max(1, n - 1))}
                  className="flex size-7 items-center justify-center rounded-md text-[#8b93a7] hover:bg-[#1e2a45] disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="min-w-10 text-center text-sm font-semibold tabular-nums text-white">
                  {returnQty}/{returnTarget.quantity}
                </span>
                <button
                  type="button"
                  disabled={returnBusy || returnQty >= returnTarget.quantity}
                  onClick={() =>
                    setReturnQty((n) =>
                      Math.min(returnTarget.quantity, n + 1),
                    )
                  }
                  className="flex size-7 items-center justify-center rounded-md text-[#8b93a7] hover:bg-[#1e2a45] disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={returnBusy}
              onClick={() => {
                setReturnTarget(null);
                setReturnQty(1);
              }}
              className="text-[#8b93a7]"
            >
              {t("btn.cancel")}
            </Button>
            <Button
              disabled={returnBusy}
              onClick={() => void handleReturnConfirm()}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {t("order.return_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) {
            setDeleteTarget(null);
            setDeleteReason("");
            setDeleteOtherNote("");
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-[440px] gap-0 overflow-hidden rounded-2xl border border-[#e4ebf3] bg-[#f7f9fc] p-0 text-[#172033] shadow-[0_28px_80px_rgba(23,32,51,0.22)]"
        >
          <div className="relative border-b border-[#e8eef5] bg-white px-5 pb-4 pt-5">
            <div className="flex items-start gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#f3d5d5] bg-[#fff1f1] shadow-[0_4px_12px_rgba(190,24,93,0.08)]">
                <Trash2 className="size-5 text-[#be185d]" />
              </span>
              <div className="min-w-0 flex-1 pr-8">
                <DialogHeader className="gap-1.5 space-y-0">
                  <DialogTitle className="text-[17px] font-bold tracking-[-0.02em] text-[#172033]">
                    {t("order.delete_item")}
                  </DialogTitle>
                  <DialogDescription className="text-[12px] leading-5 text-[#6b778c]">
                    {deleteTarget
                      ? t("order.delete_reason_desc", {
                          name: deleteTarget.name,
                        })
                      : t("order.delete_reason_hint")}
                  </DialogDescription>
                </DialogHeader>
                {deleteTarget && (
                  <span className="mt-2 inline-flex max-w-full truncate rounded-full border border-[#e8eef5] bg-[#f4f7fb] px-2.5 py-0.5 text-[11px] font-semibold text-[#3d4a61]">
                    {deleteTarget.name}
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteReason("");
                  setDeleteOtherNote("");
                }}
                className="absolute right-4 top-4 flex size-8 cursor-pointer items-center justify-center rounded-lg border border-[#e8eef5] bg-[#f8fafc] text-[#7b8798] transition-colors hover:border-[#d5dee8] hover:bg-[#eef2f7] hover:text-[#172033] disabled:opacity-40"
                aria-label={t("btn.cancel")}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="px-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {DELETE_REASON_CODES.map((code) => {
                const Icon = DELETE_REASON_ICONS[code];
                const selected = deleteReason === code;
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => setDeleteReason(code)}
                    className={cn(
                      "relative flex min-h-[4.5rem] flex-col items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer disabled:opacity-50",
                      selected
                        ? "border-[#f0b6c4] bg-white shadow-[0_8px_22px_rgba(190,24,93,0.10)]"
                        : "border-[#e4ebf3] bg-white shadow-[0_1px_3px_rgba(23,32,51,0.04)] hover:border-[#d3dce8] hover:shadow-[0_6px_16px_rgba(23,32,51,0.06)]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-lg",
                        selected
                          ? "bg-[#fff1f4] text-[#be185d]"
                          : "bg-[#f4f7fb] text-[#64748b]",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="pr-4 text-[12px] font-semibold leading-4 text-[#1c2738]">
                      {t(`order.delete_reason_${code}`)}
                    </span>
                    {selected && (
                      <span className="absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-full bg-[#be185d] text-white">
                        <Check className="size-2.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {deleteReason === "other" && (
              <Input
                value={deleteOtherNote}
                onChange={(e) => setDeleteOtherNote(e.target.value)}
                placeholder={t("order.delete_reason_other_ph")}
                className="mt-3 h-10 rounded-xl border-[#e4ebf3] bg-white text-[#172033] shadow-none placeholder:text-[#93a0b3] focus-visible:border-[#f0b6c4] focus-visible:ring-[#be185d]/20"
                disabled={deleteBusy}
                autoFocus
              />
            )}
            <p className="mt-3 text-[11px] leading-4 text-[#8a96a8]">
              {t("order.delete_stock_note")}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#e8eef5] bg-white px-4 py-3">
            <Button
              variant="ghost"
              disabled={deleteBusy}
              onClick={() => {
                setDeleteTarget(null);
                setDeleteReason("");
                setDeleteOtherNote("");
              }}
              className="h-9 rounded-lg px-3 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
            >
              {t("btn.cancel")}
            </Button>
            <Button
              disabled={
                deleteBusy ||
                !deleteReason ||
                (deleteReason === "other" && !deleteOtherNote.trim())
              }
              onClick={() => void handleVoid()}
              className="h-9 rounded-lg bg-[#be185d] px-4 text-white shadow-[0_6px_16px_rgba(190,24,93,0.28)] hover:bg-[#9d174d] disabled:bg-[#e7b7c6] disabled:text-white disabled:shadow-none"
            >
              <Trash2 className="mr-1.5 size-3.5" />
              {t("order.delete_confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
