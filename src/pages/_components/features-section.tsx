import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  LayoutGrid,
  Monitor,
  Package,
  Printer,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const FEATURE_CARDS = [
  { id: "smartOrdering", icon: Monitor, href: "/features" },
  { id: "kitchenPrinting", icon: Printer, href: "/features" },
  { id: "tableManagement", icon: LayoutGrid, href: "/features" },
  { id: "reportsAnalytics", icon: BarChart3, href: "/features" },
  { id: "payments", icon: CreditCard, href: "/features" },
  { id: "inventory", icon: Package, href: "/features" },
] as const;

export default function FeaturesSection() {
  const { t } = useTranslation("site");

  return (
    <section className="border-b border-neutral-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="flex items-center justify-center gap-3">
            <span className="hidden h-px w-10 bg-brand/40 sm:block" aria-hidden />
            <span className="text-sm font-semibold tracking-wide text-brand">
              {t("home.features.whyLabel")}
            </span>
            <span className="hidden h-px w-10 bg-brand/40 sm:block" aria-hidden />
          </div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {t("home.features.title")}
          </h2>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className="group relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md"
              >
                <Icon className="size-8 text-brand" strokeWidth={1.6} aria-hidden />
                <h3 className="mt-5 text-lg font-bold text-neutral-950">
                  {t(`home.features.cards.${card.id}.title`)}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-500">
                  {t(`home.features.cards.${card.id}.description`)}
                </p>
                <div className="mt-6 flex justify-end">
                  <Link
                    to={card.href}
                    aria-label={t(`home.features.cards.${card.id}.title`)}
                    className="inline-flex size-9 items-center justify-center rounded-full border border-brand/25 text-brand transition-colors group-hover:border-brand group-hover:bg-brand group-hover:text-white"
                  >
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
