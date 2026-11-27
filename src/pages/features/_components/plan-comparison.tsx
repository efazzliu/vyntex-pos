import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Layers, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

/** Scoped VyntexPOS red for this light comparison surface only. */
const VYNTEX_RED = "#E31E24";
const INCLUDE_GREEN = "#16A34A";
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

function AvailabilityCell({ value }: { value: CellValue }) {
  const { t } = useTranslation("site");

  if (value === true) {
    return (
      <span className="inline-flex size-7 items-center justify-center" aria-label={t("featuresPage.comparison.included")}>
        <Check className="size-4" strokeWidth={2.5} style={{ color: INCLUDE_GREEN }} />
      </span>
    );
  }

  if (value === false) {
    return (
      <span
        className="inline-flex size-7 items-center justify-center text-lg font-medium leading-none"
        style={{ color: DASH_GRAY }}
        aria-label={t("featuresPage.comparison.notIncluded")}
      >
        —
      </span>
    );
  }

  return (
    <span className="text-[13px] font-medium leading-snug text-neutral-700">
      {t(`featuresPage.comparison.values.${value}`)}
    </span>
  );
}

export default function PlanComparison() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();

  return (
    <section
      className="border-t border-neutral-200 py-20"
      style={{ backgroundColor: "#FFFFFF", color: "#0A0A0A" }}
      data-features-comparison="light"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="text-sm font-semibold uppercase tracking-[0.14em]"
            style={{ color: VYNTEX_RED }}
          >
            {t("featuresPage.plansLabel")}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {t("featuresPage.plansTitle")}
          </h2>
        </div>

        {/* Plan summary cards */}
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3 md:items-stretch">
          {PLAN_ORDER.map(({ id, popular, Icon }) => (
            <div
              key={id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-[#FAFAFA] p-6",
                popular ? "shadow-sm" : "border-neutral-200",
              )}
              style={
                popular
                  ? { borderColor: VYNTEX_RED, boxShadow: `0 0 0 1px ${VYNTEX_RED}22` }
                  : undefined
              }
            >
              {popular ? (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide text-white"
                  style={{ backgroundColor: VYNTEX_RED }}
                >
                  {t("pricing.mostPopular")}
                </span>
              ) : null}
              <div
                className="mb-4 flex size-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${VYNTEX_RED}14` }}
              >
                <Icon className="size-5" style={{ color: VYNTEX_RED }} />
              </div>
              <h3 className="text-xl font-bold text-neutral-950">
                {t(`featuresPage.plans.${id}.name`)}
              </h3>
              <p className="mt-1 text-sm font-medium" style={{ color: VYNTEX_RED }}>
                {t(`featuresPage.plans.${id}.tagline`)}
              </p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-500">
                {t(`featuresPage.plans.${id}.description`)}
              </p>
              <Button
                className={cn(
                  "mt-6 h-11 w-full rounded-full font-semibold",
                  !popular && "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50",
                )}
                style={
                  popular
                    ? { backgroundColor: VYNTEX_RED, color: "#fff" }
                    : undefined
                }
                variant={popular ? "default" : "outline"}
                onClick={() => navigate("/pricing")}
              >
                {t(`featuresPage.plans.${id}.cta`)}
              </Button>
            </div>
          ))}
        </div>

        {/* Feature matrix — horizontal scroll on small screens */}
        <div className="mt-14 overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <table className="min-w-[720px] w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-neutral-200 bg-[#FAFAFA]">
                <th className="sticky left-0 z-[1] bg-[#FAFAFA] px-5 py-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  {t("featuresPage.comparison.featureCol")}
                </th>
                {PLAN_ORDER.map(({ id, popular }) => (
                  <th
                    key={id}
                    className={cn(
                      "px-5 py-4 text-center text-sm font-semibold text-neutral-900",
                      popular && "bg-[#FFF5F5]",
                    )}
                  >
                    {t(`featuresPage.plans.${id}.name`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100 last:border-b-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] bg-white px-5 py-3.5 text-sm font-medium text-neutral-800"
                  >
                    {t(`featuresPage.comparison.rows.${row.id}`)}
                  </th>
                  {PLAN_ORDER.map(({ id, popular }) => (
                    <td
                      key={id}
                      className={cn(
                        "px-5 py-3.5 text-center align-middle",
                        popular && "bg-[#FFF5F5]/60",
                      )}
                    >
                      <div className="flex justify-center">
                        <AvailabilityCell value={row.values[id]} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-xs text-neutral-400">
          {t("featuresPage.comparison.footnote")}
        </p>
      </div>
    </section>
  );
}
