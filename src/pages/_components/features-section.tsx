import { motion } from "motion/react";
import {
  ClipboardList,
  CreditCard,
  BarChart3,
  Package,
  MapPin,
  LayoutGrid,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const FEATURE_KEYS = [
  "smart_order",
  "payments",
  "analytics",
  "inventory",
  "multi_location",
  "floor",
] as const;

const icons = [
  ClipboardList,
  CreditCard,
  BarChart3,
  Package,
  MapPin,
  LayoutGrid,
] as const;

export default function FeaturesSection() {
  const { t } = useTranslation("site");

  return (
    <section className="py-24 sm:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
              {t("home.features.label")}
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {t("home.features.title")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("home.features.subtitle")}
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURE_KEYS.map((key, i) => {
            const Icon = icons[i];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group relative rounded-xl border border-border bg-card p-6 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 group-hover:from-[#0066FF]/20 group-hover:to-[#44CC00]/20 transition-colors">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {t(`home.features.${key}.title`)}
                  </h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(`home.features.${key}.description`)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
