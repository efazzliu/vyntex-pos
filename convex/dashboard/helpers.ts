import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Get the authenticated user from the database.
 * Throws if not authenticated or user not found.
 */
export async function getAuthUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Not logged in",
    });
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();
  if (!user) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }
  return user;
}

/**
 * Require the calling user to have the "admin" role.
 * Returns the user if authorized.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getAuthUser(ctx);
  if (user.role !== "admin") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return user;
}

/**
 * Get the authenticated user's restaurant.
 * Throws if not authenticated, user not found, or restaurant not found.
 */
export async function getAuthRestaurant(ctx: QueryCtx | MutationCtx) {
  const user = await getAuthUser(ctx);
  const restaurant = await ctx.db
    .query("restaurants")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  if (!restaurant) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Restaurant not found. Please complete setup.",
    });
  }
  return { user, restaurant };
}
