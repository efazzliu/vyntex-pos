import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Globe } from "lucide-react";
import { FlagAL, FlagUS } from "@/components/flag-icons.tsx";
import { useSiteLanguage } from "@/components/providers/site-locale-provider.tsx";
import { cn } from "@/lib/utils.ts";

export default function PhoneProfilePreferencesPage() {
  const { t } = useTranslation("site");
  const { language, setLanguage } = useSiteLanguage();

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
          <h1 className="text-lg font-bold text-slate-900">{t("phone.profile.language")}</h1>
          <p className="text-xs text-slate-500">{t("phone.profile.languageSubtitle")}</p>
        </div>
      </header>

      <div className="px-4 py-4">
        <div className="flex items-center gap-2 pb-3 text-sm font-medium text-slate-700">
          <Globe className="size-4 text-slate-500" />
          {t("phone.profile.interfaceLanguage")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLanguage("sq")}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors",
              language === "sq"
                ? "border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            <FlagAL className="h-4 w-6" />
            {t("phone.profile.langSq")}
          </button>
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors",
              language === "en"
                ? "border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            <FlagUS className="h-4 w-6" />
            {t("phone.profile.langEn")}
          </button>
        </div>
      </div>
    </div>
  );
}
