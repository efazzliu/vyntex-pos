import { motion } from "motion/react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import {
  Monitor,
  ShieldCheck,
  ShoppingBag,
  Users,
  Zap,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

type StatKey =
  | "restaurants"
  | "devices"
  | "transactions"
  | "uptime"
  | "orderProcessing";

type StatConfig = {
  key: StatKey;
  value: number;
  suffix: string;
  decimals: number;
  /** When set, render this text instead of an animated number (product fact, not traction). */
  textValue?: string;
};

const STAT_ICONS: Record<StatKey, ComponentType<LucideProps>> = {
  restaurants: Users,
  devices: Monitor,
  transactions: ShoppingBag,
  uptime: ShieldCheck,
  orderProcessing: Zap,
};

/** Shown immediately and kept if live platform stats can't be loaded — never invent traction. */
const FALLBACK_STATS: StatConfig[] = [
  { key: "restaurants", value: 0, suffix: "", decimals: 0, textValue: "—" },
  { key: "devices", value: 0, suffix: "", decimals: 0, textValue: "—" },
  { key: "transactions", value: 0, suffix: "", decimals: 0, textValue: "—" },
  { key: "uptime", value: 99.9, suffix: "%", decimals: 1 },
  { key: "orderProcessing", value: 0, suffix: "", decimals: 0, textValue: "speed" },
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
    { key: "orderProcessing", value: 0, suffix: "", decimals: 0, textValue: "speed" },
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

function StatValue({
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
      const duration = 1800;
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
        if (entry.isIntersecting) animate();
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
      <div ref={ref} className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[1.65rem]">
        {textValue}
      </div>
    );
  }

  return (
    <div ref={ref} className="text-2xl font-bold tracking-tight text-neutral-900 tabular-nums sm:text-[1.65rem]">
      {display}
      <span className="text-brand">{suffix}</span>
    </div>
  );
}

export default function StatsSection() {
  const { t } = useTranslation("site");
  const stats = useLivePlatformStats();

  return (
    <section className="border-y border-neutral-200 bg-white py-10 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col divide-y divide-neutral-200 sm:flex-row sm:items-center sm:justify-between sm:divide-x sm:divide-y-0">
          {stats.map((cfg, i) => {
            const Icon = STAT_ICONS[cfg.key];
            const displayText =
              cfg.textValue === "speed"
                ? t("home.stats.processingSpeed")
                : cfg.textValue;

            return (
              <motion.div
                key={cfg.key}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-3.5 py-5 sm:px-4 sm:py-1",
                )}
              >
                <Icon
                  className="size-8 shrink-0 text-brand sm:size-9"
                  strokeWidth={1.6}
                  aria-hidden
                />
                <div className="min-w-0 text-left">
                  <StatValue
                    value={cfg.value}
                    suffix={cfg.suffix}
                    decimals={cfg.decimals}
                    textValue={displayText}
                  />
                  <div className="mt-0.5 text-sm text-neutral-500">
                    {t(`home.stats.${cfg.key}`)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
