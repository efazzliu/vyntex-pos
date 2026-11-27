import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import {
  ArrowRight,
  BedDouble,
  Check,
  Coffee,
  Layers,
  Rocket,
  Sandwich,
  ShieldCheck,
  UtensilsCrossed,
  Wine,
  CakeSlice,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

const TYPE_KEYS = [
  "restaurant",
  "cafe",
  "bar",
  "hotel",
  "fastFood",
  "bakery",
] as const;

const TYPE_ICONS: Record<(typeof TYPE_KEYS)[number], LucideIcon> = {
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  bar: Wine,
  hotel: BedDouble,
  fastFood: Sandwich,
  bakery: CakeSlice,
};

/** Venue photography — Unsplash, cropped for card masks. */
const TYPE_IMAGES: Record<(typeof TYPE_KEYS)[number], string> = {
  restaurant:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&h=700&fit=crop&q=80",
  cafe:
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&h=700&fit=crop&q=80",
  bar:
    "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=900&h=700&fit=crop&q=80",
  hotel:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&h=700&fit=crop&q=80",
  fastFood:
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=900&h=700&fit=crop&q=80",
  bakery:
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&h=700&fit=crop&q=80",
};

const HIGHLIGHT_KEYS = [
  { id: "flexible", icon: Zap },
  { id: "workflows", icon: Layers },
  { id: "setup", icon: Rocket },
  { id: "secure", icon: ShieldCheck },
] as const;

function VynTypeCard({
  typeKey,
  index,
}: {
  typeKey: (typeof TYPE_KEYS)[number];
  index: number;
}) {
  const { t } = useTranslation("site");
  const Icon = TYPE_ICONS[typeKey];
  const tags = t(`vynTypes.types.${typeKey}.tags`, { returnObjects: true }) as string[];

  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: index * 0.06, duration: 0.45 }}
      className="group relative flex min-h-[220px] overflow-hidden rounded-[1.35rem] border border-neutral-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] sm:min-h-[240px]"
    >
      {/* Text column */}
      <div className="relative z-10 flex w-[58%] flex-col justify-between p-5 sm:w-[55%] sm:p-6 lg:p-7">
        <div>
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
          <h3 className="mt-4 text-lg font-bold tracking-tight text-neutral-950 sm:text-xl">
            {t(`vynTypes.types.${typeKey}.name`)}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
            {t(`vynTypes.types.${typeKey}.description`)}
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {Array.isArray(tags) &&
              tags.map((tag) => (
                <li
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand/[0.04] px-2.5 py-1 text-xs font-medium text-neutral-800"
                >
                  <Check className="size-3 text-brand" strokeWidth={2.5} />
                  {tag}
                </li>
              ))}
          </ul>
        </div>
        <div className="mt-5">
          <Link
            to="/pricing"
            aria-label={t(`vynTypes.types.${typeKey}.name`)}
            className="inline-flex size-10 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand/90"
          >
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      {/* Diagonal image */}
      <div
        className="absolute inset-y-0 right-0 w-[48%] sm:w-[50%]"
        style={{
          clipPath: "polygon(18% 0%, 100% 0%, 100% 100%, 0% 100%)",
        }}
      >
        <img
          src={TYPE_IMAGES[typeKey]}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          decoding="async"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/25 to-transparent"
          aria-hidden
        />
      </div>
    </motion.article>
  );
}

export default function VynTypesPage() {
  const { t } = useTranslation("site");

  return (
    <div className="bg-white text-neutral-950">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-neutral-100 pt-28 pb-12 sm:pt-32 sm:pb-14">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 85% 12%, color-mix(in srgb, var(--brand) 9%, transparent), transparent 42%), radial-gradient(circle at 10% 88%, color-mix(in srgb, var(--brand-accent) 8%, transparent), transparent 40%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-brand"
          >
            <Layers className="size-3.5" />
            {t("vynTypes.badge")}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            {t("vynTypes.titleBefore")}{" "}
            <span className="bg-gradient-to-r from-brand to-brand-sky bg-clip-text text-transparent">
              {t("vynTypes.titleHighlight")}
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-base text-neutral-500 sm:text-lg"
          >
            {t("vynTypes.subtitle")}
          </motion.p>
        </div>
      </section>

      {/* Cards grid */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 sm:px-6 md:grid-cols-2 md:gap-6 lg:px-8">
          {TYPE_KEYS.map((key, i) => (
            <VynTypeCard key={key} typeKey={key} index={i} />
          ))}
        </div>
      </section>

      {/* Bottom highlights */}
      <section className="pb-20 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className={cn(
              "grid grid-cols-1 gap-6 rounded-2xl border border-neutral-200 bg-neutral-50/90 px-5 py-6",
              "sm:grid-cols-2 sm:gap-0 sm:px-2 sm:py-5",
              "lg:grid-cols-4",
            )}
          >
            {HIGHLIGHT_KEYS.map(({ id, icon: Icon }, i) => (
              <div
                key={id}
                className={cn(
                  "flex items-start gap-3 px-3 sm:px-5",
                  i > 0 && "sm:border-l sm:border-neutral-200",
                )}
              >
                <span className="mt-0.5 inline-flex shrink-0 text-brand">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-bold text-neutral-950">
                    {t(`vynTypes.highlights.${id}.title`)}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">
                    {t(`vynTypes.highlights.${id}.description`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
