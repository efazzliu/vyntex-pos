import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ChefHat,
  LayoutGrid,
  Monitor,
  Package,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  EnterpriseMock,
  InventoryMock,
  KdsMock,
  PosOrderingMock,
  ReportsMock,
  StaffMock,
  TablesMock,
} from "./category-mockups.tsx";

export type FeatureCategory =
  | "all"
  | "pos"
  | "tables"
  | "kds"
  | "inventory"
  | "staff"
  | "reports"
  | "enterprise";

type Availability = "all" | "professional" | "enterprise" | "comingSoon";

type FeatureItem = {
  id: string;
  availability: Availability;
};

type CategoryMeta = {
  id: Exclude<FeatureCategory, "all">;
  icon: typeof Monitor;
  items: FeatureItem[];
  mock: typeof PosOrderingMock;
  learnMoreHref?: string;
};

const CATEGORY_TABS: { id: FeatureCategory; icon: typeof Monitor }[] = [
  { id: "all", icon: Sparkles },
  { id: "pos", icon: Monitor },
  { id: "tables", icon: LayoutGrid },
  { id: "kds", icon: ChefHat },
  { id: "inventory", icon: Package },
  { id: "staff", icon: Users },
  { id: "reports", icon: BarChart3 },
  { id: "enterprise", icon: Boxes },
];

const OVERVIEW_CARDS: { id: Exclude<FeatureCategory, "all">; icon: typeof Monitor }[] = [
  { id: "pos", icon: Monitor },
  { id: "tables", icon: LayoutGrid },
  { id: "kds", icon: ChefHat },
  { id: "inventory", icon: Package },
  { id: "staff", icon: Users },
  { id: "reports", icon: BarChart3 },
];

/**
 * Category feature lists for browsing only.
 * Availability badges mirror implemented plan rules / roadmap — never unlock POS features.
 */
const CATEGORIES: CategoryMeta[] = [
  {
    id: "pos",
    icon: Monitor,
    mock: PosOrderingMock,
    learnMoreHref: "/product-demo",
    items: [
      { id: "quickOrder", availability: "all" },
      { id: "modifiers", availability: "all" },
      { id: "splitBills", availability: "professional" },
      { id: "multiplePayments", availability: "all" },
      { id: "discounts", availability: "all" },
      { id: "orderHistory", availability: "all" },
    ],
  },
  {
    id: "tables",
    icon: LayoutGrid,
    mock: TablesMock,
    learnMoreHref: "/product-demo",
    items: [
      { id: "floorManagement", availability: "all" },
      { id: "tableLayout", availability: "all" },
      { id: "zones", availability: "professional" },
      { id: "reservations", availability: "comingSoon" },
      { id: "tableTransfer", availability: "all" },
      { id: "mergeTables", availability: "all" },
    ],
  },
  {
    id: "kds",
    icon: ChefHat,
    mock: KdsMock,
    learnMoreHref: "/pricing",
    items: [
      { id: "liveOrders", availability: "comingSoon" },
      { id: "orderStatus", availability: "comingSoon" },
      { id: "prepQueue", availability: "comingSoon" },
      { id: "stations", availability: "comingSoon" },
      { id: "barDisplay", availability: "comingSoon" },
      { id: "priority", availability: "comingSoon" },
    ],
  },
  {
    id: "inventory",
    icon: Package,
    mock: InventoryMock,
    learnMoreHref: "/pricing",
    items: [
      { id: "stockManagement", availability: "all" },
      { id: "stockAdjustments", availability: "all" },
      { id: "lowStock", availability: "all" },
      { id: "suppliers", availability: "enterprise" },
      { id: "purchaseOrders", availability: "comingSoon" },
      { id: "recipes", availability: "enterprise" },
    ],
  },
  {
    id: "staff",
    icon: Users,
    mock: StaffMock,
    learnMoreHref: "/pricing",
    items: [
      { id: "staffManagement", availability: "all" },
      { id: "pinLogin", availability: "all" },
      { id: "roles", availability: "all" },
      { id: "shifts", availability: "comingSoon" },
      { id: "activity", availability: "professional" },
    ],
  },
  {
    id: "reports",
    icon: BarChart3,
    mock: ReportsMock,
    learnMoreHref: "/pricing",
    items: [
      { id: "salesAnalytics", availability: "professional" },
      { id: "zReports", availability: "all" },
      { id: "paymentReports", availability: "all" },
      { id: "productPerformance", availability: "professional" },
      { id: "staffPerformance", availability: "professional" },
      { id: "csvExport", availability: "professional" },
    ],
  },
  {
    id: "enterprise",
    icon: Boxes,
    mock: EnterpriseMock,
    learnMoreHref: "/pricing",
    items: [
      { id: "multiLocation", availability: "enterprise" },
      { id: "supply", availability: "enterprise" },
      { id: "recipeCosting", availability: "enterprise" },
      { id: "centralDashboard", availability: "enterprise" },
      { id: "apiWebhooks", availability: "comingSoon" },
      { id: "customReports", availability: "enterprise" },
    ],
  },
];

