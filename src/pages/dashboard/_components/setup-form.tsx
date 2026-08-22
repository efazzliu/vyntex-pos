import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Building2, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase.ts";
import { setDashboardRestaurantId } from "@/hooks/use-dashboard-restaurant.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { planTerminalFloor } from "@/pages/pos/_lib/plan-features.ts";
import { defaultSelfServeTrialExpiry, FREE_TRIAL_QUERY_VALUE } from "@/lib/free-trial.ts";
import { POS_LICENSE_LOCALE_INSERT, localeFieldsFromCurrencyCode } from "@/lib/pos-locale-defaults.ts";
import { APP_VERSION_LABEL, VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";
import { dashboardTypeLabel } from "@/lib/dashboard-i18n.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { cn } from "@/lib/utils.ts";

const currencies = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (\u20AC)" },
  { value: "GBP", label: "GBP (\u00A3)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "AUD", label: "AUD (A$)" },
];

const CAROUSEL_INTERVAL_MS = 5500;

const ACTIVATION_PLAN_SLIDES = [
  {
    key: "starter" as const,
    labelKey: "activate.plan.starter.label",
    bulletKeys: [
      "activate.plan.starter.f1",
      "activate.plan.starter.f2",
      "activate.plan.starter.f3",
      "activate.plan.starter.f4",
      "activate.plan.starter.f5",
      "activate.plan.starter.f6",
      "activate.plan.starter.f7",
      "activate.plan.starter.f8",
    ],
  },
  {
    key: "professional" as const,
    labelKey: "activate.plan.professional.label",
    bulletKeys: [
      "activate.plan.professional.f1",
      "activate.plan.professional.f2",
      "activate.plan.professional.f3",
      "activate.plan.professional.f4",
      "activate.plan.professional.f5",
      "activate.plan.professional.f6",
    ],
  },
  {
    key: "enterprise" as const,
    labelKey: "activate.plan.enterprise.label",
    bulletKeys: [
      "activate.plan.enterprise.f1",
      "activate.plan.enterprise.f2",
      "activate.plan.enterprise.f3",
      "activate.plan.enterprise.f4",
      "activate.plan.enterprise.f5",
      "activate.plan.enterprise.f6",
      "activate.plan.enterprise.f7",
    ],
  },
] as const;

function PlanTierFeatureCarousel() {
  const { t } = useDashboardLocale();
  const [index, setIndex] = useState(0);
  const slides = ACTIVATION_PLAN_SLIDES;

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [slides.length]);

  const slide = slides[index];
  const slideLabel = t(slide.labelKey);

  return (
    <div className="relative z-10 mt-auto space-y-4 lg:mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
          {t("activate.carousel.title")}
        </p>
        <div className="flex items-center gap-1.5" role="tablist" aria-label={t("activate.carousel.aria")}>
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={t("activate.carousel.show_plan", { plan: t(s.labelKey) })}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#44CC00]/70",
                i === index ? "w-7 bg-[#44CC00]" : "w-1.5 bg-white/25 hover:bg-white/40",
              )}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={slide.key}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-md"
        >
          <p className="mb-3 text-sm font-semibold tracking-tight text-white">{slideLabel}</p>
          <ul className="space-y-3.5">
            {slide.bulletKeys.map((key) => (
              <li key={key} className="flex gap-3 text-sm leading-snug text-white/88">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#44CC00]" aria-hidden />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function SetupForm() {
  const { t, lang } = useDashboardLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const trialFromMarketing = searchParams.get("trial") === FREE_TRIAL_QUERY_VALUE;
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [type] = useState<"restaurant">("restaurant");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [plan] = useState<"professional">("professional");

  const professionalPlanLabel = useMemo(
    () => t("activate.brand.plan_professional"),
    [t],
  );

  const generateLicenseKey = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let key = "";
    for (let i = 0; i < 16; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("activate.error.business_name"));
      return;
    }
    setLoading(true);
    try {
      const expiry = defaultSelfServeTrialExpiry();

      const { data: authData } = await supabase.auth.getUser();
      const u = authData.user;
      const meta = u?.user_metadata as { full_name?: string } | undefined;
      const ownerName = (meta?.full_name && String(meta.full_name).trim()) || null;

      const newLicenseKey = generateLicenseKey();

      const { data, error } = await supabase
        .from("restaurants")
        .insert({
          name: name.trim(),
          type,
          address: address.trim() || null,
          phone: phone.trim() || null,
          ...POS_LICENSE_LOCALE_INSERT,
          ...localeFieldsFromCurrencyCode(currency),
          plan,
          license_key: newLicenseKey,
          license_expiry: expiry.toISOString(),
          license_status: "active",
          owner_user_id: u?.id ?? null,
          owner_email: u?.email?.trim().toLowerCase() ?? null,
          owner_name: ownerName,
          max_terminals: planTerminalFloor(plan),
          registered_devices: [],
        })
        .select("id")
        .single();

      if (error || !data) {
        throw error ?? new Error(t("activate.error.activate_failed"));
      }

      setDashboardRestaurantId(data.id);

      const { error: planSyncError } = await supabase
        .from("restaurants")
        .update({
          plan,
        })
        .eq("id", data.id);
      if (planSyncError) {
        console.warn("[setup-form] plan sync update failed", planSyncError);
      }

      toast.success(t("activate.success.welcome"));
      navigate("/dashboard/restaurant-pos", { replace: true });
    } catch (error) {
      const message = errorMessageFromUnknown(error, t("activate.error.activate_failed"));
      const lower = message.toLowerCase();

      if (lower.includes("duplicate key")) {
        toast.error(t("activate.error.duplicate_key"));
      } else if (
        lower.includes("could not find") &&
        lower.includes("column") &&
        lower.includes("restaurants")
      ) {
        toast.error(t("activate.error.migration"));
      } else if (lower.includes("row-level security") || lower.includes("rls")) {
        toast.error(t("activate.error.rls"));
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#060B18] lg:flex-row">
      {/* Left: brand + what you get */}
      <aside className="relative flex min-h-[42vh] shrink-0 flex-col justify-between overflow-hidden border-b border-white/[0.08] px-8 py-10 sm:px-10 sm:py-12 lg:min-h-dvh lg:w-[42%] lg:min-w-0 lg:max-w-none lg:border-b-0 lg:border-r lg:border-white/[0.08] lg:px-10 lg:py-12 xl:w-[40%] xl:px-12 xl:py-14 2xl:px-14 2xl:py-16">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#060B18] via-[#0A1628] to-[#060B18]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 top-1/4 h-72 w-72 rounded-full bg-[#0066FF]/20 blur-[100px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-16 bottom-1/4 h-64 w-64 rounded-full bg-[#44CC00]/12 blur-[90px]"
          aria-hidden
        />

        <div className="relative z-10 flex flex-1 flex-col">
          <div className="mb-8 flex flex-col items-start gap-6 lg:mb-10">
            <img
              src={VYNTEX_APP_LOGO_SRC}
              alt={t("activate.logo_alt")}
              className="h-20 w-20 object-contain drop-shadow-[0_12px_40px_rgba(0,102,255,0.45)] sm:h-24 sm:w-24 lg:h-28 lg:w-28 xl:h-32 xl:w-32"
            />
            <div>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl xl:text-[2.5rem]">
                <span className="bg-gradient-to-r from-[#66B3FF] via-white to-[#7FE0C3] bg-clip-text text-transparent">
                  Vyntex POS
                </span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
                {t("activate.brand.tagline", { plan: professionalPlanLabel })}
              </p>
            </div>
          </div>

          {/* VYN Type — flat, no card */}
          <div className="relative z-10 mb-6 w-full max-w-md lg:mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              {t("activate.vyn_type")}
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-lg font-semibold leading-snug text-white sm:text-xl">
              <Sparkles className="size-5 shrink-0 text-[#7EC8FF]" aria-hidden />
              {dashboardTypeLabel(type, lang)}
            </p>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-white/60 sm:text-sm">
              {t("activate.vyn_type_hint", { plan: professionalPlanLabel })}
            </p>
          </div>

          <PlanTierFeatureCarousel />

          <p className="relative z-10 mt-8 text-xs text-white/35 lg:mt-10">
            <span className="font-medium tabular-nums text-white/45">v{APP_VERSION_LABEL}</span>
            <span className="hidden sm:inline">
              {" "}
              · {t("activate.footer.security")}
            </span>
          </p>
        </div>
      </aside>

      {/* Right: full workspace — starts at the edge of the brand column, desktop-first width */}
      <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50 dark:bg-[#0b1424]">
        <div className="flex w-full flex-1 flex-col px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12 xl:px-14 xl:py-14 2xl:px-20">
          <header className="mb-8 shrink-0 border-b border-slate-200/90 pb-8 dark:border-white/[0.08] lg:mb-10 lg:pb-10">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
              {t("activate.title")}
            </h2>
            <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-slate-600 dark:text-white/55 sm:text-base lg:text-lg">
              {t("activate.subtitle")}
            </p>
          </header>

          <form
            onSubmit={handleSubmit}
            className="flex w-full max-w-none flex-1 flex-col gap-8 lg:gap-10"
          >
            {trialFromMarketing ? (
              <div className="rounded-xl border border-emerald-700/20 bg-emerald-50 px-4 py-3.5 text-sm leading-relaxed text-emerald-950 sm:px-5 sm:text-base dark:border-emerald-400/35 dark:bg-emerald-950/60 dark:text-emerald-50">
                <strong className="font-semibold text-emerald-900 dark:text-emerald-100">
                  {t("activate.trial.banner_strong")}
                </strong>
                <span className="text-emerald-900/95 dark:text-emerald-100/90">
                  {" "}
                  {t("activate.trial.banner_text")}
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-white/80">
                  {t("activate.selected_plan")}
                </Label>
                <div className="rounded-xl border border-[#0066FF]/25 bg-[#0066FF]/[0.06] p-4 sm:p-5 dark:border-[#0066FF]/35 dark:bg-[#0066FF]/10">
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {t("activate.professional_plan")}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#0066FF] dark:text-[#66B3FF] sm:text-base">
                    {t("activate.trial_label")}
                  </p>
                  <p className="mt-2 text-sm leading-snug text-slate-600 dark:text-white/50">
                    {t("activate.trial_hint")}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type" className="text-sm font-medium text-slate-700 dark:text-white/80">
                  {t("activate.vyn_type_label")}
                </Label>
                <div className="flex min-h-[4.75rem] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#0b162b] sm:px-5">
                  <Building2 className="size-5 shrink-0 text-slate-500 dark:text-white/45" />
                  <span className="text-base font-medium text-slate-800 dark:text-white/90">
                    {dashboardTypeLabel(type, lang)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-white/80">
                {t("activate.business_name")}
              </Label>
              <Input
                id="name"
                placeholder={t("activate.business_name_placeholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12 rounded-xl border-slate-200 bg-white text-base dark:border-white/10 dark:bg-[#0b162b] lg:h-14 lg:text-lg"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
              <div className="space-y-2 lg:col-span-5">
                <Label htmlFor="address" className="text-sm font-medium text-slate-700 dark:text-white/80">
                  {t("activate.address")}
                </Label>
                <Input
                  id="address"
                  placeholder={t("activate.address_placeholder")}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-white text-base dark:border-white/10 dark:bg-[#0b162b]"
                />
              </div>
              <div className="space-y-2 lg:col-span-4">
                <Label htmlFor="phone" className="text-sm font-medium text-slate-700 dark:text-white/80">
                  {t("activate.phone")}
                </Label>
                <Input
                  id="phone"
                  placeholder={t("activate.phone_placeholder")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-white text-base dark:border-white/10 dark:bg-[#0b162b]"
                />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="currency" className="text-sm font-medium text-slate-700 dark:text-white/80">
                  {t("activate.currency")}
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger
                    id="currency"
                    className="h-12 rounded-xl border-slate-200 bg-white text-base dark:border-white/10 dark:bg-[#0b162b]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-4 border-t border-slate-200/90 pt-8 dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between lg:pt-10">
              <p className="order-2 text-xs text-slate-500 dark:text-white/40 sm:order-1 sm:max-w-md">
                {t("activate.terms")}
              </p>
              <Button
                type="submit"
                className="order-1 h-12 w-full shrink-0 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] px-10 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-[#0055DD] hover:to-[#0099BB] sm:order-2 sm:h-14 sm:w-auto sm:min-w-[220px] lg:min-w-[260px] lg:text-lg"
                disabled={loading}
              >
                {loading ? t("activate.submitting") : t("activate.submit")}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
