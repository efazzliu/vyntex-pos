import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
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
import {
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
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO_HREF } from "@/lib/site-constants.ts";

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
    <section className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6 shadow-[0_24px_56px_-34px_rgba(2,6,23,0.95)]">
      <div className="mb-5 flex items-start gap-3 border-b border-[#2a436f] pb-4">
        <div className="rounded-xl border border-[#315084] bg-gradient-to-br from-[#0f5fdd]/35 to-[#18a6b0]/25 p-2.5">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-xs text-[#97abcc]">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function DashboardSettings() {
  const { restaurant, refresh } = useDashboardRestaurant();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [businessLoading, setBusinessLoading] = useState(false);

  const [personalName, setPersonalName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalLoading, setPersonalLoading] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);

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
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (restaurant === null) return null;

  const trialDaysLeft = daysUntil(restaurant.licenseExpiry);
  const billingHref =
    billingCheckoutUrl?.trim() && !billingCheckoutUrl.includes("...")
      ? billingCheckoutUrl.trim()
      : null;

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalName.trim()) return void toast.error("Your name is required");
    setPersonalLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: personalName.trim() },
      });
      if (error) return void toast.error(error.message);
      toast.success("Personal profile updated");
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const openBilling = () => {
    if (!billingHref) return;
    window.open(billingHref, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
      <header className="relative overflow-hidden rounded-2xl border border-[#315084] bg-gradient-to-br from-[#162746] via-[#10213f] to-[#0e1a31] p-6 lg:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#0d58da]/20 blur-3xl" />
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          <Sparkles className="h-3.5 w-3.5" />
          Settings Hub
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">Account & Business Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#a7b5d1]">
          Manage your profile, venue details, billing and current license data in one place.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSavePersonal}>
          <PremiumCard
            icon={<User className="size-4 text-white" />}
            title="Personal profile"
            subtitle="How your identity appears in dashboard and support context"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="personal-name" className="text-white/90">Full name</Label>
                <Input
                  id="personal-name"
                  value={personalName}
                  onChange={(e) => setPersonalName(e.target.value)}
                  disabled={!authLoaded}
                  required
                  className="h-11 rounded-xl border-[#2a436f] bg-[#0b162b] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personal-email" className="text-white/90">
                  <Mail className="mr-1 inline size-3.5" />
                  Email
                </Label>
                <Input
                  id="personal-email"
                  type="email"
                  value={personalEmail}
                  readOnly
                  className="h-11 rounded-xl border-[#2a436f] bg-[#0b162b] text-[#9db2d3]"
                />
                <p className="text-xs text-[#97abcc]">
                  To change email contact{" "}
                  <a href={SUPPORT_MAILTO_HREF} className="text-[#66b3ff] hover:underline">
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </p>
              </div>
              <div className="pt-2">
                <Button type="submit" disabled={personalLoading || !authLoaded} className="h-11 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white">
                  {personalLoading ? "Saving..." : "Save profile"}
                </Button>
              </div>
            </div>
          </PremiumCard>
        </form>

        <form onSubmit={handleSaveBusiness}>
          <PremiumCard
            icon={<Building2 className="size-4 text-white" />}
            title="Venue & business"
            subtitle="Shown in license card and Restaurant POS application"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="biz-name" className="text-white/90">Venue / business name *</Label>
                <Input id="biz-name" value={name} onChange={(e) => setName(e.target.value)} required className="h-11 rounded-xl border-[#2a436f] bg-[#0b162b] text-white" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="biz-address" className="text-white/90"><MapPin className="mr-1 inline size-3.5" />Address</Label>
                  <Input id="biz-address" value={address} onChange={(e) => setAddress(e.target.value)} className="h-11 rounded-xl border-[#2a436f] bg-[#0b162b] text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="biz-phone" className="text-white/90"><Phone className="mr-1 inline size-3.5" />Phone</Label>
                  <Input id="biz-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl border-[#2a436f] bg-[#0b162b] text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white/90"><Banknote className="mr-1 inline size-3.5" />Default currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-11 rounded-xl border-[#2a436f] bg-[#0b162b] text-white">
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
              </div>
              <div className="pt-2">
                <Button type="submit" disabled={businessLoading} className="h-11 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white">
                  {businessLoading ? "Saving..." : "Save business"}
                </Button>
              </div>
            </div>
          </PremiumCard>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <PremiumCard
          icon={<CreditCard className="size-4 text-white" />}
          title="Billing & subscription"
          subtitle="Continue payment or change your plan before trial/license ends"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-[#2a436f] bg-[#0b162b] p-3 text-sm text-[#c7d3e8]">
              <Calendar className="mr-2 inline size-4" />
              Ends on <span className="font-semibold">{formatDate(restaurant.licenseExpiry)}</span> ({trialDaysLeft} days left)
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                onClick={openBilling}
                disabled={!billingHref}
                className="h-11 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white disabled:cursor-not-allowed disabled:opacity-100 disabled:from-[#324e82] disabled:to-[#2f6780] disabled:text-white/75"
              >
                <ExternalLink className="mr-2 size-4" />
                {billingHref ? "Continue payment" : "Checkout unavailable"}
              </Button>
              <Button type="button" variant="outline" asChild className="h-11 rounded-xl border-[#2a436f] bg-[#0b162b] text-white hover:bg-[#13284d]">
                <Link to="/pricing">
                  <ArrowRightLeft className="mr-2 size-4" />
                  Change plan
                </Link>
              </Button>
            </div>
            {!billingHref ? (
              <p className="text-xs text-[#97abcc]">
                Checkout link is not configured. Use Change plan or contact{" "}
                <a href={SUPPORT_MAILTO_HREF} className="text-[#66b3ff] hover:underline">
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            ) : null}
          </div>
        </PremiumCard>

        <PremiumCard
          icon={<Shield className="size-4 text-white" />}
          title="License details"
          subtitle="Read-only information for your active venue license"
        >
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-[#2a436f] bg-[#0b162b] px-3 py-2">
              <span className="text-[#97abcc]">VYN Type</span>
              <span className="text-white">{vynTypeLabels[restaurant.type] ?? restaurant.type}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#2a436f] bg-[#0b162b] px-3 py-2">
              <span className="text-[#97abcc]">Plan</span>
              <span className="rounded-full bg-[#0066FF]/20 px-2.5 py-0.5 text-xs font-semibold text-[#66b3ff]">
                {planLabels[restaurant.plan as keyof typeof planLabels] ?? restaurant.plan}
              </span>
            </div>
            <div className="rounded-lg border border-[#2a436f] bg-[#0b162b] px-3 py-2">
              <span className="text-[#97abcc]">License Key</span>
              <div className="mt-1 flex items-center gap-2 text-white">
                <KeyRound className="size-3.5 text-[#66b3ff]" />
                <code className="font-mono text-xs tracking-wider">{restaurant.licenseKey}</code>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#2a436f] bg-[#0b162b] px-3 py-2">
              <span className="text-[#97abcc]">Expires</span>
              <span className="text-white">{formatDate(restaurant.licenseExpiry)}</span>
            </div>
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
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
import {
  Building2,
  Mail,
  User,
  MapPin,
  Phone,
  Banknote,
  Shield,
  KeyRound,
  Calendar,
  CreditCard,
  ExternalLink,
  ArrowRightLeft,
} from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO_HREF } from "@/lib/site-constants.ts";

const currencies = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (\u20AC)" },
  { value: "GBP", label: "GBP (\u00A3)" },
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

const billingCheckoutUrl = import.meta.env.VITE_BILLING_CHECKOUT_URL as
  | string
  | undefined;

export default function DashboardSettings() {
  const { restaurant, refresh } = useDashboardRestaurant();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [businessLoading, setBusinessLoading] = useState(false);

  const [personalName, setPersonalName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalLoading, setPersonalLoading] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setAddress(restaurant.address ?? "");
    setPhone(restaurant.phone ?? "");
    setCurrency(restaurant.currency || "USD");
  }, [restaurant]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
      <div className="p-6 lg:p-8 space-y-6 max-w-3xl mx-auto w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (restaurant === null) return null;

  const trialDaysLeft = daysUntil(restaurant.licenseExpiry);
  const billingHref =
    billingCheckoutUrl?.trim() && !billingCheckoutUrl.includes("...")
      ? billingCheckoutUrl.trim()
      : null;

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalName.trim()) {
      toast.error("Your name is required");
      return;
    }
    setPersonalLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: personalName.trim() },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Personal profile updated");
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Venue name is required");
      return;
    }
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

      if (error) {
        toast.error(error.message);
        return;
      }
      await refresh();
      toast.success("Business settings saved");
    } finally {
      setBusinessLoading(false);
    }
  };

  const openBilling = () => {
    if (!billingHref) return;
    window.open(billingHref, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your account, venue details for Restaurant POS, and billing options.
        </p>
      </div>

      {/* Personal profile */}
      <form
        onSubmit={handleSavePersonal}
        className="rounded-xl border border-border bg-card p-6 space-y-5"
      >
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
            <User className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Personal profile
            </h2>
            <p className="text-xs text-muted-foreground">
              How your name appears in the dashboard and support context
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="personal-name">Full name</Label>
            <Input
              id="personal-name"
              value={personalName}
              onChange={(e) => setPersonalName(e.target.value)}
              placeholder="Your name"
              disabled={!authLoaded}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="personal-email">
              <Mail className="size-3.5 inline mr-1" />
              Email
            </Label>
            <Input
              id="personal-email"
              type="email"
              value={personalEmail}
              readOnly
              className="bg-muted/50 text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Email is tied to your login. To change it, write to{" "}
              <a href={SUPPORT_MAILTO_HREF} className="text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              or use your provider&apos;s account settings.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={personalLoading || !authLoaded}>
            {personalLoading ? "Saving..." : "Save profile"}
          </Button>
        </div>
      </form>

      {/* Business / venue (Restaurant POS) */}
      <form
        onSubmit={handleSaveBusiness}
        className="rounded-xl border border-border bg-card p-6 space-y-5"
      >
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
            <Building2 className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Venue &amp; business
            </h2>
            <p className="text-xs text-muted-foreground">
              This name appears on your license card and in Restaurant POS
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="biz-name">Venue / business name *</Label>
            <Input
              id="biz-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="biz-address">
                <MapPin className="size-3.5 inline mr-1" />
                Address
              </Label>
              <Input
                id="biz-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-phone">
                <Phone className="size-3.5 inline mr-1" />
                Phone
              </Label>
              <Input
                id="biz-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              <Banknote className="size-3.5 inline mr-1" />
              Default currency
            </Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
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
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={businessLoading}>
            {businessLoading ? "Saving..." : "Save business"}
          </Button>
        </div>
      </form>

      {/* Billing */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
            <CreditCard className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Billing &amp; subscription
            </h2>
            <p className="text-xs text-muted-foreground">
              Change your plan or continue payment before your trial or license
              ends
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Calendar className="size-4 text-muted-foreground shrink-0" />
            Trial / license ends {formatDate(restaurant.licenseExpiry)}
            <span className="text-muted-foreground font-normal">
              ({trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left)
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              className="sm:flex-1 disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-[#3a4e78] disabled:text-white/75"
              disabled={!billingHref}
              onClick={openBilling}
              title={
                billingHref
                  ? undefined
                  : "Checkout link not configured — use Change plan or contact support"
              }
            >
              <ExternalLink className="size-4 mr-2 shrink-0" />
              {billingHref ? "Continue payment" : "Checkout unavailable"}
            </Button>
            <Button type="button" variant="outline" className="sm:flex-1" asChild>
              <Link to="/pricing">
                <ArrowRightLeft className="size-4 mr-2 shrink-0" />
                Change plan
              </Link>
            </Button>
          </div>
          {!billingHref ? (
            <p className="text-xs text-muted-foreground">
              One-click checkout isn&apos;t enabled yet. Use{" "}
              <span className="text-foreground font-medium">Change plan</span> to
              pick a tier on the pricing page, or contact{" "}
              <a href={SUPPORT_MAILTO_HREF} className="text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              to complete payment.
            </p>
          ) : null}
        </div>
      </div>

      {/* License details (read-only) */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
            <Shield className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              License details
            </h2>
            <p className="text-xs text-muted-foreground">
              Your current license information
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Building2 className="size-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">VYN Type:</span>
            <span className="text-foreground font-medium">
              {vynTypeLabels[restaurant.type] ?? restaurant.type}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Banknote className="size-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Plan:</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {planLabels[restaurant.plan as keyof typeof planLabels] ??
                restaurant.plan}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <KeyRound className="size-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">License Key:</span>
            <code className="text-foreground font-mono text-xs tracking-wider bg-muted px-2 py-0.5 rounded">
              {restaurant.licenseKey}
            </code>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="size-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Expires:</span>
            <span className="text-foreground font-medium">
              {formatDate(restaurant.licenseExpiry)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