function AvailabilityBadge({ availability }: { availability: Availability }) {
  const { t } = useTranslation("site");
  if (availability === "all") return null;

  const label =
    availability === "professional"
      ? t("featuresPage.availability.professional")
      : availability === "enterprise"
        ? t("featuresPage.availability.enterprise")
        : t("featuresPage.availability.comingSoon");

  const tone =
    availability === "comingSoon"
      ? "border-neutral-200 bg-neutral-100 text-neutral-500"
      : availability === "enterprise"
        ? "border-brand-accent/30 bg-brand-accent/10 text-brand-accent"
        : "border-brand/20 bg-brand/10 text-brand";

  return (
    <span
      className={cn(
        "ml-2 inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone,
      )}
    >
      {label}
    </span>
  );
}

function CategoryDetail({
  category,
  reverse,
}: {
  category: CategoryMeta;
  reverse: boolean;
}) {
  const { t } = useTranslation("site");
  const Icon = category.icon;
  const Mock = category.mock;

  return (
    <div
      className={cn(
        "grid items-center gap-10 lg:grid-cols-2",
        reverse && "lg:[&>*:first-child]:order-2",
      )}
    >
      <div>
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/15 to-brand-accent/15">
          <Icon className="size-6 text-brand" />
        </div>
        <h3 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">
          {t(`featuresPage.categories.${category.id}.title`)}
        </h3>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-neutral-500 sm:text-base">
          {t(`featuresPage.categories.${category.id}.description`)}
        </p>

        <ul className="mt-6 space-y-0">
          {category.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2.5 border-b border-neutral-100 py-2.5 last:border-b-0"
            >
              <Check
                className="mt-0.5 size-4 shrink-0 text-brand-accent"
                strokeWidth={2.5}
              />
              <span className="flex flex-wrap items-center text-sm font-medium text-neutral-800">
                {t(`featuresPage.categories.${category.id}.items.${item.id}`)}
                <AvailabilityBadge availability={item.availability} />
              </span>
            </li>
          ))}
        </ul>

        {category.learnMoreHref ? (
          <Link
            to={category.learnMoreHref}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-brand-hover"
          >
            {t("featuresPage.learnMore")}
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>

      <div className="min-h-[260px]">
        <Mock />
      </div>
    </div>
  );
}

export default function CategoryNav() {
  const { t } = useTranslation("site");
  const [active, setActive] = useState<FeatureCategory>("all");
  const tablistId = useId();

  const activeCategory = useMemo(
    () => CATEGORIES.find((c) => c.id === active) ?? null,
    [active],
  );

  const activeIndex = CATEGORY_TABS.findIndex((tab) => tab.id === active);

  return (
    <section
      className="border-t border-neutral-200 bg-white py-16 text-neutral-950 sm:py-20"
      data-features-categories="light"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          role="tablist"
          aria-label={t("featuresPage.tabsLabel")}
          id={tablistId}
          className="-mt-2 overflow-x-auto pb-1"
        >
          <div className="inline-flex min-w-full gap-2 rounded-2xl border border-neutral-200 bg-[#FAFAFA] p-2 sm:min-w-0 sm:flex-wrap">
            {CATEGORY_TABS.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`${tablistId}-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`${tablistId}-panel`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActive(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") {
                      return;
                    }
                    e.preventDefault();
                    let next = index;
                    if (e.key === "ArrowRight") next = (index + 1) % CATEGORY_TABS.length;
                    if (e.key === "ArrowLeft") {
                      next = (index - 1 + CATEGORY_TABS.length) % CATEGORY_TABS.length;
                    }
                    if (e.key === "Home") next = 0;
                    if (e.key === "End") next = CATEGORY_TABS.length - 1;
                    setActive(CATEGORY_TABS[next].id);
                    document.getElementById(`${tablistId}-tab-${CATEGORY_TABS[next].id}`)?.focus();
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all",
                    isActive
                      ? "bg-gradient-to-r from-brand to-brand-sky text-white shadow-md shadow-brand/20"
                      : "text-neutral-500 hover:bg-white hover:text-neutral-900",
                  )}
                >
                  <Icon className="size-4" />
                  {t(`featuresPage.tabs.${tab.id}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div
          role="tabpanel"
          id={`${tablistId}-panel`}
          aria-labelledby={`${tablistId}-tab-${active}`}
          className="relative mt-10 min-h-[420px]"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {active === "all" ? (
                <div>
                  <div className="mx-auto max-w-2xl text-center">
                    <h2 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">
                      {t("featuresPage.overviewTitle")}
                    </h2>
                    <p className="mt-3 text-sm text-neutral-500 sm:text-base">
                      {t("featuresPage.overviewSubtitle")}
                    </p>
                  </div>
                  <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {OVERVIEW_CARDS.map((card) => {
                      const Icon = card.icon;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => setActive(card.id)}
                          className="group flex flex-col rounded-2xl border border-neutral-200 bg-[#FAFAFA] p-6 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-brand/35 hover:shadow-md hover:shadow-brand/5"
                        >
                          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand/15 to-brand-accent/15">
                            <Icon className="size-5 text-brand" />
                          </div>
                          <h3 className="text-lg font-semibold text-neutral-950">
                            {t(`featuresPage.cards.${card.id}.title`)}
                          </h3>
                          <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-500">
                            {t(`featuresPage.cards.${card.id}.description`)}
                          </p>
                          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                            {t("featuresPage.exploreCategory")}
                            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-8 text-center text-sm text-neutral-400">
                    {t("featuresPage.enterpriseHint")}
                  </p>
                </div>
              ) : activeCategory ? (
                <CategoryDetail
                  category={activeCategory}
                  reverse={activeIndex % 2 === 0}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
