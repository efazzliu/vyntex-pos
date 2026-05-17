import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, ChevronDown, KeyRound, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx";
import { cn } from "@/lib/utils.ts";
import {
  deleteLicense,
  extendLicenseDays,
  listClientAccounts,
  regenerateLicenseKey,
  resetLicenseDevices,
  setLicenseExpiryIso,
  setMaxTerminals,
  updateClientLicenseConfig,
  updateLicensePlan,
  updateLicenseStatus,
  updateLicenseVenueName,
  type ClientAccountRow,
} from "@/lib/supabase-pos/admin-ops.ts";
import { normalizePlan, type PlanName } from "@/pages/pos/_lib/plan-features.ts";
import {
  adminBackLinkClass,
  adminBadgeClass,
  adminCardClass,
  adminOutlineButtonClass,
  adminPanelDividerClass,
  adminPanelHeaderClass,
} from "@/pages/admin/_lib/admin-ui.ts";

type PlanValue = PlanName;
type StatusValue = "active" | "expired" | "trial" | "suspended";
type BillingCycle = "monthly" | "yearly";
type PaymentMethod = "card" | "bank_transfer" | "paypal" | "other";

const PRODUCT_TYPE_OPTIONS = [
  { value: "restaurant", label: "Restaurant POS" },
  { value: "cafe", label: "Coffee POS" },
  { value: "bar", label: "Bar POS" },
  { value: "hotel", label: "Hotel POS" },
  { value: "fitness", label: "Fitness POS" },
] as const;

type LicenseDraft = {
  businessName: string;
  productType: string;
  plan: PlanValue;
  status: StatusValue;
  expiry: string;
  maxTerminals: string;
  mobileAccessEnabled: boolean;
  billingPrice: string;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  autoRenew: boolean;
  paymentMethod: PaymentMethod;
  lastPaymentDate: string;
  usersCount: string;
  branchLimit: string;
  enabledModules: string;
  notes: string;
  discountPct: string;
  customPrice: string;
  couponApplied: string;
  expiryReminderDays: string;
  paymentFailedAlert: boolean;
  autoSuspendOnExpiry: boolean;
};

