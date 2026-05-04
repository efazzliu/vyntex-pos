import { mutation, query } from "./_generated/server";
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

/** Get conversation history for the chat widget (by email) */
export const getChatHistory = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    if (!args.email) return [];

    const submissions = await ctx.db
      .query("contactSubmissions")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .order("asc")
      .collect();

    const replies = await ctx.db
      .query("contactReplies")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .order("asc")
      .collect();

    type ChatItem = {
      kind: "user" | "admin";
      message: string;
      name: string;
      timestamp: number;
    };

    const items: ChatItem[] = [];

    for (const sub of submissions) {
      items.push({
        kind: "user",
        message: sub.message,
        name: sub.name,
        timestamp: sub._creationTime,
      });
    }

    for (const rep of replies) {
      items.push({
        kind: "admin",
        message: rep.message,
        name: rep.adminName,
        timestamp: new Date(rep.createdAt).getTime(),
      });
    }

    items.sort((a, b) => a.timestamp - b.timestamp);
    return items;
  },
});
