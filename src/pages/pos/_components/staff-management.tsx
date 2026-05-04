import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { useOfflineData } from "@/hooks/use-offline-data.ts";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { Plus, Pencil, Trash2, Users, Shield, ChefHat, UserCheck, Crown, PackageSearch, Calculator, ClipboardCheck } from "lucide-react";
import StaffDialog from "./staff-dialog.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";

type StaffManagementProps = {
  licenseKey: string;
  plan: string;
};

const ROLE_CONFIG: Record<string, { color: string; icon: typeof Shield }> = {
  admin: { color: "#0066FF", icon: Shield },
  manager: { color: "#8B5CF6", icon: Crown },
  waiter: { color: "#44CC00", icon: UserCheck },
  inventory: { color: "#F59E0B", icon: PackageSearch },
  accountant: { color: "#06B6D4", icon: Calculator },
  auditor: { color: "#EC4899", icon: ClipboardCheck },
  kitchen: { color: "#FF6B00", icon: ChefHat },
} as const;

function roleDisplayLabel(
  role: string,
  t: (k: string) => string,
): string {
  if (role === "kitchen") return t("staff.role_kitchen_long");
  const key = `staff.role_${role}`;
  const v = t(key);
  return v === key ? role : v;
}

export default function StaffManagement({ licenseKey, plan }: StaffManagementProps) {
  const { t } = usePosLocale();
  const isOnline = useOnlineStatus();
  const staffListQuery = useQuery('pos.staff.getStaff', { licenseKey });
  const { data: staffData } = useOfflineData<Doc<"staff">[]>(
    `staff:${licenseKey}`,
    staffListQuery,
    isOnline,
  );
  const deleteStaff = useMutation('pos.staff.deleteStaff');
  const [staffList, setStaffList] = useState<Doc<"staff">[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Doc<"staff"> | null>(null);

  const isLoading = false;

  useEffect(() => {
    if (staffData !== undefined) {
      setStaffList(staffData);
    }
  }, [staffData]);

  const handleDelete = async (staffId: Id<"staff">, staffName: string) => {
    if (!window.confirm(t("staff_page.confirm_remove", { name: staffName })))
      return;
    try {
      await deleteStaff({ licenseKey, staffId });
      setStaffList((prev) => prev.filter((s) => s._id !== staffId));
      const cached = (await getDataCache<Doc<"staff">[]>(`staff:${licenseKey}`)) ?? [];
      await saveDataCache(
        `staff:${licenseKey}`,
        cached.filter((s) => s._id !== staffId),
      );
      toast.success(t("staff_page.removed", { name: staffName }));
    } catch {
      toast.error(t("staff_page.remove_failed"));
    }
  };

  // ── Loading ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-64 bg-[#131A2E]" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl bg-[#131A2E]" />
        ))}
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────
  if (staffList.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <Header
          t={t}
          onAdd={() => {
            setEditingStaff(null);
            setDialogOpen(true);
          }}
        />
        <div className="mt-16">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>{t("staff_page.empty_title")}</EmptyTitle>
              <EmptyDescription>{t("staff_page.empty_desc")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                size="sm"
                onClick={() => {
                  setEditingStaff(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4 mr-1" />
                {t("staff.add_staff")}
              </Button>
            </EmptyContent>
          </Empty>
        </div>

        <StaffDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          licenseKey={licenseKey}
          plan={plan}
          editing={editingStaff}
          onSaved={(staff, mode) => {
            if (mode === "create") {
              setStaffList((prev) => [...prev, staff]);
            } else {
              setStaffList((prev) =>
                prev.map((s) => (s._id === staff._id ? staff : s)),
              );
            }
          }}
        />
      </div>
    );
  }

  // ── Main View — List ──────────────────────────────────
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Header
        t={t}
        onAdd={() => {
          setEditingStaff(null);
          setDialogOpen(true);
        }}
      />

      {/* Table list */}
      <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_120px_80px_80px] md:grid-cols-[1fr_140px_100px_100px] items-center px-4 py-3 border-b border-[#1e2a45] bg-[#0D1326]">
          <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-wider">
            {t("staff_page.col_name")}
          </span>
          <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-wider">
            {t("staff_page.col_position")}
          </span>
          <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-wider text-center">
            {t("staff_page.col_edit")}
          </span>
          <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-wider text-center">
            {t("staff_page.col_remove")}
          </span>
        </div>

        {/* Staff rows */}
        {staffList.map((member) => {
          const config = ROLE_CONFIG[member.role];

          return (
            <div
              key={member._id}
              className={cn(
                "grid grid-cols-[1fr_120px_80px_80px] md:grid-cols-[1fr_140px_100px_100px] items-center px-4 py-3 border-b border-[#1e2a45]/50 last:border-b-0 hover:bg-[#1a2240] transition-colors",
                !member.isActive && "opacity-50",
              )}
            >
              {/* Name + status */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${config.color}15` }}
                >
                  <config.icon
                    className="size-4"
                    style={{ color: config.color }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {member.name}
                  </p>
                  {!member.isActive && (
                    <span className="text-[9px] font-medium text-red-400">
                      {t("staff_page.inactive")}
                    </span>
                  )}
                </div>
              </div>

              {/* Position badge */}
              <div>
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider inline-block"
                  style={{
                    backgroundColor: `${config.color}20`,
                    color: config.color,
                  }}
                >
                  {roleDisplayLabel(member.role, t)}
                </span>
              </div>

              {/* Edit */}
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setEditingStaff(member);
                    setDialogOpen(true);
                  }}
                  className="p-2 rounded-lg text-[#5a6580] hover:text-[#0066FF] hover:bg-[#0066FF]/10 transition-colors cursor-pointer"
                  title={t("btn.edit")}
                >
                  <Pencil className="size-4" />
                </button>
              </div>

              {/* Remove */}
              <div className="flex justify-center">
                <button
                  onClick={() => handleDelete(member._id, member.name)}
                  className="p-2 rounded-lg text-[#5a6580] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title={t("btn.delete")}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Count footer */}
      <p className="text-xs text-[#5a6580]">
        {staffList.length === 1
          ? t("staff_page.footer", { count: staffList.length })
          : t("staff_page.footer_plural", { count: staffList.length })}
      </p>

      <StaffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        licenseKey={licenseKey}
        plan={plan}
        editing={editingStaff}
        onSaved={(staff, mode) => {
          if (mode === "create") {
            setStaffList((prev) => [...prev, staff]);
          } else {
            setStaffList((prev) =>
              prev.map((s) => (s._id === staff._id ? staff : s)),
            );
          }
        }}
      />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────

function Header({
  onAdd,
  t,
}: {
  onAdd: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="size-6" />
          {t("staff_page.title")}
        </h1>
        <p className="text-[#8b93a7] text-sm mt-1">{t("staff_page.subtitle")}</p>
      </div>
      <Button size="sm" onClick={onAdd}>
        <Plus className="size-4 mr-1" />
        {t("staff.add_staff")}
      </Button>
    </div>
  );
}
