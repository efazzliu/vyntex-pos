import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { useMarketingPrimaryCtaHref } from "@/hooks/use-marketing-primary-cta-href.ts";

export default function CTASection() {
  const { t } = useTranslation("site");
  const primaryCtaHref = useMarketingPrimaryCtaHref();

  return (
    <section className="py-24 sm:py-32 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground text-balance">
            {t("home.cta.titleBefore")}{" "}
            <span className="bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
              {t("home.cta.titleHighlight")}
            </span>
            {t("home.cta.titleAfter")}
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("home.cta.subtitle")}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              asChild
              className="bg-gradient-to-r from-[#0066FF] to-[#00AACC] hover:from-[#0055DD] hover:to-[#0099BB] text-white border-0 px-8 h-12 text-base shadow-lg shadow-blue-500/25"
            >
              <Link to={primaryCtaHref} className="inline-flex items-center">
                {t("home.cta.button")}
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
