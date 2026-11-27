import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Gift,
  Headphones,
  Headset,
  Lock,
  MonitorSmartphone,
  Printer,
  ShieldCheck,
  Store,
  TrendingUp,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

const FAQ_ITEMS = [
  { key: "trial", icon: Gift },
  { key: "creditCard", icon: CreditCard },
  { key: "devices", icon: MonitorSmartphone },
  { key: "offline", icon: Wifi },
  { key: "printers", icon: Printer },
  { key: "locations", icon: Store },
  { key: "security", icon: Lock },
  { key: "upgrade", icon: TrendingUp },
  { key: "expiry", icon: CalendarDays },
  { key: "support", icon: Headset },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

type FaqKey = (typeof FAQ_ITEMS)[number]["key"];

const BENEFITS = [
  { id: "setup", icon: Zap },
  { id: "secure", icon: ShieldCheck },
  { id: "support", icon: Headphones },
] as const;

function QuestionIllustration() {
  return (
    <div className="relative mx-auto h-28 w-40" aria-hidden>
      <div className="absolute right-0 top-10 flex h-14 w-[4.5rem] items-center justify-center gap-1.5 rounded-2xl bg-brand/15">
        <span className="size-1.5 rounded-full bg-brand" />
        <span className="size-1.5 rounded-full bg-brand" />
        <span className="size-1.5 rounded-full bg-brand" />
        <span className="absolute -bottom-1 left-3 size-4 rotate-45 rounded-sm bg-brand/15" />
      </div>
      <div className="absolute left-2 top-0 flex size-[5.25rem] items-center justify-center rounded-3xl bg-gradient-to-br from-brand to-brand-sky shadow-[0_10px_24px_rgba(0,91,214,0.28)]">
        <span className="text-4xl font-extrabold leading-none text-white">?</span>
        <span className="absolute -bottom-1.5 left-5 size-5 rotate-45 rounded-sm bg-brand" />
      </div>
    </div>
  );
}

function FaqAccordionItem({
  itemKey,
  icon: Icon,
  open,
  onToggle,
}: {
  itemKey: FaqKey;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation("site");
  const panelId = useId();
  const buttonId = useId();

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors duration-200",
        open
          ? "border-brand/30 bg-brand/[0.05] shadow-[0_2px_10px_rgba(0,91,214,0.08)]"
          : "border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-neutral-300",
      )}
    >
      <h3 className="m-0">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left sm:px-4"
        >
          <span
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
              open ? "bg-brand/10 text-brand" : "bg-transparent text-neutral-800",
            )}
            aria-hidden
          >
            <Icon className="size-[18px]" strokeWidth={1.75} />
          </span>
          <span className="flex-1 text-sm font-semibold text-neutral-950 sm:text-[15px]">
            {t(`faqPage.items.${itemKey}.q`)}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform duration-200",
              open ? "rotate-180 text-brand" : "text-neutral-800",
            )}
            aria-hidden
          />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="pb-3.5 pl-[3.75rem] pr-5 text-[13px] leading-relaxed text-neutral-600 sm:pl-[4.25rem]">
              {t(`faqPage.items.${itemKey}.a`)}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function FaqPage() {
  const { t } = useTranslation("site");
  const [openKey, setOpenKey] = useState<FaqKey | null>("trial");

  return (
    <div className="relative overflow-hidden bg-white text-neutral-950">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 8% 4%, color-mix(in srgb, var(--brand) 9%, transparent), transparent 38%), radial-gradient(circle at 96% 0%, color-mix(in srgb, var(--brand-accent) 8%, transparent), transparent 34%), radial-gradient(circle at 60% 100%, color-mix(in srgb, var(--brand) 6%, transparent), transparent 40%)",
        }}
        aria-hidden
      />

      <section className="relative pb-8 pt-28 sm:pb-10 sm:pt-32">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/15 bg-brand/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-brand"
          >
            <CircleHelp className="size-3.5" />
            {t("faqPage.badge")}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-4 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl"
          >
            {t("faqPage.titleBefore")}{" "}
            <span className="bg-gradient-to-r from-brand to-brand-sky bg-clip-text text-transparent">
              {t("faqPage.titleHighlight")}
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-3 max-w-xl text-base text-neutral-500 sm:text-lg"
          >
            {t("faqPage.subtitle")}
          </motion.p>
        </div>
      </section>

      <section className="relative pb-16 pt-4 sm:pb-24">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:px-6 lg:grid-cols-[17.5rem_1fr] lg:items-start lg:gap-8 lg:px-8">
          <aside className="lg:sticky lg:top-28">
            <div className="rounded-3xl border border-neutral-200/70 bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.07)]">
              <QuestionIllustration />

              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-neutral-950">
                {t("faqPage.sidebar.title")}
              </h2>
              <p className="mt-1.5 text-sm leading-snug text-neutral-500">
                {t("faqPage.sidebar.description")}
              </p>

              <ul className="mt-5 space-y-4">
                {BENEFITS.map(({ id, icon: Icon }) => (
                  <li key={id} className="flex items-center gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                      <Icon className="size-[18px]" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-tight text-neutral-950">
                        {t(`faqPage.sidebar.benefits.${id}.title`)}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-neutral-500">
                        {t(`faqPage.sidebar.benefits.${id}.description`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-2xl border border-brand/10 bg-gradient-to-br from-brand/[0.07] to-brand-accent/[0.06] p-4">
                <p className="text-sm font-bold text-neutral-950">
                  {t("faqPage.sidebar.helpTitle")}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {t("faqPage.sidebar.helpDescription")}
                </p>
                <Link
                  to="/contact"
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-brand bg-white px-3 text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
                >
                  <Headphones className="size-4" />
                  {t("faqPage.sidebar.helpCta")}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-2.5">
            {FAQ_ITEMS.map(({ key, icon }) => (
              <FaqAccordionItem
                key={key}
                itemKey={key}
                icon={icon}
                open={openKey === key}
                onToggle={() => setOpenKey((prev) => (prev === key ? null : key))}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
