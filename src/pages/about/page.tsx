import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CalendarDays,
  Eye,
  Gift,
  Info,
  Layers,
  PlayCircle,
  ShieldCheck,
  Store,
  Target,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";
import { useMarketingPrimaryCtaHref } from "@/hooks/use-marketing-primary-cta-href.ts";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=1400&h=900&fit=crop&q=80";
const STORY_IMAGE =
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1100&h=800&fit=crop&q=80";
const CTA_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=700&fit=crop&q=80";

const HERO_CLIP_ID = "about-hero-clip";

const STATS = [
  { id: "plans", icon: Layers },
  { id: "types", icon: Store },
  { id: "trial", icon: Gift },
  { id: "uptime", icon: ShieldCheck },
] as const;

const VALUES = [
  { id: "innovation", icon: Zap },
  { id: "reliability", icon: ShieldCheck },
  { id: "customer", icon: Users },
  { id: "growth", icon: TrendingUp },
] as const;

type IconComponent = ComponentType<{ className?: string }>;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SectionBadge({ icon: Icon, children }: { icon: IconComponent; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/15 bg-brand/10 px-3.5 py-1.5 text-xs font-bold text-brand">
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

function PillarCard({
  id,
  icon: Icon,
  title,
  text,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
      className="flex scroll-mt-28 items-start gap-4"
    >
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <Icon className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-extrabold leading-tight text-neutral-950">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{text}</p>
      </div>
    </motion.div>
  );
}

export default function AboutPage() {
  const { t } = useTranslation("site");
  const primaryCtaHref = useMarketingPrimaryCtaHref();
  const timeline = t("about.timeline", { returnObjects: true }) as {
    date: string;
    title: string;
    text: string;
  }[];

  return (
    <div className="relative overflow-hidden bg-white text-neutral-950">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 6% 6%, color-mix(in srgb, var(--brand) 9%, transparent), transparent 34%), radial-gradient(circle at 92% 46%, color-mix(in srgb, var(--brand-accent) 6%, transparent), transparent 34%)",
        }}
        aria-hidden
      />

      <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
        <defs>
          <clipPath id={HERO_CLIP_ID} clipPathUnits="objectBoundingBox">
            <path d="M0.36,0 L1,0 L1,1 L0,1 C0.13,0.84 0.27,0.38 0.36,0 Z" />
          </clipPath>
        </defs>
      </svg>

      <section className="relative pb-8 pt-28 sm:pt-32 lg:pb-10">
        <div
          className="pointer-events-none absolute right-0 top-16 hidden h-[17rem] w-[56%] lg:block xl:h-[19rem]"
          aria-hidden
        >
          <div
            className="absolute inset-0 -translate-x-1 bg-gradient-to-b from-brand to-brand-accent"
            style={{ clipPath: `url(#${HERO_CLIP_ID})` }}
          />
          <div className="absolute inset-0" style={{ clipPath: `url(#${HERO_CLIP_ID})` }}>
            <img
              src={HERO_IMAGE}
              alt=""
              className="h-full w-full object-cover object-[60%_50%]"
              decoding="async"
              fetchPriority="high"
            />
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex"
            >
              <SectionBadge icon={Info}>{t("about.heroBadge")}</SectionBadge>
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl"
            >
              {t("about.heroLine1")}
              <br />
              {t("about.heroLine2Before")}{" "}
              <span className="bg-gradient-to-r from-brand to-brand-sky bg-clip-text text-transparent">
                {t("about.heroHighlight")}
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 max-w-md text-[15px] leading-relaxed text-neutral-600"
            >
              {t("about.heroSubtitle")}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-6 flex flex-wrap items-center gap-3"
            >
              <button
                type="button"
                onClick={() => scrollToId("mission")}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-brand to-brand-sky px-6 text-sm font-bold text-white shadow-[0_8px_20px_rgba(0,91,214,0.28)] transition-opacity hover:opacity-90"
              >
                <Target className="size-4" />
                {t("about.ctaMission")}
              </button>
              <button
                type="button"
                onClick={() => scrollToId("story")}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-brand/40 bg-white px-6 text-sm font-bold text-brand transition-colors hover:bg-brand/5"
              >
                <PlayCircle className="size-4" />
                {t("about.ctaStory")}
              </button>
            </motion.div>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl lg:hidden">
            <img
              src={HERO_IMAGE}
              alt=""
              className="h-44 w-full object-cover sm:h-56"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-6xl space-y-10 px-4 pb-16 sm:px-6 lg:space-y-12 lg:px-8">
        <motion.ul
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="grid grid-cols-2 gap-y-5 rounded-2xl border border-neutral-200/80 bg-white px-4 py-4 shadow-[0_6px_24px_rgba(15,23,42,0.05)] lg:grid-cols-4 lg:gap-y-0 lg:px-6"
        >
          {STATS.map(({ id, icon: Icon }) => (
            <li
              key={id}
              className="flex items-center justify-center gap-3 lg:border-r lg:border-neutral-200/80 lg:last:border-r-0"
            >
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xl font-extrabold leading-none text-neutral-950">
                  {t(`about.stats.${id}.value`)}
                </span>
                <span className="mt-1 block text-xs leading-tight text-neutral-500">
                  {t(`about.stats.${id}.label`)}
                </span>
              </span>
            </li>
          ))}
        </motion.ul>

        <div className="grid gap-8 px-1 md:grid-cols-2 md:gap-0">
          <div className="md:pr-10">
            <PillarCard
              id="mission"
              icon={Target}
              title={t("about.missionTitle")}
              text={t("about.missionText")}
            />
          </div>
          <div className="md:border-l md:border-neutral-200/80 md:pl-10">
            <PillarCard
              id="vision"
              icon={Eye}
              title={t("about.visionTitle")}
              text={t("about.visionText")}
            />
          </div>
        </div>

        <motion.section
          id="story"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid scroll-mt-28 items-center gap-6 rounded-3xl border border-brand/10 bg-gradient-to-br from-brand/[0.06] via-white to-white p-3 shadow-[0_10px_40px_rgba(0,91,214,0.08)] md:grid-cols-[1.05fr_1fr] md:gap-8 md:p-4"
        >
          <div className="relative overflow-hidden rounded-2xl">
            <img
              src={STORY_IMAGE}
              alt=""
              className="h-64 w-full object-cover md:h-72"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white/60 via-white/10 to-transparent" />
            <img
              src={VYNTEX_APP_LOGO_SRC}
              alt="VyntexPOS"
              className="absolute left-5 top-1/2 h-14 w-auto -translate-y-1/2 rounded-xl bg-white/90 p-2.5 shadow-lg backdrop-blur-sm sm:h-16"
              decoding="async"
            />
          </div>

          <div className="px-2 pb-3 md:px-0 md:pb-0 md:pr-6">
            <SectionBadge icon={Users}>{t("about.storyBadge")}</SectionBadge>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
              {t("about.storyTitle")}
            </h2>
            <ol className="mt-4">
              {timeline.map((item, i) => (
                <li key={item.date} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 size-3 shrink-0 rounded-full bg-gradient-to-br from-brand to-brand-accent ring-4 ring-brand/10" />
                    <span className="mt-1 w-px flex-1 bg-gradient-to-b from-brand/40 to-neutral-200" />
                  </div>
                  <div className={i < timeline.length - 1 ? "pb-4" : "pb-3"}>
                    <p className="text-xs font-bold uppercase tracking-wide text-brand">
                      {item.date}
                    </p>
                    <h3 className="mt-0.5 text-[15px] font-extrabold leading-tight text-neutral-950">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">{item.text}</p>
                  </div>
                </li>
              ))}
              <li className="flex gap-3.5">
                <span className="mt-0.5 size-3 shrink-0 rounded-full border-2 border-dashed border-brand/50 bg-white" />
                <p className="text-sm font-semibold italic text-neutral-500">
                  {t("about.timelineNext")}
                </p>
              </li>
            </ol>
          </div>
        </motion.section>

        <section className="pt-4 text-center">
          <SectionBadge icon={Layers}>{t("about.valuesBadge")}</SectionBadge>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("about.valuesTitleBefore")}{" "}
            <span className="bg-gradient-to-r from-brand to-brand-sky bg-clip-text text-transparent">
              {t("about.valuesTitleHighlight")}
            </span>
          </h2>
          <p className="mt-2 text-sm text-neutral-600">{t("about.valuesSubtitle")}</p>

          <ul className="mt-7 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ id, icon: Icon }, i) => (
              <motion.li
                key={id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.45 }}
                className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.05)]"
              >
                <Icon className="size-7 text-brand" strokeWidth={1.75} />
                <h3 className="mt-3 text-lg font-extrabold leading-tight text-neutral-950">
                  {t(`about.values.${id}.title`)}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                  {t(`about.values.${id}.description`)}
                </p>
              </motion.li>
            ))}
          </ul>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl bg-brand-navy text-white shadow-[0_18px_50px_rgba(0,8,83,0.35)]"
        >
          <img
            src={CTA_IMAGE}
            alt=""
            className="absolute inset-y-0 right-0 hidden h-full w-3/5 object-cover opacity-60 md:block"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-navy via-brand-navy/95 to-brand-navy/30 md:via-brand-navy/80" />
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(circle at 0% 100%, color-mix(in srgb, var(--brand) 55%, transparent), transparent 55%)",
            }}
            aria-hidden
          />

          <div className="relative grid items-center gap-6 px-6 py-9 sm:px-10 md:grid-cols-2 md:py-10">
            <div>
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                {t("about.cta.line1")}
                <br />
                {t("about.cta.line2Before")}{" "}
                <span className="bg-gradient-to-r from-brand-cyan to-brand-accent bg-clip-text text-transparent">
                  {t("about.cta.highlight")}
                </span>
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/80">
                {t("about.cta.subtitle")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 md:justify-center">
              <Link
                to={primaryCtaHref}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-6 text-sm font-bold text-neutral-950 shadow-lg transition-transform hover:-translate-y-0.5"
              >
                {t("about.cta.getStarted")}
                <ArrowRight className="size-4 text-brand" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 bg-white/5 px-6 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
              >
                <CalendarDays className="size-4" />
                {t("about.cta.bookDemo")}
              </Link>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
