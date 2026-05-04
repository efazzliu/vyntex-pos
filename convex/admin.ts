import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./dashboard/helpers.ts";

// ── Users ──────────────────────────────────────────────

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").collect();

    // Attach license info for each user
    return await Promise.all(
      users.map(async (user) => {
        const license = await ctx.db
          .query("restaurants")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .first();
        return {
          ...user,
          license: license
            ? {
                _id: license._id,
                name: license.name,
                type: license.type,
                plan: license.plan,
                licenseStatus: license.licenseStatus,
              }
            : null,
        };
      })
    );
  },
});

export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("user")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // Prevent removing your own admin role
    if (admin._id === args.userId && args.role !== "admin") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "You cannot remove your own admin role",
      });
    }

    await ctx.db.patch(args.userId, { role: args.role });
  },
});

// ── Licenses ───────────────────────────────────────────

export const listLicenses = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const licenses = await ctx.db.query("restaurants").order("desc").collect();

    return await Promise.all(
      licenses.map(async (license) => {
        const user = await ctx.db.get(license.userId);
        return {
          ...license,
          ownerName: user?.name ?? "Unknown",
          ownerEmail: user?.email ?? "Unknown",
        };
      })
    );
  },
});

export const updateLicenseStatus = mutation({
  args: {
    licenseId: v.id("restaurants"),
    status: v.union(
      v.literal("active"),
      v.literal("expired"),
      v.literal("suspended")
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const license = await ctx.db.get(args.licenseId);
    if (!license) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "License not found",
      });
    }
    await ctx.db.patch(args.licenseId, { licenseStatus: args.status });
  },
});

export const extendLicense = mutation({
  args: {
    licenseId: v.id("restaurants"),
    days: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const license = await ctx.db.get(args.licenseId);
    if (!license) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "License not found",
      });
    }
    // Extend from current expiry or from now, whichever is later
    const baseDate = new Date(
      Math.max(new Date(license.licenseExpiry).getTime(), Date.now())
    );
    baseDate.setUTCDate(baseDate.getUTCDate() + args.days);

    await ctx.db.patch(args.licenseId, {
      licenseExpiry: baseDate.toISOString(),
      licenseStatus: "active",
    });
  },
});

export const resetDeviceId = mutation({
  args: {
    licenseId: v.id("restaurants"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const license = await ctx.db.get(args.licenseId);
    if (!license) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "License not found",
      });
    }
    await ctx.db.patch(args.licenseId, { deviceId: undefined });
  },
});

export const deleteLicense = mutation({
  args: {
    licenseId: v.id("restaurants"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const license = await ctx.db.get(args.licenseId);
    if (!license) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "License not found",
      });
    }
    await ctx.db.delete(args.licenseId);
  },
});

// ── Contact Submissions ────────────────────────────────

/** List conversations grouped by email, with latest message and unread count */
export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const submissions = await ctx.db
      .query("contactSubmissions")
      .order("desc")
      .collect();

    const replies = await ctx.db.query("contactReplies").order("desc").collect();

    // Group by email
    const conversationMap = new Map<
      string,
      {
        email: string;
        name: string;
        latestMessage: string;
        latestTimestamp: number;
        unreadCount: number;
        totalMessages: number;
        hasReplied: boolean;
      }
    >();

    for (const sub of submissions) {
      const existing = conversationMap.get(sub.email);
      if (!existing) {
        conversationMap.set(sub.email, {
          email: sub.email,
          name: sub.name,
          latestMessage: sub.message,
          latestTimestamp: sub._creationTime,
          unreadCount: sub.status === "new" ? 1 : 0,
          totalMessages: 1,
          hasReplied: sub.status === "replied",
        });
      } else {
        existing.totalMessages += 1;
        if (sub.status === "new") existing.unreadCount += 1;
        if (sub.status === "replied") existing.hasReplied = true;
        // Update name to the latest one (submissions are desc, so first one is latest)
      }
    }

    // Check replies for "hasReplied" and update latest timestamps
    for (const reply of replies) {
      const existing = conversationMap.get(reply.email);
      if (existing) {
        existing.hasReplied = true;
        const replyTime = new Date(reply.createdAt).getTime();
        if (replyTime > existing.latestTimestamp) {
          existing.latestTimestamp = replyTime;
          existing.latestMessage = reply.message;
        }
      }
    }

    // Sort by latest timestamp descending
    return Array.from(conversationMap.values()).sort(
      (a, b) => b.latestTimestamp - a.latestTimestamp
    );
  },
});

