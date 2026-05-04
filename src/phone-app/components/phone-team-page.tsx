import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase.ts";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Copy, KeyRound, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  fetchAllRestaurantsOwnedBySession,
  type OwnedRestaurantRow,
} from "@/lib/supabase-pos/phone-pos-session.ts";
import {
  createPhoneManagerInvite,
  listPhoneManagersForRestaurant,
  revokePhoneManager,
  type PhoneManagerRow,
} from "@/lib/supabase-pos/phone-manager-invite-ops.ts";
import { cn } from "@/lib/utils.ts";
export default function PhoneTeamPage() {
  const { t } = useTranslation("site");
  const [venues, setVenues] = useState<OwnedRestaurantRow[] | null>(null);
  const [venueId, setVenueId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [lastCode, setLastCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [isPhoneManagerOnly, setIsPhoneManagerOnly] = useState(false);
  const [managers, setManagers] = useState<PhoneManagerRow[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user: u } }) => {
      setIsPhoneManagerOnly(
        (u?.user_metadata as { vyntex_phone_manager?: boolean })?.vyntex_phone_manager === true,
      );
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const list = await fetchAllRestaurantsOwnedBySession();
        if (cancelled) return;
        setVenues(list);
        if (list.length > 0) {
          setVenueId((prev) => prev || list[0]!.id);
        }
      } catch {
        if (!cancelled) setVenues([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** fetchAll only returns venues the user owns — needed to create invites. */
  const canCreateCodes = (venues?.length ?? 0) > 0;

  useEffect(() => {
    if (!venueId || !canCreateCodes) {
      setManagers([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setManagersLoading(true);
      try {
        const list = await listPhoneManagersForRestaurant(venueId);
        if (!cancelled) setManagers(list);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/does not exist|schema cache|Could not find|PGRST202|function public\./i.test(msg)) {
          if (!cancelled) setManagers([]);
        } else {
          console.warn("[phone-team] list managers:", msg);
          if (!cancelled) setManagers([]);
        }
      } finally {
        if (!cancelled) setManagersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [venueId, canCreateCodes]);

  const generate = async () => {
    if (!venueId) {
      toast.error(t("phone.team.pickVenue"));
      return;
    }
    setCreating(true);
    setLastCode(null);
    try {
      const r = await createPhoneManagerInvite(venueId);
      setLastCode({ code: r.code, expiresAt: r.expiresAt });
      toast.success(t("phone.team.codeCreated"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("supabase_not_configured")) {
        toast.error(t("phone.team.supabaseNotConfigured"));
      } else if (msg.includes("Not allowed") || msg.includes("venue")) {
        toast.error(t("phone.team.notOwner"));
      } else if (/does not exist|schema cache|Could not find|PGRST202|function public\./i.test(msg)) {
        toast.error(t("phone.team.migrationHint"));
      } else {
        toast.error(`${t("phone.team.createFailed")}: ${msg}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const copyCode = async () => {
    if (!lastCode?.code) return;
    try {
      await navigator.clipboard.writeText(lastCode.code);
      toast.success(t("phone.team.copied"));
    } catch {
      toast.error(t("phone.team.copyFailed"));
    }
  };

  const removeManager = async (row: PhoneManagerRow) => {
    if (!venueId) return;
    if (
      !window.confirm(
        t("phone.team.confirmRemoveManager", { email: row.managerEmail }),
      )
    ) {
      return;
    }
    setRemovingId(row.managerUserId);
    try {
      const r = await revokePhoneManager(venueId, row.managerUserId);
      if (!r.ok) {
        toast.error(t("phone.team.removeFailed"));
        return;
      }
      toast.success(t("phone.team.removed"));
      setManagers((prev) => prev.filter((m) => m.managerUserId !== row.managerUserId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`${t("phone.team.removeFailed")}: ${msg}`);
    } finally {
      setRemovingId(null);
    }
  };

  const expLabel =
    lastCode?.expiresAt != null
      ? new Date(lastCode.expiresAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "";

  return (
    <div className="flex min-h-full flex-col bg-transparent">
      <header
        className={cn(
          "sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3",
          "pt-[max(0.5rem,env(safe-area-inset-top))]",
        )}
      >
        <Link
          to="/app/profile"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-[#0066FF]/10"
          aria-label={t("phone.profile.backToProfile")}
        >
          <ChevronLeft className="size-6" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-900">{t("phone.team.title")}</h1>
          <p className="text-xs text-slate-500">{t("phone.team.subtitle")}</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <Link
          to="/app/staff"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <Users className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{t("phone.team.staffPinTitle")}</p>
            <p className="text-xs text-slate-500">{t("phone.team.staffPinDesc")}</p>
          </div>
          <span className="text-slate-300">›</span>
        </Link>

        <Link
          to="/redeem-code"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <KeyRound className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{t("phone.team.redeemLinkTitle")}</p>
            <p className="text-xs text-slate-500">{t("phone.team.redeemLinkDesc")}</p>
          </div>
          <span className="text-slate-300">›</span>
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#0066FF]/8 to-violet-50 p-4">
          <h2 className="text-sm font-bold text-slate-900">{t("phone.team.inviteSection")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{t("phone.team.inviteHelp")}</p>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">{t("phone.venues.loading")}</p>
          ) : !canCreateCodes && isPhoneManagerOnly ? (
            <p className="mt-4 rounded-xl bg-white/80 px-3 py-3 text-sm text-slate-600">
              {t("phone.team.managerNoInvite")}
            </p>
          ) : !canCreateCodes ? (
            <p className="mt-4 rounded-xl bg-white/80 px-3 py-3 text-sm text-slate-600">
              {t("phone.team.noVenuesForInvite")}
            </p>
          ) : (
            <>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-slate-600">{t("phone.team.pickVenue")}</p>
                <Select value={venueId} onValueChange={setVenueId}>
                  <SelectTrigger className="h-11 rounded-xl bg-white">
                    <SelectValue placeholder={t("phone.team.pickVenue")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(venues ?? []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="mt-4 h-11 w-full rounded-xl bg-[#0066FF] hover:bg-[#0055DD]"
                disabled={creating || !venueId}
                onClick={() => void generate()}
              >
                {creating ? t("phone.profile.saving") : t("phone.team.generate")}
              </Button>
            </>
          )}
        </div>

        {canCreateCodes && !loading && venueId ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">{t("phone.team.managersSection")}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {t("phone.team.managersHelp")}
            </p>
            {managersLoading ? (
              <p className="mt-3 text-sm text-slate-500">{t("phone.venues.loading")}</p>
            ) : managers.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{t("phone.team.managersEmpty")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {managers.map((m) => (
                  <li
                    key={m.managerUserId}
                    className="flex items-center gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{m.managerEmail}</p>
                      <p className="text-xs text-slate-500">
                        {t("phone.team.linkedAt")}{" "}
                        {m.linkedAt
                          ? new Date(m.linkedAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={removingId === m.managerUserId}
                      onClick={() => void removeManager(m)}
                      aria-label={t("phone.team.removeManager")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {lastCode ? (
          <div className="rounded-2xl border-2 border-dashed border-[#0066FF]/40 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("phone.team.codeLabel")}
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-[0.35em] text-[#0f172a]">
              {lastCode.code}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {t("phone.team.expires")}: {expLabel}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 rounded-xl"
              onClick={() => void copyCode()}
            >
              <Copy className="mr-2 size-4" />
              {t("phone.team.copy")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
