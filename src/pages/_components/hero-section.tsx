import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";
import { useMarketingPrimaryCtaHref } from "@/hooks/use-marketing-primary-cta-href.ts";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#060B18]">
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

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8"
        >
          <img
            src={LOGO_URL}
            alt="Vyntex POS"
            className="w-20 h-20 sm:w-24 sm:h-24 mx-auto drop-shadow-[0_0_40px_rgba(0,102,255,0.4)]"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-[#44CC00] animate-pulse" />
          <span className="text-sm text-white/70 font-medium">{t("home.hero.badge")}</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-balance leading-[1.08] mb-6"
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
          className="text-lg sm:text-xl text-white/55 max-w-2xl mx-auto mb-10 text-balance leading-relaxed"
        >
          {t("home.hero.subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
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
          className="mt-20 relative"
        >
          <div className="relative mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/3 backdrop-blur-sm p-1.5 shadow-2xl shadow-blue-500/10">
            <div className="rounded-xl bg-gradient-to-br from-[#0A1628] to-[#0F1D32] p-6 sm:p-8">
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {MOCK_KEYS.map((key, i) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.2 + i * 0.1, duration: 0.4 }}
                    className="rounded-lg border border-white/6 bg-white/4 px-3 py-4 text-center hover:bg-white/6 transition-colors"
                  >
                    <div className="text-xs sm:text-sm text-white/40 font-medium">
                      {t(`home.hero.${key}`)}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-5 flex items-end gap-1.5 h-16 px-2">
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
