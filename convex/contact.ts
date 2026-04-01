import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const submitForm = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.optional(v.string()),
    message: v.string(),
    type: v.union(v.literal("form"), v.literal("chat")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("contactSubmissions", {
      ...args,
      status: "new",
    });
  },
});
