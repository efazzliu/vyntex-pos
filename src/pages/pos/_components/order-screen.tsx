import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
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
  UtensilsCrossed,
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
import { resolveMenuItemImageUrl } from "@/lib/menu-item-photo-urls.ts";
import MenuItemCustomizationPicker from "@/components/menu-item-customization-picker.tsx";
import {
  cartLineKey,
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
import { hasSplitBills } from "../_lib/plan-features.ts";
import SplitBillItemPicker from "./split-bill-item-picker.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
import {
  parsePosPaymentSettings,
  posTerminalCanProcessPayment,
  roleCanRefund,
} from "@/lib/pos-payment-handling.ts";
import {
  getOrderBlockReason,
  isMenuItemShownForOrdering,
  parseOrderBlockError,
  resolveEnforceOrderAvailability,
  type OrderBlockReason,
} from "@/lib/pos-order-availability.ts";

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
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      map.set(String(cat._id), cat.name);
    }
    return map;
  }, [categories]);
  const activeOrders = activeOrdersRaw ?? [];
  const tablesList = tablesRaw ?? [];
  const printersList = Array.isArray(printersQuery) ? printersQuery : [];

  /** OS printer name for Electron silent print: Address field if set, else Name (must match Windows list). */
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

  const receiptPrinterDeviceName = useMemo(() => {
    const p = printersList.find((x) => x.isActive && x.role === "receipt");
    if (!p) return undefined;
    const a = (p.address ?? "").trim();
    const n = (p.name ?? "").trim();
    return (a || n) || undefined;
  }, [printersList]);

  const submitCartOrder = useMutation("pos.orders.submitCartOrder");
  const payOrder = useMutation("pos.orders.payOrder");
  const printBill = useMutation("pos.orders.printBill");
  const transferOrders = useMutation("pos.orders.transferOrdersToTable");
  const mergeOrders = useMutation("pos.orders.mergeTableOrders");

  const [activeCategory, setActiveCategory] =
    useState<Id<"menuCategories"> | "favorites" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bouncedWrongOwnerRef = useRef(false);
  /** Prevents double-send while the Supabase mutation is in flight (cart is cleared optimistically when online). */
  const sendOrderInFlightRef = useRef(false);

  // Payment flow state
  const [payStep, setPayStep] = useState<
    "type" | "customer" | "admin-pin" | "split-amount" | "split-items"
  >("type");
  const [pendingPayAmount, setPendingPayAmount] = useState<number | null>(null);
  /** Supabase `sale_items.id` for the lines covered by the next payment (split-by-items). */
  const [pendingSettledSaleItemIds, setPendingSettledSaleItemIds] = useState<
    string[] | null
  >(null);
  const [splitAmountInput, setSplitAmountInput] = useState("");
  /** Tendered cash (numpad) — change helper only; does not affect payment API. */
  const [cashReceivedInput, setCashReceivedInput] = useState("");

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

  const isLoading =
    !categoriesHydrated ||
    !menuItemsHydrated ||
    !activeOrdersHydrated ||
    !tablesHydrated;

  const currentTable = tablesList.find((t) => t._id === tableId);
  const existingOrder = activeOrders[0];
  const paymentSettings = parsePosPaymentSettings(
    (companyQuery as { paymentSettings?: unknown } | undefined)?.paymentSettings,
  );
  const canProcessPayment = posTerminalCanProcessPayment(staffRole, paymentSettings);
  const enforceAvailability = resolveEnforceOrderAvailability(
    (companyQuery as { enforceOrderAvailability?: unknown } | undefined)
      ?.enforceOrderAvailability,
    licenseKey,
  );

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
  const showChangeHint =
    payDialogOpen &&
    payStep === "type" &&
    cashReceivedInput.trim() !== "" &&
    tenderedCash + 0.0001 >= payDueNow;
  const changeAmount = showChangeHint
    ? Math.round((tenderedCash - payDueNow) * 100) / 100
    : 0;

  const payDrawerHeading = useMemo(() => {
    switch (payStep) {
      case "type":
        return t("order.pay_drawer_title");
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

  const openTableMoveDialog = (mode: "transfer" | "merge") => {
    if (cart.length > 0) {
      toast.error(t("order.cart_blocks_table_move"));
      return;
    }
    setTableMoveMode(mode);
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
      enforceAvailability,
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
        const blocked = getOrderBlockReason(item, nextQty, enforceAvailability);
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
    if (sendOrderInFlightRef.current) return;
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
    setPendingSettledSaleItemIds(null);
    setSplitAmountInput("");
    setCashReceivedInput("");
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
    setPendingSettledSaleItemIds(null);
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
    setPendingSettledSaleItemIds(null);
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
    setPendingSettledSaleItemIds(null);
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
      "inline-flex items-center justify-center gap-1 h-8 px-2 rounded-md text-[11px] font-medium border transition-colors shrink-0 cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]/40";
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
  const handleSelectPaymentType = (type: PaymentType) => {
    if (type === "debt") {
      setPayStep("customer");
    } else if (type === "complimentary") {
      // Complimentary requires admin/manager PIN approval
      setPayStep("admin-pin");
    } else if (type === "no_receipt") {
      handleFinalPay(type, "cash");
    } else {
      // fiscal / non_fiscal: POS uses cash only (no card step)
      handleFinalPay(type, "cash");
    }
  };

  // Process the final payment
  const handleFinalPay = async (
    type: PaymentType,
    method: PaymentMethod,
    custId?: Id<"customers">,
    custName?: string
  ) => {
    if (!existingOrder) return;
    setIsSubmitting(true);
    try {
      const paidOrderId = existingOrder._id;
      const balanceBefore = orderBalanceDue;
      const payingPartial =
        pendingPayAmount != null &&
        pendingPayAmount > 0 &&
        pendingPayAmount < balanceBefore - 0.009;

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
        pendingPayAmount != null &&
        pendingPayAmount > 0 &&
        pendingPayAmount <= balanceBefore + 0.009
      ) {
        payPayload.amount = Math.min(pendingPayAmount, balanceBefore);
      }
      if (
        Array.isArray(pendingSettledSaleItemIds) &&
        pendingSettledSaleItemIds.length > 0
      ) {
        payPayload.settledSaleItemIds = pendingSettledSaleItemIds;
      }

      await payOrder(payPayload);

      if (payingPartial) {
        setPayDialogOpen(false);
        setPendingPayAmount(null);
        setPendingSettledSaleItemIds(null);
        setSplitAmountInput("");
        setCashReceivedInput("");
        setPayStep("type");
        return;
      }

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

      setPayDialogOpen(false);
      setPendingPayAmount(null);
      setPendingSettledSaleItemIds(null);
      setCashReceivedInput("");
      onBack();

      // Receipt print runs in the background so payment UI does not wait on the printer
      // (Electron silent print / OS dialogs). Failed silent jobs are queued and retry when
      // the printer is available (`startPrintQueueRunner` in pos-app).
      if ((type === "fiscal" || type === "non_fiscal") && isOnline) {
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
                : await printNonFiscalReceiptForPay({
                    licenseKey,
                    orderId: paidOrderId,
                    formatPrice,
                    strings: receiptPrintStrings,
                    deviceName: receiptPrinterDeviceName,
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
                  electronApp ? t("order.fiscal_print_failed") : t("order.print_popup_blocked"),
                );
              }
            }
          } catch (receiptPrintErr) {
            console.error("Receipt print:", receiptPrintErr);
            toast.error(t("order.fiscal_print_failed"));
          }
        })();
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
    <div className="h-full flex flex-col">
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
              <span className="ml-2 text-[#0066FF]">
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

      <div className="flex-1 flex overflow-hidden">
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
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-[#131A2E] border border-[#1e2a45] text-white text-sm placeholder:text-[#5a6580] focus:outline-none focus:border-[#0066FF] transition-colors"
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
          <div className="flex-1 overflow-auto p-4">
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
                    enforceAvailability,
                  );
                  const photoUrl = resolveMenuItemImageUrl(
                    item,
                    categoryNameById.get(String(item.categoryId)) ?? "",
                  );
                  return (
                    <button
                      key={item._id}
                      onClick={() => addToCart(item)}
                      className={cn(
                        "relative text-left rounded-xl border p-4 transition-all cursor-pointer",
                        visualBlock
                          ? "border-[#1e2a45] bg-[#0c101c] opacity-60 hover:opacity-80"
                          : cartItem
                          ? "border-[#0066FF]/50 bg-[#0066FF]/10"
                          : "border-[#1e2a45] bg-[#131A2E] hover:border-[#2a3a5a]"
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
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt=""
                          className="mb-2 h-16 w-full rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="mb-2 flex h-16 w-full items-center justify-center rounded-lg bg-[#0c101c] text-lg font-semibold text-[#5a6580]">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <p className="text-sm font-semibold text-white truncate mt-1">
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="text-[11px] text-[#5a6580] mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <p className="text-sm font-bold text-[#0066FF] mt-2">
                        {formatPrice(item.price)}
                      </p>
                      {visualBlock ? (
                        <p className="text-[10px] font-semibold text-amber-400 mt-1">
                          {visualBlock === "stock"
                            ? t("order.out_of_stock")
                            : t("order.stopped_badge")}
                        </p>
                      ) : null}
                      {cartItem && !visualBlock && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#0066FF] flex items-center justify-center text-white text-xs font-bold">
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
          <div className="w-[min(420px,38vw)] min-w-[280px] max-w-[520px] shrink-0 border-l border-r border-[#1e2a45] bg-[#0D1326] flex flex-col min-h-0 z-10">
            <div className="flex flex-1 flex-col min-h-0 overflow-hidden bg-[#0D1326] border-l border-[#E8A838]/40">
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[#1e2a45] shrink-0 bg-[#0A0F1E]">
                <h2 className="text-sm font-semibold text-white truncate pr-2">
                  {payDrawerHeading}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    if (!isSubmitting) closePayDrawer();
                  }}
                  disabled={isSubmitting}
                  className="p-2 rounded-lg text-[#8b93a7] hover:bg-[#1e2a45] hover:text-white cursor-pointer disabled:opacity-40 shrink-0"
                  aria-label={t("btn.close")}
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {payStep === "type" && (
                  <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-4">
                    <div className="shrink-0 space-y-2">
                      <PaymentTypeStep
                        amountLabel={payDueNow}
                        onSelect={handleSelectPaymentType}
                        isSubmitting={isSubmitting}
                        cashLikeOnly={
                          pendingPayAmount != null &&
                          pendingPayAmount < orderBalanceDue - 0.009
                        }
                        excludeTypes={paymentTypesHiddenFromDrawer}
                      />
                      {splitBillsEnabled && pendingPayAmount == null ? (
                        <div className="pt-2 border-t border-[#1e2a45]">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full border-[#2a3a5a] text-[#8b93a7] hover:text-white"
                            onClick={() => {
                              if (orderPaidSoFar < 0.009) {
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
                                setPayStep("split-amount");
                              }
                            }}
                          >
                            {t("order.split_bill")}
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0 rounded-xl border border-[#1e2a45] bg-[#0A0F1E] p-3 space-y-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-[#5a6580]">
                        {t("order.cash_received")}
                      </p>
                      <div className="text-center font-mono text-lg text-white py-2 rounded-lg bg-[#131A2E] border border-[#1e2a45] min-h-[2.75rem] flex items-center justify-center">
                        {cashReceivedInput.trim() === "" ? "—" : cashReceivedInput}
                      </div>
                      {showChangeHint ? (
                        <p className="text-center text-sm font-semibold text-emerald-400">
                          {t("order.change_due")}: {formatPrice(changeAmount)}
                        </p>
                      ) : null}
                      <CurrencyNumpad
                        value={cashReceivedInput}
                        onChange={setCashReceivedInput}
                        maxDecimals={currency.decimals}
                        clearLabel={t("order.numpad_clear")}
                      />
                    </div>
                  </div>
                )}
                {payStep === "split-items" && existingOrder && (
                  <SplitBillItemPicker
                    licenseKey={licenseKey}
                    orderId={existingOrder._id}
                    orderBalanceDue={orderBalanceDue}
                    showManualAmountLink={orderPaidSoFar < 0.009}
                    onManualAmount={() => {
                      setPendingSettledSaleItemIds(null);
                      setSplitAmountInput(
                        orderBalanceDue > 0
                          ? String(
                              Math.round(orderBalanceDue * 100) / 100,
                            )
                          : "",
                      );
                      setPayStep("split-amount");
                    }}
                    onBack={() => setPayStep("type")}
                    onContinue={(amount, settledSaleItemIds) => {
                      setPendingPayAmount(amount);
                      setPendingSettledSaleItemIds(
                        settledSaleItemIds.length > 0
                          ? settledSaleItemIds
                          : null,
                      );
                      setPayStep("type");
                    }}
                  />
                )}
                {payStep === "split-amount" && existingOrder && (
                  <div className="flex-1 min-h-0 flex flex-col px-3 py-2 gap-3 overflow-y-auto">
                    <div className="text-xs text-[#8b93a7]">
                      {t("order.balance_due")}:{" "}
                      <span className="text-white font-bold">
                        {formatPrice(orderBalanceDue)}
                      </span>
                    </div>
                    <label className="text-xs text-[#8b93a7]">
                      {t("order.split_enter_amount")}
                    </label>
                    <div className="text-center font-mono text-lg text-white py-2 rounded-lg bg-[#131A2E] border border-[#1e2a45]">
                      {splitAmountInput.trim() === "" ? "—" : splitAmountInput}
                    </div>
                    <p className="text-[11px] text-[#5a6580]">
                      {t("order.split_restrict_hint")}
                    </p>
                    <div className="shrink-0 rounded-xl border border-[#1e2a45] bg-[#0A0F1E] p-3">
                      <CurrencyNumpad
                        value={splitAmountInput}
                        onChange={setSplitAmountInput}
                        maxDecimals={currency.decimals}
                        clearLabel={t("order.numpad_clear")}
                      />
                    </div>
                    <div className="flex gap-2 pt-2 shrink-0 border-t border-[#1e2a45]">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-[#8b93a7] flex-1"
                        onClick={() => {
                          setPayStep("type");
                          setSplitAmountInput("");
                          setPendingSettledSaleItemIds(null);
                        }}
                      >
                        {t("btn.back")}
                      </Button>
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={() => {
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
                          setPendingPayAmount(Math.round(n * 100) / 100);
                          setPendingSettledSaleItemIds(null);
                          setPayStep("type");
                        }}
                      >
                        {t("order.split_continue")}
                      </Button>
                    </div>
                  </div>
                )}
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

        {/* Right: Order panel (always visible; payment column sits to its left when open) */}
        <div className="w-80 lg:w-96 shrink-0 border-l border-[#1e2a45] bg-[#0D1326] flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-[#1e2a45]">
            <h2 className="text-sm font-semibold text-white">{t("order.current_order")}</h2>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-1">
            {/* Existing order items (already sent) */}
            {existingOrder && (
              <ExistingOrderItems
                licenseKey={licenseKey}
                orderId={existingOrder._id}
                tableId={tableId}
                staffId={staffId}
                staffName={staffName}
                staffRole={staffRole}
                allowRefund={roleCanRefund(staffRole, paymentSettings)}
                menuItems={menuItems}
                headerActions={sentItemsHeaderActions}
              />
            )}

            {/* New cart items (not yet sent) */}
            {cart.length > 0 && (
              <>
                {existingOrder && (
                  <div className="py-2">
                    <p className="text-[10px] uppercase tracking-wider text-[#0066FF] font-medium">
                      {t("order.new_items")}
                    </p>
                  </div>
                )}
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
                        <p className="text-sm text-white truncate">
                          {item.name}
                        </p>
                        {item.station && (
                          <span
                            className={cn(
                              "shrink-0",
                              item.station === "kitchen"
                                ? "text-orange-400"
                                : "text-purple-400"
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
                      <p className="text-xs text-[#5a6580]">
                        {formatPrice(item.price)}
                      </p>
                      {customLabel ? (
                        <p className="text-[10px] text-sky-300 mt-0.5">
                          {customLabel}
                        </p>
                      ) : null}
                      {item.notes && (
                        <p className="text-[10px] text-amber-400 mt-0.5 italic">
                          {item.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openNoteDialog(item)}
                        className={cn(
                          "p-1 rounded transition-colors cursor-pointer",
                          item.notes
                            ? "text-amber-400 hover:bg-amber-500/10"
                            : "text-[#5a6580] hover:bg-[#1e2a45] hover:text-[#8b93a7]"
                        )}
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        onClick={() => updateCartQty(lineKey, -1)}
                        className="p-1 rounded hover:bg-[#1e2a45] text-[#8b93a7] cursor-pointer"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="text-sm text-white w-6 text-center font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQty(lineKey, 1)}
                        className="p-1 rounded hover:bg-[#1e2a45] text-[#8b93a7] cursor-pointer"
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <button
                        onClick={() => removeFromCart(lineKey)}
                        className="p-1 rounded hover:bg-red-500/10 text-[#5a6580] hover:text-red-400 ml-1 cursor-pointer"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
                })}
              </>
            )}

            {/* Empty state */}
            {!existingOrder && cart.length === 0 && (
              <div className="flex items-center justify-center h-40 text-[#5a6580] text-sm">
                {t("common.no_items")}
              </div>
            )}
          </div>

          {/* Totals + actions */}
          <div className="border-t border-[#1e2a45] p-4 space-y-3">
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
                <div className="col-span-2 space-y-1">
                  <Button
                    className="w-full"
                    onClick={handleSendOrder}
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
                  <p className="text-[10px] text-[#5a6580] leading-snug px-0.5">
                    {t("order.print_ticket_hint")}
                  </p>
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
          <p className="text-[10px] uppercase tracking-wider text-[#5a6580]">
            {tableMoveMode === "transfer"
              ? t("order.transfer_targets")
              : t("order.merge_targets")}
          </p>
          <div className="overflow-y-auto flex-1 min-h-0 max-h-[50vh] space-y-1 pr-1">
            {(tableMoveMode === "transfer"
              ? transferTargetTables
              : mergeTargetTables
            ).map((tbl) => {
              const sum = tableSummaries[tbl._id];
              return (
                <button
                  key={tbl._id}
                  type="button"
                  disabled={tableMoveBusy}
                  onClick={() => void handleConfirmTableMove(tbl._id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-[#1e2a45] bg-[#0A0F1E] hover:border-[#0066FF]/50 hover:bg-[#131A2E] text-white text-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <span className="font-medium">{tbl.name}</span>
                  <span className="text-[#5a6580] text-xs ml-2">· {tbl.zone}</span>
                  {sum ? (
                    <span className="block text-xs text-[#8b93a7] mt-0.5">
                      {formatPrice(sum.total)}
                    </span>
                  ) : null}
                </button>
              );
            })}
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
              accentClassName="border-[#0066FF] bg-[#0066FF]/10 text-[#7eb6ff]"
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

function CurrencyNumpad({
  value,
  onChange,
  maxDecimals,
  clearLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  maxDecimals: number;
  clearLabel: string;
}) {
  const press = (key: string) =>
    onChange(appendMoneyKey(value, key, maxDecimals));
  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ] as const;
  const keyBtn =
    "h-11 rounded-lg bg-[#1a1f2e] border border-[#2a3a5a] text-white font-semibold text-lg hover:bg-[#243045] active:scale-[0.98] cursor-pointer transition-colors";
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.join("")} className="grid grid-cols-3 gap-2">
          {r.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => press(d)}
              className={keyBtn}
            >
              {d}
            </button>
          ))}
        </div>
      ))}
      <div className="grid grid-cols-3 gap-2">
        {maxDecimals > 0 ? (
          <button type="button" onClick={() => press(".")} className={keyBtn}>
            .
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => press("0")} className={keyBtn}>
          0
        </button>
        <button type="button" onClick={() => press("bksp")} className={keyBtn}>
          ⌫
        </button>
      </div>
      <button
        type="button"
        onClick={() => press("clear")}
        className="w-full h-9 rounded-lg border border-[#2a3a5a] bg-[#131A2E] text-xs font-semibold text-[#8b93a7] hover:text-white hover:bg-[#1a1f2e] cursor-pointer"
      >
        {clearLabel}
      </button>
    </div>
  );
}

function PaymentTypeStep({
  amountLabel,
  onSelect,
  isSubmitting,
  cashLikeOnly = false,
  excludeTypes = [],
}: {
  amountLabel: number;
  onSelect: (type: PaymentType) => void;
  isSubmitting: boolean;
  /** Split bill: only methods allowed before the order is fully paid. */
  cashLikeOnly?: boolean;
  /** Shown as quick actions beside sent items when staff has those permissions. */
  excludeTypes?: PaymentType[];
}) {
  const { t, formatPrice } = usePosLocale();
  const allOptions: {
    type: PaymentType;
    labelKey: string;
    sublabelKey: string;
    icon: typeof FileText;
    color: string;
    bgColor: string;
  }[] = [
    {
      type: "fiscal",
      labelKey: "order.pay_type_fiscal_label",
      sublabelKey: "order.pay_type_fiscal_desc",
      icon: FileText,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60",
    },
    {
      type: "non_fiscal",
      labelKey: "order.pay_type_non_fiscal_label",
      sublabelKey: "order.pay_type_non_fiscal_desc",
      icon: Receipt,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/60",
    },
    {
      type: "no_receipt",
      labelKey: "order.pay_type_no_receipt_label",
      sublabelKey: "order.pay_type_no_receipt_desc",
      icon: FileX,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60",
    },
    {
      type: "debt",
      labelKey: "order.pay_type_debt_label",
      sublabelKey: "order.pay_type_debt_desc",
      icon: HandCoins,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10 border-orange-500/30 hover:border-orange-500/60",
    },
    {
      type: "complimentary",
      labelKey: "order.pay_type_complimentary_label",
      sublabelKey: "order.pay_type_complimentary_desc",
      icon: Gift,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10 border-purple-500/30 hover:border-purple-500/60",
    },
  ];

  const excluded = new Set(excludeTypes);
  let options = allOptions.filter((o) => !excluded.has(o.type));
  if (cashLikeOnly) {
    options = options.filter((o) => o.type === "no_receipt" || o.type === "non_fiscal");
  }

  return (
    <>
      <div className="space-y-1.5 pb-1">
        {cashLikeOnly ? (
          <span className="block text-[11px] text-amber-400/90">
            {t("order.split_restrict_hint")}
          </span>
        ) : null}
        <p className="text-xs text-[#8b93a7]">
          {t("order.due_now")}:{" "}
          <span className="text-white font-bold">
            {formatPrice(amountLabel)}
          </span>
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 pt-1">
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.type}
              onClick={() => onSelect(opt.type)}
              disabled={isSubmitting}
              className={cn(
                "flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all cursor-pointer text-left",
                opt.bgColor,
                isSubmitting && "opacity-50 cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  opt.color
                )}
              >
                <Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">
                  {t(opt.labelKey)}
                </p>
                <p className="text-[11px] text-[#8b93a7]">
                  {t(opt.sublabelKey)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </>
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

// ── Existing order items sub-component (with auto-grouping) ──

function ExistingOrderItems({
  licenseKey,
  orderId,
  tableId,
  staffId,
  staffName,
  staffRole,
  allowRefund = false,
  menuItems,
  headerActions,
}: {
  licenseKey: string;
  orderId: Id<"orders">;
  tableId: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  allowRefund?: boolean;
  menuItems: Doc<"menuItems">[];
  headerActions?: ReactNode | null;
}) {
  const { formatPrice, t } = usePosLocale();

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

  if (!orderData) return null;

  const activeItems = orderData.items.filter(
    (i) => i.status !== "cancelled" && i.status !== "voided"
  );
  const voidedItems = orderData.items.filter((i) => i.status === "voided");
  if (activeItems.length === 0 && voidedItems.length === 0) return null;

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
        itemIds: [item._id],
      });
    }
  }

  type GroupedVoided = {
    key: string;
    name: string;
    price: number;
    totalQuantity: number;
  };
  const groupedVoided: GroupedVoided[] = [];
  for (const item of voidedItems) {
    const key = mergeKey(item);
    const existing = groupedVoided.find((g) => g.key === key);
    if (existing) {
      existing.totalQuantity += item.quantity;
    } else {
      groupedVoided.push({
        key,
        name: item.name,
        price: item.price,
        totalQuantity: item.quantity,
      });
    }
  }

  const handleVoid = async (itemIds: Id<"orderItems">[]) => {
    if (itemIds.length === 0) return;
    try {
      await voidItemMutation({
        licenseKey,
        orderId,
        tableId,
        itemIds: itemIds.map((id) => String(id)),
        staffId: staffId as Id<"staff">,
      });
      toast.success(t("order.item_removed_toast"));
    } catch {
      toast.error(t("order.item_remove_fail"));
    }
  };

  const statusColors: Record<string, string> = {
    pending: "text-amber-400",
    sent: "text-[#0066FF]",
    preparing: "text-purple-400",
    ready: "text-emerald-400",
    served: "text-[#5a6580]",
  };

  return (
    <>
      {headerActions ? (
        <div className="py-1 flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap justify-center items-center gap-1.5 w-full">
            {headerActions}
          </div>
          <p className="text-[10px] uppercase tracking-wider text-[#5a6580] font-medium">
            {t("order.sent_items")}
          </p>
        </div>
      ) : (
        <div className="py-1">
          <p className="text-[10px] uppercase tracking-wider text-[#5a6580] font-medium">
            {t("order.sent_items")}
          </p>
        </div>
      )}
      {grouped.map((group) => {
        const stationForIcon =
          group.station ??
          (group.menuItemId
            ? stationByMenuId.get(group.menuItemId)
            : undefined);
        return (
        <div
          key={group.key}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0A0F1E] border border-[#1e2a45]"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm text-white truncate">{group.name}</p>
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
                    <ChefHat className="size-3" />
                  ) : (
                    <Wine className="size-3" />
                  )}
                </span>
              )}
              <span
                className={cn(
                  "text-[9px] uppercase font-medium",
                  statusColors[group.displayStatus] ?? "text-[#5a6580]"
                )}
              >
                {orderLineStatusLabel(group.displayStatus)}
              </span>
            </div>
            <p className="text-xs text-[#5a6580]">
              {formatPrice(group.price)} x {group.totalQuantity}
            </p>
            {group.notes && (
              <p className="text-[10px] text-amber-400 mt-0.5 italic">
                {group.notes}
              </p>
            )}
          </div>

          {allowRefund && (
            <button
              onClick={() => handleVoid(group.itemIds)}
              className="p-1 rounded hover:bg-red-500/10 text-[#5a6580] hover:text-red-400 cursor-pointer"
              title="Remove item"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
        );
      })}

      {groupedVoided.length > 0 && (
        <>
          <div className="py-1 mt-2">
            <p className="text-[10px] uppercase tracking-wider text-red-400/60 font-medium">
              {t("order.voided_items")}
            </p>
          </div>
          {groupedVoided.map((group) => (
            <div
              key={group.key}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10 opacity-60"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-400 line-through truncate">
                  {group.name}
                </p>
                <p className="text-xs text-red-400/50">
                  {formatPrice(group.price)} x {group.totalQuantity}
                </p>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
