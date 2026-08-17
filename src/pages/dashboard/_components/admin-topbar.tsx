import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { cn } from "@/lib/utils.ts";
import { supabase } from "@/lib/supabase.ts";
import { clearDashboardRestaurantId } from "@/hooks/use-dashboard-restaurant.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { useDashboardLocale } from "./dashboard-locale-context.tsx";
import { useAdminCenter } from "./admin-center-context.tsx";
import { DATE_PRESET_LABELS } from "../_lib/admin-center-format.ts";
import type { DatePreset } from "../_lib/admin-center-types.ts";

const PRESETS: DatePreset[] = ["today", "week", "month", "last_month", "quarter", "year", "custom"];

export function AdminTopbar() {
  const { t, lang } = useDashboardLocale();
  const navigate = useNavigate();
  const { user } = useUserRole();
  const {
    venues,
    venueFilterId,
    setVenueFilterId,
    datePreset,
    setDatePreset,
    customRange,
    setCustomRange,
    searchOpen,
    setSearchOpen,
  } = useAdminCenter();

  const [customOpen, setCustomOpen] = useState(false);
  const [rangeDraft, setRangeDraft] = useState<{ from?: Date; to?: Date }>({});

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSearchOpen]);

  const displayName = user?.name?.trim() || user?.email || "Account";
  const initial = displayName.charAt(0).toUpperCase();
  const selectedVenue =
    venueFilterId === "all" ? null : venues.find((v) => v.id === venueFilterId);
  const dateLabel =
    datePreset === "custom" && customRange
      ? `${customRange.from.toLocaleDateString()} – ${customRange.to.toLocaleDateString()}`
      : DATE_PRESET_LABELS[datePreset][lang];

  const signOut = async () => {
    clearDashboardRestaurantId();
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-3 backdrop-blur-md sm:px-5">
      <Link
        to="/app"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 md:hidden"
        aria-label={t("ac.nav.back_venues")}
      >
        <ChevronLeft className="size-5" />
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex max-w-[14rem] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
          >
            <Building2 className="size-4 text-indigo-500" />
            <span className="truncate">
              {selectedVenue?.name ?? t("ac.filter.all_venues")}
            </span>
            <ChevronDown className="size-3.5 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuItem onClick={() => setVenueFilterId("all")}>
            {t("ac.filter.all_venues")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {venues.map((venue) => (
            <DropdownMenuItem key={venue.id} onClick={() => setVenueFilterId(venue.id)}>
              <span className="truncate">{venue.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
          >
            <CalendarDays className="size-4 text-indigo-500" />
            <span>{dateLabel}</span>
            <ChevronDown className="size-3.5 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset}
              onClick={() => {
                if (preset === "custom") {
                  setCustomOpen(true);
                  return;
                }
                setDatePreset(preset);
              }}
            >
              {DATE_PRESET_LABELS[preset][lang]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <span className="sr-only">Custom range</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <Calendar
            mode="range"
            selected={{ from: rangeDraft.from, to: rangeDraft.to }}
            onSelect={(range) => setRangeDraft({ from: range?.from, to: range?.to })}
            numberOfMonths={2}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCustomOpen(false)}>
              {t("ac.common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!rangeDraft.from || !rangeDraft.to) {
                  toast.error(t("ac.filter.pick_range"));
                  return;
                }
                setCustomRange({ from: rangeDraft.from, to: rangeDraft.to });
                setDatePreset("custom");
                setCustomOpen(false);
              }}
            >
              {t("ac.filter.apply")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="ml-auto hidden min-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white lg:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">{t("ac.search.placeholder")}</span>
        <kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="ml-auto inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 lg:hidden"
        aria-label={t("ac.search.placeholder")}
      >
        <Search className="size-4" />
      </button>

      <Link
        to="/admin-center/activity"
        className="relative inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
        aria-label={t("ac.nav.notifications")}
      >
        <Bell className="size-4" />
        <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-indigo-500" />
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-slate-50"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-xs font-bold text-white">
              {initial}
            </span>
            <ChevronDown className="hidden size-3.5 text-slate-400 sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="text-xs text-slate-500">{t("ac.nav.owner")}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/admin-center/settings?tab=account">
              <Settings className="size-4" />
              {t("ac.nav.profile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" />
            {t("nav.sign_out")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen} title={t("ac.search.title")}>
        <CommandInput placeholder={t("ac.search.placeholder")} />
        <CommandList>
          <CommandEmpty>{t("ac.search.empty")}</CommandEmpty>
          <CommandGroup heading={t("ac.nav.admin_center")}>
            <CommandItem onSelect={() => { setSearchOpen(false); navigate("/admin-center/overview"); }}>
              <LayoutDashboard className="size-4" />
              {t("ac.nav.overview")}
            </CommandItem>
            <CommandItem onSelect={() => { setSearchOpen(false); navigate("/admin-center/venues"); }}>
              <Building2 className="size-4" />
              {t("ac.nav.venues")}
            </CommandItem>
            <CommandItem onSelect={() => { setSearchOpen(false); navigate("/admin-center/licenses"); }}>
              {t("ac.nav.licenses")}
            </CommandItem>
            <CommandItem onSelect={() => { setSearchOpen(false); navigate("/admin-center/billing"); }}>
              {t("ac.nav.billing")}
            </CommandItem>
          </CommandGroup>
          {venues.length > 0 ? (
            <CommandGroup heading={t("ac.nav.venues")}>
              {venues.map((venue) => (
                <CommandItem
                  key={venue.id}
                  onSelect={() => {
                    setSearchOpen(false);
                    setVenueFilterId(venue.id);
                    navigate("/admin-center/venues");
                  }}
                >
                  {venue.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </header>
  );
}
