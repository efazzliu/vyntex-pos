import { useQuery } from "convex/react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";

type DailyCirculationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
};

type CirculationStats = {
  todayRevenue?: number;
  paidCirculation?: number;
  openUnpaidTotal?: number;
  totalCirculation?: number;
};

function positiveAmount(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export default function DailyCirculationDialog({
  open,
  onOpenChange,
  licenseKey,
}: DailyCirculationDialogProps) {
  const { t, formatPrice, language } = usePosLocale();
  const { theme } = usePosTheme();
  const statsQuery = useQuery(
    "pos.dashboard.getDashboardStats",
    open
      ? {
          licenseKey,
          viewPeriod: "day",
          locale: language,
        }
      : "skip",
  );

  const stats =
    statsQuery && typeof statsQuery === "object" && !Array.isArray(statsQuery)
      ? (statsQuery as CirculationStats)
      : undefined;
  const loading = open && statsQuery === undefined;
  const paid = positiveAmount(stats?.paidCirculation ?? stats?.todayRevenue);
  const unpaid = positiveAmount(stats?.openUnpaidTotal);
  const total = positiveAmount(stats?.totalCirculation ?? paid + unpaid);
  const paidPercent =
    total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0;
  const dateLabel = new Intl.DateTimeFormat(
    language === "sq" ? "sq-AL" : "en-GB",
    { weekday: "short", day: "2-digit", month: "short" },
  ).format(new Date());
  const amountLabel = (amount: number) => (loading ? "…" : formatPrice(amount));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-pos-theme={theme}
        showCloseButton={false}
        className="overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-md"
      >
        <DialogTitle className="sr-only">
          {t("dashboard.circulation_total")}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t("dashboard.circulation_total_hint")}
        </DialogDescription>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_16px_48px_-28px_rgba(15,23,42,0.35)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {t("dashboard.circulation_total")}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{dateLabel}</p>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label={t("btn.close")}
              >
                <X className="size-4" />
              </button>
            </DialogClose>
          </div>

          <p
            className="mt-4 text-[1.75rem] font-semibold tracking-tight text-slate-900 tabular-nums"
            aria-live="polite"
          >
            {amountLabel(total)}
          </p>

          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900 transition-[width] duration-500"
              style={{ width: `${paidPercent}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-xs text-slate-400">
                {t("dashboard.circulation_paid")}
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900 tabular-nums">
                {amountLabel(paid)}
              </p>
            </div>
            <div className="border-l border-slate-100 pl-3">
              <p className="text-xs text-slate-400">
                {t("dashboard.circulation_unpaid")}
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900 tabular-nums">
                {amountLabel(unpaid)}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
