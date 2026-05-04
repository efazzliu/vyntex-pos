import { motion } from "motion/react";
import {
  UtensilsCrossed,
  Coffee,
  Wine,
  Hotel,
  Dumbbell,
  Check,
  ArrowRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import PageHeader from "@/components/page-header.tsx";
import { useNavigate } from "react-router-dom";

const COMING_KEYS = ["coffee", "bar", "hotel", "fitness"] as const;
const COMING_ICONS = [Coffee, Wine, Hotel, Dumbbell] as const;

export default function VynTypesPage() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();

  const restaurantFeatures = t("vynTypes.restaurant.features", {
    returnObjects: true,
  }) as string[];

  return (
    <>
      <PageHeader
        badge={t("vynTypes.badge")}
        title={t("vynTypes.title")}
        subtitle={t("vynTypes.subtitle")}
      />

      <section className="pb-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-2xl border-2 border-[#0066FF]/30 bg-card p-8 lg:p-12 mb-16 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0066FF] to-[#44CC00]" />

            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
                    <UtensilsCrossed className="size-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {t("vynTypes.restaurant.name")}
                    </h2>
                    <Badge className="bg-[#44CC00]/10 text-[#44CC00] border-[#44CC00]/20 hover:bg-[#44CC00]/15">
                      {t("vynTypes.active")}
                    </Badge>
                  </div>
                </div>
                <p className="text-muted-foreground mb-6 max-w-lg">
                  {t("vynTypes.restaurant.description")}
                </p>
                <Button
                  size="lg"
                  onClick={() => navigate("/pricing")}
                  className="bg-gradient-to-r from-[#0066FF] to-[#00AACC] hover:from-[#0055DD] hover:to-[#0099BB] text-white border-0"
                >
                  {t("vynTypes.viewPlans")}
                  <ArrowRight className="ml-1 size-4" />
                </Button>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  {t("vynTypes.included")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.isArray(restaurantFeatures) &&
                    restaurantFeatures.map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <Check className="size-4 text-[#44CC00] shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </motion.div>

          <div>
            <h3 className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent mb-6">
              {t("vynTypes.comingSoon")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {COMING_KEYS.map((key, i) => {
                const Icon = COMING_ICONS[i];
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="rounded-xl border border-border bg-card p-6 opacity-75"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
                      <Icon className="size-5 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-foreground">
                        {t(`vynTypes.${key}.name`)}
                      </h4>
                      <Badge variant="secondary" className="text-xs">
                        {t("vynTypes.soon")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t(`vynTypes.${key}.description`)}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
