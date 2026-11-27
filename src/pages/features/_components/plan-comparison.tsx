import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Layers, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

const INCLUDE_GREEN = "#12C959";
const DASH_GRAY = "#CBD5E1";

type PlanId = "starter" | "professional" | "enterprise";
type CellValue = boolean | string;

type ComparisonRow = {
  id: string;
  values: Record<PlanId, CellValue>;
};

/**
 * Matrix aligned to existing Features plan items — no new product claims.
 * `true` = included, `false` = not included, `string` = limit/value key under
 * `featuresPage.comparison.values.<key>`.
 */
const COMPARISON_ROWS: ComparisonRow[] = [
  { id: "locations", values: { starter: "loc1", professional: "loc1", enterprise: "locMulti" } },
  { id: "staff", values: { starter: "staff5", professional: "staff25", enterprise: "staffCustom" } },
  { id: "terminals", values: { starter: "term1", professional: "term5", enterprise: "term50" } },
  { id: "printers", values: { starter: "print1", professional: "printMulti", enterprise: true } },
  { id: "floors", values: { starter: "floor1", professional: "floorMulti", enterprise: true } },
  { id: "basicInventory", values: { starter: true, professional: true, enterprise: true } },
  { id: "advancedInventory", values: { starter: false, professional: true, enterprise: true } },
  { id: "basicZReport", values: { starter: true, professional: true, enterprise: true } },
  { id: "dailyReports", values: { starter: true, professional: true, enterprise: true } },
  { id: "splitDebt", values: { starter: false, professional: true, enterprise: true } },
  { id: "kds", values: { starter: false, professional: "kdsSoon", enterprise: "kdsSoon" } },
  { id: "advancedZExports", values: { starter: false, professional: true, enterprise: true } },
  { id: "detailedAnalytics", values: { starter: false, professional: true, enterprise: true } },
  { id: "supply", values: { starter: false, professional: false, enterprise: true } },
  { id: "recipesCosting", values: { starter: false, professional: false, enterprise: true } },
  { id: "customScheduledReports", values: { starter: false, professional: false, enterprise: true } },
  { id: "apiWebhooks", values: { starter: false, professional: false, enterprise: "apiSoon" } },
  { id: "advancedRoles", values: { starter: false, professional: false, enterprise: true } },
  { id: "detailedAudit", values: { starter: false, professional: false, enterprise: true } },
  { id: "whiteLabel", values: { starter: false, professional: false, enterprise: "wlSoon" } },
  { id: "prioritySla", values: { starter: false, professional: false, enterprise: true } },
];

const PLAN_ORDER: { id: PlanId; popular: boolean; Icon: typeof Zap }[] = [
  { id: "starter", popular: false, Icon: Zap },
  { id: "professional", popular: true, Icon: Trophy },
  { id: "enterprise", popular: false, Icon: Layers },
];

function FeatureRow({
  label,
  value,
}: {
  label: string;
  value: CellValue;
}) {
  const { t } = useTranslation("site");
  const included = value !== false;
  const text =
    typeof value === "string" ? t(`featuresPage.comparison.values.${value}`) : label;

  return (
    <li className="flex items-start gap-2.5 border-b border-neutral-100 py-2.5 last:border-b-0">
      {included ? (
        <span
          className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center"
          aria-label={t("featuresPage.comparison.included")}
        >
          <Check className="size-4" strokeWidth={2.5} style={{ color: INCLUDE_GREEN }} />
        </span>
      ) : (
        <span
          className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center text-base font-medium leading-none"
          style={{ color: DASH_GRAY }}
          aria-label={t("featuresPage.comparison.notIncluded")}
        >
          —
        </span>
      )}
      <span
        className={cn(
          "text-sm leading-snug",
          included ? "text-neutral-800" : "text-neutral-400",
        )}
      >
        {typeof value === "string" ? (
          <>
            {label}
            <span className="mt-0.5 block text-xs font-medium text-brand">{text}</span>
          </>
        ) : (
          text
        )}
      </span>
    </li>
  );
}

export default function PlanComparison() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();

  return (
    <section
      className="border-t border-neutral-200 bg-white py-20 text-neutral-950"
      data-features-comparison="light"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">
            {t("featuresPage.plansLabel")}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {t("featuresPage.plansTitle")}
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3 md:items-stretch">
          {PLAN_ORDER.map(({ id, popular, Icon }) => (
            <div
              key={id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-[#FAFAFA] p-6",
                popular
                  ? "border-brand shadow-lg shadow-brand/10 ring-1 ring-brand/25"
                  : "border-neutral-200",
              )}
            >
              {popular ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand to-brand-sky px-3 py-1 text-[11px] font-bold tracking-wide text-white shadow">
                  {t("pricing.mostPopular")}
                </span>
              ) : null}

              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand/15 to-brand-accent/15">
                <Icon className="size-5 text-brand" />
              </div>

              <h3 className="text-xl font-bold text-neutral-950">
                {t(`featuresPage.plans.${id}.name`)}
              </h3>
              <p className="mt-1 text-sm font-medium text-brand">
                {t(`featuresPage.plans.${id}.tagline`)}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                {t(`featuresPage.plans.${id}.description`)}
              </p>

              <ul className="mt-6 flex-1">
                {COMPARISON_ROWS.map((row) => (
                  <FeatureRow
                    key={row.id}
                    label={t(`featuresPage.comparison.rows.${row.id}`)}
                    value={row.values[id]}
                  />
                ))}
              </ul>

              <Button
                className={cn(
                  "mt-6 h-11 w-full rounded-full font-semibold",
                  popular
                    ? "bg-gradient-to-r from-brand to-brand-sky text-white shadow-md shadow-brand/25"
                    : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50",
                )}
                variant={popular ? "default" : "outline"}
                onClick={() => navigate("/pricing")}
              >
                {t(`featuresPage.plans.${id}.cta`)}
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          {t("featuresPage.comparison.footnote")}
        </p>
      </div>
    </section>
  );
}
