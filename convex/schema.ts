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
});
