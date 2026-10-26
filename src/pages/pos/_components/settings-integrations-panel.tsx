import { cn } from "@/lib/utils.ts";
import {
  BookOpen,
  CreditCard,
  Plug,
  Truck,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import {
  INTEGRATION_CATEGORIES,
  integrationCanDisconnect,
  integrationsForCategory,
  type IntegrationCategory,
  type IntegrationStatus,
  type VenueIntegration,
} from "@/lib/pos-integrations.ts";
import { BRAND } from "@/lib/brand-colors.ts";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const CATEGORY_ICON: Record<IntegrationCategory, LucideIcon> = {
  accounting: BookOpen,
  delivery: Truck,
  payments: CreditCard,
  api: Webhook,
};

const CATEGORY_COLOR: Record<IntegrationCategory, string> = {
  accounting: BRAND.primary,
  delivery: BRAND.primary,
  payments: BRAND.primary,
  api: BRAND.primary,
};

type SettingsIntegrationsPanelProps = {
  t: Translate;
};

function statusLabelKey(status: IntegrationStatus): string {
  if (status === "connected") return "settings.int_status_connected";
  if (status === "error") return "settings.int_status_error";
  return "settings.int_status_unavailable";
}

function IntegrationCard({
  t,
  item,
}: {
  t: Translate;
  item: VenueIntegration;
}) {
  const live = integrationCanDisconnect(item);
  return (
    <article className="rounded-[18px] border border-[#1e2a45] bg-[#131A2E] p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{t(item.titleKey)}</p>
          <p className="mt-1 text-xs leading-relaxed text-[#8b93a7]">{t(item.descKey)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            item.status === "connected"
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
              : item.status === "error"
                ? "border-red-500/30 bg-red-500/15 text-red-400"
                : "border-[#2a3a5a] bg-[#0D1326] text-[#8b93a7]",
          )}
        >
          {t(statusLabelKey(item.status))}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] border border-[#1e2a45] bg-[#0D1326] px-3 py-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#5a6580]">
            {t("settings.int_last_sync")}
          </dt>
          <dd className="mt-1 text-sm text-white">
            {item.lastSyncAt
              ? new Date(item.lastSyncAt).toLocaleString()
              : t("settings.int_last_sync_none")}
          </dd>
        </div>
        <div className="rounded-[14px] border border-[#1e2a45] bg-[#0D1326] px-3 py-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#5a6580]">
            {t("settings.int_errors")}
          </dt>
          <dd className="mt-1 text-sm text-white">
            {item.errors.length === 0
              ? t("settings.int_errors_none")
              : t("settings.int_errors_count", { count: item.errors.length })}
          </dd>
        </div>
      </dl>

      {item.errors.length > 0 ? (
        <ul className="space-y-1.5">
          {item.errors.map((row) => (
            <li
              key={row.at}
              className="rounded-[12px] border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
              <p>{row.message}</p>
              <p className="mt-0.5 text-[10px] text-red-300/80">
                {new Date(row.at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs leading-relaxed text-[#8b93a7]">{t(item.setupKey)}</p>

      {live ? (
        <p className="text-[11px] text-[#5a6580]">{t("settings.int_actions_ready")}</p>
      ) : (
        <p className="text-[11px] text-[#5a6580]">{t("settings.int_actions_hidden")}</p>
      )}
    </article>
  );
}

export default function SettingsIntegrationsPanel({
  t,
}: SettingsIntegrationsPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-sky/15">
          <Plug className="size-5 text-brand-sky" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold tracking-tight text-white">
            {t("settings.int_heading")}
          </h1>
          <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-[#8b93a7]">
            {t("settings.int_lead")}
          </p>
        </div>
      </div>

      {INTEGRATION_CATEGORIES.map((cat) => {
        const Icon = CATEGORY_ICON[cat.id];
        const color = CATEGORY_COLOR[cat.id];
        const items = integrationsForCategory(cat.id);
        return (
          <section
            key={cat.id}
            className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${color}22` }}
              >
                <Icon className="size-5" style={{ color }} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white">{t(cat.titleKey)}</h2>
                <p className="mt-0.5 text-sm text-[#8b93a7]">{t(cat.leadKey)}</p>
              </div>
            </div>
            {items.map((item) => (
              <IntegrationCard key={item.id} t={t} item={item} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
