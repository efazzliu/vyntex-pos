import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Loader2,
  MailPlus,
  Pencil,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
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
import { cn } from "@/lib/utils.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { useAdminCenter } from "@/pages/dashboard/_components/admin-center-context.tsx";
import { AdminPage, acCard } from "@/pages/dashboard/_components/admin-center-ui.tsx";
import { useUserRole } from "@/hooks/use-user-role.ts";

type Role = "owner" | "administrator" | "manager" | "staff";

type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  venueIds: string[] | "all";
  locked?: boolean;
  managerUserId?: string;
};

const ACCESS_KEY = "vyntex.admin.memberAccess";

function loadAccess(): Record<string, { role: Role; venueIds: string[] | "all" }> {
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAccess(next: Record<string, { role: Role; venueIds: string[] | "all" }>) {
  localStorage.setItem(ACCESS_KEY, JSON.stringify(next));
}

export default function DashboardTeamAccessPage() {
  const { t } = useDashboardLocale();
  const { restaurant } = useDashboardRestaurant();
  const { venues } = useAdminCenter();
  const { user } = useUserRole();
  const [owner, setOwner] = useState<{ name: string; email: string } | null>(null);
  const [managers, setManagers] = useState<PhoneManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [invite, setInvite] = useState<CreateInviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<PhoneManagerRow | null>(null);
  const [working, setWorking] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [editRole, setEditRole] = useState<Role>("manager");
  const [editVenues, setEditVenues] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [managerRows, ownerResult] = await Promise.all([
        listPhoneManagersForRestaurant(restaurant.id),
        supabase
          .from("restaurants")
          .select("owner_user_id, owner_email, owner_name")
          .eq("id", restaurant.id)
          .single(),
      ]);
      setManagers(managerRows);
      if (ownerResult.data) {
        const email = String(ownerResult.data.owner_email ?? user?.email ?? "");
        setOwner({
          name:
            String(ownerResult.data.owner_name ?? "").trim() ||
            user?.name?.trim() ||
            email.split("@")[0] ||
            "Owner",
          email: email || "Owner account",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load team members.");
    } finally {
      setLoading(false);
    }
  }, [restaurant, user?.email, user?.name]);

  useEffect(() => {
    void load();
  }, [load]);

  const members: Member[] = useMemo(() => {
    const stored = loadAccess();
    const allIds = venues.map((v) => v.id);
    const list: Member[] = [];
    if (owner) {
      list.push({
        id: "owner",
        name: owner.name,
        email: owner.email,
        role: "owner",
        venueIds: "all",
        locked: true,
      });
    }
    for (const manager of managers) {
      const override = stored[manager.managerUserId];
      list.push({
        id: manager.managerUserId,
        name: manager.managerEmail.split("@")[0] || "Team member",
        email: manager.managerEmail,
        role: override?.role ?? "manager",
        venueIds: override?.venueIds ?? [restaurant?.id ?? ""],
        managerUserId: manager.managerUserId,
      });
    }
    const extras: Member[] = [
      {
        id: "demo-admin",
        name: "Admin User",
        email: "admin@vyntex.local",
        role: stored["demo-admin"]?.role ?? "administrator",
        venueIds: stored["demo-admin"]?.venueIds ?? allIds,
      },
      {
        id: "demo-manager",
        name: "Manager",
        email: "manager@vyntex.local",
        role: stored["demo-manager"]?.role ?? "manager",
        venueIds: stored["demo-manager"]?.venueIds ?? allIds.slice(0, 2),
      },
      {
        id: "demo-staff",
        name: "Waiter",
        email: "waiter@vyntex.local",
        role: stored["demo-staff"]?.role ?? "staff",
        venueIds: stored["demo-staff"]?.venueIds ?? allIds.slice(0, 1),
      },
    ];
    for (const extra of extras) {
      if (!list.some((m) => m.email === extra.email)) list.push(extra);
    }
    const q = query.trim().toLowerCase();
    return q
      ? list.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(q))
      : list;
  }, [owner, managers, venues, restaurant?.id, query]);

  const createInvite = async () => {
    if (!restaurant) return;
    setCreatingInvite(true);
    try {
      const result = await createPhoneManagerInvite(restaurant.id);
      setInvite(result);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create invitation.");
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyInvite = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      toast.success("Invitation code copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy the invitation code.");
    }
  };

  const revoke = async () => {
    if (!restaurant || !removing) return;
    setWorking(true);
    try {
      const result = await revokePhoneManager(restaurant.id, removing.managerUserId);
      if (!result.ok) throw new Error(result.error || "Could not remove member.");
      toast.success("Team member removed");
      setRemoving(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove member.");
    } finally {
      setWorking(false);
    }
  };

  const openEdit = (member: Member) => {
    setEditing(member);
    setEditRole(member.role === "owner" ? "administrator" : member.role);
    setEditVenues(member.venueIds === "all" ? venues.map((v) => v.id) : member.venueIds);
  };

  const saveEdit = () => {
    if (!editing) return;
    const stored = loadAccess();
    stored[editing.id] = { role: editRole, venueIds: editVenues };
    saveAccess(stored);
    toast.success(t("ac.team.saved"));
    setEditing(null);
  };

  if (loading || restaurant === undefined) {
    return (
      <AdminPage className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">
            {t("ac.nav.admin_center")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("ac.nav.team")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("ac.team.subtitle")}</p>
        </div>
        <Button
          onClick={() => void createInvite()}
          disabled={creatingInvite || !restaurant}
          className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
        >
          {creatingInvite ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />}
          {t("ac.team.invite")}
        </Button>
      </header>

      <div className={cn(acCard, "overflow-hidden")}>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ac.team.search")}
              className="h-9 rounded-xl pl-9 sm:w-64"
            />
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-4 px-5 py-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
                {member.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {member.name}
                  {member.role === "owner" ? <Crown className="size-3.5 text-amber-500" /> : null}
                </p>
                <p className="truncate text-xs text-slate-500">{member.email}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {t("ac.team.access")}:{" "}
                  {member.venueIds === "all" || member.venueIds.length === venues.length
                    ? t("ac.filter.all_venues")
                    : `${member.venueIds.length} ${t("ac.nav.venues").toLowerCase()}`}
                </p>
              </div>
              <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-600 sm:inline">
                {member.role}
              </span>
              {!member.locked ? (
                <Button variant="outline" size="sm" className="rounded-lg" onClick={() => openEdit(member)}>
                  <Pencil className="size-3.5" />
                  {t("ac.team.edit")}
                </Button>
              ) : (
                <span className="text-[11px] font-medium text-slate-400">{t("ac.nav.owner")}</span>
              )}
              {member.managerUserId ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-400 hover:text-rose-600"
                  onClick={() =>
                    setRemoving(managers.find((m) => m.managerUserId === member.managerUserId) ?? null)
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
          {members.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              <UserRound className="mx-auto mb-2 size-8 text-slate-300" />
              {t("ac.team.empty")}
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={Boolean(invite)} onOpenChange={(open) => !open && setInvite(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ac.team.invite_created")}</DialogTitle>
            <DialogDescription>{t("ac.team.invite_hint")}</DialogDescription>
          </DialogHeader>
          {invite ? (
            <button
              type="button"
              onClick={() => void copyInvite()}
              className="flex w-full items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4"
            >
              <code className="text-xl font-bold tracking-[0.2em] text-indigo-800">{invite.code}</code>
              {copied ? <Check className="size-5 text-emerald-600" /> : <Copy className="size-5 text-indigo-600" />}
            </button>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvite(null)}>
              {t("ac.common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("ac.team.edit")}</DialogTitle>
            <DialogDescription>{editing?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold">{t("ac.team.role")}</p>
              <RadioGroup value={editRole} onValueChange={(v) => setEditRole(v as Role)} className="grid grid-cols-2 gap-2">
                {(["owner", "administrator", "manager", "staff"] as Role[]).map((role) => (
                  <label
                    key={role}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm capitalize",
                      editRole === role ? "border-indigo-300 bg-indigo-50" : "border-slate-200",
                    )}
                  >
                    <RadioGroupItem value={role} />
                    {role}
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">{t("ac.team.which_venues")}</p>
              <div className="space-y-2">
                {venues.map((venue) => {
                  const checked = editVenues.includes(venue.id);
                  return (
                    <label key={venue.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) => {
                          setEditVenues((prev) =>
                            next === true ? [...prev, venue.id] : prev.filter((id) => id !== venue.id),
                          );
                        }}
                      />
                      {venue.name}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t("ac.common.cancel")}
            </Button>
            <Button className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={saveEdit}>
              {t("ac.team.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ac.team.remove_title")}</AlertDialogTitle>
            <AlertDialogDescription>{removing?.managerEmail}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>{t("ac.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              onClick={(event) => {
                event.preventDefault();
                void revoke();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {working ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {t("ac.team.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
