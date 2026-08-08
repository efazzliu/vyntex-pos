import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Check,
  Circle,
  Clock3,
  Globe,
  KeyRound,
  Loader2,
  Link2,
  Mail,
  Monitor,
  Phone,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { supabase } from "@/lib/supabase.ts";
import { SUPPORT_EMAIL, SUPPORT_MAILTO_HREF } from "@/lib/site-constants.ts";
import {
  ACCOUNT_COUNTRY_OPTIONS,
  buildAccountActivityFeed,
  computeProfileCompleteness,
  getProfileCompletionChecklist,
  loadDashboardAccountMeta,
  recordDashboardLoginVisit,
} from "../_lib/account-settings.ts";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { claimUnassignedLicenseForDashboardAccount } from "@/lib/supabase-pos/claim-license-dashboard.ts";
import type { DashboardActivityItem, DashboardUserMetadata } from "../_lib/types.ts";

type DashboardAccountSectionProps = {
  /** @deprecated use hook internally; kept for parent refresh callback */
  hasRestaurant?: boolean;
  restaurantName?: string;
  onVenueLinked?: () => void;
};

function LinkLicensePanel({ onLinked }: { onLinked: () => void }) {
  const [licenseInput, setLicenseInput] = useState("");
  const [claiming, setClaiming] = useState(false);

  const handleClaim = async () => {
    const raw = licenseInput.trim();
    if (raw.replace(/[^a-zA-Z0-9]/g, "").length < 16) {
      toast.error("Enter the full 16-character license key from your POS or email.");
      return;
    }
    setClaiming(true);
    try {
      const { licenseKey } = await claimUnassignedLicenseForDashboardAccount(raw);
      toast.success(`Venue linked — license ${licenseKey}`);
      onLinked();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not link this license. Check the key or contact support.",
      );
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-500/30 dark:bg-sky-950/40">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <Link2 className="size-4 text-[#0066FF] dark:text-cyan-400" />
        Link your license (venue)
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        If you already activated Vyntex POS on a PC, paste the same license key here so this
        account controls billing, downloads, and cloud data. New business?{" "}
        <Link
          to="/dashboard/get-started"
          className="font-medium text-[#0066FF] hover:underline dark:text-cyan-400"
        >
          Create a trial instead
        </Link>
        .
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={licenseInput}
          onChange={(e) => setLicenseInput(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          className={cn(fieldClass, "font-mono tracking-wider")}
          autoComplete="off"
          spellCheck={false}
        />
        <Button
          type="button"
          disabled={claiming}
          onClick={() => void handleClaim()}
          className="h-11 shrink-0 rounded-xl bg-[#0066FF] px-5 text-white hover:bg-[#0052cc]"
        >
          {claiming ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Linking…
            </>
          ) : (
            "Link license"
          )}
        </Button>
      </div>
    </div>
  );
}

const fieldClass =
  "h-11 rounded-xl border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-950";

function ActivityIcon({ id }: { id: string }) {
  if (id === "last-login") return <Clock3 className="size-4 text-[#0066FF] dark:text-cyan-400" />;
  if (id === "password-changed") return <KeyRound className="size-4 text-amber-600 dark:text-amber-400" />;
  return <Monitor className="size-4 text-emerald-600 dark:text-emerald-400" />;
}

function ActivityFeed({ items }: { items: DashboardActivityItem[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/50">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <Activity className="size-4 text-[#0066FF] dark:text-cyan-400" />
        Activity feed
      </p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/80"
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <ActivityIcon id={item.id} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {item.label}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100",
                  item.tone === "warning" && "text-amber-700 dark:text-amber-400",
                  item.tone === "info" && "text-[#0066FF] dark:text-cyan-400",
                )}
              >
                {item.value}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashboardAccountSection({
  hasRestaurant: hasRestaurantProp,
  restaurantName: restaurantNameProp,
  onVenueLinked,
}: DashboardAccountSectionProps) {
  const { restaurant, refresh: refreshRestaurant } = useDashboardRestaurant();
  const hasRestaurant = restaurant != null || Boolean(hasRestaurantProp);
  const restaurantName = restaurant?.name ?? restaurantNameProp;
  const [authLoaded, setAuthLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [activityItems, setActivityItems] = useState<DashboardActivityItem[]>([]);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const user = data.user;
      if (user) {
        const meta = (user.user_metadata ?? {}) as DashboardUserMetadata;
        setFullName((meta.full_name ?? "").trim());
        setEmail(user.email ?? "");
        setPhone(typeof meta.phone === "string" ? meta.phone.trim() : "");
        setCountry(typeof meta.country === "string" ? meta.country.trim() : "");
        setEmailVerified(Boolean(user.email_confirmed_at));
      }

      const history = await recordDashboardLoginVisit();
      const accountMeta = await loadDashboardAccountMeta();
      if (cancelled) return;

      setEmailVerified(accountMeta.emailVerified);
      setActivityItems(
        buildAccountActivityFeed({
          loginHistory: history.length ? history : accountMeta.loginHistory,
          passwordChangedAt: accountMeta.passwordChangedAt,
        }),
      );

      const { data: mfaData } = await supabase.auth.mfa.listFactors();
      if (!cancelled) {
        setMfaEnabled(Boolean(mfaData?.totp?.some((f) => f.status === "verified")));
      }

      setAuthLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const profileInput = useMemo(
    () => ({
      fullName,
      email,
      emailVerified,
      phone,
      country,
      hasRestaurant,
      mfaEnabled,
    }),
    [fullName, email, emailVerified, phone, country, hasRestaurant, mfaEnabled],
  );

  const completeness = useMemo(
    () => computeProfileCompleteness(profileInput),
    [profileInput],
  );

  const completionChecklist = useMemo(
    () => getProfileCompletionChecklist(profileInput),
    [profileInput],
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return void toast.error("Full name is required");
    setSaving(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          country: country.trim() || null,
        },
      });
      if (error) return void toast.error(error.message);

      const user = data.user;
      if (user) {
        const meta = (user.user_metadata ?? {}) as DashboardUserMetadata;
        setFullName((meta.full_name ?? "").trim());
        setEmail(user.email ?? "");
        setPhone(typeof meta.phone === "string" ? meta.phone.trim() : "");
        setCountry(typeof meta.country === "string" ? meta.country.trim() : "");
        setEmailVerified(Boolean(user.email_confirmed_at));
      } else {
        await supabase.auth.refreshSession();
        const { data: refreshed } = await supabase.auth.getUser();
        const refreshedUser = refreshed.user;
        if (refreshedUser) {
          const meta = (refreshedUser.user_metadata ?? {}) as DashboardUserMetadata;
          setFullName((meta.full_name ?? "").trim());
          setPhone(typeof meta.phone === "string" ? meta.phone.trim() : "");
          setCountry(typeof meta.country === "string" ? meta.country.trim() : "");
        }
      }

      toast.success("Profile updated");
    } finally {
      setSaving(false);
    }
  };

  if (!authLoaded) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-12 dark:border-slate-700/80 dark:bg-slate-900/90">
        <p className="text-center text-sm text-slate-500">Loading account…</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_50px_-30px_rgba(2,6,23,0.2)] dark:border-slate-700/80 dark:bg-slate-900/90">
      <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-700/80">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#0066FF]/10 to-[#00AACC]/10 p-2.5 text-[#0066FF] dark:border-slate-600 dark:text-cyan-400">
            <User className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Account profile</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Full name, email, phone, and country for your account. Activity is shown on the right.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        <form
          onSubmit={(e) => void handleSaveProfile(e)}
          className="border-b border-slate-200 p-6 lg:border-b-0 lg:border-r dark:border-slate-700/80"
        >
          <div className="w-full max-w-xl space-y-5">
            <div className="space-y-2">
              <Label htmlFor="account-full-name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Full Name
              </Label>
              <Input
                id="account-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                className={fieldClass}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="account-email"
                  type="email"
                  value={email}
                  readOnly
                  className={cn(fieldClass, "cursor-default pl-10 text-slate-600 dark:text-slate-300")}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {emailVerified ? (
                  <span className="text-emerald-700 dark:text-emerald-400">Verified email address.</span>
                ) : (
                  <span>Email not verified yet — check your inbox for the confirmation link.</span>
                )}{" "}
                <a href={SUPPORT_MAILTO_HREF} className="text-[#0066FF] hover:underline dark:text-cyan-400">
                  Contact {SUPPORT_EMAIL}
                </a>{" "}
                to change it.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="account-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+355 6x xxx xxxx"
                  autoComplete="tel"
                  className={cn(fieldClass, "pl-10")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-country" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Country
              </Label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
                <Select value={country || undefined} onValueChange={setCountry}>
                  <SelectTrigger id="account-country" className={cn(fieldClass, "w-full pl-10")}>
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_COUNTRY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-5 dark:border-slate-800">
              <Button
                type="submit"
                disabled={saving}
                className="h-11 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] px-6 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>

            {hasRestaurant ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200">
                <Check className="size-4 shrink-0" />
                Venue linked
                {restaurantName ? (
                  <span className="font-medium">— {restaurantName}</span>
                ) : null}
              </p>
            ) : (
              <LinkLicensePanel
                onLinked={() => {
                  void refreshRestaurant();
                  onVenueLinked?.();
                }}
              />
            )}
          </div>
        </form>

        <aside className="space-y-4 bg-slate-50/50 p-6 dark:bg-slate-950/30">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/90">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Profile completion</p>
              <span className="text-sm font-bold tabular-nums text-[#0066FF] dark:text-cyan-400">
                {completeness}%
              </span>
            </div>
            <Progress
              value={completeness}
              className="h-2 bg-slate-100 dark:bg-slate-800 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-[#0066FF] [&>[data-slot=progress-indicator]]:to-[#00AACC]"
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Profile completeness: {completeness}% — link your license for 90%; enable 2FA in
              Security for 100% (optional).
            </p>
            <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              {completionChecklist.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-xs">
                  {item.done ? (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="mt-0.5 size-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "font-medium",
                        item.done
                          ? "text-slate-600 dark:text-slate-400"
                          : "text-slate-800 dark:text-slate-200",
                      )}
                    >
                      {item.label}
                    </span>
                    {item.hint && !item.done ? (
                      <span className="block text-slate-500 dark:text-slate-500">{item.hint}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-400">+{item.points}%</span>
                </li>
              ))}
            </ul>
          </div>

          <ActivityFeed items={activityItems} />
        </aside>
      </div>
    </section>
  );
}
