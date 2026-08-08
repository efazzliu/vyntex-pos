import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Building2,
  Check,
  KeyRound,
  Loader2,
  MapPin,
  ReceiptText,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import {
  fetchDashboardBusinessProfile,
  saveDashboardBusinessProfile,
  type DashboardBusinessProfile,
} from "@/lib/supabase-pos/business-profile.ts";
import { listTemplates, saveTemplate } from "@/lib/supabase-pos/templates-ops.ts";
import { cn } from "@/lib/utils.ts";

type ReceiptTemplate = Awaited<ReturnType<typeof listTemplates>>[number];

export default function DashboardBusinessSettingsPage() {
  const { restaurant, refresh } = useDashboardRestaurant();
  const { lang } = useDashboardLocale();
  const [profile, setProfile] = useState<DashboardBusinessProfile | null>(null);
  const [initialProfile, setInitialProfile] =
    useState<DashboardBusinessProfile | null>(null);
  const [receipt, setReceipt] = useState<ReceiptTemplate | null>(null);
  const [initialReceipt, setInitialReceipt] = useState<ReceiptTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurant) {
      if (restaurant === null) setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchDashboardBusinessProfile(restaurant.id),
      listTemplates(restaurant.licenseKey),
    ])
      .then(([businessProfile, templates]) => {
        if (cancelled) return;
        const fiscal =
          templates.find((template) => template.templateType === "fiscal_receipt") ??
          null;
        setProfile(businessProfile);
        setInitialProfile(structuredClone(businessProfile));
        setReceipt(fiscal);
        setInitialReceipt(fiscal ? structuredClone(fiscal) : null);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Could not load business profile.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurant]);

  const dirty =
    JSON.stringify(profile) !== JSON.stringify(initialProfile) ||
    JSON.stringify(receipt) !== JSON.stringify(initialReceipt);

  const completion = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      profile.name,
      profile.legalName,
      profile.address,
      profile.city,
      profile.country,
      profile.phone,
      profile.email,
      profile.taxNumber,
      profile.vatNumber,
    ];
    return Math.round((fields.filter((value) => value.trim()).length / fields.length) * 100);
  }, [profile]);

  const update = <K extends keyof DashboardBusinessProfile>(
    key: K,
    value: DashboardBusinessProfile[K],
  ) => {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateReceiptLabels = (
    key: "headerText" | "footerText",
    value: string,
  ) => {
    setReceipt((current) =>
      current
        ? { ...current, labels: { ...current.labels, [key]: value } }
        : current,
    );
  };

  const updateReceiptToggle = (
    key: "logo" | "taxDetails",
    value: boolean,
  ) => {
    setReceipt((current) =>
      current
        ? { ...current, toggles: { ...current.toggles, [key]: value } }
        : current,
    );
  };

  const save = async () => {
    if (!profile || !restaurant) return;
    setSaving(true);
    try {
      await saveDashboardBusinessProfile(profile);
      if (receipt) {
        await saveTemplate({
          licenseKey: restaurant.licenseKey,
          templateType: "fiscal_receipt",
          toggles: receipt.toggles,
          labels: receipt.labels,
          styles: receipt.styles,
          printerId: receipt.printerId ?? undefined,
        });
      }
      setInitialProfile(structuredClone(profile));
      setInitialReceipt(receipt ? structuredClone(receipt) : null);
      await refresh();
      toast.success("Business information saved");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setProfile(initialProfile ? structuredClone(initialProfile) : null);
    setReceipt(initialReceipt ? structuredClone(initialReceipt) : null);
  };

  if (loading || restaurant === undefined) {
    return (
      <div className="space-y-5 px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <Skeleton className="h-28 rounded-3xl" />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-[620px] rounded-3xl" />
          <Skeleton className="h-[480px] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    const isSq = lang === "sq";
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-16 dark:bg-[#02040a]">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
            <Building2 className="size-7" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isSq ? "Nuk ka biznes të lidhur ende" : "No business linked yet"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {isSq
              ? "Aktivizo ose lidh një licencë POS me këtë llogari, pastaj këtu do të shfaqen të dhënat e biznesit, adresa dhe faturat."
              : "Activate or link a POS license to this account first. Then you can edit venue details, address, and receipt information here."}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild className="rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white">
              <Link to="/dashboard/get-started">
                <KeyRound className="size-4" />
                {isSq ? "Aktivizo licencën" : "Activate license"}
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/dashboard/licenses">
                {isSq ? "Shiko licencat" : "View licenses"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-full bg-slate-50 px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="font-semibold text-amber-900">Business profile unavailable</h1>
          <p className="mt-2 text-sm text-amber-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-sky-50/50 px-4 pb-28 pt-16 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-48px_rgba(14,116,202,0.4)]">
          <div className="flex flex-col gap-5 bg-gradient-to-r from-sky-50 via-white to-emerald-50/60 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
                <Building2 className="size-6" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-600">
                  Business
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  Business information
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Details used across Vyntex POS, receipts, taxes, and reports.
                </p>
              </div>
            </div>
            <div className="min-w-44 rounded-2xl border border-slate-200 bg-white/80 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Profile completion</span>
                <span className="font-bold text-sky-700">{completion}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </div>
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="space-y-5">
            <FormSection
              icon={Building2}
              title="Business profile"
              description="Public and legal identity of your venue."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Restaurant name" required>
                  <Input
                    value={profile.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder="Restaurant name"
                  />
                </Field>
                <Field label="Legal business name">
                  <Input
                    value={profile.legalName}
                    onChange={(event) => update("legalName", event.target.value)}
                    placeholder="Registered company name"
                  />
                </Field>
                <Field label="Business type">
                  <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm capitalize text-slate-600">
                    {profile.type}
                    <BadgeCheck className="ml-auto size-4 text-sky-500" />
                  </div>
                </Field>
                <Field label="Phone">
                  <Input
                    value={profile.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    placeholder="+355..."
                  />
                </Field>
                <Field label="Business email">
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(event) => update("email", event.target.value)}
                    placeholder="contact@restaurant.com"
                  />
                </Field>
                <Field label="Website">
                  <Input
                    value={profile.website}
                    onChange={(event) => update("website", event.target.value)}
                    placeholder="https://..."
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              icon={MapPin}
              title="Address & regional"
              description="Location, language, currency, and reporting timezone."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Street address" className="sm:col-span-2">
                  <Input
                    value={profile.address}
                    onChange={(event) => update("address", event.target.value)}
                    placeholder="Street and number"
                  />
                </Field>
                <Field label="City">
                  <Input
                    value={profile.city}
                    onChange={(event) => update("city", event.target.value)}
                    placeholder="Tirana"
                  />
                </Field>
                <Field label="Postal code">
                  <Input
                    value={profile.postalCode}
                    onChange={(event) => update("postalCode", event.target.value)}
                    placeholder="1001"
                  />
                </Field>
                <Field label="Country">
                  <Input
                    value={profile.country}
                    onChange={(event) => update("country", event.target.value)}
                    placeholder="Albania"
                  />
                </Field>
                <Field label="Currency">
                  <Select value={profile.currency} onValueChange={(value) => update("currency", value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR — Euro</SelectItem>
                      <SelectItem value="ALL">ALL — Albanian Lek</SelectItem>
                      <SelectItem value="Lek">Lek — Albanian Lek (legacy)</SelectItem>
                      <SelectItem value="USD">USD — US Dollar</SelectItem>
                      <SelectItem value="GBP">GBP — British Pound</SelectItem>
                      <SelectItem value="CHF">CHF — Swiss Franc</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Language">
                  <Select
                    value={profile.language}
                    onValueChange={(value) => update("language", value as "en" | "sq")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="sq">Shqip</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Timezone">
                  <Select
                    value={profile.timezone}
                    onValueChange={(value) => update("timezone", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Tirane">Europe/Tirane</SelectItem>
                      <SelectItem value="Europe/Pristina">Europe/Pristina</SelectItem>
                      <SelectItem value="Europe/Skopje">Europe/Skopje</SelectItem>
                      <SelectItem value="Europe/Rome">Europe/Rome</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FormSection>

            <FormSection
              icon={ShieldCheck}
              title="Tax & VAT"
              description="Fiscal identifiers and the default product tax rate."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Tax / fiscal number">
                  <Input
                    value={profile.taxNumber}
                    onChange={(event) => update("taxNumber", event.target.value)}
                    placeholder="Business tax ID"
                  />
                </Field>
                <Field label="VAT number">
                  <Input
                    value={profile.vatNumber}
                    onChange={(event) => update("vatNumber", event.target.value)}
                    placeholder="VAT registration ID"
                  />
                </Field>
                <Field label="Default VAT rate">
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={Math.round(profile.defaultVatRate * 10000) / 100}
                      onChange={(event) =>
                        update("defaultVatRate", Number(event.target.value) / 100)
                      }
                      className="pr-9"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      %
                    </span>
                  </div>
                </Field>
              </div>
              <p className="mt-3 text-xs leading-5 text-amber-700">
                Changing the default VAT does not overwrite rates already assigned to existing products.
              </p>
            </FormSection>

            {receipt && (
              <FormSection
                icon={ReceiptText}
                title="Receipt settings"
                description="Text and tax visibility on the fiscal receipt."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Receipt header">
                    <Textarea
                      value={receipt.labels.headerText}
                      onChange={(event) =>
                        updateReceiptLabels("headerText", event.target.value)
                      }
                      rows={4}
                    />
                  </Field>
                  <Field label="Receipt footer">
                    <Textarea
                      value={receipt.labels.footerText}
                      onChange={(event) =>
                        updateReceiptLabels("footerText", event.target.value)
                      }
                      rows={4}
                    />
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <ToggleCard
                    label="Show logo"
                    checked={receipt.toggles.logo}
                    onChange={(checked) => updateReceiptToggle("logo", checked)}
                  />
                  <ToggleCard
                    label="Show tax details"
                    checked={receipt.toggles.taxDetails}
                    onChange={(checked) => updateReceiptToggle("taxDetails", checked)}
                  />
                </div>
              </FormSection>
            )}
          </main>

          <aside className="space-y-4 lg:sticky lg:top-20">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Receipt preview</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Fiscal receipt</p>
                </div>
                <ReceiptText className="size-5 text-sky-600" />
              </div>
              <div className="mx-auto mt-4 max-w-[270px] rounded-lg border border-dashed border-slate-300 bg-[#fffef9] px-5 py-6 font-mono text-[10px] text-slate-700 shadow-inner">
                <div className="text-center">
                  {receipt?.toggles.logo && (
                    <div className="mx-auto mb-2 flex size-7 items-center justify-center rounded bg-slate-900 font-sans text-xs font-bold text-white">
                      V
                    </div>
                  )}
                  <p className="whitespace-pre-line font-bold">
                    {receipt?.labels.headerText || "FISCAL RECEIPT"}
                  </p>
                  <p className="mt-2 font-bold">{profile.legalName || profile.name}</p>
                  <p>{[profile.address, profile.city].filter(Boolean).join(", ") || "Business address"}</p>
                  {profile.taxNumber && <p>Tax ID: {profile.taxNumber}</p>}
                  {profile.vatNumber && <p>VAT: {profile.vatNumber}</p>}
                </div>
                <div className="my-3 border-t border-dashed border-slate-400" />
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Product</span><span>10.00</span></div>
                  <div className="flex justify-between"><span>Product</span><span>5.00</span></div>
                </div>
                <div className="my-3 border-t border-dashed border-slate-400" />
                {receipt?.toggles.taxDetails && (
                  <div className="mb-1 flex justify-between">
                    <span>VAT {Math.round(profile.defaultVatRate * 100)}%</span>
                    <span>{(15 * profile.defaultVatRate).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold">
                  <span>TOTAL</span><span>15.00 {profile.currency}</span>
                </div>
                <p className="mt-4 whitespace-pre-line text-center">
                  {receipt?.labels.footerText || "Thank you!"}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <Check className="size-4" />
                Synced with Vyntex POS
              </p>
              <p className="mt-1.5 text-[11px] leading-5 text-emerald-700">
                Saved business and receipt details follow this license across connected devices.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_35px_-25px_rgba(15,23,42,0.5)] backdrop-blur lg:left-[230px]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="hidden text-xs text-slate-500 sm:block">
            {dirty ? "You have unsaved business changes." : "All business changes are saved."}
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={reset} disabled={!dirty || saving} className="rounded-xl">
              <RotateCcw className="mr-2 size-4" />
              Reset
            </Button>
            <Button onClick={() => void save()} disabled={!dirty || saving} className="rounded-xl bg-sky-600 hover:bg-sky-700">
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required = false,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-slate-600">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
        checked
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-slate-200 text-slate-500 hover:bg-slate-50",
      )}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded",
          checked ? "bg-sky-600 text-white" : "border border-slate-300 bg-white",
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
      {label}
    </button>
  );
}
