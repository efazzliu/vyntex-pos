import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const PREVIEW_KEYS = ["trial", "devices", "locations"] as const;

function FaqPreviewItem({
  itemKey,
  open,
  onToggle,
}: {
  itemKey: (typeof PREVIEW_KEYS)[number];
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation("site");
  const panelId = useId();
  const buttonId = useId();

  return (
    <div
      className={cn(
        "rounded-xl border bg-white transition-[border-color,box-shadow]",
        open
          ? "border-brand/40 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          : "border-neutral-200",
      )}
    >
      <h3 className="m-0">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5"
        >
          <span className="text-sm font-semibold text-neutral-950 sm:text-[15px]">
            {t(`home.faq.previewItems.${itemKey}.q`)}
          </span>
          <span
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-brand",
              open ? "border-brand/40 bg-brand/10" : "border-neutral-200 bg-transparent",
            )}
            aria-hidden
          >
            {open ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
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
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="border-t border-neutral-100 px-4 pb-4 pt-3 text-sm leading-relaxed text-neutral-500 sm:px-5">
              {t(`home.faq.previewItems.${itemKey}.a`)}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function FaqSection() {
  const { t } = useTranslation("site");
  const [openKey, setOpenKey] = useState<(typeof PREVIEW_KEYS)[number] | null>(null);

  return (
    <section id="faq" className="scroll-mt-24 border-b border-neutral-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-8 lg:grid-cols-[0.85fr_1.4fr_auto] lg:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="max-w-sm"
          >
            <h2 className="text-balance text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">
              {t("home.faq.titleBefore")}{" "}
              <span className="bg-gradient-to-r from-brand to-brand-sky bg-clip-text text-transparent">
                {t("home.faq.titleHighlight")}
              </span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-500 sm:text-[15px]">
              {t("home.faq.previewSubtitle")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="flex min-w-0 flex-col gap-2.5"
          >
            {PREVIEW_KEYS.map((key) => (
              <FaqPreviewItem
                key={key}
                itemKey={key}
                open={openKey === key}
                onToggle={() => setOpenKey((prev) => (prev === key ? null : key))}
              />
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="flex lg:h-full lg:items-center lg:justify-end"
          >
            <Link
              to="/faq"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-brand px-5 text-sm font-semibold text-brand transition-colors hover:bg-brand/5 sm:w-auto"
            >
              {t("home.faq.viewAll")}
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
