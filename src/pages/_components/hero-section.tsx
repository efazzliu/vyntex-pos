import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";
import { useMarketingPrimaryCtaHref } from "@/hooks/use-marketing-primary-cta-href.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

const MOCK_KEYS = [
  "mockOrders",
  "mockTables",
  "mockMenu",
  "mockPayments",
  "mockAnalytics",
  "mockStaff",
] as const;

export default function HeroSection() {
  const { t } = useTranslation("site");
  const primaryCtaHref = useMarketingPrimaryCtaHref();

  return (
    <section className="relative flex min-h-[640px] items-start justify-center overflow-hidden bg-[#060B18]">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#060B18] via-[#0A1628] to-[#060B18]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <motion.div
          animate={{
            x: [0, 120, -60, 0],
            y: [0, -100, 60, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#0066FF]/15 blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -100, 80, 0],
            y: [0, 120, -80, 0],
            scale: [1, 0.9, 1.15, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#44CC00]/12 blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, 60, -80, 0], y: [0, -50, 90, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[#0099CC]/8 blur-[100px]"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-8 pt-20 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-4"
        >
          <img
            src={VYNTEX_APP_LOGO_SRC}
            alt="Vyntex POS"
            className="mx-auto h-14 w-14 drop-shadow-[0_0_36px_rgba(0,102,255,0.45)] sm:h-16 sm:w-16"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-1.5 backdrop-blur-sm"
        >
          <span className="w-2 h-2 rounded-full bg-[#44CC00] animate-pulse" />
          <span className="text-sm text-white/70 font-medium">{t("home.hero.badge")}</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="mb-4 text-balance text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl md:text-6xl"
        >
          <span className="text-white">{t("home.hero.line1")}</span>
          <br />
          <span className="bg-gradient-to-r from-[#0066FF] via-[#00AACC] to-[#44CC00] bg-clip-text text-transparent">
            {t("home.hero.line2")}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mx-auto mb-7 max-w-xl text-balance text-base leading-relaxed text-white/65 sm:text-lg"
        >
          {t("home.hero.subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button
            size="lg"
            asChild
            className="bg-gradient-to-r from-[#0066FF] to-[#00AACC] hover:from-[#0055DD] hover:to-[#0099BB] text-white border-0 px-8 h-12 text-base shadow-lg shadow-blue-500/25"
          >
            <Link to={primaryCtaHref} className="inline-flex items-center">
              {t("home.hero.ctaPrimary")}
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => toast.info(t("home.hero.demoToast"))}
            className="text-white/60 hover:text-white hover:bg-white/10 px-8 h-12 text-base"
          >
            <Play className="mr-1 size-4" />
            {t("home.hero.ctaDemo")}
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="relative mt-8"
        >
          <div className="relative mx-auto max-w-4xl rounded-2xl border border-white/15 bg-white/[0.04] p-1.5 shadow-2xl shadow-blue-500/10 backdrop-blur-sm">
            <div className="rounded-xl bg-gradient-to-br from-[#0A1628] to-[#0F1D32] p-5 sm:p-6">
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {MOCK_KEYS.map((key, i) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.2 + i * 0.1, duration: 0.4 }}
                    className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-3 text-center transition-colors hover:bg-white/[0.08]"
                  >
                    <div className="text-xs font-medium text-white/55 sm:text-sm">
                      {t(`home.hero.${key}`)}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 flex h-14 items-end gap-1.5 px-2">
                {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 50].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{
                      delay: 1.5 + i * 0.05,
                      duration: 0.6,
                      ease: "easeOut",
                    }}
                    className="flex-1 rounded-t bg-gradient-to-t from-[#0066FF]/30 to-[#44CC00]/30"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="absolute -inset-8 bg-gradient-to-r from-[#0066FF]/8 via-transparent to-[#44CC00]/8 blur-3xl -z-10 rounded-3xl" />
        </motion.div>
      </div>
    </section>
  );
}
