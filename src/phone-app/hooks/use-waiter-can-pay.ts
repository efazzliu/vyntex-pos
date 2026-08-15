import { useQuery } from "convex/react";
import {
  parsePosPaymentSettings,
  waiterPhoneCanCollectPayment,
} from "@/lib/pos-payment-handling.ts";

/** True only when the venue lets waiters collect payment on the phone. */
export function useWaiterCanPay(licenseKey: string): boolean {
  const company = useQuery(
    "pos.settings.getCompanyDetails",
    licenseKey ? { licenseKey } : "skip",
  ) as { paymentSettings?: unknown } | undefined;
  return waiterPhoneCanCollectPayment(
    parsePosPaymentSettings(company?.paymentSettings),
  );
}
