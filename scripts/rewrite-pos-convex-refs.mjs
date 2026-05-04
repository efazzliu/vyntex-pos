import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPLACEMENTS = [
  // Queries
  [/api\.pos\.staff\.getStaff/g, "'pos.staff.getStaff'"],
  [/api\.pos\.tables\.getTables/g, "'pos.tables.getTables'"],
  [/api\.pos\.tables\.getTableOrderSummaries/g, "'pos.tables.getTableOrderSummaries'"],
  [/api\.pos\.menu\.getCategories/g, "'pos.menu.getCategories'"],
  [/api\.pos\.menu\.getAllItems/g, "'pos.menu.getAllItems'"],
  [/api\.pos\.menu\.getMenus/g, "'pos.menu.getMenus'"],
  [/api\.pos\.orders\.getOrdersByTable/g, "'pos.orders.getOrdersByTable'"],
  [/api\.pos\.orders\.getClosedOrders/g, "'pos.orders.getClosedOrders'"],
  [/api\.pos\.orders\.getOrderWithItems/g, "'pos.orders.getOrderWithItems'"],
  [/api\.pos\.orders\.getNonFiscalOrders/g, "'pos.orders.getNonFiscalOrders'"],
  [/api\.pos\.settings\.getPrinters/g, "'pos.settings.getPrinters'"],
  [/api\.pos\.settings\.getCompanyDetails/g, "'pos.settings.getCompanyDetails'"],
  [/api\.pos\.dashboard\.getDashboardStats/g, "'pos.dashboard.getDashboardStats'"],
  [/api\.pos\.dashboard\.getZReportHistory/g, "'pos.dashboard.getZReportHistory'"],
  [/api\.pos\.dashboard\.getZReport/g, "'pos.dashboard.getZReport'"],
  [/api\.pos\.dashboard\.getAuditLogs/g, "'pos.dashboard.getAuditLogs'"],
  [/api\.pos\.customers\.getDebtLedger/g, "'pos.customers.getDebtLedger'"],
  [/api\.pos\.customers\.getCustomerStatement/g, "'pos.customers.getCustomerStatement'"],
  [/api\.pos\.expenses\.getTodayExpenses/g, "'pos.expenses.getTodayExpenses'"],
  [/api\.pos\.expenses\.getStaffExpenses/g, "'pos.expenses.getStaffExpenses'"],
  [/api\.pos\.expenses\.getAllUnclearedExpenses/g, "'pos.expenses.getAllUnclearedExpenses'"],
  [/api\.pos\.templates\.listTemplates/g, "'pos.templates.listTemplates'"],
  [/api\.pos\.stock\.getStockItems/g, "'pos.stock.getStockItems'"],
  [/api\.pos\.stock\.getAllLogs/g, "'pos.stock.getAllLogs'"],
  [/api\.pos\.stock\.getItemLogs/g, "'pos.stock.getItemLogs'"],
  [/api\.pos\.staffConsumption\.getStaffConsumption/g, "'pos.staffConsumption.getStaffConsumption'"],
  // Mutations
  [/api\.pos\.staff\.createStaff/g, "'pos.staff.createStaff'"],
  [/api\.pos\.staff\.updateStaff/g, "'pos.staff.updateStaff'"],
  [/api\.pos\.staff\.deleteStaff/g, "'pos.staff.deleteStaff'"],
  [/api\.pos\.staff\.clockIn/g, "'pos.staff.clockIn'"],
  [/api\.pos\.staff\.closeStaffShift/g, "'pos.staff.closeStaffShift'"],
  [/api\.pos\.tables\.createTable/g, "'pos.tables.createTable'"],
  [/api\.pos\.tables\.deleteTable/g, "'pos.tables.deleteTable'"],
  [/api\.pos\.tables\.updateTable/g, "'pos.tables.updateTable'"],
  [/api\.pos\.tables\.moveTable/g, "'pos.tables.moveTable'"],
  [/api\.pos\.tables\.renameZone/g, "'pos.tables.renameZone'"],
  [/api\.pos\.tables\.deleteZone/g, "'pos.tables.deleteZone'"],
  [/api\.pos\.tables\.setTableStatus/g, "'pos.tables.setTableStatus'"],
  [/api\.pos\.menu\.createCategory/g, "'pos.menu.createCategory'"],
  [/api\.pos\.menu\.updateCategory/g, "'pos.menu.updateCategory'"],
  [/api\.pos\.menu\.deleteCategory/g, "'pos.menu.deleteCategory'"],
  [/api\.pos\.menu\.createItem/g, "'pos.menu.createItem'"],
  [/api\.pos\.menu\.updateItem/g, "'pos.menu.updateItem'"],
  [/api\.pos\.menu\.deleteItem/g, "'pos.menu.deleteItem'"],
  [/api\.pos\.menu\.toggleItemAvailability/g, "'pos.menu.toggleItemAvailability'"],
  [/api\.pos\.menu\.createMenu/g, "'pos.menu.createMenu'"],
  [/api\.pos\.menu\.deleteMenu/g, "'pos.menu.deleteMenu'"],
  [/api\.pos\.menu\.updateMenu/g, "'pos.menu.updateMenu'"],
  [/api\.pos\.menu\.generateUploadUrl/g, "'pos.menu.generateUploadUrl'"],
  [/api\.pos\.orders\.createOrder/g, "'pos.orders.createOrder'"],
  [/api\.pos\.orders\.addItemToOrder/g, "'pos.orders.addItemToOrder'"],
  [/api\.pos\.orders\.sendOrder/g, "'pos.orders.sendOrder'"],
  [/api\.pos\.orders\.printBill/g, "'pos.orders.printBill'"],
  [/api\.pos\.orders\.payOrder/g, "'pos.orders.payOrder'"],
  [/api\.pos\.orders\.voidItem/g, "'pos.orders.voidItem'"],
  [/api\.pos\.orders\.updateOrderStatus/g, "'pos.orders.updateOrderStatus'"],
  [/api\.pos\.orders\.updateItemQuantity/g, "'pos.orders.updateItemQuantity'"],
  [/api\.pos\.orders\.removeItemFromOrder/g, "'pos.orders.removeItemFromOrder'"],
  [/api\.pos\.orders\.updateItemStatus/g, "'pos.orders.updateItemStatus'"],
  [/api\.pos\.orders\.generateFiscalCoupon/g, "'pos.orders.generateFiscalCoupon'"],
  [/api\.pos\.orders\.fiscalizeOrderBulk/g, "'pos.orders.fiscalizeOrderBulk'"],
  [/api\.pos\.orders\.logBulkFiscalization/g, "'pos.orders.logBulkFiscalization'"],
  [/api\.pos\.settings\.addPrinter/g, "'pos.settings.addPrinter'"],
  [/api\.pos\.settings\.updatePrinter/g, "'pos.settings.updatePrinter'"],
  [/api\.pos\.settings\.deletePrinter/g, "'pos.settings.deletePrinter'"],
  [/api\.pos\.settings\.updateLocaleSettings/g, "'pos.settings.updateLocaleSettings'"],
  [/api\.pos\.settings\.syncDeviceClosePinHash/g, "'pos.settings.syncDeviceClosePinHash'"],
  [/api\.pos\.dashboard\.closeDay/g, "'pos.dashboard.closeDay'"],
  [/api\.pos\.expenses\.addExpense/g, "'pos.expenses.addExpense'"],
  [/api\.pos\.expenses\.clearAllExpenses/g, "'pos.expenses.clearAllExpenses'"],
  [/api\.pos\.customers\.createCustomer/g, "'pos.customers.createCustomer'"],
  [/api\.pos\.customers\.updateCustomer/g, "'pos.customers.updateCustomer'"],
  [/api\.pos\.customers\.settleDebt/g, "'pos.customers.settleDebt'"],
  [/api\.pos\.templates\.saveTemplate/g, "'pos.templates.saveTemplate'"],
  [/api\.pos\.templates\.resetTemplate/g, "'pos.templates.resetTemplate'"],
  [/api\.pos\.staffConsumption\.addConsumption/g, "'pos.staffConsumption.addConsumption'"],
  [/api\.pos\.stock\.addStock/g, "'pos.stock.addStock'"],
  [/api\.pos\.stock\.removeStock/g, "'pos.stock.removeStock'"],
  [/api\.pos\.stock\.setStock/g, "'pos.stock.setStock'"],
];

// Longest patterns first so e.g. getZReportHistory is not partially replaced as getZReport + "History".
REPLACEMENTS.sort((a, b) => b[0].source.length - a[0].source.length);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "release") continue;
      walk(p, files);
    } else if (/\.(tsx|ts)$/.test(name)) {
      files.push(p);
    }
  }
  return files;
}

const roots = [
  join(process.cwd(), "src", "pages", "pos"),
  join(process.cwd(), "src", "pages", "auth"),
];

for (const root of roots) {
  for (const file of walk(root)) {
    let s = readFileSync(file, "utf8");
    if (!s.includes("api.pos.")) continue;
    for (const [re, rep] of REPLACEMENTS) {
      s = s.replace(re, rep);
    }
    writeFileSync(file, s);
    console.log("updated", file);
  }
}
