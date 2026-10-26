import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { SettingsCategoryId } from "./pos-settings-categories.ts";

export type SettingsHubItem = {
  id: SettingsCategoryId;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  comingSoon?: boolean;
};

type SettingsCategoryHubProps = {
  items: SettingsHubItem[];
  t: (key: string) => string;
  onSelect: (id: SettingsCategoryId) => void;
};

export default function SettingsCategoryHub({
  items,
  t,
  onSelect,
}: SettingsCategoryHubProps) {
  return (
    <div className="min-h-full w-full p-5 lg:p-6">
      <header className="mb-5">
        <h1 className="text-[26px] font-bold tracking-tight text-white">
          {t("settings.hub_title")}
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const soon = item.comingSoon === true;
          return (
            <button
              key={item.id}
              type="button"
              disabled={soon}
              onClick={() => onSelect(item.id)}
              className={cn(
                "group flex items-center gap-3.5 rounded-[18px] border border-[#1e2a45] bg-[#131A2E]",
                "px-4 py-[17px] text-left",
                "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
                "transition-all duration-200 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
                soon
                  ? "cursor-default opacity-60"
                  : "cursor-pointer hover:-translate-y-px hover:border-brand/30 hover:shadow-[0_14px_32px_-18px_rgba(0,91,214,0.45)]",
              )}
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-light transition-colors duration-200 group-hover:bg-brand-subtle">
                <Icon className="size-[22px] text-brand" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-tight text-white">
                  {t(item.titleKey)}
                </p>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-[#8b93a7]">
                  {t(item.descKey)}
                </p>
              </div>
              {soon ? (
                <span className="shrink-0 rounded-md bg-[#1e2a45] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#8b93a7] uppercase">
                  {t("nav.coming_soon_badge")}
                </span>
              ) : (
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    "text-brand/70 transition-all duration-200",
                    "group-hover:translate-x-0.5 group-hover:bg-brand/10 group-hover:text-brand",
                  )}
                >
                  <ChevronRight className="size-5" strokeWidth={2} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
