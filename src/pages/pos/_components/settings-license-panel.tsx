import { useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import {
  BadgeCheck,
  Calendar,
  Check,
  Copy,
  Crown,
  ExternalLink,
  KeyRound,
  Layers,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { POS_UPDATE_ORIGIN } from "@/lib/pos-app-update.ts";
import {
  maxEffectiveTerminalsForLicense,
  normalizePlan,
  planTerminalFloor,
  type PlanName,
} from "../_lib/plan-features.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type SettingsLicensePanelProps = {
  t: Translate;
  licenseKey: string;
};

const PLAN_FEATURES: Record<PlanName, string[]> = {
  starter: [
    "settings.lic_feat_floor",
    "settings.lic_feat_menu",
    "settings.lic_feat_history",
    "settings.lic_feat_tables",
    "settings.lic_feat_stock",
    "settings.lic_feat_staff",
    "settings.lic_feat_today",
    "settings.lic_feat_zreport",
  ],
  professional: [
    "settings.lic_feat_starter_all",
    "settings.lic_feat_kds",
    "settings.lic_feat_split",
    "settings.lic_feat_analytics",
    "settings.lic_feat_debt",
    "settings.lic_feat_audit",
  ],
  enterprise: [
    "settings.lic_feat_pro_all",
    "settings.lic_feat_supply",
    "settings.lic_feat_priority",
  ],
};

function formatDate(iso: string | null | undefined, language: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(language === "sq" ? "sq-AL" : "en-GB", {
    dateStyle: "medium",
  });
}

function daysRemaining(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

function displayLicenseStatus(
  status: string | undefined,
  expiry: string | null | undefined,
): "active" | "expired" | "suspended" | null {
  if (status === "suspended") return "suspended";
  const end = expiry ? new Date(expiry).getTime() : NaN;
  const expiredByDate = Number.isFinite(end) && end <= Date.now();
  if (status === "expired" || expiredByDate) return "expired";
  if (status === "active" || (Number.isFinite(end) && end > Date.now())) {
    return "active";
  }
  return null;
}

export default function SettingsLicensePanel({
  t,
  licenseKey,
}: SettingsLicensePanelProps) {
  const { language } = usePosLocale();
  const companyQuery = useQuery("pos.settings.getCompanyDetails", {
    licenseKey,
  });
  const [copied, setCopied] = useState(false);

  const company =
    companyQuery &&
    typeof companyQuery === "object" &&
    !Array.isArray(companyQuery)
      ? (companyQuery as {
          plan?: string;
          licenseKey?: string;
          licenseStatus?: string;
          licenseExpiry?: string | null;
          licenseStartedAt?: string | null;
          maxTerminals?: number | null;
          registeredDeviceCount?: number;
          mobileAccessEnabled?: boolean;
        })
      : null;

  const loaded = companyQuery !== undefined;
  const rawPlan = String(company?.plan ?? "").trim();
  const plan = rawPlan ? normalizePlan(rawPlan) : null;
  const shownKey = String(company?.licenseKey || "").trim() || (loaded ? licenseKey.trim() : "");
  const expiry = company?.licenseExpiry ?? null;
  const started = company?.licenseStartedAt ?? null;
  const status = loaded
    ? displayLicenseStatus(company?.licenseStatus, expiry)
    : null;
  const remaining = daysRemaining(expiry);
  const allowed =
    plan == null
      ? null
      : company?.maxTerminals != null && Number(company.maxTerminals) > 0
        ? maxEffectiveTerminalsForLicense(plan, company.maxTerminals)
        : planTerminalFloor(plan);
  const registered = Math.max(0, Number(company?.registeredDeviceCount) || 0);
  const features = plan ? PLAN_FEATURES[plan] : [];

  const planLabel = plan ? t(`settings.plan_tier_${plan}`) : "—";
  const startLabel = formatDate(started, language) || "—";
  const expiryLabel = formatDate(expiry, language) || "—";
  const daysHero =
    remaining == null
      ? "—"
      : status === "expired"
        ? t("settings.lic_days_expired")
        : t("settings.lic_days_short", { count: remaining });
  const daysPill =
    remaining == null
      ? "—"
      : status === "expired"
        ? t("settings.lic_days_expired")
        : t("settings.lic_days_left", { count: remaining });
  const usagePercent =
    allowed != null && allowed > 0 ? Math.round((registered / allowed) * 100) : null;
  const featureKeys = [
    ...features,
    ...(allowed != null ? ["settings.lic_feat_terminals"] : []),
    ...(company?.mobileAccessEnabled === true ? ["settings.lic_feat_phone"] : []),
  ];

  const copyKey = async () => {
    if (!shownKey) return;
    try {
      await navigator.clipboard.writeText(shownKey);
      setCopied(true);
      toast.success(t("settings.lic_copied"));
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t("settings.lic_copy_failed"));
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start gap-3 px-1">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
          <BadgeCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-[#0f172a]">
            {t("settings.lic_heading")}
          </h1>
          <p className="mt-0.5 text-sm text-[#64748b]">{t("settings.lic_page_lead")}</p>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[22px] border border-[#e6edf5] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="pointer-events-none absolute -right-6 -top-8 hidden h-36 w-56 rounded-full bg-brand-light lg:block" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:pr-40">
          <HeroStat
            icon={<Crown className="size-4 text-brand" />}
            label={t("settings.lic_plan")}
            value={planLabel}
          />
          <HeroRule />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
              {t("settings.lic_status")}
            </p>
            {status ? (
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold",
                  status === "active"
                    ? "bg-[#ecfdf3] text-[#16a34a]"
                    : status === "expired"
                      ? "bg-[#fef2f2] text-[#dc2626]"
                      : "bg-[#fff7ed] text-[#d97706]",
                )}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {t(`settings.lic_status_${status}`)}
              </span>
            ) : (
              <p className="mt-1 text-2xl font-bold text-[#0f172a]">—</p>
            )}
          </div>
          <HeroRule />
          <HeroStat
            icon={<Calendar className="size-4 text-brand" />}
            label={t("settings.lic_days")}
            value={daysHero}
          />
        </div>
        <div className="pointer-events-none absolute right-5 top-1/2 hidden w-[132px] -translate-y-1/2 lg:block">
          <div className="rotate-6 rounded-2xl border border-brand-subtle bg-white/90 px-4 py-5 shadow-[0_12px_30px_-18px_rgba(0,91,214,0.65)]">
            <div className="text-3xl font-bold text-brand">V</div>
            <span className="absolute -bottom-2 -right-2 flex size-8 items-center justify-center rounded-full bg-brand shadow-sm">
              <Check className="size-4" style={{ color: "#ffffff" }} />
            </span>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <section className="rounded-[22px] border border-[#e6edf5] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardHead
            icon={<KeyRound className="size-4 text-brand" />}
            title={t("settings.lic_details_title")}
            lead={t("settings.lic_details_lead")}
          />
          <dl className="mt-3 divide-y divide-[#eef2f6]">
            <DetailRow icon={<KeyRound className="size-4" />} label={t("settings.lic_id")}>
              <span className="inline-flex max-w-full items-center gap-2">
                <span className="truncate rounded-lg bg-[#f1f5f9] px-2.5 py-1 font-mono text-xs font-semibold text-[#0f172a]">
                  {shownKey || "—"}
                </span>
                {shownKey ? (
                  <button
                    type="button"
                    onClick={() => void copyKey()}
                    className="text-[#94a3b8] hover:text-[#0f172a]"
                    aria-label={copied ? t("settings.lic_copied") : t("settings.lic_copy")}
                  >
                    <Copy className="size-3.5" />
                  </button>
                ) : null}
              </span>
            </DetailRow>
            <DetailRow icon={<Calendar className="size-4" />} label={t("settings.lic_start")}>
              {startLabel}
            </DetailRow>
            <DetailRow icon={<Calendar className="size-4" />} label={t("settings.lic_expiry")}>
              {expiryLabel}
            </DetailRow>
            <DetailRow icon={<Calendar className="size-4" />} label={t("settings.lic_days")}>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  status === "expired"
                    ? "bg-[#fef2f2] text-[#dc2626]"
                    : status === "suspended"
                      ? "bg-[#fff7ed] text-[#d97706]"
                      : remaining == null
                        ? "text-[#0f172a]"
                        : "bg-[#ecfdf3] text-[#16a34a]",
                )}
              >
                {daysPill}
              </span>
            </DetailRow>
          </dl>
        </section>

        <section className="rounded-[22px] border border-[#e6edf5] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <CardHead
              icon={<Monitor className="size-4 text-brand" />}
              title={t("settings.lic_devices_title")}
              lead={t("settings.lic_devices_lead")}
            />
            {allowed != null ? (
              <span className="shrink-0 rounded-full border border-[#e6edf5] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-[#64748b]">
                {t("settings.lic_plan_limit", { count: allowed })}
              </span>
            ) : null}
          </div>
          <p className="mt-6 text-4xl font-bold tracking-tight text-[#0f172a]">
            {allowed == null ? "—" : `${registered} / ${allowed}`}
          </p>
          <p className="mt-1 text-sm text-[#94a3b8]">{t("settings.lic_devices_sub")}</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.min(100, Math.max(0, usagePercent ?? 0))}%` }}
              />
            </div>
            <span className="text-sm font-medium text-[#64748b]">
              {usagePercent == null ? "—" : `${usagePercent}%`}
            </span>
          </div>
        </section>
      </div>

      <section className="rounded-[22px] border border-[#e6edf5] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardHead
            icon={<Layers className="size-4 text-brand" />}
            title={t("settings.lic_features_title")}
            lead={
              plan
                ? t("settings.lic_features_plan", { plan: planLabel })
                : t("settings.lic_features_lead")
            }
          />
          {plan ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-2.5 py-1 text-xs font-semibold text-brand">
              <Crown className="size-3.5" />
              {planLabel}
            </span>
          ) : null}
        </div>
        {featureKeys.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {featureKeys.map((key) => (
              <li
                key={key}
                className="inline-flex items-center gap-2 rounded-full border border-[#e6edf5] bg-[#f8fafc] px-3 py-1.5 text-sm text-[#0f172a]"
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-[#ecfdf3] text-[#16a34a]">
                  <Check className="size-3" />
                </span>
                {key === "settings.lic_feat_terminals"
                  ? t(key, { count: allowed ?? 0 })
                  : t(key)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[#64748b]">—</p>
        )}
      </section>

      <section className="rounded-[22px] border border-[#e6edf5] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-[15px] font-semibold text-[#0f172a]">{t("settings.lic_manage_title")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-[#64748b]">{t("settings.lic_manage_lead")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`${POS_UPDATE_ORIGIN}/pricing`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-3.5 text-sm font-semibold"
            style={{ color: "#ffffff" }}
          >
            <ExternalLink className="size-4" />
            {t("settings.lic_upgrade")}
          </a>
          <a
            href={`${POS_UPDATE_ORIGIN}/dashboard/billing`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e6edf5] bg-white px-3.5 text-sm font-medium text-[#0f172a]"
          >
            <ExternalLink className="size-4" />
            {t("settings.lic_manage")}
          </a>
        </div>
      </section>
    </div>
  );
}

function HeroRule() {
  return <div className="hidden h-12 w-px bg-[#e6edf5] lg:block" />;
}

function HeroStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-light">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
          {label}
        </p>
        <p className="mt-0.5 truncate text-2xl font-bold tracking-tight text-[#0f172a]">{value}</p>
      </div>
    </div>
  );
}

function CardHead({
  icon,
  title,
  lead,
}: {
  icon: ReactNode;
  title: string;
  lead: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-[#0f172a]">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">{lead}</p>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="flex items-center gap-2 text-sm text-[#64748b]">
        <span className="text-[#94a3b8]">{icon}</span>
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm font-medium text-[#0f172a]">{children}</dd>
    </div>
  );
}
