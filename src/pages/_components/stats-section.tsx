import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

type StatConfig = {
  key: string;
  value: number;
  suffix: string;
  decimals: number;
  /** When set, render this text instead of an animated number (product fact, not traction). */
  textValue?: string;
};

/** Shown immediately and kept if live platform stats can't be loaded (e.g. before the
 * `vyntex_public_platform_stats` migration is applied) — real facts, never invented traction. */
const FALLBACK_STATS: StatConfig[] = [
  { key: "restaurants", value: 0, suffix: "", decimals: 0, textValue: "—" },
  { key: "devices", value: 0, suffix: "", decimals: 0, textValue: "—" },
  { key: "transactions", value: 0, suffix: "", decimals: 0, textValue: "—" },
  { key: "uptime", value: 99.9, suffix: "%", decimals: 1 },
  { key: "orderProcessing", value: 0, suffix: "", decimals: 0, textValue: "live" },
];

type PlatformStats = {
  restaurants: number;
  paid_orders: number;
  countries?: number;
  devices?: number;
};

function buildLiveStats(data: PlatformStats): StatConfig[] {
  const devices = typeof data.devices === "number" ? data.devices : 0;
  return [
    { key: "restaurants", value: data.restaurants, suffix: "+", decimals: 0 },
    { key: "devices", value: Math.max(devices, 0), suffix: "+", decimals: 0 },
    { key: "transactions", value: data.paid_orders, suffix: "+", decimals: 0 },
    { key: "uptime", value: 99.9, suffix: "%", decimals: 1 },
    { key: "orderProcessing", value: 0, suffix: "", decimals: 0, textValue: "live" },
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
  textValue,
}: {
  value: number;
  suffix: string;
  decimals: number;
  textValue?: string;
}) {
  const [display, setDisplay] = useState("0");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textValue) return;
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
  }, [value, decimals, textValue]);

  if (textValue) {
    return (
      <div
        ref={ref}
        className="text-4xl sm:text-5xl font-bold tabular-nums bg-gradient-to-r from-brand to-brand-accent bg-clip-text text-transparent"
      >
        {textValue}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="text-4xl sm:text-5xl font-bold text-white tabular-nums"
    >
      {display}
      <span className="bg-gradient-to-r from-brand to-brand-accent bg-clip-text text-transparent">
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
            "radial-gradient(ellipse at center, rgba(0,91,214,0.08), transparent 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10">
          {stats.map((cfg, i) => (
            <motion.div
              key={cfg.key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="text-center"
            >
              <AnimatedCounter
                value={cfg.value}
                suffix={cfg.suffix}
                decimals={cfg.decimals}
                textValue={
                  cfg.textValue === "live"
                    ? t("home.stats.liveValue")
                    : cfg.textValue
                }
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
