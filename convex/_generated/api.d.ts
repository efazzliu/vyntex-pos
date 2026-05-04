/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as contact from "../contact.js";
import type * as dashboard_helpers from "../dashboard/helpers.js";
import type * as dashboard_restaurants from "../dashboard/restaurants.js";
import type * as licenseActivation from "../licenseActivation.js";
import type * as pos_customers from "../pos/customers.js";
import type * as pos_dashboard from "../pos/dashboard.js";
import type * as pos_expenses from "../pos/expenses.js";
import type * as pos_helpers from "../pos/helpers.js";
import type * as pos_menu from "../pos/menu.js";
import type * as pos_orders from "../pos/orders.js";
import type * as pos_settings from "../pos/settings.js";
import type * as pos_staff from "../pos/staff.js";
import type * as pos_staffConsumption from "../pos/staffConsumption.js";
import type * as pos_stock from "../pos/stock.js";
import type * as pos_tables from "../pos/tables.js";
import type * as pos_templates from "../pos/templates.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  contact: typeof contact;
  "dashboard/helpers": typeof dashboard_helpers;
  "dashboard/restaurants": typeof dashboard_restaurants;
  licenseActivation: typeof licenseActivation;
  "pos/customers": typeof pos_customers;
  "pos/dashboard": typeof pos_dashboard;
  "pos/expenses": typeof pos_expenses;
  "pos/helpers": typeof pos_helpers;
  "pos/menu": typeof pos_menu;
  "pos/orders": typeof pos_orders;
  "pos/settings": typeof pos_settings;
  "pos/staff": typeof pos_staff;
  "pos/staffConsumption": typeof pos_staffConsumption;
  "pos/stock": typeof pos_stock;
  "pos/tables": typeof pos_tables;
  "pos/templates": typeof pos_templates;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
