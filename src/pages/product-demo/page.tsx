import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, LayoutGrid, PieChart, Sparkles, UtensilsCrossed, Users } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { useMarketingPrimaryCtaHref } from "@/hooks/use-marketing-primary-cta-href.ts";
import { DEMO_TABLES, type DemoTable } from "./_data.ts";
import DemoFloorPlan from "./_components/demo-floor-plan.tsx";
import DemoOrderPanel from "./_components/demo-order-panel.tsx";
import DemoMenu from "./_components/demo-menu.tsx";
import DemoStaff from "./_components/demo-staff.tsx";
import DemoAnalytics from "./_components/demo-analytics.tsx";

type DemoTab = "floor" | "menu" | "staff" | "analytics";

const TABS: { id: DemoTab; icon: typeof LayoutGrid; labelKey: string }[] = [
  { id: "floor", icon: LayoutGrid, labelKey: "productDemo.tabFloor" },
  { id: "menu", icon: UtensilsCrossed, labelKey: "productDemo.tabMenu" },
  { id: "staff", icon: Users, labelKey: "productDemo.tabStaff" },
  { id: "analytics", icon: PieChart, labelKey: "productDemo.tabAnalytics" },
];

export default function ProductDemoPage() {
  const { t } = useTranslation("site");
  const primaryCtaHref = useMarketingPrimaryCtaHref();
  const [tab, setTab] = useState<DemoTab>("floor");
  const [tables, setTables] = useState<DemoTable[]>(DEMO_TABLES);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const selectedTable = tables.find((tbl) => tbl.id === selectedTableId) ?? null;

  const openTable = (id: string) => {
    setTables((prev) =>
      prev.map((tbl) => (tbl.id === id ? { ...tbl, status: "occupied" } : tbl)),
    );
    setSelectedTableId(id);
  };

  const finishOrder = () => {
    setTables((prev) =>
      prev.map((tbl) => (tbl.id === selectedTableId ? { ...tbl, status: "available" } : tbl)),
    );
    setSelectedTableId(null);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#0066FF]/25 bg-[#0066FF]/10 px-3.5 py-1.5 text-xs font-semibold text-[#0066FF]">
          <Sparkles className="size-3.5" />
          {t("productDemo.badge")}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("productDemo.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("productDemo.subtitle")}
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-3xl border border-[#1e2a45] bg-[#0A0F1E] shadow-[0_40px_100px_-50px_rgba(0,102,255,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e2a45] bg-[#0D1326] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setSelectedTableId(null);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm",
                  tab === item.id
                    ? "bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/25"
                    : "text-[#8b93a7] hover:bg-[#131A2E] hover:text-white",
                )}
              >
                <item.icon className="size-4" />
                <span className="hidden sm:inline">{t(item.labelKey)}</span>
              </button>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[#5a6580]">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {t("productDemo.liveBadge")}
          </span>
        </div>

        <div>
          {tab === "floor" &&
            (selectedTable ? (
              <DemoOrderPanel
                table={selectedTable}
                onBack={() => setSelectedTableId(null)}
                onCharged={finishOrder}
              />
            ) : (
              <DemoFloorPlan tables={tables} onSelectTable={openTable} />
            ))}
          {tab === "menu" && <DemoMenu />}
          {tab === "staff" && <DemoStaff />}
          {tab === "analytics" && <DemoAnalytics />}
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center sm:flex-row">
        <p className="text-sm text-muted-foreground">{t("productDemo.ctaHint")}</p>
        <Button asChild className="h-10 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white">
          <Link to={primaryCtaHref} className="inline-flex items-center">
            {t("home.hero.ctaPrimary")}
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
