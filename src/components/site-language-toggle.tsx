import { Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { FlagAL, FlagUS } from "@/components/flag-icons.tsx";
import { useSiteLanguage } from "@/components/providers/site-locale-provider.tsx";
import { cn } from "@/lib/utils.ts";

type SiteLanguageToggleProps = {
  triggerClassName?: string;
  align?: "start" | "center" | "end";
};

export function SiteLanguageToggle({
  triggerClassName,
  align = "end",
}: SiteLanguageToggleProps) {
  const { language, setLanguage } = useSiteLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Change language"
          title={language === "sq" ? "Shqip" : "English"}
          className={cn(
            "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
            triggerClassName,
          )}
        >
          {language === "sq" ? <FlagAL className="h-3.5 w-5" /> : <FlagUS className="h-3.5 w-5" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[10.5rem]">
        <DropdownMenuItem
          className="cursor-pointer gap-2"
          onClick={() => setLanguage("sq")}
        >
          <FlagAL />
          <span className="flex-1 font-medium">Shqip</span>
          {language === "sq" ? <Check className="size-4 text-[#0066FF]" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2"
          onClick={() => setLanguage("en")}
        >
          <FlagUS />
          <span className="flex-1 font-medium">English</span>
          {language === "en" ? <Check className="size-4 text-[#0066FF]" /> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
