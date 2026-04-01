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
});
