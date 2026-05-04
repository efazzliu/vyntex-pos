import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Trash2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { usePlatformAdmin } from "@/hooks/use-platform-admin.ts";
import { clearRestaurantCache } from "@/lib/supabase-pos/restaurant.ts";
import { fetchPhoneStaffBundle } from "@/lib/supabase-pos/phone-staff-ops.ts";
import { deleteStaff } from "@/lib/supabase-pos/staff-ops.ts";
import { PhoneStaffEditSheet } from "./phone-staff-edit-sheet.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";

type StaffDoc = Awaited<ReturnType<typeof fetchPhoneStaffBundle>>["staff"][number];

const ROLE_COLORS: Record<string, string> = {
  admin: "#0066FF",
  manager: "#7c3aed",
  waiter: "#16a34a",
  inventory: "#d97706",
  accountant: "#0891b2",
  auditor: "#db2777",
  kitchen: "#ea580c",
};

export default function PhoneStaffPage() {
  const { t } = useTranslation("site");
  const { restaurant, refresh: refreshRestaurant } = useDashboardRestaurant();
  const { session } = usePlatformAdmin();
  const isPhoneManager =
    (session?.user?.user_metadata as { vyntex_phone_manager?: boolean } | undefined)
      ?.vyntex_phone_manager === true;
  const [staff, setStaff] = useState<StaffDoc[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<StaffDoc | null>(null);

  const load = useCallback(async () => {
    if (!restaurant?.licenseKey) return;
    setLoading(true);
    setError(false);
    try {
      const bundle = await fetchPhoneStaffBundle(restaurant.licenseKey);
      setStaff(bundle.staff);
      setOnlineIds(bundle.onlineStaffIds);
    } catch {
      setStaff([]);
      setOnlineIds(new Set());
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [restaurant?.licenseKey]);

  useEffect(() => {
    void refreshRestaurant();
  }, [refreshRestaurant]);

  useEffect(() => {
    if (restaurant?.licenseKey) void load();
  }, [restaurant?.licenseKey, load]);

  const roleLabel = useCallback(
    (role: string) => {
      const key = `phone.staff.role_${role}`;
      const v = t(key);
      return v === key ? role : v;
    },
    [t],
  );

  const { onlineList, otherActive, inactiveList } = useMemo(() => {
    const on: StaffDoc[] = [];
    const oa: StaffDoc[] = [];
    const ia: StaffDoc[] = [];
    for (const s of staff) {
      if (!s.isActive) ia.push(s);
      else if (onlineIds.has(s._id)) on.push(s);
      else oa.push(s);
    }
    const byName = (a: StaffDoc, b: StaffDoc) => a.name.localeCompare(b.name);
    on.sort(byName);
    oa.sort(byName);
    ia.sort(byName);
    return { onlineList: on, otherActive: oa, inactiveList: ia };
  }, [staff, onlineIds]);

  const onlineCount = onlineList.length;
  const totalCount = staff.length;

  const handleDelete = async (member: StaffDoc) => {
    if (!restaurant?.licenseKey) return;
    if (!window.confirm(t("phone.staff.confirmDelete", { name: member.name }))) return;
    try {
      await deleteStaff({ licenseKey: restaurant.licenseKey, staffId: member._id });
      clearRestaurantCache(restaurant.licenseKey);
      toast.success(t("phone.staff.deleted"));
      void load();
    } catch {
      toast.error(t("phone.staff.deleteFailed"));
    }
  };

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (s: StaffDoc) => {
    setEditing(s);
    setSheetOpen(true);
  };

  if (restaurant === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        {t("phone.venues.loading")}
      </div>
    );
  }

  if (restaurant === null) {
    return <Navigate to="/app" replace />;
  }

  const renderCard = (member: StaffDoc, showOnlineBadge: boolean) => {
    const color = ROLE_COLORS[member.role] ?? "#64748b";
    const online = showOnlineBadge && member.isActive && onlineIds.has(member._id);

    return (
      <li
        key={member._id}
        className={cn(
          "relative rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm",
          !member.isActive && "opacity-70",
        )}
      >
        <div className="absolute right-3 top-3 flex gap-1">
          <button
            type="button"
            className="rounded-lg p-2 text-[#0066FF] hover:bg-[#0066FF]/10"
            aria-label={t("phone.staff.edit")}
            onClick={() => openEdit(member)}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
            aria-label={t("phone.staff.delete")}
            onClick={() => void handleDelete(member)}
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        <div className="flex gap-3 pr-16">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}18` }}
          >
            <UserRound className="size-6" style={{ color }} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">{member.name}</span>
              {online ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {t("phone.staff.badgeOnline")}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm font-medium" style={{ color }}>
              {roleLabel(member.role)}
            </p>
            {!member.isActive ? (
              <p className="mt-1 text-xs text-slate-500">{t("phone.staff.inactiveHint")}</p>
            ) : null}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col bg-transparent text-slate-900">
      <header className="shrink-0 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="pt-2 text-2xl font-bold tracking-tight text-[#0f172a]">{t("phone.staff.title")}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{restaurant.name}</p>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-6">
        {error ? (
          <p className="rounded-xl border border-red-200 bg-white p-4 text-center text-sm text-red-600">
            {t("phone.staff.loadError")}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 px-3 py-4 shadow-md">
            <Users className="mb-2 size-6 text-white/90" strokeWidth={2} />
            <p className="text-2xl font-bold tabular-nums text-white">{loading ? "—" : onlineCount}</p>
            <p className="text-xs font-medium text-white/90">{t("phone.staff.cardOnline")}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#5b4ddb] px-3 py-4 shadow-md shadow-[#0066FF]/20">
            <Users className="mb-2 size-6 text-white/90" strokeWidth={2} />
            <p className="text-2xl font-bold tabular-nums text-white">{loading ? "—" : totalCount}</p>
            <p className="text-xs font-medium text-white/90">{t("phone.staff.cardTotal")}</p>
          </div>
        </div>

        <Button
          type="button"
          className="h-12 w-full rounded-xl bg-[#0066FF] text-base font-semibold text-white shadow-sm hover:bg-[#0055DD]"
          onClick={openAdd}
        >
          <Plus className="mr-2 size-5" />
          {t("phone.staff.addMember")}
        </Button>

        {!loading && staff.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            {t("phone.staff.empty")}
          </p>
        ) : null}

        {onlineList.length > 0 ? (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-[#0f172a]">
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
              {t("phone.staff.sectionOnline", { count: onlineList.length })}
            </h2>
            <ul className="flex flex-col gap-3">{onlineList.map((s) => renderCard(s, true))}</ul>
          </section>
        ) : null}

        {otherActive.length > 0 ? (
          <section>
            <h2 className="mb-2 text-base font-semibold text-[#0f172a]">{t("phone.staff.sectionOther")}</h2>
            <ul className="flex flex-col gap-3">{otherActive.map((s) => renderCard(s, false))}</ul>
          </section>
        ) : null}

        {inactiveList.length > 0 ? (
          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-600">{t("phone.staff.sectionInactive")}</h2>
            <ul className="flex flex-col gap-3">{inactiveList.map((s) => renderCard(s, false))}</ul>
          </section>
        ) : null}
      </div>

      <PhoneStaffEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        licenseKey={restaurant.licenseKey}
        editing={editing}
        isPhoneManager={isPhoneManager}
        onSaved={() => void load()}
      />
    </div>
  );
}
