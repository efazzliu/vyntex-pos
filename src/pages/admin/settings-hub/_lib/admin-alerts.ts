import { toast } from "sonner";
import {
  effectiveLicenseStatus,
  getAdminActiveMrrEur,
  listLicensesForAdmin,
} from "@/lib/supabase-pos/admin-ops.ts";
import type { AdminNotificationPrefs } from "./admin-settings-types.ts";
import { sendAdminNotifyEmail } from "./admin-settings-api.ts";

const LICENSE_WARN_DAYS = 14;
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function storageKey(kind: string) {
  return `vyntex-admin-alert-${kind}`;
}

function recentlySent(kind: string): boolean {
  if (typeof window === "undefined") return true;
  const raw = sessionStorage.getItem(storageKey(kind));
  if (!raw) return false;
  const t = Number(raw);
  return Number.isFinite(t) && Date.now() - t < ALERT_COOLDOWN_MS;
}

function markSent(kind: string) {
  sessionStorage.setItem(storageKey(kind), String(Date.now()));
}

async function pushBrowserNotification(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    /* ignore */
  }
}

export async function runAdminAlerts(prefs: AdminNotificationPrefs, adminEmail: string): Promise<void> {
  if (!prefs.licenseExpiryAlerts && !prefs.billingAlerts) return;

  if (prefs.licenseExpiryAlerts && !recentlySent("license")) {
    try {
      const licenses = await listLicensesForAdmin();
      const soon = licenses.filter((row) => {
        if (effectiveLicenseStatus(row) !== "active") return false;
        const ex = new Date(row.license_expiry).getTime();
        const days = (ex - Date.now()) / (24 * 60 * 60 * 1000);
        return days >= 0 && days <= LICENSE_WARN_DAYS;
      });
      if (soon.length > 0) {
        const names = soon
          .slice(0, 5)
          .map((l) => l.name)
          .join(", ");
        const more = soon.length > 5 ? ` (+${soon.length - 5} more)` : "";
        const msg = `${soon.length} license(s) expire within ${LICENSE_WARN_DAYS} days: ${names}${more}.`;
        toast.warning("License expiry alert", { description: msg, duration: 12_000 });
        if (prefs.push) void pushBrowserNotification("License expiry", msg);
        if (prefs.email && adminEmail) {
          try {
            await sendAdminNotifyEmail({
              type: "license_expiry",
              subject: `[Vyntex Admin] ${soon.length} license(s) expiring soon`,
              message: msg,
            });
          } catch {
            /* optional */
          }
        }
        markSent("license");
      }
    } catch {
      /* non-blocking */
    }
  }

  if (prefs.billingAlerts && !recentlySent("billing")) {
    try {
      const mrr = await getAdminActiveMrrEur();
      const msg = `Estimated active MRR: €${Math.round(mrr).toLocaleString()}. Review Revenue for details.`;
      toast.info("Billing snapshot", { description: msg, duration: 10_000 });
      if (prefs.push) void pushBrowserNotification("Billing", msg);
      if (prefs.email && adminEmail) {
        try {
          await sendAdminNotifyEmail({
            type: "billing_digest",
            subject: "[Vyntex Admin] Revenue snapshot",
            message: msg,
          });
        } catch {
          /* optional */
        }
      }
      markSent("billing");
    } catch {
      /* non-blocking */
    }
  }

  if (prefs.sound && (prefs.licenseExpiryAlerts || prefs.billingAlerts)) {
    /* sound only on explicit user test in settings */
  }
}
