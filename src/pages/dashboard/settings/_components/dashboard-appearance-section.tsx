import { useEffect, useState } from "react";
import { Languages, Palette } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type { DashboardLang } from "@/lib/dashboard-i18n.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { SettingsRow } from "./settings-row.tsx";

const REDUCED_MOTION_KEY = "vyntex.dashboard.reducedMotion";

function getReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(REDUCED_MOTION_KEY) === "1";
}

function setReducedMotion(enabled: boolean): void {
  localStorage.setItem(REDUCED_MOTION_KEY, enabled ? "1" : "0");
  document.documentElement.toggleAttribute("data-dashboard-reduced-motion", enabled);
}

const LANG_OPTIONS: { id: DashboardLang; label: string; native: string }[] = [
  { id: "en", label: "English", native: "English" },
  { id: "sq", label: "Albanian", native: "Shqip" },
];

export function DashboardAppearanceSection() {
  const { lang, setLang } = useDashboardLocale();
  const [reducedMotion, setReducedMotionState] = useState(false);

  useEffect(() => {
    const stored = getReducedMotion();
    setReducedMotionState(stored);
    document.documentElement.toggleAttribute("data-dashboard-reduced-motion", stored);
  }, []);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.28)] dark:border-slate-700/80 dark:bg-slate-900/90">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-200 pb-4 dark:border-slate-700/80">
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#0066FF]/10 to-[#00AACC]/10 p-2.5 text-[#0066FF] dark:border-slate-600 dark:text-cyan-400">
          <Palette className="size-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Appearance</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Language and display preferences for your dashboard.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
            <Languages className="size-4 text-[#0066FF] dark:text-cyan-400" />
            Dashboard language
          </p>
          <div className="flex flex-wrap gap-2">
            {LANG_OPTIONS.map(({ id, label, native }) => (
              <Button
                key={id}
                type="button"
                variant={lang === id ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-10 rounded-xl px-4",
                  lang === id &&
                    "bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white hover:opacity-95 dark:text-white",
                )}
                onClick={() => {
                  setLang(id);
                  toast.success(id === "sq" ? "Gjuha: Shqip" : "Language: English");
                }}
              >
                <span className="font-medium">{native}</span>
                <span className="ml-1.5 text-xs opacity-80">({label})</span>
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Sidebar labels and dashboard text update immediately. POS desktop uses its own locale.
          </p>
        </div>

        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700/80">
          <SettingsRow
            label="Reduce motion"
            hint="Minimize animations in the dashboard for accessibility."
          >
            <Switch
              checked={reducedMotion}
              onCheckedChange={(checked) => {
                setReducedMotion(checked);
                setReducedMotionState(checked);
                toast.success(checked ? "Reduced motion on" : "Reduced motion off");
              }}
            />
          </SettingsRow>
        </div>
      </div>
    </section>
  );
}
