import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  Copy,
  Crown,
  KeyRound,
  Loader2,
  MailPlus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { supabase } from "@/lib/supabase.ts";
import {
  createPhoneManagerInvite,
  listPhoneManagersForRestaurant,
  revokePhoneManager,
  type CreateInviteResult,
  type PhoneManagerRow,
} from "@/lib/supabase-pos/phone-manager-invite-ops.ts";
import { dashboardDateLocale } from "@/lib/dashboard-i18n.ts";
import { cn } from "@/lib/utils.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";

type OwnerDetails = {
  userId: string | null;
  name: string;
  email: string;
};

type PendingInvite = {
  id: string;
  code: string;
  expiresAt: string;
};

export default function DashboardTeamAccessPage() {
  const { t, lang } = useDashboardLocale();
  const dateLocale = dashboardDateLocale(lang);
  const { restaurant } = useDashboardRestaurant();
  const [owner, setOwner] = useState<OwnerDetails | null>(null);
  const [managers, setManagers] = useState<PhoneManagerRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [invite, setInvite] = useState<CreateInviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<PhoneManagerRow | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [managerRows, ownerResult, inviteResult] = await Promise.all([
        listPhoneManagersForRestaurant(restaurant.id),
        supabase
          .from("restaurants")
          .select("owner_user_id, owner_email, owner_name")
          .eq("id", restaurant.id)
          .single(),
        supabase
          .from("phone_manager_invites")
          .select("id, code, expires_at, redeemed_at")
          .eq("restaurant_id", restaurant.id)
          .is("redeemed_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false }),
      ]);
      setManagers(managerRows);
      if (ownerResult.data) {
        const email = String(ownerResult.data.owner_email ?? "");
        setOwner({
          userId: ownerResult.data.owner_user_id
            ? String(ownerResult.data.owner_user_id)
            : null,
          name:
            String(ownerResult.data.owner_name ?? "").trim() ||
            email.split("@")[0] ||
            t("team.business_owner"),
          email: email || t("team.owner_account"),
        });
      }
      if (!inviteResult.error) {
        setPendingInvites(
          (inviteResult.data ?? []).map((row) => ({
            id: String(row.id),
            code: String(row.code),
            expiresAt: String(row.expires_at),
          })),
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("team.toast_load_failed"),
      );
    } finally {
      setLoading(false);
    }
  }, [restaurant, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleManagers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return managers;
    return managers.filter((manager) =>
      manager.managerEmail.toLowerCase().includes(normalized),
    );
  }, [managers, query]);

  const createInvite = async () => {
    if (!restaurant) return;
    setCreatingInvite(true);
    try {
      const result = await createPhoneManagerInvite(restaurant.id);
      setInvite(result);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("team.toast_invite_failed"),
      );
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyInvite = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      toast.success(t("team.toast_invite_copied"));
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("team.toast_invite_copy_failed"));
    }
  };

  const revoke = async () => {
    if (!restaurant || !removing) return;
    setWorking(true);
    try {
      const result = await revokePhoneManager(
        restaurant.id,
        removing.managerUserId,
      );
      if (!result.ok) throw new Error(result.error || t("team.toast_remove_failed"));
      toast.success(t("team.toast_removed"));
      setRemoving(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("team.toast_remove_failed"),
      );
    } finally {
      setWorking(false);
    }
  };

  if (loading || restaurant === undefined) {
    return (
      <div className="space-y-5 px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <Skeleton className="h-28 rounded-3xl" />
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-96 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex min-h-full items-center justify-center p-8 text-sm text-slate-500">
        {t("team.no_license")}
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-sky-50/50 px-4 pb-12 pt-16 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-48px_rgba(14,116,202,0.4)]">
          <div className="flex flex-col gap-5 bg-gradient-to-r from-sky-50 via-white to-violet-50/60 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
                <Users className="size-6" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-600">
                  {t("nav.team")}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  {t("nav.team_access")}
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  {t("team.page_subtitle")}
                </p>
              </div>
            </div>
            <Button
              onClick={() => void createInvite()}
              disabled={creatingInvite}
              className="shrink-0 rounded-xl bg-sky-600 text-white hover:bg-sky-700"
            >
              {creatingInvite ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <MailPlus className="mr-2 size-4" />
              )}
              {t("team.invite_member")}
            </Button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label={t("team.metric_active_members")}
            value={`${1 + managers.length}`}
            hint={t("team.metric_active_hint")}
            icon={Users}
            tone="sky"
          />
          <SummaryCard
            label={t("team.metric_pending_invites")}
            value={`${pendingInvites.length}`}
            hint={t("team.metric_pending_hint")}
            icon={Clock3}
            tone="amber"
          />
          <SummaryCard
            label={t("team.metric_access_level")}
            value={t("team.metric_protected")}
            hint={t("team.metric_access_hint")}
            icon={ShieldCheck}
            tone="emerald"
          />
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">{t("team.members_title")}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t("team.members_subtitle")}
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("team.search_placeholder")}
                  className="h-9 w-full rounded-xl pl-9 sm:w-56"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {owner && (
                <MemberRow
                  name={owner.name}
                  email={owner.email}
                  role={t("team.role_owner")}
                  joinedAt={null}
                  owner
                  t={t}
                  dateLocale={dateLocale}
                />
              )}
              {visibleManagers.map((manager) => (
                <MemberRow
                  key={manager.managerUserId}
                  name={manager.managerEmail.split("@")[0] || t("team.team_member")}
                  email={manager.managerEmail}
                  role={t("team.role_manager")}
                  joinedAt={manager.linkedAt}
                  onRemove={() => setRemoving(manager)}
                  t={t}
                  dateLocale={dateLocale}
                />
              ))}
              {managers.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <UserRound className="mx-auto size-8 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    {t("team.empty_members")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("team.empty_members_hint")}
                  </p>
                </div>
              )}
              {managers.length > 0 && visibleManagers.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  {t("team.no_search_results")}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-sky-600" />
                <h2 className="text-sm font-semibold">{t("team.access_roles")}</h2>
              </div>
              <div className="mt-4 space-y-3">
                <RoleCard
                  icon={Crown}
                  title={t("team.role_owner")}
                  description={t("team.role_owner_desc")}
                  tone="amber"
                />
                <RoleCard
                  icon={ShieldCheck}
                  title={t("team.role_manager")}
                  description={t("team.role_manager_desc")}
                  tone="sky"
                />
              </div>
            </section>

            {pendingInvites.length > 0 && (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <Clock3 className="size-4" />
                  {t("team.pending_invitations")}
                </div>
                <div className="mt-3 space-y-2">
                  {pendingInvites.slice(0, 3).map((pending) => (
                    <div
                      key={pending.id}
                      className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2"
                    >
                      <code className="text-xs font-bold tracking-wider text-amber-900">
                        {pending.code}
                      </code>
                      <span className="text-[10px] text-amber-700">
                        {formatExpiry(pending.expiresAt, t)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <ShieldCheck className="size-4" />
                {t("team.access_policy")}
              </p>
              <p className="mt-1.5 text-[11px] leading-5 text-emerald-700">
                {t("team.access_policy_text")}
              </p>
            </section>
          </aside>
        </div>
      </div>

      <Dialog open={Boolean(invite)} onOpenChange={(open) => !open && setInvite(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("team.invite_created")}</DialogTitle>
            <DialogDescription>{t("team.invite_created_desc")}</DialogDescription>
          </DialogHeader>
          {invite && (
            <div className="py-2">
              <button
                type="button"
                onClick={() => void copyInvite()}
                className="flex w-full items-center justify-between rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4"
              >
                <code className="text-xl font-bold tracking-[0.22em] text-sky-800">
                  {invite.code}
                </code>
                {copied ? (
                  <Check className="size-5 text-emerald-600" />
                ) : (
                  <Copy className="size-5 text-sky-600" />
                )}
              </button>
              <p className="mt-3 text-center text-xs text-slate-500">
                {t("team.expires_at", {
                  date: new Date(invite.expiresAt).toLocaleString(dateLocale),
                })}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvite(null)}>
              {t("team.done")}
            </Button>
            <Button onClick={() => void copyInvite()}>
              <Copy className="mr-2 size-4" />
              {t("team.copy_code")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("team.remove_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("team.remove_description", { email: removing?.managerEmail ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>{t("team.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              onClick={(event) => {
                event.preventDefault();
                void revoke();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {working && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("team.remove_access")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MemberRow({
  name,
  email,
  role,
  joinedAt,
  owner = false,
  onRemove,
  t,
  dateLocale,
}: {
  name: string;
  email: string;
  role: string;
  joinedAt: string | null;
  owner?: boolean;
  onRemove?: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dateLocale: string;
}) {
  const initial = (name || email || "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
          owner ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700",
        )}
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
          {owner && <Crown className="size-3.5 shrink-0 text-amber-500" />}
        </div>
        <p className="truncate text-xs text-slate-500">{email}</p>
      </div>
      <div className="hidden text-right sm:block">
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
            owner
              ? "bg-amber-50 text-amber-700"
              : "bg-sky-50 text-sky-700",
          )}
        >
          {role}
        </span>
        <p className="mt-1 text-[10px] text-slate-400">
          {joinedAt
            ? t("team.joined", {
                date: new Date(joinedAt).toLocaleDateString(dateLocale),
              })
            : t("team.primary_account")}
        </p>
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          title={t("team.remove_access")}
          className="size-9 shrink-0 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
  tone: "sky" | "amber" | "emerald";
}) {
  const tones = {
    sky: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
        </div>
        <span className={cn("flex size-10 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

function RoleCard({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: typeof Crown;
  title: string;
  description: string;
  tone: "amber" | "sky";
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          tone === "amber"
            ? "bg-amber-100 text-amber-700"
            : "bg-sky-100 text-sky-700",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function formatExpiry(
  iso: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const minutes = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
  if (minutes < 60) return t("team.expiry_minutes", { count: minutes });
  return t("team.expiry_hours", { count: Math.ceil(minutes / 60) });
}
