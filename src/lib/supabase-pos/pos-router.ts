/**
 * Maps POS Convex-style string ids to Supabase implementations.
 */
import * as staff from "./staff-ops.ts";
import * as tables from "./tables-ops.ts";
import * as menu from "./menu-ops.ts";
import * as orders from "./orders-ops.ts";
import * as settings from "./settings-ops.ts";
import * as dashboard from "./dashboard-ops.ts";
import * as customers from "./customers-ops.ts";
import * as expenses from "./expenses-ops.ts";
import * as stock from "./stock-ops.ts";
import * as templates from "./templates-ops.ts";
import * as staffConsumption from "./staff-consumption-ops.ts";
import * as phoneNotify from "./phone-notify-ops.ts";

function argsKey(a: Record<string, unknown>) {
  return JSON.stringify(a, Object.keys(a).sort());
}

export function posQueryKey(queryId: string, args: Record<string, unknown>) {
  return ["pos", queryId, argsKey(args)] as const;
}

export async function runPosQuery(
  queryId: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (queryId) {
    case "pos.staff.getStaff":
      return staff.getStaff(args.licenseKey as string);
    case "pos.tables.getTables":
      return tables.getTables(args.licenseKey as string);
    case "pos.tables.getTableOrderSummaries":
      return tables.getTableOrderSummaries(args.licenseKey as string);
    case "pos.menu.getCategories":
      return menu.getCategories(args.licenseKey as string);
    case "pos.menu.getAllItems":
      return menu.getAllItems(args.licenseKey as string);
    case "pos.menu.getMenus":
      return menu.getMenus(args.licenseKey as string);
    case "pos.menu.getGuestMenu":
      return menu.getGuestMenu(args.restaurantId as string);
    case "pos.orders.getOrdersByTable":
      return orders.getOrdersByTable({
        licenseKey: args.licenseKey as string,
        tableId: args.tableId as string,
      });
    case "pos.orders.getClosedOrders":
      return orders.getClosedOrders({ licenseKey: args.licenseKey as string });
    case "pos.orders.getOrderWithItems":
      return orders.getOrderWithItems({
        licenseKey: args.licenseKey as string,
        orderId: args.orderId as string,
      });
    case "pos.orders.getKitchenQueue":
      return orders.getKitchenQueue({
        licenseKey: args.licenseKey as string,
      });
    case "pos.orders.getWaiterKitchenNotifications":
      return orders.getWaiterKitchenNotifications({
        licenseKey: args.licenseKey as string,
      });
    case "pos.orders.getNonFiscalOrders":
      return orders.getNonFiscalOrders(args);
    case "pos.settings.getPrinters":
      return settings.getPrinters(args.licenseKey as string);
    case "pos.settings.getCompanyDetails":
      return settings.getCompanyDetails(args.licenseKey as string);
    case "pos.dashboard.getDashboardStats":
      return dashboard.getDashboardStats(
        args.licenseKey as string,
        args.viewPeriod as dashboard.DashboardViewPeriod | undefined,
        args.locale as dashboard.DashboardLocaleOption | undefined,
        args.anchorDate as string | undefined,
        args.rangeFromIso as string | undefined,
        args.rangeToExclusiveIso as string | undefined,
        args.operationalDayStartIso as string | undefined,
      );
    case "pos.dashboard.getZReport":
      return dashboard.getZReport({
        licenseKey: args.licenseKey as string,
        date: args.date as string | undefined,
      });
    case "pos.dashboard.getZReportHistory":
      return dashboard.getZReportHistory(args.licenseKey as string);
    case "pos.dashboard.getAuditLogs":
      return dashboard.getAuditLogs({
        licenseKey: args.licenseKey as string,
        limit: args.limit as number | undefined,
      });
    case "pos.customers.getDebtLedger":
      return customers.getDebtLedger(args.licenseKey as string);
    case "pos.customers.getCustomerStatement":
      return customers.getCustomerStatement({
        licenseKey: args.licenseKey as string,
        customerId: args.customerId as string,
      });
    case "pos.expenses.getTodayExpenses":
      return expenses.getTodayExpenses({
        licenseKey: args.licenseKey as string,
        staffId: args.staffId as string,
      });
    case "pos.expenses.getStaffExpenses":
      return expenses.getStaffExpenses({
        licenseKey: args.licenseKey as string,
        staffId: args.staffId as string,
      });
    case "pos.expenses.getAllUnclearedExpenses":
      return expenses.getAllUnclearedExpenses({
        licenseKey: args.licenseKey as string,
      });
    case "pos.templates.listTemplates":
      return templates.listTemplates(args.licenseKey as string);
    case "pos.stock.getStockItems":
      return stock.getStockItems(args.licenseKey as string);
    case "pos.stock.getAllLogs":
      return stock.getAllLogs(args.licenseKey as string);
    case "pos.stock.getItemLogs":
      return stock.getItemLogs(args);
    case "pos.staffConsumption.getStaffConsumption":
      return staffConsumption.getStaffConsumption({
        licenseKey: args.licenseKey as string,
        staffId: args.staffId as string,
      });
    default:
      return undefined;
  }
}