export default function AdminClientDetailsPage() {
  const { ownerEmail: ownerEmailParam } = useParams<{ ownerEmail: string }>();
  const ownerEmail = useMemo(() => decodeURIComponent(ownerEmailParam ?? ""), [ownerEmailParam]);
  const queryClient = useQueryClient();

  const [drafts, setDrafts] = useState<Record<string, LicenseDraft>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expandedLicenseIds, setExpandedLicenseIds] = useState<Set<string>>(() => new Set());

  function setLicenseExpanded(licenseId: string, open: boolean) {
    setExpandedLicenseIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(licenseId);
      else next.delete(licenseId);
      return next;
    });
  }

  const clientsQuery = useQuery({
    queryKey: ["admin", "clients-list"],
    queryFn: listClientAccounts,
  });

  const account = useMemo(() => {
    return (clientsQuery.data ?? []).find((row) => row.owner_email === ownerEmail) ?? null;
  }, [clientsQuery.data, ownerEmail]);

  useEffect(() => {
    if (!account) return;
    setDrafts(Object.fromEntries(account.licenses.map((l) => [l.id, createDraft(account, l)])));
  }, [account]);

  function patchDraft(licenseId: string, patch: Partial<LicenseDraft>) {
    setDrafts((prev) => ({ ...prev, [licenseId]: { ...prev[licenseId], ...patch } }));
  }

  async function runAction(key: string, task: () => Promise<void>, successMessage: string) {
    try {
      setBusyKey(key);
      await task();
      await queryClient.invalidateQueries({ queryKey: ["admin", "clients-list"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "clients-kpi"] });
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusyKey(null);
    }
  }

  if (clientsQuery.isLoading) {
    return (
      <section className="space-y-4 p-6 lg:p-8">
        <Skeleton className="h-11 w-72 rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </section>
    );
  }

  if (!account) {
    return (
      <section className="space-y-3 p-6 lg:p-8">
        <Link to="/admin/businesses" className={adminBackLinkClass}>
          <ArrowLeft className="size-3.5 shrink-0" />
          Back to Clients
        </Link>
        <div className={cn(adminCardClass, "px-4 py-3")}>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Client not found</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Invalid link or removed client.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3 p-6 lg:p-8">
      <Link to="/admin/businesses" className={adminBackLinkClass}>
        <ArrowLeft className="size-3.5 shrink-0" />
        Back to Clients
      </Link>

      <div className={cn(adminCardClass, "flex items-center justify-between gap-3 px-3 py-2.5")}>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {account.owner_name?.trim() || account.owner_email}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{account.owner_email}</p>
        </div>
        <Button asChild variant="outline" size="sm" className={adminOutlineButtonClass}>
          <a href={`mailto:${account.owner_email}?subject=${encodeURIComponent("Vyntex POS Support")}`}>
            Contact client
          </a>
        </Button>
      </div>

      <div className="space-y-4">
        {account.licenses.map((license) => {
          const d = drafts[license.id];
          if (!d) return null;

          const isOpen = expandedLicenseIds.has(license.id);
          const licenseStatus = normalizeStatusValue(license.license_status);

          return (
            <article key={license.id} className={adminCardClass}>
              <Collapsible open={isOpen} onOpenChange={(open) => setLicenseExpanded(license.id, open)}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      adminPanelHeaderClass,
                      isOpen && adminPanelDividerClass,
                    )}
                  >
                    <ChevronDown
                      className={cn(
                        "size-3.5 shrink-0 text-slate-400 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {license.name?.trim() || "Unnamed venue"}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <LicenseMetaBadge>{normalizePosLabel(license.type)}</LicenseMetaBadge>
                      <LicenseMetaBadge>
                        {planTierDisplayName(normalizePlan(String(license.plan ?? "")))}
                      </LicenseMetaBadge>
                      <LicenseStatusBadge status={licenseStatus} />
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-300/70">Business</p>
                    <div className="flex items-center gap-2">
                      <Input
                        value={d.businessName}
                        onChange={(e) => patchDraft(license.id, { businessName: e.target.value })}
                        className="h-9 rounded-lg border-slate-200/80 bg-white text-xs dark:border-slate-700/70 dark:bg-slate-900"
                        placeholder="Emri i lokalit"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 shrink-0 rounded-lg px-3"
                        disabled={
                          busyKey === `${license.id}-name` ||
                          d.businessName.trim() === (license.name ?? "").trim()
                        }
                        onClick={() =>
                          runAction(
                            `${license.id}-name`,
                            () => updateLicenseVenueName(license.id, d.businessName),
                            "Business name updated",
                          )
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-300/70">Product</p>
                    <div className="flex items-center gap-2">
                      <Select
                        value={d.productType}
                        onValueChange={(v) => patchDraft(license.id, { productType: v })}
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-9 flex-1 rounded-lg border-slate-200/80 bg-white dark:border-slate-700/70 dark:bg-slate-900"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 shrink-0 rounded-lg px-3"
                        disabled={
                          busyKey === `${license.id}-type` ||
                          d.productType === (license.type ?? "").trim()
                        }
                        onClick={() =>
                          runAction(
                            `${license.id}-type`,
                            () =>
                              updateClientLicenseConfig({
                                licenseId: license.id,
                                type: d.productType,
                                maxTerminals: Math.max(1, Number(d.maxTerminals) || 1),
                                mobileAccessEnabled: d.mobileAccessEnabled,
                              }),
                            "Product type updated",
                          )
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 md:col-span-2 dark:border-slate-700/70 dark:bg-slate-900/60">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-300/70">
                        Mobile app access
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Phone manager / mobile POS
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={d.mobileAccessEnabled}
                        onCheckedChange={(checked) =>
                          patchDraft(license.id, { mobileAccessEnabled: checked })
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg px-2.5 text-xs"
                        disabled={
                          busyKey === `${license.id}-mobile` ||
                          d.mobileAccessEnabled === (license.mobile_access_enabled ?? true)
                        }
                        onClick={() =>
                          runAction(
                            `${license.id}-mobile`,
                            () =>
                              updateClientLicenseConfig({
                                licenseId: license.id,
                                type: d.productType,
                                maxTerminals: Math.max(1, Number(d.maxTerminals) || 1),
                                mobileAccessEnabled: d.mobileAccessEnabled,
                              }),
                            "Mobile access updated",
                          )
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700/70 dark:bg-slate-900/60 md:col-span-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-300/70">License key</p>
                    <div className="flex items-center gap-2">
                      <Input
                        value={license.license_key || license.id}
                        readOnly
                        className="h-9 rounded-lg border-slate-200/80 bg-white text-xs dark:border-slate-700/70 dark:bg-slate-900"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-lg px-3"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(license.license_key || license.id);
                            toast.success("License copied");
                          } catch {
                            toast.error("Copy failed");
                          }
                        }}
                      >
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-lg px-3"
                        disabled={busyKey === `${license.id}-regen-key`}
                        onClick={() => {
                          const ok = window.confirm(
                            "Generate a new license key? Client must use the new key on POS devices.",
                          );
                          if (!ok) return;
                          void runAction(
                            `${license.id}-regen-key`,
                            async () => {
                              const key = await regenerateLicenseKey(license.id);
                              try {
                                await navigator.clipboard.writeText(key);
                              } catch {
                                /* optional */
                              }
                            },
                            "License key regenerated",
                          );
                        }}
                      >
                        New key
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-300/70">Plan</p>
                    <div className="flex flex-wrap items-end gap-2">
                      <Select
                        value={d.plan}
                        onValueChange={(v) => patchDraft(license.id, { plan: v as PlanValue })}
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-9 min-w-[200px] max-w-xs flex-1 rounded-lg border-slate-200/80 bg-white dark:border-slate-700/70 dark:bg-slate-900"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-lg px-3"
                        disabled={
                          busyKey === `${license.id}-plan` ||
                          normalizePlan(String(license.plan ?? "")) === d.plan
                        }
                        onClick={() =>
                          runAction(
                            `${license.id}-plan`,
                            () => updateLicensePlan(license.id, d.plan),
                            "Plan updated",
                          )
                        }
                      >
                        Save plan
                      </Button>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      Active in database:{" "}
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {planTierDisplayName(normalizePlan(String(license.plan ?? "")))}
                      </span>
                      . Changing tier may raise the minimum terminal count to match the plan.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-300/70">Billing</p>
                    <Select
                      value={d.billingCycle}
                      onValueChange={(v) => patchDraft(license.id, { billingCycle: v as BillingCycle })}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-9 rounded-lg border-slate-200/80 bg-white dark:border-slate-700/70 dark:bg-slate-900"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-300/70">Status</p>
                    <Select value={d.status} onValueChange={(v) => patchDraft(license.id, { status: v as StatusValue })}>
                      <SelectTrigger
                        size="sm"
                        className="h-9 rounded-lg border-slate-200/80 bg-white dark:border-slate-700/70 dark:bg-slate-900"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <LicenseStatusBadge status={d.status} />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg px-2.5 text-xs"
                        disabled={
                          busyKey === `${license.id}-status` ||
                          normalizeStatusValue(license.license_status) === d.status
                        }
                        onClick={() =>
                          runAction(
                            `${license.id}-status`,
                            () => updateLicenseStatus(license.id, d.status),
                            "Status updated",
                          )
                        }
                      >
                        Save status
                      </Button>
                    </div>
                  </div>

                  <StaticRow
                    label="Expiry date"
                    value={new Date(license.license_expiry).toLocaleDateString()}
                  />
                  <StaticRow
                    label="Remaining date"
                    value={formatRemainingDays(d.expiry || license.license_expiry)}
                  />

                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-300/70">Change expiry</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="datetime-local"
                        className="h-9 rounded-lg border-slate-200/80 bg-white text-xs dark:border-slate-700/70 dark:bg-slate-900"
                        value={d.expiry}
                        onChange={(e) => patchDraft(license.id, { expiry: e.target.value })}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-lg px-3"
                        disabled={busyKey === `${license.id}-expiry` || !d.expiry}
                        onClick={() =>
                          runAction(
                            `${license.id}-expiry`,
                            () => setLicenseExpiryIso(license.id, new Date(d.expiry).toISOString()),
                            "Expiry updated",
                          )
                        }
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-9 rounded-lg px-3"
                        disabled={busyKey === `${license.id}-ext30`}
                        onClick={() =>
                          runAction(
                            `${license.id}-ext30`,
                            () => extendLicenseDays(license.id, 30),
                            "Extended 30 days",
                          )
                        }
                      >
                        +30 days
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-9 rounded-lg px-3"
                        disabled={busyKey === `${license.id}-ext90`}
                        onClick={() =>
                          runAction(
                            `${license.id}-ext90`,
                            () => extendLicenseDays(license.id, 90),
                            "Extended 90 days",
                          )
                        }
                      >
                        +90 days
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-9 rounded-lg px-3"
                        disabled={busyKey === `${license.id}-ext365`}
                        onClick={() =>
                          runAction(
                            `${license.id}-ext365`,
                            () => extendLicenseDays(license.id, 365),
                            "Extended 1 year",
                          )
                        }
                      >
                        +1 year
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-300/70">Terminals</p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-lg px-3"
                        onClick={() =>
                          patchDraft(license.id, {
                            maxTerminals: String(Math.max(1, (Number(d.maxTerminals) || 1) - 1)),
                          })
                        }
                      >
                        -
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        className="h-9 w-24 rounded-lg border-slate-200/80 bg-white text-xs dark:border-slate-700/70 dark:bg-slate-900"
                        value={d.maxTerminals}
                        onChange={(e) => patchDraft(license.id, { maxTerminals: e.target.value })}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-lg px-3"
                        onClick={() =>
                          patchDraft(license.id, {
                            maxTerminals: String(Math.max(1, (Number(d.maxTerminals) || 1) + 1)),
                          })
                        }
                      >
                        +
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-lg px-3"
                        disabled={busyKey === `${license.id}-terminals`}
                        onClick={() =>
                          runAction(
                            `${license.id}-terminals`,
                            () => setMaxTerminals(license.id, Math.max(1, Number(d.maxTerminals) || 1)),
                            "Terminals updated",
                          )
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-300/70">Actions</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="h-9 rounded-lg px-3"
                        disabled={busyKey === `${license.id}-suspend`}
                        onClick={() =>
                          runAction(
                            `${license.id}-suspend`,
                            () =>
                              updateLicenseStatus(
                                license.id,
                                d.status === "suspended" ? "active" : "suspended",
                              ),
                            d.status === "suspended" ? "License activated" : "License suspended",
                          )
                        }
                      >
                        {d.status === "suspended" ? "Activate" : "Suspend"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-lg px-3"
                        disabled={busyKey === `${license.id}-reset`}
                        onClick={() =>
                          runAction(
                            `${license.id}-reset`,
                            () => resetLicenseDevices(license.id),
                            "Terminals reset",
                          )
                        }
                      >
                        Reset terminal
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-9 rounded-lg border border-blue-200 bg-blue-50 px-3 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200"
                        onClick={() => {
                          const subject = encodeURIComponent("Billing reminder");
                          const body = encodeURIComponent(
                            `Hello,\n\nYour license payment is due. Please complete payment to keep service active.\n\nThanks.`,
                          );
                          window.location.href = `mailto:${account.owner_email}?subject=${subject}&body=${body}`;
                        }}
                      >
                        Notify to pay
                      </Button>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="rounded-xl border border-red-200/80 bg-red-50/60 p-3 dark:border-red-500/30 dark:bg-red-500/10">
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                        Danger zone
                      </p>
                      <p className="mt-1 text-xs text-red-700/80 dark:text-red-300/80">
                        Permanent action, cannot be undone.
                      </p>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="mt-2 h-9 rounded-lg px-3"
                        disabled={busyKey === `${license.id}-remove`}
                        onClick={() => {
                          const ok = window.confirm("Remove this license permanently?");
                          if (!ok) return;
                          void runAction(`${license.id}-remove`, () => deleteLicense(license.id), "License removed");
                        }}
                      >
                        Remove license
                      </Button>
                    </div>
                  </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function createDraft(account: ClientAccountRow, license: ClientAccountRow["licenses"][number]): LicenseDraft {
  const plan = normalizePlan(String(license.plan ?? ""));
  const cycle = inferCycle(license.created_at, license.license_expiry);
  const basePrice = plan === "starter" ? 59 : plan === "professional" ? 99 : 189;
  return {
    businessName: license.name ?? "",
    productType: normalizeProductTypeValue(license.type),
    plan,
    status: normalizeStatusValue(license.license_status),
    expiry: toDateTimeLocalValue(license.license_expiry),
    maxTerminals: String(Math.max(1, Number(license.max_terminals) || 1)),
    mobileAccessEnabled: license.mobile_access_enabled ?? true,
    billingPrice: String(cycle === "yearly" ? basePrice * 12 : basePrice),
    billingCycle: cycle,
    nextBillingDate: toDateValue(license.license_expiry),
    autoRenew: true,
    paymentMethod: "card",
    lastPaymentDate: toDateValue(license.created_at ?? ""),
    usersCount: "1",
    branchLimit: String(account.license_count),
    enabledModules: "Inventory, Reports",
    notes: "",
    discountPct: "0",
    customPrice: "",
    couponApplied: "",
    expiryReminderDays: "3",
    paymentFailedAlert: true,
    autoSuspendOnExpiry: true,
  };
}

function normalizeProductTypeValue(value: string): string {
  const v = value.trim().toLowerCase();
  const known = PRODUCT_TYPE_OPTIONS.map((o) => o.value);
  if (known.includes(v as (typeof PRODUCT_TYPE_OPTIONS)[number]["value"])) {
    return v;
  }
  if (v.includes("coffee") || v.includes("cafe")) return "cafe";
  if (v.includes("bar")) return "bar";
  if (v.includes("hotel")) return "hotel";
  if (v.includes("fitness")) return "fitness";
  return "restaurant";
}

function normalizePosLabel(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return "Restaurant POS";
  if (v.includes("restaurant")) return "Restaurant POS";
  if (v.includes("coffee")) return "Coffee POS";
  if (v.includes("fitness")) return "Fitness POS";
  if (v.includes("hotel")) return "Hotel POS";
  return value;
}

function planTierDisplayName(plan: PlanValue): string {
  if (plan === "starter") return "Starter";
  if (plan === "professional") return "Professional";
  return "Enterprise";
}

function normalizeStatusValue(status: string): StatusValue {
  const v = status.trim().toLowerCase();
  if (v === "active" || v === "expired" || v === "suspended" || v === "trial") {
    return v as StatusValue;
  }
  return "active";
}

function statusLabel(status: StatusValue): string {
  if (status === "active") return "Active";
  if (status === "expired") return "Expired";
  if (status === "trial") return "Trial";
  return "Suspended";
}

function LicenseMetaBadge({ children }: { children: ReactNode }) {
  return <span className={cn(adminBadgeClass, "uppercase tracking-wide")}>{children}</span>;
}

function LicenseStatusBadge({ status }: { status: StatusValue }) {
  return (
    <span className={adminBadgeClass}>
      <span className={cn("size-1.5 shrink-0 rounded-full", licenseStatusDotClass(status))} aria-hidden />
      <span className={cn("font-semibold", licenseStatusTextClass(status))}>{statusLabel(status)}</span>
    </span>
  );
}

function licenseStatusDotClass(status: StatusValue): string {
  if (status === "active") return "bg-emerald-500";
  if (status === "expired") return "bg-rose-500";
  if (status === "trial") return "bg-violet-500";
  return "bg-amber-500";
}

function licenseStatusTextClass(status: StatusValue): string {
  if (status === "active") return "text-emerald-700 dark:text-emerald-400";
  if (status === "expired") return "text-rose-700 dark:text-rose-400";
  if (status === "trial") return "text-violet-700 dark:text-violet-400";
  return "text-amber-700 dark:text-amber-400";
}

function StaticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 text-sm dark:border-slate-700/70 dark:bg-slate-900/60">
      <span className="font-medium text-slate-500 dark:text-slate-300/70">{label}</span>
      <span className="max-w-[65%] truncate font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300/70">
        {label}
      </p>
      <Input type={type} className="h-8 text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SectionBlockTitle({ text }: { text: string }) {
  return (
    <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300/70">
      {text}
    </p>
  );
}

function inferCycle(createdAt?: string, expiry?: string): BillingCycle {
  if (!createdAt || !expiry) return "monthly";
  const a = new Date(createdAt).getTime();
  const b = new Date(expiry).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "monthly";
  return b - a >= 330 * 24 * 60 * 60 * 1000 ? "yearly" : "monthly";
}

function toDateTimeLocalValue(iso: string): string {
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return "";
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mi = String(dt.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function toDateValue(iso: string): string {
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return "";
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatRemainingDays(isoOrLocal: string): string {
  const t = new Date(isoOrLocal).getTime();
  if (!Number.isFinite(t)) return "-";
  const days = Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}


