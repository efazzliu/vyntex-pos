import { MessageCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SUPPORT_MAILTO_HREF } from "@/lib/site-constants.ts";
import { cn } from "@/lib/utils.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";

type PosPrioritySupportNavProps = {
  /** Admin slide-out: full-width row like other nav items */
  variant: "drawer" | "sidebar";
  /** Drawer + popover portal outside POS `data-pos-theme`; pass explicit theme when used from AdminDrawer. */
  theme?: "dark" | "light";
};

export default function PosPrioritySupportNav({
  variant,
  theme = "dark",
}: PosPrioritySupportNavProps) {
  const { t } = usePosLocale();
  const light = theme === "light";

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === "drawer" ? (
          <button
            type="button"
            className={cn(
              "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer",
              light
                ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                : "text-[#8b93a7] hover:bg-[#1e2a45]/60 hover:text-white",
            )}
          >
            <MessageCircle className="size-5 shrink-0" />
            <span className="flex-1 text-left">{t("support.priority_btn")}</span>
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "flex flex-col items-center gap-1 w-16 py-2.5 rounded-xl transition-all cursor-pointer",
              "text-[#5a6580] hover:text-[#8b93a7] hover:bg-[#1e2a45]/50",
            )}
          >
            <MessageCircle className="size-5" />
            <span className="text-[10px] font-medium leading-tight text-center px-0.5">
              {t("support.priority_btn")}
            </span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={12}
        data-pos-theme={theme}
        className={cn(
          "z-[100] w-[min(100vw-2rem,360px)] rounded-2xl p-0 shadow-2xl overflow-hidden",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          light
            ? "border border-slate-200 bg-white"
            : "border border-[#1e2a45] bg-[#131A2E]",
        )}
      >
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white">
          <MessageCircle className="size-5 shrink-0" />
          <span className="font-semibold text-sm truncate">
            {t("support.priority_title")}
          </span>
        </div>
        <div
          className={cn(
            "p-4 space-y-3 text-sm",
            light ? "text-slate-600" : "text-[#8b93a7]",
          )}
        >
          <p>{t("support.priority_body")}</p>
          <Button
            asChild
            className="w-full bg-white text-[#0066FF] hover:bg-white/90"
          >
            <a href={SUPPORT_MAILTO_HREF}>{t("support.priority_email")}</a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
