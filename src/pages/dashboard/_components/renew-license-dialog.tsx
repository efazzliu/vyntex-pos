import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { cn } from "@/lib/utils.ts";
import { useDashboardLocale } from "./dashboard-locale-context.tsx";
import { useAdminCenter } from "./admin-center-context.tsx";
import { RENEW_OPTIONS, type RenewTerm } from "../_lib/admin-center-types.ts";
import { formatEur } from "../_lib/admin-center-format.ts";

const AUTO_RENEW_KEY = "vyntex.admin.autoRenew";

function loadAutoRenew(venueId: string): boolean {
  try {
    const raw = localStorage.getItem(AUTO_RENEW_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed[venueId] !== false;
  } catch {
    return true;
  }
}

function saveAutoRenew(venueId: string, value: boolean) {
  try {
    const raw = localStorage.getItem(AUTO_RENEW_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[venueId] = value;
    localStorage.setItem(AUTO_RENEW_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function RenewLicenseDialog() {
  const { t, lang } = useDashboardLocale();
  const { renewTarget, closeRenew } = useAdminCenter();
  const [term, setTerm] = useState<RenewTerm>("1y");
  const [autoRenew, setAutoRenew] = useState(true);
  const [busy, setBusy] = useState(false);

  const open = Boolean(renewTarget);
  const selected = RENEW_OPTIONS.find((o) => o.id === term) ?? RENEW_OPTIONS[1];
  const expiryLabel = useMemo(() => {
    if (!renewTarget?.expiry) return "—";
    return new Date(renewTarget.expiry).toLocaleDateString(lang === "sq" ? "sq-AL" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [renewTarget?.expiry, lang]);

  const onOpenChange = (next: boolean) => {
    if (!next) closeRenew();
    else if (renewTarget) setAutoRenew(loadAutoRenew(renewTarget.venueId));
  };

  const submit = async () => {
    if (!renewTarget) return;
    setBusy(true);
    saveAutoRenew(renewTarget.venueId, autoRenew);
    await new Promise((r) => window.setTimeout(r, 700));
    setBusy(false);
    toast.success(t("ac.renew.success", { venue: renewTarget.venueName }));
    closeRenew();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-0">
        <DialogHeader className="space-y-1 border-b border-slate-100 px-6 py-5 text-left">
          <DialogTitle className="text-xl">{t("ac.renew.title")}</DialogTitle>
          <DialogDescription>{t("ac.renew.subtitle")}</DialogDescription>
        </DialogHeader>

        {renewTarget ? (
          <div className="space-y-5 px-6 py-5">
            <dl className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t("ac.renew.venue")}
                </dt>
                <dd className="mt-1 font-semibold text-slate-900">{renewTarget.venueName}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t("ac.renew.plan")}
                </dt>
                <dd className="mt-1 font-semibold text-slate-900">{renewTarget.plan}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t("ac.renew.expiration")}
                </dt>
                <dd className="mt-1 font-semibold text-slate-900">{expiryLabel}</dd>
              </div>
            </dl>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">{t("ac.renew.options")}</p>
              <RadioGroup
                value={term}
                onValueChange={(value) => setTerm(value as RenewTerm)}
                className="gap-2"
              >
                {RENEW_OPTIONS.map((option) => {
                  const active = option.id === term;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 transition",
                        active
                          ? "border-indigo-300 bg-indigo-50/70 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={option.id} />
                        <span className="text-sm font-medium text-slate-800">{option.label}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {formatEur(option.price, true)}
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{t("ac.renew.auto")}</p>
                <p className="mt-0.5 text-xs text-slate-500">{t("ac.renew.auto_hint")}</p>
              </div>
              <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
            </div>

            <div className="space-y-1.5 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>{t("ac.renew.subtotal")}</span>
                <span className="tabular-nums text-slate-800">{formatEur(selected.price)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>{t("ac.renew.tax")}</span>
                <span className="tabular-nums text-slate-800">{formatEur(0)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
                <span>{t("ac.renew.total")}</span>
                <span className="tabular-nums">{formatEur(selected.price)}</span>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="border-t border-slate-100 px-6 py-4">
          <Button variant="ghost" onClick={closeRenew}>
            {t("ac.common.cancel")}
          </Button>
          <Button
            className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? t("ac.renew.working") : t("ac.renew.cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
