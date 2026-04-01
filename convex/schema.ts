import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  contactSubmissions: defineTable({
    name: v.string(),
    email: v.string(),
    subject: v.optional(v.string()),
    message: v.string(),
    type: v.union(v.literal("form"), v.literal("chat")),
    status: v.union(v.literal("new"), v.literal("read"), v.literal("replied")),
  })
    .index("by_type", ["type"])
    .index("by_status", ["status"]),

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
    plan: v.union(
      v.literal("starter"),
      v.literal("professional"),
      v.literal("enterprise")
    ),
  }).index("by_user", ["userId"]),

  menuCategories: defineTable({
    restaurantId: v.id("restaurants"),
    name: v.string(),
    sortOrder: v.number(),
  }).index("by_restaurant", ["restaurantId"]),

  menuItems: defineTable({
    restaurantId: v.id("restaurants"),
    categoryId: v.id("menuCategories"),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    isAvailable: v.boolean(),
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_category", ["categoryId"]),

  orders: defineTable({
    restaurantId: v.id("restaurants"),
    orderNumber: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    items: v.array(
      v.object({
        menuItemId: v.id("menuItems"),
        name: v.string(),
        price: v.number(),
        quantity: v.number(),
      })
    ),
    subtotal: v.number(),
    tax: v.number(),
    total: v.number(),
    type: v.union(
      v.literal("dine-in"),
      v.literal("takeout"),
      v.literal("delivery")
    ),
    tableNumber: v.optional(v.string()),
    customerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_restaurant_and_status", ["restaurantId", "status"]),
});
