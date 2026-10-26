import { useEffect, useRef, useState } from "react";
import {
  Check,
  CreditCard,
  Lock,
  ShieldCheck,
  Sparkles,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";

type CardPhase = "waiting" | "processing" | "approved";

export default function CardPaymentScreen({
  amount,
  isSubmitting = false,
  onCancel,
  onApproved,
}: {
  amount: number;
  isSubmitting?: boolean;
  onCancel: () => void;
  onApproved: () => void;
}) {
  const { t, formatPrice, currency } = usePosLocale();
  const [phase, setPhase] = useState<CardPhase>("waiting");
  const approvedOnce = useRef(false);
  const onApprovedRef = useRef(onApproved);
  onApprovedRef.current = onApproved;
  const price = formatPrice(amount);

  useEffect(() => {
    const toProcess = window.setTimeout(() => setPhase("processing"), 1800);
    const toApprove = window.setTimeout(() => setPhase("approved"), 4000);
    return () => {
      window.clearTimeout(toProcess);
      window.clearTimeout(toApprove);
    };
  }, []);

  useEffect(() => {
    if (phase !== "approved" || approvedOnce.current) return;
    approvedOnce.current = true;
    const done = window.setTimeout(() => onApprovedRef.current(), 700);
    return () => window.clearTimeout(done);
  }, [phase]);

  const steps: {
    id: CardPhase;
    title: string;
    sub: string;
  }[] = [
    {
      id: "waiting",
      title: t("order.card_step_wait"),
      sub: t("order.card_step_wait_sub"),
    },
    {
      id: "processing",
      title: t("order.card_step_process"),
      sub: t("order.card_step_process_sub"),
    },
    {
      id: "approved",
      title: t("order.card_step_approved"),
      sub: t("order.card_step_approved_sub"),
    },
  ];
  const phaseIndex = steps.findIndex((step) => step.id === phase);

  return (
    <div className="pay-card-screen relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="pay-card-screen__glow" />
      <div className="relative flex min-h-0 flex-1 flex-col px-7 pb-5 pt-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]">
              {t("order.card_kicker")}
            </p>
            <h2 className="mt-1 text-[28px] font-semibold tracking-tight text-[#f8fafc]">
              {t("order.card_title")}
            </h2>
            <p className="mt-1 text-[13px] text-[#93a4bb]">
              {t("order.card_subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <span
              className={cn(
                "size-2 rounded-full",
                phase === "approved"
                  ? "bg-emerald-400"
                  : "bg-brand-cyan pay-card-screen__live",
              )}
            />
            <span className="text-[12px] font-medium text-[#e2e8f0]">
              {phase === "approved"
                ? t("order.card_status_approved")
                : t("order.card_status_ready")}
            </span>
            <CreditCard className="size-3.5 text-[#7dd3fc]" strokeWidth={1.75} />
          </div>
        </header>

        <div className="mt-7 grid min-h-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-6">
          <div className="min-w-0">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#7b8ba3]">
                {t("order.card_amount_label")}
              </p>
              <p className="mt-2 flex items-end gap-1.5 text-[#f8fafc]">
                <span className="mb-1.5 text-[22px] font-medium text-[#7dd3fc]">
                  {currency.symbol}
                </span>
                <span className="text-[3.4rem] font-semibold leading-none tracking-[-0.06em] tabular-nums">
                  {amount.toFixed(currency.decimals)}
                </span>
              </p>
            </div>
            <ul className="mt-5 space-y-3">
              <Feature
                icon={Zap}
                title={t("order.card_feat_fast")}
                sub={t("order.card_feat_fast_sub")}
              />
              <Feature
                icon={Lock}
                title={t("order.card_feat_secure")}
                sub={t("order.card_feat_secure_sub")}
              />
              <Feature
                icon={ShieldCheck}
                title={t("order.card_feat_cards")}
                sub={t("order.card_feat_cards_sub")}
              />
            </ul>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {["Visa", "Mastercard", "Amex"].map((brand) => (
                <span
                  key={brand}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c5d0de]"
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>

          <SoftPosTerminal amount={price} phase={phase} />

          <ol className="min-w-0 space-y-0">
            {steps.map((step, index) => {
              const done = index < phaseIndex || phase === "approved";
              const active = step.id === phase;
              return (
                <li key={step.id} className="relative flex gap-3 pb-7 last:pb-0">
                  {index < steps.length - 1 ? (
                    <span
                      className={cn(
                        "absolute left-[15px] top-8 h-[calc(100%-18px)] w-px",
                        done || active
                          ? "bg-gradient-to-b from-brand-cyan to-white/15"
                          : "bg-white/10",
                      )}
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold",
                      done && !active
                        ? "bg-emerald-400 text-[#052e16]"
                        : active
                          ? "bg-brand-cyan text-[#082f49] shadow-[0_0_24px_rgba(0,198,255,0.45)]"
                          : "border border-white/15 bg-white/[0.04] text-[#94a3b8]",
                    )}
                  >
                    {done && !active ? (
                      <Check className="size-3.5" strokeWidth={2.5} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p
                      className={cn(
                        "text-[14px] font-semibold tracking-tight",
                        active || done ? "text-[#f8fafc]" : "text-[#7b8ba3]",
                      )}
                    >
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-snug text-[#8090a6]">
                      {step.sub}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <footer className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="flex min-w-0 items-start gap-2.5 text-[12px] leading-snug text-[#93a4bb]">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[#7dd3fc]" />
            <span>{t("order.card_footer_hint")}</span>
          </p>
          <button
            type="button"
            disabled={isSubmitting || phase === "approved"}
            onClick={onCancel}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#cbd5e1] transition hover:bg-white/5 hover:text-[#f8fafc] disabled:opacity-40"
          >
            <X className="size-3.5" />
            {t("order.card_cancel")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Zap;
  title: string;
  sub: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[#7dd3fc]">
        <Icon className="size-3.5" strokeWidth={1.75} />
      </span>
      <span>
        <span className="block text-[13px] font-semibold text-[#f1f5f9]">
          {title}
        </span>
        <span className="block text-[11px] text-[#7b8ba3]">{sub}</span>
      </span>
    </li>
  );
}

export function CardPaymentDetails({
  amount,
  active = false,
  onApproved,
}: {
  amount: number;
  active?: boolean;
  onApproved?: () => void;
}) {
  const { t, formatPrice } = usePosLocale();
  const [phase, setPhase] = useState<CardPhase>("waiting");
  const approvedOnce = useRef(false);
  const onApprovedRef = useRef(onApproved);
  onApprovedRef.current = onApproved;
  const price = formatPrice(amount);

  useEffect(() => {
    if (!active) {
      setPhase("waiting");
      approvedOnce.current = false;
      return;
    }
    const toProcess = window.setTimeout(() => setPhase("processing"), 1600);
    const toApprove = window.setTimeout(() => setPhase("approved"), 3600);
    return () => {
      window.clearTimeout(toProcess);
      window.clearTimeout(toApprove);
    };
  }, [active]);

  useEffect(() => {
    if (!active || phase !== "approved" || approvedOnce.current) return;
    approvedOnce.current = true;
    const done = window.setTimeout(() => onApprovedRef.current?.(), 500);
    return () => window.clearTimeout(done);
  }, [active, phase]);

  const steps: { id: CardPhase; title: string; sub: string }[] = [
    {
      id: "waiting",
      title: t("order.card_step_wait"),
      sub: t("order.card_step_wait_sub"),
    },
    {
      id: "processing",
      title: t("order.card_step_process"),
      sub: t("order.card_step_process_sub"),
    },
    {
      id: "approved",
      title: t("order.card_step_approved"),
      sub: t("order.card_step_approved_sub"),
    },
  ];
  const phaseIndex = steps.findIndex((step) => step.id === phase);

  return (
    <div className="mt-3">
    <div className="pay-card-screen pay-card-screen--inline relative overflow-hidden rounded-[22px] px-4 py-4">
      <div className="pay-card-screen__glow" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7dd3fc]">
              {t("order.card_kicker")}
            </p>
            <p className="mt-0.5 text-[15px] font-semibold text-[#f8fafc]">
              {t("order.card_title")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
            <span
              className={cn(
                "size-1.5 rounded-full",
                phase === "approved"
                  ? "bg-emerald-400"
                  : "bg-brand-cyan pay-card-screen__live",
              )}
            />
            <span className="text-[11px] font-medium text-[#e2e8f0]">
              {phase === "approved"
                ? t("order.card_status_approved")
                : t("order.card_status_ready")}
            </span>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <SoftPosTerminal amount={price} phase={phase} compact />
        </div>

        <ol className="mt-4 space-y-0">
          {steps.map((step, index) => {
            const done = index < phaseIndex || phase === "approved";
            const on = step.id === phase;
            return (
              <li key={step.id} className="relative flex gap-2.5 pb-3.5 last:pb-0">
                {index < steps.length - 1 ? (
                  <span
                    className={cn(
                      "absolute left-[11px] top-6 h-[calc(100%-14px)] w-px",
                      done || on
                        ? "bg-gradient-to-b from-brand-cyan to-white/15"
                        : "bg-white/10",
                    )}
                  />
                ) : null}
                <span
                  className={cn(
                    "relative z-10 grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                    done && !on
                      ? "bg-emerald-400 text-[#052e16]"
                      : on
                        ? "bg-brand-cyan text-[#082f49] shadow-[0_0_16px_rgba(0,198,255,0.4)]"
                        : "border border-white/15 bg-white/[0.04] text-[#94a3b8]",
                  )}
                >
                  {done && !on ? (
                    <Check className="size-3" strokeWidth={2.5} />
                  ) : (
                    index + 1
                  )}
                </span>
                <div className="min-w-0 pt-px">
                  <p
                    className={cn(
                      "text-[13px] font-semibold",
                      on || done ? "text-[#f8fafc]" : "text-[#7b8ba3]",
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-[11px] leading-snug text-[#8090a6]">
                    {step.sub}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
    <p className="mt-3 flex items-start gap-2 text-[12px] leading-snug text-slate-500">
      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" />
      <span>{t("order.card_footer_hint")}</span>
    </p>
    </div>
  );
}

function SoftPosTerminal({
  amount,
  phase,
  compact = false,
  mini = false,
}: {
  amount: string;
  phase: CardPhase;
  compact?: boolean;
  mini?: boolean;
}) {
  const { t } = usePosLocale();
  return (
    <div className={cn("relative shrink-0", mini ? "w-[132px]" : compact ? "w-[168px]" : "mx-2 w-[230px]")}>
      <div className="pay-card-screen__orb" />
      <div className={cn(
        "relative border border-white/10 bg-[linear-gradient(180deg,#152033_0%,#0a1018_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.45)]",
        compact ? "rounded-[26px] p-2.5" : "rounded-[34px] p-3.5",
      )}>
        <div className={cn("flex justify-center", compact ? "py-2" : "py-3")}>
          <span className={cn("relative grid place-items-center", compact ? "size-11" : "size-14")}>
            <span className="pay-card-screen__ring" />
            <span className="pay-card-screen__ring pay-card-screen__ring--delay" />
            <Wifi className={cn("relative rotate-90 text-[#7dd3fc]", compact ? "size-5" : "size-6")} strokeWidth={1.6} />
          </span>
        </div>
        <div className={cn(
          "rounded-2xl border border-cyan-300/15 bg-[#05080f] text-center",
          compact ? "px-3 py-3" : "px-4 py-5",
        )}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b7c93]">
            {phase === "waiting"
              ? t("order.card_terminal_tap")
              : phase === "processing"
                ? t("order.card_step_process")
                : t("order.card_step_approved")}
          </p>
          <p className={cn(
            "mt-2 font-semibold tracking-[-0.04em] text-[#f8fafc] tabular-nums",
            compact ? "text-[1.35rem]" : "text-[1.7rem]",
          )}>
            {amount}
          </p>
        </div>
        {mini ? null : (
        <div className={cn("grid grid-cols-3", compact ? "mt-2.5 gap-1" : "mt-3.5 gap-1.5")}>
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className={cn(
                "rounded-lg bg-white/[0.04] ring-1 ring-white/10",
                compact ? "h-5" : "h-7",
              )}
            />
          ))}
        </div>
        )}
        <div className={cn("grid grid-cols-3 gap-1.5", mini ? "mt-1.5" : "mt-2")}>
          <span className="h-2.5 rounded-full bg-[#f43f5e]/80" />
          <span className="h-2.5 rounded-full bg-[#fbbf24]/80" />
          <span className="h-2.5 rounded-full bg-[#34d399]/80" />
        </div>
      </div>
    </div>
  );
}