/** Get the full conversation thread for a given email */
export const getConversation = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

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

    // Merge into a single timeline
    type TimelineItem =
      | { kind: "message"; id: string; name: string; message: string; subject?: string; type: string; timestamp: number }
      | { kind: "reply"; id: string; adminName: string; message: string; timestamp: number };

    const timeline: TimelineItem[] = [];

    for (const sub of submissions) {
      timeline.push({
        kind: "message",
        id: sub._id,
        name: sub.name,
        message: sub.message,
        subject: sub.subject,
        type: sub.type,
        timestamp: sub._creationTime,
      });
    }

    for (const rep of replies) {
      timeline.push({
        kind: "reply",
        id: rep._id,
        adminName: rep.adminName,
        message: rep.message,
        timestamp: new Date(rep.createdAt).getTime(),
      });
    }

    // Sort by timestamp ascending
    timeline.sort((a, b) => a.timestamp - b.timestamp);

    return {
      contactName: submissions[0]?.name ?? "Unknown",
      email: args.email,
      timeline,
    };
  },
});

/** Send an admin reply to a conversation */
export const sendReply = mutation({
  args: {
    email: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // Save the reply
    await ctx.db.insert("contactReplies", {
      email: args.email,
      message: args.message,
      adminName: admin.name ?? "Admin",
      createdAt: new Date().toISOString(),
    });

    // Mark all submissions from this email as replied
    const submissions = await ctx.db
      .query("contactSubmissions")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    for (const sub of submissions) {
      if (sub.status !== "replied") {
        await ctx.db.patch(sub._id, { status: "replied" });
      }
    }
  },
});

/** Mark all messages in a conversation as read */
export const markConversationRead = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const submissions = await ctx.db
      .query("contactSubmissions")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    for (const sub of submissions) {
      if (sub.status === "new") {
        await ctx.db.patch(sub._id, { status: "read" });
      }
    }
  },
});

/** Delete an entire conversation */
export const deleteConversation = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const submissions = await ctx.db
      .query("contactSubmissions")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    const replies = await ctx.db
      .query("contactReplies")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    for (const sub of submissions) {
      await ctx.db.delete(sub._id);
    }
    for (const rep of replies) {
      await ctx.db.delete(rep._id);
    }
  },
});

export const listContacts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("contactSubmissions")
      .order("desc")
      .collect();
  },
});

export const updateContactStatus = mutation({
  args: {
    contactId: v.id("contactSubmissions"),
    status: v.union(
      v.literal("new"),
      v.literal("read"),
      v.literal("replied")
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Contact submission not found",
      });
    }
    await ctx.db.patch(args.contactId, { status: args.status });
  },
});

export const deleteContact = mutation({
  args: {
    contactId: v.id("contactSubmissions"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Contact submission not found",
      });
    }
    await ctx.db.delete(args.contactId);
  },
});

// ── Stats ──────────────────────────────────────────────

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    const licenses = await ctx.db.query("restaurants").collect();
    const contacts = await ctx.db.query("contactSubmissions").collect();

    const activeLicenses = licenses.filter(
      (l) =>
        l.licenseStatus === "active" &&
        new Date(l.licenseExpiry) > new Date()
    ).length;

    const expiredLicenses = licenses.filter(
      (l) =>
        l.licenseStatus === "expired" ||
        new Date(l.licenseExpiry) <= new Date()
    ).length;

    const suspendedLicenses = licenses.filter(
      (l) => l.licenseStatus === "suspended"
    ).length;

    const newContacts = contacts.filter((c) => c.status === "new").length;

    return {
      totalUsers: users.length,
      totalLicenses: licenses.length,
      activeLicenses,
      expiredLicenses,
      suspendedLicenses,
      totalContacts: contacts.length,
      newContacts,
    };
  },
});
