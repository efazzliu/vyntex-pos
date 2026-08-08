import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Languages, Monitor, Moon, Palette, Sun } from "lucide-react";
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

const THEME_OPTIONS = [
  { id: "light" as const, label: "Light", Icon: Sun, preview: "from-slate-100 to-white" },
  { id: "dark" as const, label: "Dark", Icon: Moon, preview: "from-slate-800 to-slate-950" },
  { id: "system" as const, label: "System", Icon: Monitor, preview: "from-slate-200 via-slate-100 to-slate-800" },
] as const;

type ThemeId = (typeof THEME_OPTIONS)[number]["id"];

const LANG_OPTIONS: { id: DashboardLang; label: string; native: string }[] = [
  { id: "en", label: "English", native: "English" },
  { id: "sq", label: "Albanian", native: "Shqip" },
];

export function DashboardAppearanceSection() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { lang, setLang } = useDashboardLocale();
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotionState] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = getReducedMotion();
    setReducedMotionState(stored);
    document.documentElement.toggleAttribute("data-dashboard-reduced-motion", stored);
  }, []);

  const activeTheme: ThemeId =
    theme === "light" || theme === "dark" || theme === "system" ? theme : "system";

  const handleThemeSelect = (id: ThemeId) => {
    setTheme(id);
    const label = THEME_OPTIONS.find((o) => o.id === id)?.label ?? id;
    toast.success(
      id === "system"
        ? "Theme follows your system settings"
        : `${label} theme applied`,
    );
  };

  const statusLine = (() => {
    if (!mounted) return "Choose how the dashboard looks on this device.";
    if (activeTheme === "system") {
      const mode = resolvedTheme === "dark" ? "dark" : "light";
      return `Following system settings · currently ${mode} mode.`;
    }
    return activeTheme === "dark"
      ? "Dark mode is active across the dashboard."
      : "Light mode is active across the dashboard.";
  })();

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.28)] dark:border-slate-700/80 dark:bg-slate-900/90">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-200 pb-4 dark:border-slate-700/80">
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#0066FF]/10 to-[#00AACC]/10 p-2.5 text-[#0066FF] dark:border-slate-600 dark:text-cyan-400">
          <Palette className="size-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Appearance</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Theme, language, and display preferences for your dashboard.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <p className="mb-3 text-sm font-medium text-slate-900 dark:text-white">Color theme</p>
          <div
            className="grid max-w-3xl gap-3 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Color theme"
          >
            {THEME_OPTIONS.map(({ id, label, Icon, preview }) => {
              const selected = mounted && activeTheme === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!mounted}
                  onClick={() => handleThemeSelect(id)}
                  className={cn(
                    "group flex flex-col overflow-hidden rounded-2xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]/50 disabled:cursor-wait disabled:opacity-60",
                    selected
                      ? "border-[#0066FF] ring-2 ring-[#0066FF]/30 dark:border-cyan-500 dark:ring-cyan-500/25"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-20 items-end justify-between bg-gradient-to-br p-3",
                      preview,
                    )}
                  >
                    <div className="flex gap-1">
                      <span className="size-2 rounded-full bg-[#0066FF]/80" />
                      <span className="size-2 rounded-full bg-[#00AACC]/80" />
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          id === "light" ? "bg-slate-300" : "bg-white/40",
                        )}
                      />
                    </div>
                    <Icon
                      className={cn(
                        "size-4",
                        id === "light" ? "text-slate-400" : "text-white/70",
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {label}
                    </span>
                    {selected ? (
                      <span className="rounded-full bg-[#0066FF]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0066FF] dark:bg-cyan-500/15 dark:text-cyan-400">
                        Active
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{statusLine}</p>
        </div>

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
