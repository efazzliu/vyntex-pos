import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, MoonStar, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils.ts";

export default function PhoneProfileDisplayPage() {
  const { t } = useTranslation("site");
  const { theme, setTheme } = useTheme();
  const activeTheme = theme === "dark" ? "dark" : "light";

  return (
    <div className="flex min-h-full flex-col bg-transparent">
      <header
        className={cn(
          "sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3",
          "pt-[max(0.5rem,env(safe-area-inset-top))]",
        )}
      >
        <Link
          to="/app/profile"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-[#0066FF]/10"
          aria-label={t("phone.profile.backToProfile")}
        >
          <ChevronLeft className="size-6" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-900">{t("phone.profile.display")}</h1>
          <p className="text-xs text-slate-500">{t("phone.profile.displaySubtitle")}</p>
        </div>
      </header>

      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={cn(
              "rounded-xl border-2 px-3 py-4 text-sm font-semibold transition-colors",
              activeTheme === "light"
                ? "border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            <Sun className="mx-auto mb-2 size-5" />
            {t("phone.profile.displayLight")}
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={cn(
              "rounded-xl border-2 px-3 py-4 text-sm font-semibold transition-colors",
              activeTheme === "dark"
                ? "border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            <MoonStar className="mx-auto mb-2 size-5" />
            {t("phone.profile.displayDark")}
          </button>
        </div>
      </div>
    </div>
  );
}
