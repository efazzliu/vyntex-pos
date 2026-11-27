import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Clock3,
  Headphones,
  Minus,
  Plus,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

/** FAQ page accent — matches the requested premium FAQ reference. */
const ACCENT = "#D7192D";

const FAQ_KEYS = [
  "trial",
  "creditCard",
  "devices",
  "offline",
  "printers",
  "locations",
  "security",
  "upgrade",
  "expiry",
  "support",
] as const;

const BENEFITS = [
  { id: "setup", icon: Zap },
  { id: "secure", icon: ShieldCheck },
  { id: "support", icon: Headphones },
] as const;

function FaqAccordionItem({
  itemKey,
  open,
  onToggle,
}: {
  itemKey: (typeof FAQ_KEYS)[number];
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation("site");
  const panelId = useId();
  const buttonId = useId();

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white transition-shadow",
        open
          ? "shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          : "border-neutral-200",
      )}
      style={open ? { borderColor: `${ACCENT}55` } : undefined}
    >
      <h3 className="m-0">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        >
          <span className="text-sm font-semibold text-neutral-950 sm:text-[15px]">
            {t(`faqPage.items.${itemKey}.q`)}
          </span>
          <span
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border"
            style={{
              borderColor: open ? `${ACCENT}55` : "#E5E7EB",
              color: ACCENT,
              backgroundColor: open ? `${ACCENT}0F` : "transparent",
            }}
            aria-hidden
          >
            {open ? <Minus className="size-4" /> : <Plus className="size-4" />}
          </span>
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
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="border-t border-neutral-100 px-5 pb-5 pt-3 text-sm leading-relaxed text-neutral-500">
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
  const [openKey, setOpenKey] = useState<(typeof FAQ_KEYS)[number] | null>("trial");

  return (
    <div className="bg-white text-neutral-950" data-faq-page="light">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-neutral-200 pt-28 pb-14 sm:pt-32 sm:pb-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(215,25,45,0.06), transparent 40%), radial-gradient(circle at 80% 0%, rgba(15,23,42,0.04), transparent 35%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
            style={{ borderColor: `${ACCENT}33`, color: ACCENT, backgroundColor: `${ACCENT}0D` }}
          >
            {t("faqPage.badge")}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            {t("faqPage.titleBefore")}{" "}
            <span style={{ color: ACCENT }}>{t("faqPage.titleHighlight")}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-xl text-base text-neutral-500 sm:text-lg"
          >
            {t("faqPage.subtitle")}
          </motion.p>
        </div>
      </section>

      {/* Main two-column */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.35fr] lg:gap-10 lg:px-8">
          {/* Left support */}
          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <h2 className="text-xl font-bold tracking-tight text-neutral-950">
                {t("faqPage.sidebar.title")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {t("faqPage.sidebar.description")}
              </p>

              <ul className="mt-6 space-y-5">
                {BENEFITS.map(({ id, icon: Icon }) => (
                  <li key={id} className="flex gap-3">
                    <span
                      className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${ACCENT}12`, color: ACCENT }}
                    >
                      <Icon className="size-4" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-neutral-950">
                        {t(`faqPage.sidebar.benefits.${id}.title`)}
                      </p>
                      <p className="mt-0.5 text-sm text-neutral-500">
                        {t(`faqPage.sidebar.benefits.${id}.description`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-[#FAFAFA] p-5">
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${ACCENT}12`, color: ACCENT }}
                >
                  <Clock3 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-950">
                    {t("faqPage.sidebar.helpTitle")}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {t("faqPage.sidebar.helpDescription")}
                  </p>
                  <Button
                    asChild
                    className="mt-4 h-10 rounded-full px-5 font-semibold text-white"
                    style={{ backgroundColor: ACCENT }}
                  >
                    <Link to="/contact" className="inline-flex items-center gap-1.5">
                      {t("faqPage.sidebar.helpCta")}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </aside>

          {/* Right accordion */}
          <div className="space-y-3">
            {FAQ_KEYS.map((key) => (
              <FaqAccordionItem
                key={key}
                itemKey={key}
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
