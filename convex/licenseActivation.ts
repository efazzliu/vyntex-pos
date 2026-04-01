import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Activate a license key by binding it to a device.
 * Returns activation data if successful.
 */
export const activate = mutation({
  args: {
    licenseKey: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up the license by key
    const license = await ctx.db
      .query("restaurants")
      .withIndex("by_licenseKey", (q) => q.eq("licenseKey", args.licenseKey))
      .first();

    if (!license) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Invalid license key. Please check your key and try again.",
      });
    }

    // Check if license is suspended
    if (license.licenseStatus === "suspended") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "This license has been suspended. Please contact support or check your Web Dashboard.",
      });
    }

    // Check if license is expired
    const now = new Date();
    const expiryDate = new Date(license.licenseExpiry);
    if (expiryDate <= now || license.licenseStatus === "expired") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "This license has expired. Please renew your license in the Web Dashboard.",
      });
    }

    // Check if device ID is already bound to a different device
    if (license.deviceId && license.deviceId !== args.deviceId) {
      throw new ConvexError({
        code: "CONFLICT",
        message:
          "Activation failed. This license is already activated on another device. Please reset your Device ID in the Web Dashboard or contact your administrator.",
      });
    }

    // Bind the device ID if not already bound
    if (!license.deviceId) {
      await ctx.db.patch(license._id, { deviceId: args.deviceId });
    }

    // Return activation data (used to build the local token)
    return {
      licenseKey: license.licenseKey,
      plan: license.plan,
      businessName: license.name,
      businessType: license.type,
      expiresAt: license.licenseExpiry,
      deviceId: args.deviceId,
      activatedAt: now.toISOString(),
    };
  },
});

/**
 * Verify an existing activation token is still valid.
 * Called on app open to ensure the license hasn't been revoked or expired.
 */
export const verify = query({
  args: {
    licenseKey: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const license = await ctx.db
      .query("restaurants")
      .withIndex("by_licenseKey", (q) => q.eq("licenseKey", args.licenseKey))
      .first();

    if (!license) {
      return { valid: false, reason: "License not found" };
    }

    if (license.licenseStatus === "suspended") {
      return { valid: false, reason: "License suspended" };
    }

    const now = new Date();
    const expiryDate = new Date(license.licenseExpiry);
    if (expiryDate <= now || license.licenseStatus === "expired") {
      return { valid: false, reason: "License expired" };
    }

    // Check device binding
    if (license.deviceId && license.deviceId !== args.deviceId) {
      return { valid: false, reason: "Device mismatch" };
    }

    return {
      valid: true,
      plan: license.plan,
      businessName: license.name,
      businessType: license.type,
      expiresAt: license.licenseExpiry,
    };
  },
});
