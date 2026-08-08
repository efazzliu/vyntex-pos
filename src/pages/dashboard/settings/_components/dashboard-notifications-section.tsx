import { useEffect, useState } from "react";
import { Bell, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { toast } from "sonner";
import {
  loadDashboardAccountMeta,
  saveDashboardNotificationPrefs,
} from "../_lib/account-settings.ts";
import type { DashboardNotificationPrefs } from "../_lib/types.ts";
import { SettingsRow } from "./settings-row.tsx";

export function DashboardNotificationsSection() {
  const [notifications, setNotifications] = useState<DashboardNotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadDashboardAccountMeta().then((m) => setNotifications(m.notifications));
  }, []);

  const patch = (p: Partial<DashboardNotificationPrefs>) => {
    setNotifications((prev) => (prev ? { ...prev, ...p } : prev));
  };

  const testSound = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.04;
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      toast.message("Could not play test sound");
    }
  };

  const handleSave = async () => {
    if (!notifications) return;
    setSaving(true);
    try {
      const err = await saveDashboardNotificationPrefs(notifications);
      if (err) toast.error(err);
      else toast.success("Notification preferences saved");
    } finally {
      setSaving(false);
    }
  };

  if (!notifications) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-12 dark:border-slate-700/80 dark:bg-slate-900/90">
        <p className="text-center text-sm text-slate-500">Loading preferences…</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.28)] dark:border-slate-700/80 dark:bg-slate-900/90">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-200 pb-4 dark:border-slate-700/80">
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#0066FF]/10 to-[#00AACC]/10 p-2.5 text-[#0066FF] dark:border-slate-600 dark:text-cyan-400">
          <Bell className="size-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Notification preferences
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Choose what you receive by email and in the POS app.
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        <SettingsRow label="Email notifications" hint="Account, license, and billing messages.">
          <Switch
            checked={notifications.emailNotifications}
            onCheckedChange={(checked) => patch({ emailNotifications: checked })}
          />
        </SettingsRow>
        <SettingsRow label="POS alerts" hint="Device activation, sync issues, and critical POS events.">
          <Switch
            checked={notifications.posAlerts}
            onCheckedChange={(checked) => patch({ posAlerts: checked })}
          />
        </SettingsRow>
        <SettingsRow label="Sales reports" hint="Periodic summaries of revenue and orders.">
          <Switch
            checked={notifications.salesReports}
            onCheckedChange={(checked) => patch({ salesReports: checked })}
          />
        </SettingsRow>
        <SettingsRow label="Marketing emails" hint="Product news and offers (optional).">
          <Switch
            checked={notifications.marketingEmails}
            onCheckedChange={(checked) => patch({ marketingEmails: checked })}
          />
        </SettingsRow>
        <SettingsRow label="Sound notifications" hint="Play a sound for alerts in this browser.">
          <div className="flex items-center gap-2">
            <Switch
              checked={notifications.soundNotifications}
              onCheckedChange={(checked) => {
                patch({ soundNotifications: checked });
                if (checked) testSound();
              }}
            />
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={testSound}>
              <Volume2 className="size-4" />
            </Button>
          </div>
        </SettingsRow>
      </div>

      <div className="mt-6 flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700/80">
        <Button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="h-10 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] px-5 text-white"
        >
          {saving ? "Saving…" : "Save notifications"}
        </Button>
      </div>
    </section>
  );
}
