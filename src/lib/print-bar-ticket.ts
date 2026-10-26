import {
  buildKitchenTicketHtml,
  visibilityFromKitchenElements,
  visibilityFromKitchenTemplate,
  type KitchenTicketLine,
  type KitchenTicketVisibility,
} from "@/lib/print-kitchen-ticket.ts";

export type BarTicketLine = KitchenTicketLine;
export type BarTicketVisibility = KitchenTicketVisibility;

export const BAR_TICKET_TITLE = "BAR";
export const DEFAULT_BAR_VISIBILITY = {
  logo: false,
  divider: true,
  timestamp: true,
  orderNumber: true,
  waiterName: true,
  tableNumber: true,
  itemList: true,
  itemModifiers: true,
  itemNotes: true,
} satisfies BarTicketVisibility;

export function resolveBarTicketCopy(labels?: { headerText?: string }) {
  const header = (labels?.headerText ?? "").trim();
  const firstLine = header.split("\n")[0]?.trim() ?? "";
  const isLegacy = !firstLine || /^bar( order)?$/i.test(firstLine);
  return { title: isLegacy ? BAR_TICKET_TITLE : firstLine };
}

export const visibilityFromBarElements = visibilityFromKitchenElements;
export const visibilityFromBarTemplate = visibilityFromKitchenTemplate;

export function buildBarTicketHtml(
  args: Parameters<typeof buildKitchenTicketHtml>[0],
): string {
  return buildKitchenTicketHtml({
    ...args,
    title: args.title ?? BAR_TICKET_TITLE,
    pageTitle: args.pageTitle ?? "Bar ticket",
  });
}
