import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("user")),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_role", ["role"]),

  contactSubmissions: defineTable({
    name: v.string(),
    email: v.string(),
    subject: v.optional(v.string()),
    message: v.string(),
    type: v.union(v.literal("form"), v.literal("chat")),
    status: v.union(v.literal("new"), v.literal("read"), v.literal("replied")),
  })
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .index("by_email", ["email"]),

  contactReplies: defineTable({
    email: v.string(),
    message: v.string(),
    adminName: v.string(),
    createdAt: v.string(),
  }).index("by_email", ["email"]),

  restaurants: defineTable({
    userId: v.id("users"),
    name: v.string(),
    type: v.union(
      v.literal("restaurant"),
      v.literal("cafe"),
      v.literal("bar"),
      v.literal("hotel"),
      v.literal("fitness")
    ),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    currency: v.string(),
    // Language & Currency config
    language: v.optional(v.union(v.literal("en"), v.literal("sq"))),
    currencySymbol: v.optional(v.string()),
    currencyPosition: v.optional(
      v.union(v.literal("prefix"), v.literal("suffix"))
    ),
    currencyDecimals: v.optional(v.number()),
    plan: v.union(
      v.literal("starter"),
      v.literal("professional"),
      v.literal("enterprise")
    ),
    licenseKey: v.string(),
    licenseExpiry: v.string(),
    licenseStatus: v.union(
      v.literal("active"),
      v.literal("expired"),
      v.literal("suspended")
    ),
    deviceId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_licenseKey", ["licenseKey"]),

  menuCategories: defineTable({
    restaurantId: v.id("restaurants"),
    name: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
    displayOrder: v.number(),
    isActive: v.boolean(),
  }).index("by_restaurant", ["restaurantId"]),

  menus: defineTable({
    restaurantId: v.id("restaurants"),
    name: v.string(),
    displayOrder: v.number(),
    isActive: v.boolean(),
  }).index("by_restaurant", ["restaurantId"]),

  menuItems: defineTable({
    restaurantId: v.id("restaurants"),
    categoryId: v.id("menuCategories"),
    menuId: v.optional(v.id("menus")),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    available: v.boolean(),
    displayOrder: v.number(),
    station: v.optional(v.union(v.literal("kitchen"), v.literal("bar"))),
    vatRate: v.optional(v.number()),
    imageStorageId: v.optional(v.id("_storage")),
    isFavorite: v.optional(v.boolean()),
    /** When false, hidden from waiter self-service staff meal (admin flow still sees all). */
    staffMealAllowed: v.optional(v.boolean()),
    /** Optional per-item price used for waiter self-service staff meal (0 = free). */
    staffMealPrice: v.optional(v.number()),
    totalSold: v.optional(v.number()),
    // Stock / inventory fields
    trackStock: v.optional(v.boolean()),
    stockUnit: v.optional(v.union(v.literal("pc"), v.literal("lt"), v.literal("kg"), v.literal("g"), v.literal("ml"), v.literal("bottle"), v.literal("box"))),
    initialStock: v.optional(v.number()),
    currentStock: v.optional(v.number()),
    lowStockThreshold: v.optional(v.number()),
    /** Kitchen / bar supply metadata (optional). */
    supplyVendor: v.optional(v.string()),
    supplyLot: v.optional(v.string()),
    /** ISO date YYYY-MM-DD */
    supplyExpiryDate: v.optional(v.string()),
    supplyStorage: v.optional(
      v.union(
        v.literal("fridge"),
        v.literal("freezer"),
        v.literal("dry"),
        v.literal("ambient"),
      ),
    ),
    /** Optional BOM: per 1 sold unit of this product, deduct `qtyPerUnit` from each tracked supply row. */
    supplyRecipe: v.optional(
      v.array(
        v.object({
          supplyMenuItemId: v.id("menuItems"),
          qtyPerUnit: v.number(),
        }),
      ),
    ),
    /** Admin-defined option groups (doneness, sides, removals, etc.). */
    customizationConfig: v.optional(v.any()),
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_category", ["categoryId"])
    .index("by_menu", ["menuId"]),

  tables: defineTable({
    restaurantId: v.id("restaurants"),
    name: v.string(),
    seats: v.number(),
    zone: v.string(),
    status: v.union(
      v.literal("available"),
      v.literal("occupied"),
      v.literal("reserved"),
      v.literal("bill-printed")
    ),
    posX: v.optional(v.number()),
    posY: v.optional(v.number()),
    shape: v.optional(v.union(v.literal("square"), v.literal("circle"), v.literal("rectangle"))),
    tableScale: v.optional(v.number()),
    tableScaleY: v.optional(v.number()),
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_restaurant_and_zone", ["restaurantId", "zone"]),

  staff: defineTable({
    restaurantId: v.id("restaurants"),
    name: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("manager"),
      v.literal("waiter"),
      v.literal("inventory"),
      v.literal("accountant"),
      v.literal("auditor"),
      v.literal("kitchen")
    ),
    pinHash: v.string(),
    isActive: v.boolean(),
    permissions: v.optional(
      v.object({
        canVoidItems: v.boolean(),
        canGiveDiscount: v.boolean(),
        canTransferTables: v.boolean(),
        /** Combine this bill with another table that already has an open bill (separate from transfer to empty table). */
        canMergeTables: v.optional(v.boolean()),
        /** Allow split-bill / partial pay action on order payment drawer. */
        canSplitBills: v.optional(v.boolean()),
        canViewReports: v.boolean(),
        canManageMenu: v.boolean(),
        canManageStock: v.boolean(),
        canLogStaffConsumption: v.optional(v.boolean()),
        /** Charge order to customer debt from the order column (waiter; admin sets per staff). */
        canChargeDebt: v.optional(v.boolean()),
        /** Mark order complimentary from the order column (PIN step; admin sets per staff). */
        canMarkComplimentary: v.optional(v.boolean()),
        /** Open audit log / activity trail (admin drawer or sidebar). */
        canViewAuditLog: v.optional(v.boolean()),
      })
    ),
  }).index("by_restaurant", ["restaurantId"]),

  shifts: defineTable({
    staffId: v.id("staff"),
    restaurantId: v.id("restaurants"),
    clockIn: v.string(),
    clockOut: v.optional(v.string()),
    openingCash: v.optional(v.number()),
  })
    .index("by_staff", ["staffId"])
    .index("by_restaurant", ["restaurantId"]),

  customers: defineTable({
    restaurantId: v.id("restaurants"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    creditLimit: v.optional(v.number()),
  }).index("by_restaurant", ["restaurantId"]),

  debtPayments: defineTable({
    restaurantId: v.id("restaurants"),
    customerId: v.id("customers"),
    amount: v.number(),
    method: v.union(v.literal("cash"), v.literal("card"), v.literal("other")),
    staffId: v.optional(v.id("staff")),
    staffName: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_customer", ["customerId"]),

  orders: defineTable({
    restaurantId: v.id("restaurants"),
    tableId: v.id("tables"),
    staffId: v.id("staff"),
    orderNumber: v.number(),
    status: v.union(
      v.literal("open"),
      v.literal("sent-to-kitchen"),
      v.literal("ready"),
      v.literal("served"),
      v.literal("paid"),
      v.literal("cancelled")
    ),
    subtotal: v.number(),
    tax: v.number(),
    total: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    paidAt: v.optional(v.string()),
    paymentMethod: v.optional(
      v.union(v.literal("cash"), v.literal("card"), v.literal("other"))
    ),
    // Payment type for the three-tier system
    paymentType: v.optional(
      v.union(
        v.literal("fiscal"),
        v.literal("non_fiscal"),
        v.literal("no_receipt"),
        v.literal("debt"),
        v.literal("complimentary")
      )
    ),
    // For debt payments - link to customer
    customerId: v.optional(v.id("customers")),
    customerName: v.optional(v.string()),
    // For complimentary - original total before zeroing
    originalTotal: v.optional(v.number()),
    // Fiscal tracking
    fiscalStatus: v.optional(v.boolean()),
    fiscalizedAt: v.optional(v.string()),
    fiscalizedBy: v.optional(v.id("staff")),
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_table", ["tableId"])
    .index("by_restaurant_and_status", ["restaurantId", "status"]),

  orderItems: defineTable({
    orderId: v.id("orders"),
    menuItemId: v.id("menuItems"),
    name: v.string(),
    price: v.number(),
    quantity: v.number(),
    notes: v.optional(v.string()),
    station: v.optional(v.union(v.literal("kitchen"), v.literal("bar"))),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("served"),
      v.literal("cancelled"),
      v.literal("voided")
    ),
    voidedBy: v.optional(v.id("staff")),
    voidedAt: v.optional(v.string()),
    vatRate: v.optional(v.number()),
  }).index("by_order", ["orderId"]),

  // Configured printers and peripherals
  printers: defineTable({
    restaurantId: v.id("restaurants"),
    name: v.string(),
    type: v.union(
      v.literal("bluetooth"),
      v.literal("network"),
      v.literal("usb")
    ),
    address: v.string(),
    role: v.union(
      v.literal("receipt"),
      v.literal("kitchen"),
      v.literal("bar")
    ),
    isActive: v.boolean(),
  }).index("by_restaurant", ["restaurantId"]),

  // Audit log for system actions
  auditLogs: defineTable({
    restaurantId: v.id("restaurants"),
    staffId: v.optional(v.id("staff")),
    staffName: v.string(),
    action: v.union(
      v.literal("login"),
      v.literal("logout"),
      v.literal("void_item"),
      v.literal("item_deleted"),
      v.literal("quantity_reduced"),
      v.literal("price_change"),
      v.literal("table_transfer"),
      v.literal("day_close"),
      v.literal("shift_close"),
      v.literal("late_fiscal"),
      v.literal("order_cancel"),
      v.literal("staff_create"),
      v.literal("staff_update"),
      v.literal("menu_change"),
      v.literal("payment"),
      v.literal("complimentary_order"),
      v.literal("debt_order"),
      v.literal("debt_settlement"),
      v.literal("item_ordered"),
      v.literal("bulk_fiscal"),
      v.literal("expense")
    ),
    details: v.string(),
    // Optional JSON metadata for structured data (items, comments, etc.)
    metadata: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_restaurant", ["restaurantId"]),
  // Stock movement logs (audit trail for inventory changes)
  stockLogs: defineTable({
    restaurantId: v.id("restaurants"),
    menuItemId: v.id("menuItems"),
    staffName: v.string(),
    type: v.union(
      v.literal("manual_addition"),
      v.literal("manual_set"),
      v.literal("sale"),
      v.literal("adjustment"),
      v.literal("reset"),
      v.literal("staff_consumption"),
      v.literal("recipe_sale")
    ),
    change: v.number(),
    balanceAfter: v.number(),
    note: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_menuItem", ["menuItemId"]),

  // Stored Z-Reports for shift history / auditing
  zReports: defineTable({
    restaurantId: v.id("restaurants"),
    zNumber: v.number(),
    closedByStaffId: v.id("staff"),
    closedByStaffName: v.string(),
    // Revenue breakdown by station
    barRevenue: v.number(),
    kitchenRevenue: v.number(),
    grossRevenue: v.number(),
    // Deductions
    cardTotal: v.number(),
    debtTotal: v.number(),
    complimentaryTotal: v.number(),
    wasteTotal: v.number(),
    voidsTotal: v.number(),
    cashExpenses: v.number(),
    // Final
    totalToHandOver: v.number(),
    // Opening cash (float) for reconciliation
    openingCash: v.optional(v.number()),
    // Metadata
    totalOrders: v.number(),
    paidOrders: v.number(),
    cancelledOrders: v.number(),
    shiftStart: v.string(),
    shiftEnd: v.string(),
    // Staff breakdown
    staffBreakdown: v.array(
      v.object({
        staffName: v.string(),
        orders: v.number(),
        revenue: v.number(),
      })
    ),
    // Shift details
    shiftDetails: v.array(
      v.object({
        staffName: v.string(),
        clockIn: v.string(),
        clockOut: v.string(),
      })
    ),
    createdAt: v.string(),
  }).index("by_restaurant", ["restaurantId"]),

  // Daily expenses (cash out)
  expenses: defineTable({
    restaurantId: v.id("restaurants"),
    staffId: v.id("staff"),
    staffName: v.string(),
    amount: v.number(),
    note: v.string(),
    cleared: v.optional(v.boolean()),
    createdAt: v.string(),
  }).index("by_restaurant", ["restaurantId"]),

  // Staff consumption tracking (meals/drinks consumed by staff)
  staffConsumption: defineTable({
    restaurantId: v.id("restaurants"),
    staffId: v.id("staff"),
    staffName: v.string(),
    loggedByStaffId: v.id("staff"),
    loggedByStaffName: v.string(),
    items: v.array(
      v.object({
        menuItemId: v.id("menuItems"),
        name: v.string(),
        price: v.number(),
        quantity: v.number(),
        listPrice: v.optional(v.number()),
      })
    ),
    total: v.number(),
    cleared: v.boolean(),
    createdAt: v.string(),
  }).index("by_restaurant", ["restaurantId"]),

  // Receipt & report template configurations
  receiptTemplates: defineTable({
    restaurantId: v.id("restaurants"),
    templateType: v.union(
      v.literal("fiscal_receipt"),
      v.literal("non_fiscal_receipt"),
      v.literal("kitchen_ticket"),
      v.literal("bar_ticket"),
      v.literal("waiter_shift_report"),
      v.literal("x_report"),
      v.literal("z_report"),
      v.literal("complimentary_slip"),
      v.literal("expense_voucher"),
      v.literal("debt_voucher")
    ),
    toggles: v.object({
      logo: v.boolean(),
      headerText: v.boolean(),
      footerText: v.boolean(),
      waiterName: v.boolean(),
      tableNumber: v.boolean(),
      timestamp: v.boolean(),
      unitPrices: v.boolean(),
      taxDetails: v.boolean(),
      orderNumber: v.boolean(),
    }),
    labels: v.object({
      headerText: v.string(),
      footerText: v.string(),
    }),
    // Per-element text formatting styles
    styles: v.optional(
      v.record(
        v.string(),
        v.object({
          fontSize: v.optional(v.number()),
          bold: v.optional(v.boolean()),
          italic: v.optional(v.boolean()),
          uppercase: v.optional(v.boolean()),
          textAlign: v.optional(
            v.union(
              v.literal("left"),
              v.literal("center"),
              v.literal("right")
            )
          ),
        })
      )
    ),
    printerId: v.optional(v.id("printers")),
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_restaurant_and_type", ["restaurantId", "templateType"]),
});
