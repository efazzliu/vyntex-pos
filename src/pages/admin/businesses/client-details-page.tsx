import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, KeyRound, MonitorSmartphone, ShieldCheck } from "lucide-react";
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
  deleteLicense,
  listClientAccounts,
  resetLicenseDevices,
  setLicenseExpiryIso,
  setMaxTerminals,
  updateClientLicenseConfig,
  updateLicensePlan,
  updateLicenseStatus,
  type ClientAccountRow,
} from "@/lib/supabase-pos/admin-ops.ts";

type PlanValue = "starter" | "professional" | "enterprise";
type StatusValue = "active" | "expired" | "trial" | "suspended";
type BillingCycle = "monthly" | "yearly";
type PaymentMethod = "card" | "bank_transfer" | "paypal" | "other";

type LicenseDraft = {
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
      <section className="space-y-4 p-6 lg:p-8">
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/admin/businesses">
            <ArrowLeft className="size-4" />
            Back to Clients
          </Link>
        </Button>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-700/70 dark:bg-slate-900/80">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Client not found</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300/70">Invalid link or removed client.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/admin/businesses">
            <ArrowLeft className="size-4" />
            Back to Clients
          </Link>
        </Button>
        <Button asChild size="sm" className="rounded-full">
          <a href={`mailto:${account.owner_email}?subject=${encodeURIComponent("Vyntex POS Support")}`}>
            Contact client
          </a>
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_18px_40px_-30px_rgba(2,6,23,0.25)] dark:border-slate-700/70 dark:bg-slate-900/80">
        <p className="text-lg font-semibold text-slate-900 dark:text-white">
          {account.owner_name?.trim() || account.owner_email}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-300/70">{account.owner_email}</p>
      </div>

      <div className="space-y-4">
        {account.licenses.map((license) => {
          const d = drafts[license.id];
          if (!d) return null;

          return (
            <article
              key={license.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_20px_48px_-36px_rgba(2,6,23,0.24)] dark:border-slate-700/70 dark:bg-slate-900/80"
            >
              <div className="max-w-4xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_40px_-34px_rgba(2,6,23,0.26)] dark:border-slate-700/70 dark:bg-slate-900/80">
                <div className="border-b border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-900/90">
                  <SectionLabel icon={<ShieldCheck className="size-3.5" />} text="Manage license" />
                </div>

                <div className="grid gap-3 p-4 md:grid-cols-2">
                  <StaticRow label="Business" value={license.name} />
                  <StaticRow label="Product" value={normalizePosLabel(license.type)} />

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
                    </div>
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
                    <div className="pt-1">
                      <span className={statusBadgeClass(d.status)}>{statusLabel(d.status)}</span>
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
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function createDraft(account: ClientAccountRow, license: ClientAccountRow["licenses"][number]): LicenseDraft {
  const plan = normalizePlanValue(license.plan);
  const cycle = inferCycle(license.created_at, license.license_expiry);
  const basePrice = plan === "starter" ? 59 : plan === "professional" ? 99 : 189;
  return {
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

function normalizePosLabel(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return "Restaurant POS";
  if (v.includes("restaurant")) return "Restaurant POS";
  if (v.includes("coffee")) return "Coffee POS";
  if (v.includes("fitness")) return "Fitness POS";
  if (v.includes("hotel")) return "Hotel POS";
  return value;
}

function normalizePlanValue(plan: string): PlanValue {
  const v = plan.trim().toLowerCase();
  if (v === "starter" || v === "professional" || v === "enterprise") return v;
  return "starter";
}

function normalizeStatusValue(status: string): StatusValue {
  const v = status.trim().toLowerCase();
  if (v === "active" || v === "expired" || v === "suspended" || v === "trial") {
    return v as StatusValue;
  }
  return "active";
}

function planLabel(plan: PlanValue): string {
  if (plan === "starter") return "Starter";
  if (plan === "professional") return "Pro";
  return "Enterprise";
}

function statusLabel(status: StatusValue): string {
  if (status === "active") return "Active";
  if (status === "expired") return "Expired";
  if (status === "trial") return "Trial";
  return "Suspended";
}

function SectionLabel({ text, icon }: { text: string; icon: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-200">
      {icon}
      {text}
    </p>
  );
}

function StaticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 text-sm dark:border-slate-700/70 dark:bg-slate-900/60">
      <span className="font-medium text-slate-500 dark:text-slate-300/70">{label}</span>
      <span className="max-w-[65%] truncate font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

function statusBadgeClass(status: StatusValue): string {
  if (status === "active") {
    return "inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300";
  }
  if (status === "expired") {
    return "inline-flex rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300";
  }
  if (status === "trial") {
    return "inline-flex rounded-full border border-violet-300 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300";
  }
  return "inline-flex rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300";
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

