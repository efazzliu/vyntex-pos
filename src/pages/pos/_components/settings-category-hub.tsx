import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { SettingsCategoryId } from "./pos-settings-categories.ts";

const ACCENT: Record<SettingsCategoryId, string> = {
  general: "#7C3AED",
  payments: "#10B981",
  menu: "#F59E0B",
  devices: "#2563EB",
  users: "#4F46E5",
  tax: "#D97706",
  notifications: "#EC4899",
  integrations: "#06B6D4",
  money: "#059669",
  backup: "#0EA5E9",
  security: "#DC2626",
  print: "#0D9488",
  customerDisplay: "#C026D3",
  phoneApp: "#0284C7",
  other: "#64748B",
};

export type SettingsHubItem = {
  id: SettingsCategoryId;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
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

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const color = ACCENT[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "group flex items-center gap-3.5 rounded-[18px] border border-[#1e2a45] bg-[#131A2E]",
                "px-4 py-[17px] text-left cursor-pointer",
                "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
                "transition-all duration-200 ease-out",
                "hover:-translate-y-px hover:border-[#7C3AED]/30",
                "hover:shadow-[0_14px_32px_-18px_rgba(124,58,237,0.45)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]/50",
              )}
            >
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${color}1F` }}
              >
                <Icon
                  className="size-[22px]"
                  style={{ color }}
                  strokeWidth={1.75}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-tight text-white">
                  {t(item.titleKey)}
                </p>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-[#8b93a7]">
                  {t(item.descKey)}
                </p>
              </div>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  "text-[#7C3AED]/70 transition-all duration-200",
                  "group-hover:translate-x-0.5 group-hover:bg-[#7C3AED]/10 group-hover:text-[#7C3AED]",
                )}
              >
                <ChevronRight className="size-5" strokeWidth={2} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
