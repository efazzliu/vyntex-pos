import { motion } from "motion/react";
import { Shield, Zap, Heart, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import PageHeader from "@/components/page-header.tsx";

const VALUE_KEYS = ["innovation", "reliability", "customer", "global"] as const;
const VALUE_ICONS = [Zap, Shield, Heart, Globe] as const;

export default function AboutPage() {
  const { t } = useTranslation("site");

  const milestones = t("about.milestones", { returnObjects: true }) as {
    year: string;
    event: string;
  }[];

  return (
    <>
      <PageHeader
        badge={t("about.badge")}
        title={t("about.title")}
        subtitle={t("about.subtitle")}
      />

      <section className="pb-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center mb-20"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
              {t("about.storyTitle")}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t("about.storyP1")}
            </p>
            <p className="text-muted-foreground leading-relaxed">{t("about.storyP2")}</p>
          </motion.div>

          <div className="mb-20">
            <h3 className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent text-center mb-10">
              {t("about.valuesLabel")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {VALUE_KEYS.map((key, i) => {
                const Icon = VALUE_ICONS[i];
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="rounded-xl border border-border bg-card p-6"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
                        <Icon className="size-5 text-primary" />
                      </div>
                      <h4 className="text-lg font-semibold text-foreground">
                        {t(`about.values.${key}.title`)}
                      </h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t(`about.values.${key}.description`)}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent text-center mb-10">
              {t("about.journeyLabel")}
            </h3>
            <div className="max-w-2xl mx-auto space-y-0">
              {Array.isArray(milestones) &&
                milestones.map((m, i) => (
                  <motion.div
                    key={m.year + m.event}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="flex gap-6 pb-8 last:pb-0"
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#0066FF] to-[#44CC00] shrink-0 mt-1.5" />
                      {i < milestones.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-2" />
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-primary">{m.year}</span>
                      <p className="text-sm text-muted-foreground mt-0.5">{m.event}</p>
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
