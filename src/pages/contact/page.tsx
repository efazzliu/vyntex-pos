import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Headphones,
  Layers,
  Mail,
  MessageCircle,
  MessageSquare,
  MonitorPlay,
  Music2,
  Phone,
  Send,
  Share2,
  ShieldCheck,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { submitContactForm } from "@/lib/supabase-pos/contact-ops.ts";
import {
  SUPPORT_BUSINESS_EMAIL_READY,
  SUPPORT_EMAIL,
  SUPPORT_MAILTO_HREF,
  SUPPORT_PHONE,
  SUPPORT_TEL_HREF,
  VYNTEX_INSTAGRAM_URL,
  VYNTEX_TIKTOK_URL,
  VYNTEX_WHATSAPP_URL,
} from "@/lib/site-constants.ts";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1400&h=900&fit=crop&q=80";

const SUBJECT_KEYS = ["general", "sales", "support", "billing", "partnership"] as const;

const HIGHLIGHTS = [
  { id: "fast", icon: Zap },
  { id: "dedicated", icon: Headphones },
  { id: "everyone", icon: ShieldCheck },
  { id: "demo", icon: MonitorPlay },
] as const;

// lucide-react dropped brand icons; local copy of the old Instagram glyph
function Instagram({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

type SocialChip = {
  id: string;
  label: string;
  icon: LucideIcon | typeof Instagram;
  href: string;
};

type InfoRow = {
  id: string;
  icon: LucideIcon | typeof Instagram;
  title: string;
  value?: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  chips?: SocialChip[];
};

const rowClass =
  "flex w-full items-center gap-3 rounded-xl border border-neutral-200/80 bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const rowInteractiveClass = "transition-colors hover:border-brand/30 hover:bg-brand/[0.03]";

function InfoRowItem({ row }: { row: InfoRow }) {
  const Icon = row.icon;
  const interactive = Boolean(row.href || row.onClick);
  const body = (
    <>
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-tight text-neutral-950">
          {row.title}
        </span>
        {row.value ? (
          <span className="mt-0.5 block break-words text-sm leading-snug text-neutral-500">
            {row.value}
          </span>
        ) : null}
      </span>
      {interactive ? <ChevronRight className="size-4 shrink-0 text-neutral-800" aria-hidden /> : null}
    </>
  );

  if (row.chips) {
    return (
      <li className={rowClass}>
        <span className="inline-flex size-11 shrink-0 items-center justify-center self-start rounded-xl bg-brand/10 text-brand">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-tight text-neutral-950">
            {row.title}
          </span>
          <span className="mt-2 flex flex-wrap gap-2">
            {row.chips.map((chip) => {
              const ChipIcon = chip.icon;
              return (
                <a
                  key={chip.id}
                  href={chip.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
                >
                  <ChipIcon className="size-4 text-brand" />
                  {chip.label}
                </a>
              );
            })}
          </span>
        </span>
      </li>
    );
  }

  if (row.href) {
    return (
      <li>
        <a
          href={row.href}
          {...(row.external ? { target: "_blank", rel: "noreferrer" } : {})}
          className={`${rowClass} ${rowInteractiveClass}`}
        >
          {body}
        </a>
      </li>
    );
  }
  if (row.onClick) {
    return (
      <li>
        <button type="button" onClick={row.onClick} className={`${rowClass} ${rowInteractiveClass} cursor-pointer`}>
          {body}
        </button>
      </li>
    );
  }
  return <li className={rowClass}>{body}</li>;
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-neutral-950">
      {children} <span className="text-brand">*</span>
    </label>
  );
}

const fieldClass =
  "h-11 rounded-xl border-neutral-200 bg-white pl-10 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-neutral-400 focus-visible:border-brand/50 focus-visible:ring-brand/20";

export default function ContactPage() {
  const { t } = useTranslation("site");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject || !message.trim()) {
      toast.error(t("contact.toastRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      await submitContactForm({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || undefined,
        message: message.trim(),
        type: "form",
      });
      toast.success(t("contact.toastSuccess"));
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("contact.toastError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const socialChips: SocialChip[] = [
    { id: "instagram", label: "Instagram", icon: Instagram, href: VYNTEX_INSTAGRAM_URL },
    ...(VYNTEX_WHATSAPP_URL
      ? [{ id: "whatsapp", label: "WhatsApp", icon: MessageCircle, href: VYNTEX_WHATSAPP_URL }]
      : []),
    ...(VYNTEX_TIKTOK_URL
      ? [{ id: "tiktok", label: "TikTok", icon: Music2, href: VYNTEX_TIKTOK_URL }]
      : []),
  ];

  const rows: InfoRow[] = [
    SUPPORT_BUSINESS_EMAIL_READY
      ? {
          id: "email",
          icon: Mail,
          title: t("contact.emailUs"),
          value: SUPPORT_EMAIL,
          href: SUPPORT_MAILTO_HREF,
        }
      : {
          id: "email",
          icon: Mail,
          title: t("contact.emailUs"),
          value: t("contact.emailFormHint"),
          onClick: scrollToForm,
        },
    ...(SUPPORT_PHONE && SUPPORT_TEL_HREF
      ? [
          {
            id: "call",
            icon: Phone,
            title: t("contact.callUs"),
            value: SUPPORT_PHONE,
            href: SUPPORT_TEL_HREF,
          } satisfies InfoRow,
        ]
      : []),
    {
      id: "social",
      icon: Share2,
      title: t("contact.socialMedia"),
      chips: socialChips,
    },
    {
      id: "response",
      icon: Clock,
      title: t("contact.responseTime"),
      value: t("contact.responseValue"),
    },
  ];

  return (
    <div className="relative overflow-hidden bg-white text-neutral-950">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 6% 8%, color-mix(in srgb, var(--brand) 9%, transparent), transparent 36%), radial-gradient(circle at 70% 40%, color-mix(in srgb, var(--brand-accent) 6%, transparent), transparent 36%)",
        }}
        aria-hidden
      />

      <section className="relative pb-8 pt-28 sm:pt-32 lg:pb-10">
        <div
          className="pointer-events-none absolute right-0 top-16 hidden h-[17rem] w-[52%] lg:block xl:h-[19rem]"
          style={{ clipPath: "polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)" }}
          aria-hidden
        >
          <img
            src={HERO_IMAGE}
            alt=""
            className="h-full w-full object-cover"
            decoding="async"
            fetchPriority="high"
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/15 bg-brand/10 px-3.5 py-1.5 text-xs font-bold text-brand"
            >
              <Headphones className="size-3.5" />
              {t("contact.heroBadge")}
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-4 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl"
            >
              {t("contact.heroTitleBefore")}
              <br />
              <span className="bg-gradient-to-r from-brand to-brand-sky bg-clip-text text-transparent">
                {t("contact.heroTitleHighlight")}
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 max-w-md text-base leading-relaxed text-neutral-500"
            >
              {t("contact.heroSubtitle")}
            </motion.p>
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

      <section className="relative pb-10 pt-2">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.4fr] lg:items-start lg:gap-7 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="space-y-5"
          >
            <ul className="space-y-2.5 rounded-3xl border border-neutral-200/70 bg-white p-3 shadow-[0_10px_40px_rgba(15,23,42,0.07)]">
              {rows.map((row) => (
                <InfoRowItem key={row.id} row={row} />
              ))}
            </ul>

            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-hover p-5 text-white shadow-[0_14px_34px_rgba(0,91,214,0.3)]">
              <CalendarDays
                className="pointer-events-none absolute -bottom-3 -right-2 size-28 text-white/10"
                strokeWidth={1.25}
                aria-hidden
              />
              <div className="relative flex items-start gap-3">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <MonitorPlay className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold leading-tight">{t("contact.demoTitle")}</h2>
                  <p className="mt-1 max-w-[15rem] text-sm leading-snug text-white/85">
                    {t("contact.demoBody")}
                  </p>
                </div>
              </div>
              <Link
                to="/product-demo"
                className="relative mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-brand shadow-sm transition-transform hover:scale-[1.03]"
              >
                {t("contact.demoCta")}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.08 }}
            id="contact-form"
            className="scroll-mt-28 rounded-3xl border border-neutral-200/70 bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.07)] sm:p-7"
          >
            <h2 className="text-2xl font-extrabold tracking-tight text-neutral-950">
              {t("contact.formTitle")}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">{t("contact.formSubtitle")}</p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="contact-name">{t("contact.fullName")}</FieldLabel>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                      id="contact-name"
                      placeholder={t("contact.phFullName")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={fieldClass}
                      required
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="contact-email">{t("contact.emailAddress")}</FieldLabel>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder={t("contact.phEmailAddress")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={fieldClass}
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="contact-subject">{t("contact.subjectLabel")}</FieldLabel>
                <div className="relative">
                  <Layers className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                  <select
                    id="contact-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-neutral-200 bg-white pl-10 pr-10 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-colors focus-visible:border-brand/50 focus-visible:ring-[3px] focus-visible:ring-brand/20 invalid:text-neutral-400"
                  >
                    <option value="" disabled>
                      {t("contact.phSubjectSelect")}
                    </option>
                    {SUBJECT_KEYS.map((key) => (
                      <option key={key} value={t(`contact.subjects.${key}`)} className="text-neutral-950">
                        {t(`contact.subjects.${key}`)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-800" />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="contact-message">{t("contact.messageLabel")}</FieldLabel>
                <div className="relative">
                  <MessageSquare className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-neutral-500" />
                  <Textarea
                    id="contact-message"
                    placeholder={t("contact.phMessageNew")}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    className="min-h-32 rounded-xl border-neutral-200 bg-white pl-10 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-neutral-400 focus-visible:border-brand/50 focus-visible:ring-brand/20"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-sky text-sm font-bold text-white shadow-[0_8px_20px_rgba(0,91,214,0.28)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="size-4" />
                {isSubmitting ? t("contact.sending") : t("contact.send")}
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      <section className="relative pb-20 sm:pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[1.75rem] border border-neutral-200/60 bg-gradient-to-b from-neutral-50 to-neutral-100/60 px-4 py-5 shadow-[0_6px_24px_rgba(15,23,42,0.04)] sm:px-6 sm:py-6 lg:px-4 lg:py-7">
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-y-6 lg:flex lg:items-center lg:gap-0">
              {HIGHLIGHTS.map(({ id, icon: Icon }, i) => (
                <li key={id} className="flex items-center lg:flex-1">
                  {i > 0 ? (
                    <span className="hidden h-12 w-px shrink-0 bg-neutral-300/70 lg:block" aria-hidden />
                  ) : null}
                  <div className="flex flex-1 items-center gap-3 px-2 lg:justify-center lg:px-3">
                    <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand/15 to-white text-brand shadow-[0_2px_10px_rgba(0,91,214,0.12)] sm:size-11 lg:size-10">
                      <Icon className="size-[22px]" strokeWidth={1.6} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold leading-tight text-neutral-950">
                        {t(`contact.highlights.${id}.title`)}
                      </p>
                      <p className="mt-1 text-[13px] leading-snug text-neutral-500">
                        {t(`contact.highlights.${id}.description`)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
