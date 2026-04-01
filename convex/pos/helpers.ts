import type { QueryCtx, MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";

/**
 * Verify a license key and return the associated restaurant.
 * Used by POS endpoints that authenticate via license key instead of user session.
 */
export async function getRestaurantByLicense(
  ctx: QueryCtx | MutationCtx,
  licenseKey: string
) {
  const restaurant = await ctx.db
    .query("restaurants")
    .withIndex("by_licenseKey", (q) => q.eq("licenseKey", licenseKey))
    .unique();

  if (!restaurant) {
    throw new ConvexError({ message: "Invalid license key", code: "NOT_FOUND" });
  }

  if (restaurant.licenseStatus !== "active") {
    throw new ConvexError({
      message: "License is not active",
      code: "FORBIDDEN",
    });
  }

  return restaurant;
}
