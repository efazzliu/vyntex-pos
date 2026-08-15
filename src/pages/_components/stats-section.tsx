import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

type StatConfig = { key: string; value: number; suffix: string; decimals: number };

/** Shown immediately and kept if live platform stats can't be loaded (e.g. before the
 * `vyntex_public_platform_stats` migration is applied) — real facts, never invented traction. */
const FALLBACK_STATS: StatConfig[] = [
  { key: "modules", value: 6, suffix: "", decimals: 0 },
  { key: "uptime", value: 99.9, suffix: "%", decimals: 1 },
  { key: "trial", value: 1, suffix: "", decimals: 0 },
  { key: "support", value: 24, suffix: "/7", decimals: 0 },
];

type PlatformStats = {
  restaurants: number;
  paid_orders: number;
  countries: number;
};

function buildLiveStats(data: PlatformStats): StatConfig[] {
  return [
    { key: "restaurants", value: data.restaurants, suffix: "+", decimals: 0 },
    { key: "uptime", value: 99.9, suffix: "%", decimals: 1 },
    { key: "transactions", value: data.paid_orders, suffix: "+", decimals: 0 },
    { key: "countries", value: Math.max(data.countries, 1), suffix: "+", decimals: 0 },
  ];
}

function useLivePlatformStats(): StatConfig[] {
  const [stats, setStats] = useState<StatConfig[]>(FALLBACK_STATS);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase.rpc("vyntex_public_platform_stats");
        if (cancelled || error || !data) return;
        const parsed = data as PlatformStats;
        if (typeof parsed.restaurants !== "number" || parsed.restaurants <= 0) return;
        setStats(buildLiveStats(parsed));
      } catch {
        // RPC not deployed yet, or offline — keep the static fallback stats.
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}

function AnimatedCounter({
  value,
  suffix,
  decimals,
}: {
  value: number;
  suffix: string;
  decimals: number;
}) {
  const [display, setDisplay] = useState("0");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frameId: number;
    let cancelled = false;

    const animate = () => {
      const duration = 2000;
      const startTime = performance.now();

      const step = (timestamp: number) => {
        if (cancelled) return;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = eased * value;

        setDisplay(
          decimals > 0
            ? current.toFixed(decimals)
            : Math.floor(current).toLocaleString(),
        );

        if (progress < 1) {
          frameId = requestAnimationFrame(step);
        }
      };

      frameId = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animate();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, [value, decimals]);

  return (
    <div
      ref={ref}
      className="text-4xl sm:text-5xl font-bold text-white tabular-nums"
    >
      {display}
      <span className="bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
        {suffix}
      </span>
    </div>
  );
}

export default function StatsSection() {
  const { t } = useTranslation("site");
  const stats = useLivePlatformStats();

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-[#060B18] via-[#0A1628] to-[#060B18]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,102,255,0.08), transparent 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((cfg, i) => (
            <motion.div
              key={cfg.key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="text-center"
            >
              <AnimatedCounter
                value={cfg.value}
                suffix={cfg.suffix}
                decimals={cfg.decimals}
              />
              <div className="mt-2 text-sm sm:text-base text-white/50">
                {t(`home.stats.${cfg.key}`)}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
