import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils.ts";

/** Homepage FAQ preview — Ultra Premium Minimal red identity. */
const ACCENT = "#D7192D";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const INK = "#111111";

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
        open ? "shadow-[0_1px_2px_rgba(17,17,17,0.04)]" : "",
      )}
      style={{ borderColor: open ? `${ACCENT}66` : BORDER }}
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
          <span className="text-sm font-semibold sm:text-[15px]" style={{ color: INK }}>
            {t(`home.faq.previewItems.${itemKey}.q`)}
          </span>
          <span
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border"
            style={{
              borderColor: open ? `${ACCENT}55` : BORDER,
              color: ACCENT,
              backgroundColor: open ? `${ACCENT}0F` : "transparent",
            }}
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
            <p
              className="border-t px-4 pb-4 pt-3 text-sm leading-relaxed sm:px-5"
              style={{ borderColor: BORDER, color: MUTED }}
            >
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
    <section id="faq" className="scroll-mt-24 bg-white py-16 sm:py-20" data-faq-preview="light">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-8 lg:grid-cols-[0.85fr_1.4fr_auto] lg:gap-10">
          {/* Left — title */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="max-w-sm"
          >
            <h2
              className="text-balance text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ color: INK }}
            >
              {t("home.faq.titleBefore")}{" "}
              <span style={{ color: ACCENT }}>{t("home.faq.titleHighlight")}</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed sm:text-[15px]" style={{ color: MUTED }}>
              {t("home.faq.previewSubtitle")}
            </p>
          </motion.div>

          {/* Center — 3 accordion items */}
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

          {/* Right — View All */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="flex lg:h-full lg:items-center lg:justify-end"
          >
            <Link
              to="/faq"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border-2 px-5 text-sm font-semibold transition-colors hover:bg-[#D7192D]/[0.06] sm:w-auto lg:w-auto"
              style={{ borderColor: ACCENT, color: ACCENT }}
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