export async function runPosMutation(
  mutationId: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (mutationId) {
    case "pos.staff.createStaff":
      return staff.createStaff(args as Parameters<typeof staff.createStaff>[0]);
    case "pos.staff.updateStaff":
      return staff.updateStaff(args as Parameters<typeof staff.updateStaff>[0]);
    case "pos.staff.deleteStaff":
      return staff.deleteStaff(args as Parameters<typeof staff.deleteStaff>[0]);
    case "pos.staff.clockIn":
      return staff.clockIn(args as Parameters<typeof staff.clockIn>[0]);
    case "pos.staff.closeStaffShift":
      return staff.closeStaffShift(args);
    case "pos.tables.createTable":
      return tables.createTable(
        args as Parameters<typeof tables.createTable>[0],
      );
    case "pos.tables.deleteTable":
      return tables.deleteTable(
        args as Parameters<typeof tables.deleteTable>[0],
      );
    case "pos.tables.updateTable":
      return tables.updateTable(
        args as Parameters<typeof tables.updateTable>[0],
      );
    case "pos.tables.moveTable":
      return tables.moveTable(args as Parameters<typeof tables.moveTable>[0]);
    case "pos.tables.renameZone":
      return tables.renameZone(
        args as Parameters<typeof tables.renameZone>[0],
      );
    case "pos.tables.deleteZone":
      return tables.deleteZone(args as Parameters<typeof tables.deleteZone>[0]);
    case "pos.tables.setTableStatus":
      return tables.setTableStatus(
        args as Parameters<typeof tables.setTableStatus>[0],
      );
    case "pos.menu.createCategory":
      return menu.createCategory(
        args as Parameters<typeof menu.createCategory>[0],
      );
    case "pos.menu.updateCategory":
      return menu.updateCategory(
        args as Parameters<typeof menu.updateCategory>[0],
      );
    case "pos.menu.deleteCategory":
      return menu.deleteCategory(
        args as Parameters<typeof menu.deleteCategory>[0],
      );
    case "pos.menu.createItem":
      return menu.createItem(args);
    case "pos.menu.updateItem":
      return menu.updateItem(args);
    case "pos.menu.deleteItem":
      return menu.deleteItem(
        args as Parameters<typeof menu.deleteItem>[0],
      );
    case "pos.menu.toggleItemAvailability":
      return menu.toggleItemAvailability(
        args as Parameters<typeof menu.toggleItemAvailability>[0],
      );
    case "pos.menu.createMenu":
      return menu.createMenu(args as Parameters<typeof menu.createMenu>[0]);
    case "pos.menu.deleteMenu":
      return menu.deleteMenu(args as Parameters<typeof menu.deleteMenu>[0]);
    case "pos.menu.updateMenu":
      return menu.updateMenu(args as Parameters<typeof menu.updateMenu>[0]);
    case "pos.menu.generateUploadUrl":
      return menu.generateUploadUrl(args);
    case "pos.menu.ensureSupplyCategory":
      return menu.ensureSupplyCategory({
        licenseKey: args.licenseKey as string,
      });
    case "pos.orders.createOrder":
      return orders.createOrder(
        args as Parameters<typeof orders.createOrder>[0],
      );
    case "pos.orders.addItemToOrder":
      return orders.addItemToOrder(
        args as Parameters<typeof orders.addItemToOrder>[0],
      );
    case "pos.orders.addItemsToOrderBulk":
      return orders.addItemsToOrderBulk(
        args as Parameters<typeof orders.addItemsToOrderBulk>[0],
      );
    case "pos.orders.sendOrder":
      return orders.sendOrder(args as Parameters<typeof orders.sendOrder>[0]);
    case "pos.orders.submitCartOrder":
      return orders.submitCartOrder(
        args as Parameters<typeof orders.submitCartOrder>[0],
      );
    case "pos.orders.printBill":
      return orders.printBill(args);
    case "pos.orders.payOrder":
      return orders.payOrder(args);
    case "pos.orders.bumpKitchenTicketItem":
      return orders.bumpKitchenTicketItem(
        args as Parameters<typeof orders.bumpKitchenTicketItem>[0],
      );
    case "pos.orders.voidItem":
      return orders.voidItem(args);
    case "pos.orders.updateOrderStatus":
      return orders.updateOrderStatus(args);
    case "pos.orders.updateItemQuantity":
      return orders.updateItemQuantity(args);
    case "pos.orders.removeItemFromOrder":
      return orders.removeItemFromOrder(args);
    case "pos.orders.updateItemStatus":
      return orders.updateItemStatus(args);
    case "pos.orders.generateFiscalCoupon":
      return orders.generateFiscalCoupon(args);
    case "pos.orders.fiscalizeOrderBulk":
      return orders.fiscalizeOrderBulk(args);
    case "pos.orders.logBulkFiscalization":
      return orders.logBulkFiscalization(args);
    case "pos.orders.transferOrdersToTable":
      return orders.transferOrdersToTable(
        args as Parameters<typeof orders.transferOrdersToTable>[0],
      );
    case "pos.orders.mergeTableOrders":
      return orders.mergeTableOrders(
        args as Parameters<typeof orders.mergeTableOrders>[0],
      );
    case "pos.settings.addPrinter":
      return settings.addPrinter(
        args as Parameters<typeof settings.addPrinter>[0],
      );
    case "pos.settings.updatePrinter":
      return settings.updatePrinter(
        args as Parameters<typeof settings.updatePrinter>[0],
      );
    case "pos.settings.deletePrinter":
      return settings.deletePrinter(
        args as Parameters<typeof settings.deletePrinter>[0],
      );
    case "pos.settings.updateLocaleSettings":
      return settings.updateLocaleSettings(
        args as Parameters<typeof settings.updateLocaleSettings>[0],
      );
    case "pos.settings.updateCompanyProfile":
      return settings.updateCompanyProfile(
        args as Parameters<typeof settings.updateCompanyProfile>[0],
      );
    case "pos.settings.updateTaxSettings":
      return settings.updateTaxSettings(
        args as Parameters<typeof settings.updateTaxSettings>[0],
      );
    case "pos.settings.updatePaymentSettings":
      return settings.updatePaymentSettings(
        args as Parameters<typeof settings.updatePaymentSettings>[0],
      );
    case "pos.settings.updateOrderAvailabilitySettings":
      return settings.updateOrderAvailabilitySettings(
        args as Parameters<typeof settings.updateOrderAvailabilitySettings>[0],
      );
    case "pos.settings.syncDeviceClosePinHash":
      return settings.syncDeviceClosePinHash({
        licenseKey: args.licenseKey as string,
        pinHash: args.pinHash as string,
      });
    case "pos.dashboard.insertAuditLog":
      return dashboard.insertAuditLog(
        args as Parameters<typeof dashboard.insertAuditLog>[0],
      );
    case "pos.dashboard.recordAdminPinLoginForPhone":
      return phoneNotify.recordAdminPinLoginForPhone(
        args as Parameters<typeof phoneNotify.recordAdminPinLoginForPhone>[0],
      );
    case "pos.dashboard.closeDay":
      return dashboard.closeDay(args);
    case "pos.expenses.addExpense":
      return expenses.addExpense(
        args as Parameters<typeof expenses.addExpense>[0],
      );
    case "pos.expenses.clearAllExpenses":
      return expenses.clearAllExpenses({
        licenseKey: args.licenseKey as string,
      });
    case "pos.customers.createCustomer":
      return customers.createCustomer(
        args as Parameters<typeof customers.createCustomer>[0],
      );
    case "pos.customers.updateCustomer":
      return customers.updateCustomer(args);
    case "pos.customers.settleDebt":
      return customers.settleDebt(args);
    case "pos.templates.saveTemplate":
      return templates.saveTemplate(args);
    case "pos.templates.resetTemplate":
      return templates.resetTemplate(args);
    case "pos.staffConsumption.addConsumption":
      return staffConsumption.addConsumption(args);
    case "pos.staffConsumption.clearAllConsumption":
      return staffConsumption.clearAllConsumption({
        licenseKey: args.licenseKey as string,
      });
    case "pos.stock.addStock":
      return stock.addStock(args);
    case "pos.stock.removeStock":
      return stock.removeStock(args);
    case "pos.stock.setStock":
      return stock.setStock(args);
    default:
      return null;
  }
}
