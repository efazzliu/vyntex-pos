import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Bell, ChevronDown, LogOut, Monitor, Moon, Search, Sun, UserRound, X } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { supabase } from "@/lib/supabase.ts";

const SUBTITLE_BY_PREFIX: Array<{ prefix: string; text: string }> = [
  { prefix: "/admin/businesses/", text: "Client workspace, billing context, and account signals." },
  { prefix: "/admin/licenses/", text: "License seat management and renewal posture for this account." },
  { prefix: "/admin/businesses", text: "Browse tenant accounts, health, and engagement across the fleet." },
  { prefix: "/admin/branches", text: "Locations, terminals, and rollout coverage across clients." },
  { prefix: "/admin/subscriptions", text: "Plans, renewals, and revenue composition across the platform." },
  { prefix: "/admin/invoices", text: "Billing documents, payment status, and reconciliation." },
  { prefix: "/admin/finance", text: "Legacy finance tools and historical ledger views." },
  { prefix: "/admin/licenses", text: "Keys, activations, and compliance across deployments." },
  { prefix: "/admin/users", text: "Internal operators, access scopes, and collaboration." },
  { prefix: "/admin/staff-roles", text: "Role templates and permission boundaries for platform staff." },
  { prefix: "/admin/modules", text: "Feature flags and module availability by segment." },
  { prefix: "/admin/bookings", text: "Scheduled work, onboarding queues, and capacity." },
  { prefix: "/admin/reports", text: "Exports, trends, and operational analytics." },
  { prefix: "/admin/support", text: "Tickets, escalations, and customer success workflows." },
  { prefix: "/admin/system-monitor", text: "Uptime, latency, and infrastructure health signals." },
  { prefix: "/admin/marketing", text: "Campaigns, messaging, and growth experiments." },
  { prefix: "/admin/contacts", text: "Inbound leads, handoffs, and CRM-style touchpoints." },
  { prefix: "/admin/settings", text: "Global defaults, integrations, and platform configuration." },
];

function adminPageSubtitle(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/admin";
  if (normalized === "/admin") {
    return "Central command center for platform KPIs, health signals, and global activity.";
  }
  for (const { prefix, text } of SUBTITLE_BY_PREFIX) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return text;
  }
  return "Platform administration — tools and visibility for operators.";
}

export function AdminPageHeader() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user } = useUserRole();
  const location = useLocation();
  const adminName = user?.name?.trim() || user?.email || "Admin";
  const adminEmail = user?.email ?? "";
  const profileInitial = adminName.charAt(0).toUpperCase();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const subtitle = adminPageSubtitle(location.pathname);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">Welcome, {adminName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
          <div className="flex items-center gap-2">
            {searchOpen && (
              <div className="relative w-full min-w-[200px] max-w-xs sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search..."
                  className="h-10 rounded-full border-slate-200/80 bg-slate-50/80 pl-9 pr-9 shadow-[0_6px_18px_-14px_rgba(2,6,23,0.55)] backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-[#0066FF]/25 dark:border-slate-700/80 dark:bg-slate-900/70"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchValue("");
                  }}
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/85 text-slate-500 shadow-[0_6px_18px_-14px_rgba(2,6,23,0.55)] transition-all hover:border-slate-300 hover:bg-white hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            >
              <Search className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Notifications"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/85 text-slate-500 shadow-[0_6px_18px_-14px_rgba(2,6,23,0.55)] transition-all hover:border-slate-300 hover:bg-white hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            >
              <Bell className="size-4" />
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/85 px-2 pr-2.5 shadow-[0_8px_20px_-16px_rgba(2,6,23,0.6)] backdrop-blur-sm transition hover:border-slate-300 hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/70 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                aria-label="Open account menu"
              >
                <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0066FF] to-[#44CC00] text-xs font-bold text-white">
                  {profileInitial}
                </div>
                <span className="hidden max-w-[140px] truncate text-sm font-medium text-foreground sm:inline">
                  {adminName}
                </span>
                <ChevronDown className="size-4 shrink-0 text-slate-400 dark:text-slate-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl border-slate-200/90 p-1.5 shadow-xl dark:border-slate-700">
              <DropdownMenuLabel className="px-2 py-1.5 font-normal">
                <span className="block truncate text-sm font-semibold text-foreground">{adminName}</span>
                {adminEmail ? (
                  <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{adminEmail}</span>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                <Link to="/admin/settings#account" className="flex items-center gap-2">
                  <UserRound className="size-4" />
                  Profile & account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Theme
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light" className="cursor-pointer rounded-lg">
                  <Sun className="size-4 text-amber-500" />
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" className="cursor-pointer rounded-lg">
                  <Moon className="size-4 text-indigo-400" />
                  Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system" className="cursor-pointer rounded-lg">
                  <Monitor className="size-4 text-slate-500" />
                  Match system
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer rounded-lg"
                onSelect={(e) => {
                  e.preventDefault();
                  void handleSignOut();
                }}
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
