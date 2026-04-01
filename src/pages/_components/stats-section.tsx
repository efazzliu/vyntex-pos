import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const stats = [
  { value: 2500, suffix: "+", label: "Restaurants Served", decimals: 0 },
  { value: 99.9, suffix: "%", label: "Uptime Guaranteed", decimals: 1 },
  { value: 12, suffix: "M+", label: "Transactions Processed", decimals: 0 },
  { value: 45, suffix: "+", label: "Countries Worldwide", decimals: 0 },
];

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
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frameId: number;
    let cancelled = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const startTime = performance.now();

          const step = (timestamp: number) => {
            if (cancelled) return;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * value;

            setDisplay(
              decimals > 0
                ? current.toFixed(decimals)
                : Math.floor(current).toLocaleString()
            );

            if (progress < 1) {
              frameId = requestAnimationFrame(step);
            }
          };

          frameId = requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
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
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Dark gradient background */}
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
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="text-center"
            >
              <AnimatedCounter
                value={stat.value}
                suffix={stat.suffix}
                decimals={stat.decimals}
              />
              <div className="mt-2 text-sm sm:text-base text-white/50">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
