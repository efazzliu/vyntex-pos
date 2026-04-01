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
