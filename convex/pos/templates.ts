import { ConvexError, v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getRestaurantByLicense } from "./helpers.ts";

// All template types
const TEMPLATE_TYPES = [
  "fiscal_receipt",
  "non_fiscal_receipt",
  "kitchen_ticket",
  "bar_ticket",
  "waiter_shift_report",
  "x_report",
  "z_report",
  "complimentary_slip",
  "expense_voucher",
  "debt_voucher",
] as const;

type TemplateType = (typeof TEMPLATE_TYPES)[number];

// Default toggle configurations per template type
const DEFAULT_TOGGLES: Record<
  TemplateType,
  {
    logo: boolean;
    headerText: boolean;
    footerText: boolean;
    waiterName: boolean;
    tableNumber: boolean;
    timestamp: boolean;
    unitPrices: boolean;
    taxDetails: boolean;
    orderNumber: boolean;
  }
> = {
  fiscal_receipt: {
    logo: true,
    headerText: true,
    footerText: true,
    waiterName: true,
    tableNumber: true,
    timestamp: true,
    unitPrices: true,
    taxDetails: true,
    orderNumber: true,
  },
  non_fiscal_receipt: {
    logo: true,
    headerText: true,
    footerText: true,
    waiterName: true,
    tableNumber: true,
    timestamp: true,
    unitPrices: true,
    taxDetails: false,
    orderNumber: true,
  },
  kitchen_ticket: {
    logo: false,
    headerText: true,
    footerText: false,
    waiterName: true,
    tableNumber: true,
    timestamp: true,
    unitPrices: false,
    taxDetails: false,
    orderNumber: true,
  },
  bar_ticket: {
    logo: false,
    headerText: true,
    footerText: false,
    waiterName: true,
    tableNumber: true,
    timestamp: true,
    unitPrices: false,
    taxDetails: false,
    orderNumber: true,
  },
  waiter_shift_report: {
    logo: true,
    headerText: true,
    footerText: false,
    waiterName: true,
    tableNumber: false,
    timestamp: true,
    unitPrices: false,
    taxDetails: true,
    orderNumber: false,
  },
  x_report: {
    logo: true,
    headerText: true,
    footerText: false,
    waiterName: false,
    tableNumber: false,
    timestamp: true,
    unitPrices: false,
    taxDetails: true,
    orderNumber: false,
  },
  z_report: {
    logo: true,
    headerText: true,
    footerText: true,
    waiterName: false,
    tableNumber: false,
    timestamp: true,
    unitPrices: false,
    taxDetails: true,
    orderNumber: false,
  },
  complimentary_slip: {
    logo: true,
    headerText: true,
    footerText: true,
    waiterName: true,
    tableNumber: true,
    timestamp: true,
    unitPrices: false,
    taxDetails: false,
    orderNumber: true,
  },
  expense_voucher: {
    logo: true,
    headerText: true,
    footerText: false,
    waiterName: true,
    tableNumber: false,
    timestamp: true,
    unitPrices: false,
    taxDetails: false,
    orderNumber: false,
  },
  debt_voucher: {
    logo: true,
    headerText: true,
    footerText: true,
    waiterName: true,
    tableNumber: true,
    timestamp: true,
    unitPrices: true,
    taxDetails: false,
    orderNumber: true,
  },
};

const DEFAULT_LABELS: Record<
  TemplateType,
  { headerText: string; footerText: string }
> = {
  fiscal_receipt: {
    headerText: "FISCAL RECEIPT\nFiscal Receipt",
    footerText: "Thank you for your visit!",
  },
  non_fiscal_receipt: {
    headerText: "PRE-BILL",
    footerText: "This is not a fiscal document",
  },
  kitchen_ticket: {
    headerText: "KITCHEN ORDER",
    footerText: "",
  },
  bar_ticket: {
    headerText: "BAR ORDER",
    footerText: "",
  },
  waiter_shift_report: {
    headerText: "SHIFT REPORT",
    footerText: "",
  },
  x_report: {
    headerText: "X-REPORT",
    footerText: "",
  },
  z_report: {
    headerText: "Z-REPORT (END OF DAY)",
    footerText: "Fiscal closure complete",
  },
  complimentary_slip: {
    headerText: "COMPLIMENTARY",
    footerText: "On the house - Thank you!",
  },
  expense_voucher: {
    headerText: "EXPENSE VOUCHER",
    footerText: "",
  },
  debt_voucher: {
    headerText: "DEBT VOUCHER",
    footerText: "Please pay at your earliest convenience",
  },
};

const templateTypeValidator = v.union(
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
);

/** List all templates for a restaurant, merging saved with defaults */
export const listTemplates = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const saved = await ctx.db
      .query("receiptTemplates")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const savedMap = new Map(saved.map((t) => [t.templateType, t]));

    // Return all template types with saved or default config
    return TEMPLATE_TYPES.map((type) => {
      const existing = savedMap.get(type);
      return {
        templateType: type,
        toggles: existing?.toggles ?? DEFAULT_TOGGLES[type],
        labels: existing?.labels ?? DEFAULT_LABELS[type],
        styles: existing?.styles ?? {},
        printerId: existing?.printerId ?? null,
        isCustomized: !!existing,
        _id: existing?._id ?? null,
      };
    });
  },
});

/** Get a single template config */
export const getTemplate = query({
  args: { licenseKey: v.string(), templateType: templateTypeValidator },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const saved = await ctx.db
      .query("receiptTemplates")
      .withIndex("by_restaurant_and_type", (q) =>
        q
          .eq("restaurantId", restaurant._id)
          .eq("templateType", args.templateType)
      )
      .unique();

    const type = args.templateType;

    return {
      templateType: type,
      toggles: saved?.toggles ?? DEFAULT_TOGGLES[type],
      labels: saved?.labels ?? DEFAULT_LABELS[type],
      styles: saved?.styles ?? {},
      printerId: saved?.printerId ?? null,
      isCustomized: !!saved,
      _id: saved?._id ?? null,
    };
  },
});

/** Save/update a template */
export const saveTemplate = mutation({
  args: {
    licenseKey: v.string(),
    templateType: templateTypeValidator,
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
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const existing = await ctx.db
      .query("receiptTemplates")
      .withIndex("by_restaurant_and_type", (q) =>
        q
          .eq("restaurantId", restaurant._id)
          .eq("templateType", args.templateType)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        toggles: args.toggles,
        labels: args.labels,
        styles: args.styles,
        printerId: args.printerId,
      });
      return existing._id;
    }

    return await ctx.db.insert("receiptTemplates", {
      restaurantId: restaurant._id,
      templateType: args.templateType,
      toggles: args.toggles,
      labels: args.labels,
      styles: args.styles,
      printerId: args.printerId,
    });
  },
});

/** Reset a template back to defaults */
export const resetTemplate = mutation({
  args: {
    licenseKey: v.string(),
    templateType: templateTypeValidator,
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const existing = await ctx.db
      .query("receiptTemplates")
      .withIndex("by_restaurant_and_type", (q) =>
        q
          .eq("restaurantId", restaurant._id)
          .eq("templateType", args.templateType)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
