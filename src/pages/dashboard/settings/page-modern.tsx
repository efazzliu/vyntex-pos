import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { supabase } from "@/lib/supabase.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import {
  AlertCircle,
  ArrowRightLeft,
  Banknote,
  Building2,
  Calendar,
  CreditCard,
  ExternalLink,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Shield,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO_HREF } from "@/lib/site-constants.ts";
import { claimUnassignedLicenseForDashboardAccount } from "@/lib/supabase-pos/claim-license-dashboard.ts";

const currencies = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (EUR)" },
  { value: "GBP", label: "GBP (GBP)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "AUD", label: "AUD (A$)" },
];

const planLabels = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
} as const;

const vynTypeLabels: Record<string, string> = {
  restaurant: "Restaurant POS",
  cafe: "Coffee POS",
  bar: "Bar POS",
  hotel: "Hotel POS",
  fitness: "Fitness POS",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const billingCheckoutUrl = import.meta.env.VITE_BILLING_CHECKOUT_URL as string | undefined;

function PremiumCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.28)] dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-[0_24px_56px_-32px_rgba(0,0,0,0.45)]">
      <div className="mb-6 flex items-start gap-3 border-b border-slate-200 pb-4 dark:border-slate-700/80">
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#0066FF]/10 to-[#00AACC]/10 p-2.5 text-[#0066FF] dark:border-slate-600 dark:from-[#0066FF]/20 dark:to-cyan-500/15 dark:text-cyan-400">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function DashboardSettingsModern() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { restaurant, refresh } = useDashboardRestaurant();
  const { isAdmin } = useUserRole();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [businessLoading, setBusinessLoading] = useState(false);
  const [personalName, setPersonalName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalLoading, setPersonalLoading] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [linkLicenseKey, setLinkLicenseKey] = useState("");
  const [linkLicenseLoading, setLinkLicenseLoading] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setAddress(restaurant.address ?? "");
    setPhone(restaurant.phone ?? "");
    setCurrency(restaurant.currency || "USD");
  }, [restaurant]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const u = data.user;
      if (u) {
        const meta = u.user_metadata as { full_name?: string };
        setPersonalName((meta?.full_name ?? "").trim() || "");
        setPersonalEmail(u.email ?? "");
      }
      setAuthLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (restaurant === undefined) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
        <Skeleton className="h-32 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }
  const hasRestaurant = restaurant !== null;
  const trialDaysLeft = hasRestaurant ? daysUntil(restaurant.licenseExpiry) : 0;
  const billingHref =
    billingCheckoutUrl?.trim() && !billingCheckoutUrl.includes("...")
      ? billingCheckoutUrl.trim()
      : null;

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalName.trim()) return void toast.error("Your name is required");
    setPersonalLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: personalName.trim() } });
      if (error) return void toast.error(error.message);
      toast.success("Personal profile updated");
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return void toast.error("No venue linked to this account yet.");
    if (!name.trim()) return void toast.error("Venue name is required");
    setBusinessLoading(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({
          name: name.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          currency,
        })
        .eq("id", restaurant.id);
      if (error) return void toast.error(error.message);
      await refresh();
      toast.success("Business settings saved");
    } finally {
      setBusinessLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="w-full space-y-6 p-6 lg:p-8">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 lg:p-7 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.28)] dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-[0_24px_56px_-32px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#0d58da]/10 blur-3xl dark:bg-[#0066FF]/15" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
              <Sparkles className="h-3.5 w-3.5" />
              Settings hub
            </p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Account & business</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Manage your personal identity and venue details in one place. Theme follows your choice here and across the
              app.
            </p>
            {isAdmin ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="rounded-xl border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <Link to="/admin">
                    <LayoutDashboard className="mr-2 size-4" />
                    Back to admin
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleSignOut()}
            className="h-10 rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <LogOut className="mr-2 size-4" />
            Log out
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSavePersonal}>
          <PremiumCard icon={<User className="size-4" />} title="Personal profile" subtitle="Name shown across the product">
            <div className="space-y-4">
              <Label htmlFor="personal-name" className="text-sm text-slate-700 dark:text-slate-300">
                Full name
              </Label>
              <Input
                id="personal-name"
                value={personalName}
                onChange={(e) => setPersonalName(e.target.value)}
                disabled={!authLoaded}
                className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              <Label htmlFor="personal-email" className="text-sm text-slate-700 dark:text-slate-300">
                <Mail className="mr-1 inline size-3.5" />
                Email
              </Label>
              <Input
                id="personal-email"
                value={personalEmail}
                readOnly
                className="h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Need to change email?{" "}
                <a href={SUPPORT_MAILTO_HREF} className="text-[#0066FF] hover:underline dark:text-cyan-400">
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Appearance
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: "light" as const, label: "Light", Icon: Sun },
                      { id: "dark" as const, label: "Dark", Icon: Moon },
                      { id: "system" as const, label: "System", Icon: Monitor },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <Button
                      key={id}
                      type="button"
                      variant={(theme ?? "system") === id ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "rounded-xl",
                        (theme ?? "system") === id &&
                          "bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white hover:opacity-95 dark:text-white",
                      )}
                      onClick={() => setTheme(id)}
                    >
                      <Icon className="mr-1.5 size-3.5" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                type="submit"
                disabled={personalLoading || !authLoaded}
                className="h-11 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] px-5 text-white shadow-lg shadow-blue-500/25"
              >
                {personalLoading ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </PremiumCard>
        </form>
        <form onSubmit={handleSaveBusiness}>
          <PremiumCard icon={<Building2 className="size-4" />} title="Venue & business" subtitle="Shown on license and in POS">
            {hasRestaurant ? (
              <div className="space-y-4">
                <Label htmlFor="biz-name" className="text-slate-700 dark:text-slate-300">
                  Venue / business name *
                </Label>
                <Input
                  id="biz-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="biz-address" className="text-slate-700 dark:text-slate-300">
                      <MapPin className="mr-1 inline size-3.5" />
                      Address
                    </Label>
                    <Input
                      id="biz-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="biz-phone" className="text-slate-700 dark:text-slate-300">
                      <Phone className="mr-1 inline size-3.5" />
                      Phone
                    </Label>
                    <Input
                      id="biz-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>
                <Label className="text-slate-700 dark:text-slate-300">
                  <Banknote className="mr-1 inline size-3.5" />
                  Default currency
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="submit"
                  disabled={businessLoading}
                  className="h-11 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white"
                >
                  {businessLoading ? "Saving…" : "Save business"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {!isAdmin ? (
                  <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/60 p-4 dark:border-emerald-500/35 dark:bg-emerald-950/25">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                      <KeyRound className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      Link license to this account
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      If you received a claimable license key from support (or you already activated the Windows POS with
                      that key), paste it here while logged in with <span className="font-medium text-slate-800 dark:text-slate-200">this</span> email.
                      The venue will attach to your dashboard and POS can keep using the same key.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <Input
                        value={linkLicenseKey}
                        onChange={(e) => setLinkLicenseKey(e.target.value.toUpperCase())}
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        autoComplete="off"
                        spellCheck={false}
                        className="h-11 flex-1 rounded-xl border-emerald-200/80 bg-white font-mono text-xs tracking-wider text-slate-900 dark:border-emerald-500/30 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <Button
                        type="button"
                        disabled={
                          linkLicenseLoading ||
                          linkLicenseKey.replace(/[^A-Z0-9]/g, "").length < 16
                        }
                        className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 text-white hover:from-emerald-700 hover:to-emerald-800 dark:from-emerald-600 dark:to-emerald-700"
                        onClick={() => {
                          void (async () => {
                            setLinkLicenseLoading(true);
                            try {
                              await claimUnassignedLicenseForDashboardAccount(linkLicenseKey);
                              toast.success("License linked to your account.");
                              setLinkLicenseKey("");
                              await refresh();
                              navigate("/dashboard/restaurant-pos", { replace: true });
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Could not link license");
                            } finally {
                              setLinkLicenseLoading(false);
                            }
                          })();
                        }}
                      >
                        {linkLicenseLoading ? "Linking…" : "Link license"}
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800/60">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <AlertCircle className="size-4 shrink-0 text-[#0066FF] dark:text-cyan-400" />
                    {isAdmin ? "No venue on this login" : "No business linked yet"}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {isAdmin
                      ? "You’re signed in as a platform administrator. Venue fields appear when this account also has an active POS license. Use Admin for day-to-day operations."
                      : "You can also complete a new venue from the website setup flow, then return here to edit details."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isAdmin ? (
                    <Button
                      type="button"
                      asChild
                      className="h-11 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] px-5 text-white shadow-lg shadow-blue-500/25"
                    >
                      <Link to="/admin">
                        <LayoutDashboard className="mr-2 size-4" />
                        Open admin
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant={isAdmin ? "outline" : "default"}
                    asChild
                    className={cn(
                      "h-11 rounded-xl px-5",
                      isAdmin
                        ? "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        : "bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white shadow-lg shadow-blue-500/25",
                    )}
                  >
                    <Link to="/">Go to website</Link>
                  </Button>
                </div>
              </div>
            )}
          </PremiumCard>
        </form>
      </div>

      {hasRestaurant ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <PremiumCard icon={<CreditCard className="size-4" />} title="Billing & subscription" subtitle="Plan and payment controls">
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200">
                <Calendar className="mr-2 inline size-4" />
                Ends on <span className="font-semibold">{formatDate(restaurant.licenseExpiry)}</span> ({trialDaysLeft}{" "}
                days left)
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => billingHref && window.open(billingHref, "_blank", "noopener,noreferrer")}
                  disabled={!billingHref}
                  className="h-11 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white disabled:cursor-not-allowed disabled:opacity-100 disabled:from-[#324e82] disabled:to-[#2f6780] disabled:text-white/75"
                >
                  <ExternalLink className="mr-2 size-4" />
                  {billingHref ? "Continue payment" : "Checkout unavailable"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="h-11 rounded-xl border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <Link to="/pricing">
                    <ArrowRightLeft className="mr-2 size-4" />
                    Change plan
                  </Link>
                </Button>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard icon={<Shield className="size-4" />} title="License details" subtitle="Read-only active license data">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">VYN type</span>
                <span className="text-slate-800 dark:text-slate-100">{vynTypeLabels[restaurant.type] ?? restaurant.type}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Plan</span>
                <span className="rounded-full bg-[#0066FF]/10 px-2.5 py-0.5 text-xs font-semibold text-[#0066FF] dark:bg-cyan-500/15 dark:text-cyan-300">
                  {planLabels[restaurant.plan as keyof typeof planLabels] ?? restaurant.plan}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">License key</span>
                <div className="mt-1 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                  <KeyRound className="size-3.5 text-[#0066FF] dark:text-cyan-400" />
                  <code className="font-mono text-xs tracking-wider">{restaurant.licenseKey}</code>
                </div>
              </div>
            </div>
          </PremiumCard>
        </div>
      ) : null}
    </div>
  );
}
