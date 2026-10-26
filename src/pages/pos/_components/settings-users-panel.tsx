import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import AuditLogView from "./audit-log-view.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
import { hashString, getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { BRAND } from "@/lib/brand-colors.ts";
import { toast } from "sonner";
import {
  canAccessView,
  hasSplitBills,
  normalizePlan,
} from "../_lib/plan-features.ts";
import {
  STAFF_PIN_MAX_LEN,
  STAFF_PIN_MIN_LEN,
  isValidStaffPinLength,
  sanitizeStaffPinInput,
} from "../_lib/staff-pin.ts";
import {
  ROLE_PERMISSION_TEMPLATES,
  STAFF_PERMISSION_KEYS,
  isFullAccessStaffRole,
  permissionsForRole,
  type StaffPermissionKey,
  type StaffPermissions,
} from "@/lib/staff-permissions.ts";
import type { StaffRole } from "../_lib/types.ts";
import {
  Ban,
  BarChart3,
  Calculator,
  Check,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Crown,
  Eye,
  EyeOff,
  Gift,
  Layers,
  LayoutGrid,
  Lock,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Percent,
  Plus,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Split,
  User,
  UserCheck,
  UserX,
  Users,
  UtensilsCrossed,
  Wallet,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type SettingsUsersPanelProps = {
  t: Translate;
  licenseKey: string;
  plan: string;
  actorStaffId?: string;
  actorStaffName?: string;
  deviceId?: string;
  isAdmin: boolean;
  canManageSessions: boolean;
};

type StaffRow = {
  _id: string;
  _creationTime?: number;
  name: string;
  role: string;
  pinHash?: string;
  isActive?: boolean;
  permissions?: Record<string, unknown> | null;
};

type AuditRow = {
  staffId?: string;
  staffName?: string;
  action: string;
  createdAt: string;
};

type TabId = "staff" | "roles" | "security" | "activity";

const PAGE_SIZE = 6;
const ROLE_COUNT = 8;

const ROLES: StaffRole[] = [
  "admin",
  "manager",
  "cashier",
  "waiter",
  "inventory",
  "accountant",
  "auditor",
  "kitchen",
];

const ROLE_META: Record<StaffRole, { icon: LucideIcon; color: string; titleKey: string; descKey: string }> = {
  admin: { icon: Shield, color: BRAND.primaryActive, titleKey: "staff.role_admin", descKey: "staff.role_desc_admin" },
  manager: { icon: Crown, color: BRAND.primary, titleKey: "staff.role_manager", descKey: "staff.role_desc_manager" },
  cashier: { icon: User, color: BRAND.accentStrong, titleKey: "staff.role_cashier", descKey: "staff.role_desc_cashier" },
  waiter: { icon: UserCheck, color: BRAND.sky, titleKey: "staff.role_waiter", descKey: "staff.role_desc_waiter" },
  inventory: { icon: PackageSearch, color: BRAND.deepTeal, titleKey: "staff.role_inventory", descKey: "staff.role_desc_inventory" },
  accountant: { icon: Calculator, color: BRAND.primaryHover, titleKey: "staff.role_accountant", descKey: "staff.role_desc_accountant" },
  auditor: { icon: ClipboardCheck, color: BRAND.navy, titleKey: "staff.role_auditor", descKey: "staff.role_desc_auditor" },
  kitchen: { icon: ChefHat, color: BRAND.accentStrong, titleKey: "staff.role_kitchen_long", descKey: "staff.role_desc_kitchen" },
};

const PERM_ICONS: Record<StaffPermissionKey, LucideIcon> = {
  canVoidItems: Ban,
  canGiveDiscount: Percent,
  canTransferTables: ArrowLeftRight,
  canMergeTables: Split,
  canSplitBills: Split,
  canViewReports: BarChart3,
  canManageMenu: UtensilsCrossed,
  canManageStock: PackageSearch,
  canLogStaffConsumption: ShoppingBag,
  canChargeDebt: Wallet,
  canMarkComplimentary: Gift,
  canViewAuditLog: ClipboardList,
};

const AVATAR_COLORS = [
  BRAND.primary,
  BRAND.primaryHover,
  BRAND.primaryActive,
  BRAND.sky,
  BRAND.accentStrong,
  BRAND.deepTeal,
];

function isStaffRole(role: string): role is StaffRole {
  return ROLES.includes(role as StaffRole);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function avatarColor(name: string): string {
  let n = 0;
  for (let i = 0; i < name.length; i += 1) n = (n + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[n] ?? AVATAR_COLORS[0];
}

function permissionsFromRow(row: StaffRow): StaffPermissions {
  const base = permissionsForRole(row.role);
  const raw = row.permissions ?? {};
  const next = { ...base };
  for (const key of STAFF_PERMISSION_KEYS) {
    if (typeof raw[key] === "boolean") next[key] = Boolean(raw[key]);
  }
  if (raw.canMergeTables == null && raw.canTransferTables === true) {
    next.canMergeTables = true;
  }
  return next;
}

function formatClock(iso: string, language: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString(language === "sq" ? "sq-AL" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLoginLabel(iso: string, language: string, t: Translate): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return t("settings.users_login_none");
  const time = formatClock(iso, language);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  if (d >= startToday) return t("settings.users_login_today", { time });
  if (d >= startYesterday) return t("settings.users_login_yesterday", { time });
  const date = d.toLocaleDateString(language === "sq" ? "sq-AL" : "en-GB", {
    month: "short",
    day: "numeric",
  });
  return `${date}, ${time}`;
}

function visiblePermissionKeys(plan: string): StaffPermissionKey[] {
  if (normalizePlan(plan) === "starter") {
    return [
      "canVoidItems",
      "canGiveDiscount",
      "canTransferTables",
      "canMergeTables",
      "canManageMenu",
      "canManageStock",
      "canLogStaffConsumption",
    ];
  }
  const keys: StaffPermissionKey[] = [
    "canVoidItems",
    "canGiveDiscount",
    "canTransferTables",
    "canMergeTables",
  ];
  if (hasSplitBills(plan)) keys.push("canSplitBills");
  keys.push("canViewReports", "canManageMenu", "canManageStock", "canLogStaffConsumption");
  if (canAccessView(plan, "debt-ledger")) keys.push("canChargeDebt");
  keys.push("canMarkComplimentary");
  if (canAccessView(plan, "audit-log")) keys.push("canViewAuditLog");
  return keys;
}

const onPurple = { color: "#ffffff" } as const;

function StaffCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "flex size-4 items-center justify-center rounded-[4px] border",
        checked ? "border-brand bg-brand" : "border-[#d5dbe6] bg-white",
      )}
    >
      {checked ? <Check className="size-3" style={onPurple} /> : null}
    </button>
  );
}

function OptionMenu({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string; icon: LucideIcon }[];
  className?: string;
}) {
  const { theme } = usePosTheme();
  const light = theme === "light";
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value) ?? options[0];
  const CurrentIcon = current?.icon ?? Layers;

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-10 min-w-0 items-center gap-2 rounded-xl border border-brand px-3 text-sm font-semibold text-brand",
          light ? "bg-white" : "bg-[#131A2E]",
          className,
        )}
      >
        <CurrentIcon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{current?.label ?? ""}</span>
        <ChevronUp className={cn("size-4 shrink-0 transition-transform", open ? "" : "rotate-180")} />
      </PopoverTrigger>
      <PopoverContent
        data-pos-theme={theme}
        align="start"
        className={cn(
          "w-[240px] rounded-2xl p-2 shadow-xl",
          light ? "border-brand-subtle bg-white text-[#0f172a]" : "border-[#1e2a45] bg-[#131A2E] text-white",
        )}
      >
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {options.map((option) => {
            const Icon = option.icon;
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => pick(option.value)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium",
                  active
                    ? "bg-brand/12 text-brand"
                    : light
                      ? "text-[#0f172a] hover:bg-[#f4f0ff]"
                      : "hover:bg-[#1e2a45]",
                )}
              >
                <Icon className="size-4 shrink-0 text-brand" />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {active ? <Check className="size-4 shrink-0 text-brand" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function SettingsUsersPanel({
  t,
  licenseKey,
  plan,
  actorStaffId,
  actorStaffName,
}: SettingsUsersPanelProps) {
  const { language } = usePosLocale();
  const { theme: posTheme } = usePosTheme();
  const staffQuery = useQuery("pos.staff.getStaff", { licenseKey });
  const auditQuery = useQuery("pos.dashboard.getAuditLogs", {
    licenseKey,
    staffId: actorStaffId || undefined,
    limit: 200,
  });
  const createStaff = useMutation("pos.staff.createStaff");
  const updateStaff = useMutation("pos.staff.updateStaff");
  const deleteStaff = useMutation("pos.staff.deleteStaff");

  const [tab, setTab] = useState<TabId>("staff");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | StaffRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [editor, setEditor] = useState<StaffRow | "new" | null>(null);

  const staffRows = useMemo((): StaffRow[] => {
    if (!Array.isArray(staffQuery)) return [];
    return staffQuery
      .map((row) => {
        const item = row as Partial<StaffRow>;
        const id = String(item._id ?? "");
        if (!id) return null;
        return {
          _id: id,
          _creationTime: Number(item._creationTime) || undefined,
          name: String(item.name ?? ""),
          role: String(item.role ?? ""),
          pinHash: item.pinHash ? String(item.pinHash) : undefined,
          isActive: item.isActive !== false,
          permissions:
            item.permissions && typeof item.permissions === "object"
              ? (item.permissions as Record<string, unknown>)
              : undefined,
        } satisfies StaffRow;
      })
      .filter((row): row is StaffRow => row !== null);
  }, [staffQuery]);

  const lastLogin = useMemo(() => {
    const byId = new Map<string, string>();
    const byName = new Map<string, string>();
    if (!Array.isArray(auditQuery)) return { byId, byName };
    for (const raw of auditQuery as AuditRow[]) {
      if (raw.action !== "login" || !raw.createdAt) continue;
      if (raw.staffId && !byId.has(raw.staffId)) byId.set(raw.staffId, raw.createdAt);
      const name = raw.staffName?.trim().toLowerCase();
      if (name && !byName.has(name)) byName.set(name, raw.createdAt);
    }
    return { byId, byName };
  }, [auditQuery]);

  const loaded = staffQuery !== undefined;
  const addedThisMonth = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return staffRows.filter((row) => Number(row._creationTime) >= start.getTime()).length;
  }, [staffRows]);
  const activeCount = staffRows.filter((row) => row.isActive !== false).length;
  const inactiveCount = staffRows.filter((row) => row.isActive === false).length;
  const activePct = staffRows.length === 0 ? 0 : Math.round((activeCount / staffRows.length) * 100);
  const inactivePct = staffRows.length === 0 ? 0 : 100 - activePct;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staffRows.filter((row) => {
      if (roleFilter !== "all" && row.role !== roleFilter) return false;
      if (statusFilter === "active" && row.isActive === false) return false;
      if (statusFilter === "inactive" && row.isActive !== false) return false;
      if (!q) return true;
      const roleLabel = isStaffRole(row.role) ? t(ROLE_META[row.role].titleKey) : row.role;
      return `${row.name} ${roleLabel} ${row.role}`.toLowerCase().includes(q);
    });
  }, [staffRows, query, roleFilter, statusFilter, t]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query, roleFilter, statusFilter]);

  const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: "staff", label: t("settings.users_tab_staff"), icon: Users },
    { id: "roles", label: t("settings.users_tab_roles"), icon: Shield },
    { id: "security", label: t("settings.users_tab_security"), icon: Lock },
    { id: "activity", label: t("settings.users_tab_activity"), icon: Clock },
  ];

  const stats: {
    key: string;
    label: string;
    value: string;
    icon: LucideIcon;
    extra?: ReactNode;
  }[] = [
    {
      key: "staff",
      label: t("settings.users_stat_staff"),
      value: loaded ? String(staffRows.length) : "—",
      icon: Users,
      extra: loaded ? (
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600">
          +{addedThisMonth}
        </span>
      ) : null,
    },
    {
      key: "roles",
      label: t("settings.users_stat_roles"),
      value: String(ROLE_COUNT),
      icon: Shield,
    },
    {
      key: "active",
      label: t("settings.users_stat_active"),
      value: loaded ? String(activeCount) : "—",
      icon: UserCheck,
      extra: loaded ? (
        <span className="text-sm font-semibold text-emerald-600">{activePct}%</span>
      ) : null,
    },
    {
      key: "inactive",
      label: t("settings.users_stat_inactive"),
      value: loaded ? String(inactiveCount) : "—",
      icon: UserX,
      extra: loaded ? (
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-500">
          <span className="size-1.5 rounded-full bg-red-500" />
          {inactivePct}%
        </span>
      ) : null,
    },
  ];

  const openEdit = (row: StaffRow) => setEditor(row);

  const removeIds = async (ids: string[]) => {
    const names = staffRows.filter((row) => ids.includes(row._id)).map((row) => row.name);
    const label = names.join(", ");
    if (!window.confirm(t("staff_page.confirm_remove", { name: label || ids.length }))) return;
    try {
      for (const staffId of ids) {
        await deleteStaff({
          licenseKey,
          staffId,
          actorStaffId,
          actorStaffName,
        });
      }
      const cached = (await getDataCache<StaffRow[]>(`staff:${licenseKey}`)) ?? [];
      await saveDataCache(
        `staff:${licenseKey}`,
        cached.filter((row) => !ids.includes(row._id)),
      );
      setSelected((prev) => prev.filter((id) => !ids.includes(id)));
      if (editor && editor !== "new" && ids.includes(editor._id)) setEditor(null);
      toast.success(t("staff_page.removed", { name: label }));
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("staff_page.remove_failed")));
    }
  };

  const setActive = async (row: StaffRow, isActive: boolean) => {
    try {
      await updateStaff({
        licenseKey,
        staffId: row._id,
        name: row.name,
        role: row.role,
        isActive,
        permissions: permissionsFromRow(row),
        actorStaffId,
        actorStaffName,
      });
      toast.success(t("staff.toast_updated"));
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("staff.err_unexpected")));
    }
  };

  const pageIds = pageRows.map((row) => row._id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const editorOpen = editor !== null && tab === "staff";
  const editorSnapshot = useRef(editor);
  if (editor) editorSnapshot.current = editor;
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (editorOpen) {
      setPanelMounted(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setPanelOpen(true);
        });
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }
    setPanelOpen(false);
    const timer = window.setTimeout(() => {
      if (!cancelled) setPanelMounted(false);
    }, 340);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [editorOpen]);

  return (
    <div className="space-y-5">
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand/12">
          <Users className="size-5 text-brand" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold tracking-tight text-white">
            {t("settings.users_heading")}
          </h1>
          <p className="mt-0.5 text-sm text-[#8b93a7]">{t("settings.users_lead")}</p>
        </div>
      </div>

      <div
        className={cn(
          "items-start",
          panelMounted &&
            "xl:grid xl:transition-[grid-template-columns,gap] xl:duration-300 xl:ease-[cubic-bezier(0.22,1,0.36,1)]",
          panelMounted &&
            (panelOpen
              ? "xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-4"
              : "xl:grid-cols-[minmax(0,1fr)_0px] xl:gap-0"),
        )}
      >
      <div className="min-w-0 space-y-5">
      <div
        className={cn(
          "grid grid-cols-1 transition-[gap] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:grid-cols-2 xl:grid-cols-4",
          panelOpen ? "gap-2" : "gap-3",
        )}
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.key}
              className={cn(
                "flex items-center rounded-[18px] border border-[#1e2a45] bg-[#131A2E] shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                panelOpen ? "gap-2 px-2.5 py-2" : "gap-3 px-4 py-3.5",
              )}
            >
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full bg-brand/12 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  panelOpen ? "size-8" : "size-11",
                )}
              >
                <Icon className={cn("text-brand transition-all duration-300", panelOpen ? "size-4" : "size-5")} />
              </span>
              <div className="min-w-0">
                <p className={cn("text-[#8b93a7] transition-all duration-300", panelOpen ? "text-xs" : "text-sm")}>
                  {stat.label}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <p
                    className={cn(
                      "font-bold leading-none tracking-tight text-white transition-all duration-300",
                      panelOpen ? "text-xl" : "text-[28px]",
                    )}
                  >
                    {stat.value}
                  </p>
                  {stat.extra}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          const soon = item.id === "security";
          return (
            <button
              key={item.id}
              type="button"
              disabled={soon}
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                soon
                  ? "cursor-default border border-[#1e2a45] bg-[#131A2E] text-[#8b93a7] opacity-60"
                  : active
                    ? "bg-brand"
                    : "border border-[#1e2a45] bg-[#131A2E] text-[#8b93a7] hover:text-white",
              )}
              style={active && !soon ? onPurple : undefined}
            >
              <Icon className="size-4" />
              {item.label}
              {soon ? (
                <span className="rounded-md bg-[#1e2a45] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#8b93a7] uppercase">
                  {t("nav.coming_soon_badge")}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "staff" ? (
          <section className="rounded-[22px] border border-[#1e2a45] bg-[#131A2E] p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{t("settings.users_staff_title")}</h2>
                <p className="mt-0.5 text-sm text-[#8b93a7]">{t("settings.users_staff_desc")}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selected.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-full border-[#1e2a45]"
                    onClick={() => void removeIds(selected)}
                  >
                    {t("settings.users_remove_selected")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="h-10 rounded-full bg-brand px-4 hover:bg-brand-hover"
                  style={onPurple}
                  onClick={() => setEditor("new")}
                >
                  <Plus className="size-4" />
                  {t("staff.add_staff")}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8b93a7]" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("settings.users_search")}
                  className="h-10 rounded-xl border-[#1e2a45] bg-[#0D1326] pl-9 text-white placeholder:text-[#8b93a7]"
                />
              </div>
              <OptionMenu
                value={roleFilter}
                onChange={(next) => setRoleFilter(next as "all" | StaffRole)}
                className="min-w-[158px]"
                options={[
                  { value: "all", label: t("settings.users_all_roles"), icon: Layers },
                  ...ROLES.map((role) => ({
                    value: role,
                    label: t(ROLE_META[role].titleKey),
                    icon: ROLE_META[role].icon,
                  })),
                ]}
              />
              <OptionMenu
                value={statusFilter}
                onChange={(next) => setStatusFilter(next as "all" | "active" | "inactive")}
                className="min-w-[158px]"
                options={[
                  { value: "all", label: t("settings.users_all_status"), icon: Clock },
                  { value: "active", label: t("settings.users_staff_active"), icon: UserCheck },
                  { value: "inactive", label: t("settings.users_staff_inactive"), icon: UserX },
                ]}
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-medium text-[#8b93a7]">
                    <th className="w-10 px-2 py-2">
                      <StaffCheck
                        checked={allPageSelected}
                        label={t("settings.users_col_name")}
                        onChange={() => {
                          setSelected((prev) =>
                            allPageSelected
                              ? prev.filter((id) => !pageIds.includes(id))
                              : [...new Set([...prev, ...pageIds])],
                          );
                        }}
                      />
                    </th>
                    <th className="px-2 py-2 font-medium">{t("settings.users_col_name")}</th>
                    <th className="px-2 py-2 font-medium">{t("settings.users_col_role")}</th>
                    <th className="px-2 py-2 font-medium">{t("settings.users_col_pin")}</th>
                    <th className="px-2 py-2 font-medium">{t("settings.users_col_last_login")}</th>
                    <th className="px-2 py-2 font-medium">{t("settings.users_col_status")}</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {staffQuery === undefined ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-8 text-sm text-[#8b93a7]">
                        {t("common.loading")}
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-8 text-sm text-[#8b93a7]">
                        {staffRows.length === 0
                          ? t("settings.users_staff_empty")
                          : t("settings.users_no_match")}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const meta = isStaffRole(row.role) ? ROLE_META[row.role] : null;
                      const Icon = meta?.icon ?? User;
                      const loginAt =
                        lastLogin.byId.get(row._id) ??
                        lastLogin.byName.get(row.name.trim().toLowerCase());
                      const editing = editor !== "new" && editor?._id === row._id;
                      return (
                        <tr
                          key={row._id}
                          className={cn(
                            "cursor-pointer border-t border-[#1e2a45]",
                            editing ? "bg-brand/10" : "hover:bg-[#1e2a45]/30",
                          )}
                          onClick={() => openEdit(row)}
                        >
                          <td className="px-2 py-3" onClick={(event) => event.stopPropagation()}>
                            <StaffCheck
                              checked={selected.includes(row._id)}
                              label={row.name}
                              onChange={() => {
                                setSelected((prev) =>
                                  prev.includes(row._id)
                                    ? prev.filter((id) => id !== row._id)
                                    : [...prev, row._id],
                                );
                              }}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                                style={{
                                  backgroundColor: `${avatarColor(row.name)}22`,
                                  color: avatarColor(row.name),
                                }}
                              >
                                {initials(row.name)}
                              </span>
                              <span className="font-semibold text-white">{row.name || "—"}</span>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <span className="inline-flex items-center gap-1.5 text-[#8b93a7]">
                              <Icon className="size-3.5" style={{ color: meta?.color ?? BRAND.primary }} />
                              {meta ? t(meta.titleKey) : row.role || "—"}
                            </span>
                          </td>
                          <td className="px-2 py-3 tracking-widest text-[#8b93a7]">
                            {row.pinHash ? "••••" : "—"}
                          </td>
                          <td className="px-2 py-3 text-[#8b93a7]">
                            {loginAt
                              ? formatLoginLabel(loginAt, language, t)
                              : t("settings.users_login_none")}
                          </td>
                          <td className="px-2 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                                row.isActive === false
                                  ? "bg-[#1e2a45] text-[#8b93a7]"
                                  : "bg-emerald-500/12 text-emerald-600",
                              )}
                            >
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  row.isActive === false ? "bg-[#8b93a7]" : "bg-emerald-500",
                                )}
                              />
                              {row.isActive === false
                                ? t("settings.users_staff_inactive")
                                : t("settings.users_staff_active")}
                            </span>
                          </td>
                          <td className="px-2 py-3" onClick={(event) => event.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="flex size-8 items-center justify-center rounded-full text-[#8b93a7] hover:bg-[#1e2a45]/30"
                                  aria-label={t("settings.users_edit")}
                                >
                                  <MoreHorizontal className="size-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent data-pos-theme={posTheme} align="end">
                                <DropdownMenuItem onClick={() => openEdit(row)}>
                                  {t("settings.users_edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => void setActive(row, row.isActive === false)}
                                >
                                  {row.isActive === false
                                    ? t("settings.users_activate")
                                    : t("settings.users_deactivate")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => void removeIds([row._id])}
                                >
                                  {t("settings.users_remove")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[#8b93a7]">
              <p>
                {filtered.length === 0
                  ? t("settings.users_showing", { from: 0, to: 0, count: 0 })
                  : t("settings.users_showing", {
                      from: safePage * PAGE_SIZE + 1,
                      to: Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE),
                      count: filtered.length,
                    })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage(Math.max(0, safePage - 1))}
                  className="flex size-8 items-center justify-center rounded-full border border-[#1e2a45] disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                {Array.from({ length: pageCount }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setPage(index)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-sm font-semibold",
                      index === safePage ? "bg-brand" : "text-[#8b93a7]",
                    )}
                    style={index === safePage ? onPurple : undefined}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                  className="flex size-8 items-center justify-center rounded-full border border-[#1e2a45] disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </section>
      ) : null}

      {tab === "roles" ? (
        <RolePermissionsPane t={t} staffRows={staffRows} />
      ) : null}

      {tab === "activity" ? (
        <AuditLogView embedded licenseKey={licenseKey} staffId={actorStaffId} />
      ) : null}
      </div>
      {panelMounted && editorSnapshot.current ? (
        <div
          className={cn(
            "min-w-0 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] xl:sticky xl:top-0",
            panelOpen ? "overflow-visible opacity-100" : "pointer-events-none overflow-hidden opacity-0",
          )}
        >
          <StaffEditor
            t={t}
            plan={plan}
            licenseKey={licenseKey}
            actorStaffId={actorStaffId}
            actorStaffName={actorStaffName}
            editing={editorSnapshot.current === "new" ? null : editorSnapshot.current}
            onClose={() => setEditor(null)}
            createStaff={createStaff}
            updateStaff={updateStaff}
          />
        </div>
      ) : null}
      </div>
    </div>
  );
}

const PERM_SHORT: Record<StaffPermissionKey, string> = {
  canVoidItems: "void_label",
  canGiveDiscount: "discount_label",
  canTransferTables: "transfer_label",
  canMergeTables: "merge_label",
  canSplitBills: "split_label",
  canViewReports: "reports_label",
  canManageMenu: "menu_label",
  canManageStock: "stock_label",
  canLogStaffConsumption: "consumption_label",
  canChargeDebt: "debt_label",
  canMarkComplimentary: "complimentary_label",
  canViewAuditLog: "audit_label",
};

function permShort(key: StaffPermissionKey): string {
  return PERM_SHORT[key];
}

type RoleAction = "view" | "create" | "edit" | "delete";

const ROLE_ACTIONS: RoleAction[] = ["view", "create", "edit", "delete"];

const ROLE_ACTION_LABEL: Record<RoleAction, string> = {
  view: "settings.users_col_view",
  create: "settings.users_col_create",
  edit: "settings.users_col_edit",
  delete: "settings.users_col_delete",
};

const ROLE_MODULES: {
  id: string;
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
  cells: Partial<Record<RoleAction, StaffPermissionKey>>;
}[] = [
  {
    id: "orders",
    titleKey: "settings.users_mod_orders",
    descKey: "settings.users_mod_orders_desc",
    icon: ShoppingBag,
    cells: { delete: "canVoidItems" },
  },
  {
    id: "tables",
    titleKey: "settings.users_mod_tables",
    descKey: "settings.users_mod_tables_desc",
    icon: ArrowLeftRight,
    cells: { edit: "canTransferTables", delete: "canMergeTables" },
  },
  {
    id: "payments",
    titleKey: "settings.users_mod_payments",
    descKey: "settings.users_mod_payments_desc",
    icon: Wallet,
    cells: { create: "canSplitBills", edit: "canChargeDebt" },
  },
  {
    id: "discounts",
    titleKey: "settings.users_mod_discounts",
    descKey: "settings.users_mod_discounts_desc",
    icon: Percent,
    cells: { create: "canGiveDiscount", edit: "canGiveDiscount" },
  },
  {
    id: "menu",
    titleKey: "settings.users_mod_menu",
    descKey: "settings.users_mod_menu_desc",
    icon: UtensilsCrossed,
    cells: { view: "canManageMenu", create: "canManageMenu", edit: "canManageMenu", delete: "canManageMenu" },
  },
  {
    id: "stock",
    titleKey: "settings.users_mod_stock",
    descKey: "settings.users_mod_stock_desc",
    icon: PackageSearch,
    cells: { view: "canManageStock", edit: "canManageStock", create: "canLogStaffConsumption" },
  },
  {
    id: "reports",
    titleKey: "settings.users_mod_reports",
    descKey: "settings.users_mod_reports_desc",
    icon: BarChart3,
    cells: { view: "canViewReports" },
  },
  {
    id: "staff",
    titleKey: "settings.users_mod_staff",
    descKey: "settings.users_mod_staff_desc",
    icon: Users,
    cells: {},
  },
  {
    id: "settings",
    titleKey: "settings.users_mod_settings",
    descKey: "settings.users_mod_settings_desc",
    icon: Lock,
    cells: {},
  },
  {
    id: "fiscal",
    titleKey: "settings.users_mod_fiscal",
    descKey: "settings.users_mod_fiscal_desc",
    icon: ClipboardList,
    cells: { view: "canViewAuditLog" },
  },
];

function roleCellOn(
  locked: boolean,
  template: StaffPermissions,
  cell: StaffPermissionKey | undefined,
): boolean {
  if (locked) return true;
  if (!cell) return false;
  return template[cell] === true;
}

function RolePermissionsPane({
  t,
  staffRows,
}: {
  t: Translate;
  staffRows: StaffRow[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StaffRole>("manager");
  const [roleTab, setRoleTab] = useState<"permissions" | "limits" | "settings">("permissions");
  const q = query.trim().toLowerCase();
  const visibleRoles = ROLES.filter((role) => {
    if (!q) return true;
    const meta = ROLE_META[role];
    return `${t(meta.titleKey)} ${t(meta.descKey)} ${role}`.toLowerCase().includes(q);
  });
  const meta = ROLE_META[selected];
  const template = ROLE_PERMISSION_TEMPLATES[selected];
  const locked = isFullAccessStaffRole(selected);
  const allOn = ROLE_MODULES.every((module) =>
    ROLE_ACTIONS.every((action) => roleCellOn(locked, template, module.cells[action])),
  );

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <section className="rounded-[22px] border border-[#1e2a45] bg-[#131A2E] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">
            {t("settings.users_roles_heading", { count: ROLES.length })}
          </h2>
          <Button
            type="button"
            className="h-8 shrink-0 rounded-full bg-brand px-3 text-xs hover:bg-brand-hover"
            style={onPurple}
          >
            <Plus className="size-3.5" />
            {t("settings.users_add_role")}
          </Button>
        </div>
        <p className="mt-1 text-sm text-[#8b93a7]">{t("settings.users_roles_note")}</p>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8b93a7]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("settings.users_roles_search")}
            className="h-10 rounded-xl border-[#1e2a45] bg-[#0D1326] pl-9 text-white placeholder:text-[#8b93a7]"
          />
        </div>
        <div className="mt-3 space-y-2">
          {visibleRoles.length === 0 ? (
            <p className="px-1 py-6 text-sm text-[#8b93a7]">{t("settings.users_no_match")}</p>
          ) : (
            visibleRoles.map((role) => {
              const item = ROLE_META[role];
              const Icon = item.icon;
              const count = staffRows.filter((row) => row.role === role).length;
              const active = role === selected;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setSelected(role);
                    setRoleTab("permissions");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                    active
                      ? "border-brand bg-brand/10"
                      : "border-[#1e2a45] bg-[#0D1326] hover:border-brand/35",
                  )}
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${item.color}22` }}
                  >
                    <Icon className="size-3.5" style={{ color: item.color }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-white">
                      {t(item.titleKey)}
                    </span>
                    <span className="block truncate text-[11px] text-[#8b93a7]">{t(item.descKey)}</span>
                  </span>
                  <span className="text-xs font-semibold text-[#8b93a7]">{count}</span>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#131A2E] p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/12">
            <Users className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">
              {t("settings.users_role_editor", { role: t(meta.titleKey) })}
            </h2>
            <p className="mt-0.5 text-sm text-[#8b93a7]">{t("settings.users_role_editor_lead")}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["permissions", "settings.users_tab_permissions", LayoutGrid],
              ["limits", "settings.users_tab_limits", Lock],
              ["settings", "settings.users_tab_role_settings", Settings],
            ] as const
          ).map(([id, labelKey, Icon]) => {
            const active = roleTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setRoleTab(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium",
                  active ? "bg-brand" : "bg-[#0D1326] text-[#8b93a7]",
                )}
                style={active ? onPurple : undefined}
              >
                <Icon className="size-4" style={active ? onPurple : undefined} />
                {t(labelKey)}
              </button>
            );
          })}
        </div>

        {roleTab === "limits" ? (
          <p className="mt-5 text-sm text-[#8b93a7]">{t("settings.users_limits_empty")}</p>
        ) : null}
        {roleTab === "settings" ? (
          <p className="mt-5 text-sm text-[#8b93a7]">{t("settings.users_role_settings_empty")}</p>
        ) : null}

        {roleTab === "permissions" ? (
        <>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">{t("settings.users_mod_permissions")}</h3>
            <p className="mt-0.5 text-sm text-[#8b93a7]">{t("settings.users_mod_permissions_lead")}</p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm text-[#8b93a7]">
            <span
              className={cn(
                "relative inline-flex h-5 w-9 rounded-full",
                allOn ? "bg-brand" : "bg-[#e2e8f0]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-white shadow-sm",
                  allOn ? "right-0.5" : "left-0.5",
                )}
              />
            </span>
            {t("settings.users_select_all")}
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,64px)] items-center px-3 pb-1.5 text-center text-[11px] font-medium text-[#8b93a7]">
              <span />
              {ROLE_ACTIONS.map((action) => (
                <span key={action}>{t(ROLE_ACTION_LABEL[action])}</span>
              ))}
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#1e2a45]">
              {ROLE_MODULES.map((module, index) => {
                const Icon = module.icon;
                return (
                  <div
                    key={module.id}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_repeat(4,64px)] items-center bg-[#0D1326] px-3 py-2",
                      index > 0 && "border-t border-[#1e2a45]",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                        <Icon className="size-3.5 text-brand" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-white">
                          {t(module.titleKey)}
                        </span>
                        <span className="block truncate text-[11px] text-[#8b93a7]">{t(module.descKey)}</span>
                      </span>
                    </div>
                    {ROLE_ACTIONS.map((action) => {
                      const on = roleCellOn(locked, template, module.cells[action]);
                      return (
                        <span key={action} className="flex justify-center">
                          <span
                            className={cn(
                              "flex size-5 items-center justify-center rounded-md border",
                              on ? "border-brand bg-brand" : "border-[#d5dbe6] bg-white",
                            )}
                            style={on ? onPurple : undefined}
                          >
                            {on ? <Check className="size-3" style={onPurple} /> : null}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </>
        ) : null}

        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            className="h-10 rounded-xl bg-brand px-4 hover:bg-brand-hover"
            style={onPurple}
          >
            <Check className="size-4" />
            {t("settings.users_save")}
          </Button>
        </div>
      </section>
    </div>
  );
}

function StaffEditor({
  t,
  plan,
  licenseKey,
  actorStaffId,
  actorStaffName,
  editing,
  onClose,
  createStaff,
  updateStaff,
}: {
  t: Translate;
  plan: string;
  licenseKey: string;
  actorStaffId?: string;
  actorStaffName?: string;
  editing: StaffRow | null;
  onClose: () => void;
  createStaff: (args: Record<string, unknown>) => Promise<unknown>;
  updateStaff: (args: Record<string, unknown>) => Promise<unknown>;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [role, setRole] = useState<StaffRole>(
    editing && isStaffRole(editing.role) ? editing.role : "waiter",
  );
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isActive, setIsActive] = useState(editing ? editing.isActive !== false : true);
  const [permissions, setPermissions] = useState<StaffPermissions>(
    editing ? permissionsFromRow(editing) : permissionsForRole("waiter"),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(editing?.name ?? "");
    setRole(editing && isStaffRole(editing.role) ? editing.role : "waiter");
    setPin("");
    setShowPin(false);
    setIsActive(editing ? editing.isActive !== false : true);
    setPermissions(editing ? permissionsFromRow(editing) : permissionsForRole("waiter"));
    setError(null);
  }, [editing]);

  const locked = isFullAccessStaffRole(role);
  const keys = visiblePermissionKeys(plan);

  const save = async () => {
    if (!name.trim()) {
      setError(t("staff.err_name_required"));
      return;
    }
    if (!editing && !isValidStaffPinLength(pin.length)) {
      setError(t("staff.err_pin_digits", { min: STAFF_PIN_MIN_LEN, max: STAFF_PIN_MAX_LEN }));
      return;
    }
    if (editing && pin.length > 0 && !isValidStaffPinLength(pin.length)) {
      setError(t("staff.err_pin_digits", { min: STAFF_PIN_MIN_LEN, max: STAFF_PIN_MAX_LEN }));
      return;
    }
    const nextPerms = locked ? permissionsForRole(role) : permissions;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const pinHash =
          pin.length > 0 && isValidStaffPinLength(pin.length) ? await hashString(pin) : undefined;
        await updateStaff({
          licenseKey,
          staffId: editing._id,
          name: name.trim(),
          role,
          pinHash,
          isActive,
          permissions: nextPerms,
          actorStaffId,
          actorStaffName,
        });
        const cached = (await getDataCache<StaffRow[]>(`staff:${licenseKey}`)) ?? [];
        await saveDataCache(
          `staff:${licenseKey}`,
          cached.map((row) =>
            row._id === editing._id
              ? {
                  ...row,
                  name: name.trim(),
                  role,
                  isActive,
                  permissions: nextPerms,
                  pinHash: pinHash ?? row.pinHash,
                }
              : row,
          ),
        );
        toast.success(t("staff.toast_updated"));
      } else {
        const pinHash = await hashString(pin);
        const createdId = await createStaff({
          licenseKey,
          name: name.trim(),
          role,
          pinHash,
          permissions: nextPerms,
          actorStaffId,
          actorStaffName,
        });
        if (typeof createdId === "string" && createdId) {
          const cached = (await getDataCache<StaffRow[]>(`staff:${licenseKey}`)) ?? [];
          await saveDataCache(`staff:${licenseKey}`, [
            ...cached,
            {
              _id: createdId,
              _creationTime: Date.now(),
              name: name.trim(),
              role,
              pinHash,
              isActive: true,
              permissions: nextPerms,
            },
          ]);
        }
        toast.success(t("staff.toast_created"));
      }
      onClose();
    } catch (err) {
      setError(errorMessageFromUnknown(err, t("staff.err_unexpected")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="min-w-0 max-w-full rounded-[22px] border border-[#1e2a45] bg-[#131A2E] p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Pencil className="size-4 text-brand" />
          <h2 className="text-lg font-semibold text-white">
            {editing ? t("settings.users_edit_title") : t("settings.users_add_title")}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-[#8b93a7] hover:text-white"
          aria-label={t("btn.cancel")}
        >
          ×
        </button>
      </div>

      <label className="mt-4 block text-sm font-medium text-white">
        {t("settings.users_full_name")}
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1.5 h-11 rounded-xl border-[#1e2a45] bg-[#0D1326] text-white"
        />
      </label>

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
        <label className="block min-w-0 text-sm font-medium text-white">
          {t("settings.users_col_role")}
          <span className="mt-1.5 block min-w-0">
            <OptionMenu
              value={role}
              onChange={(next) => {
                const picked = next as StaffRole;
                setRole(picked);
                setPermissions(permissionsForRole(picked));
              }}
              className="h-11 w-full"
              options={ROLES.map((item) => ({
                value: item,
                label: t(ROLE_META[item].titleKey),
                icon: ROLE_META[item].icon,
              }))}
            />
          </span>
        </label>
        <label className="block min-w-0 text-sm font-medium text-white">
          {t("staff.pin")}
          <span className="relative mt-1.5 block min-w-0">
            <Input
              value={pin}
              type={showPin ? "text" : "password"}
              autoComplete="new-password"
              placeholder={editing ? "••••" : t("staff.pin_placeholder")}
              onChange={(event) => setPin(sanitizeStaffPinInput(event.target.value))}
              className="h-11 w-full rounded-xl border-[#1e2a45] bg-[#0D1326] pr-10 text-white"
            />
            <button
              type="button"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-[#8b93a7]"
              onClick={() => setShowPin((value) => !value)}
              aria-label={showPin ? t("staff.pin_toggle_hide") : t("staff.pin_toggle_show")}
            >
              {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>
      </div>
      {editing ? (
        <p className="mt-1.5 break-words text-[11px] leading-snug text-[#8b93a7]">
          {t("staff.pin_not_recoverable_hint")}
        </p>
      ) : null}

      <label className="mt-3 block text-sm font-medium text-white">
        {t("common.status")}
        <span className="mt-1.5 block">
          <OptionMenu
            value={isActive ? "active" : "inactive"}
            onChange={(next) => setIsActive(next === "active")}
            className="h-11 w-full"
            options={[
              { value: "active", label: t("settings.users_staff_active"), icon: UserCheck },
              { value: "inactive", label: t("settings.users_staff_inactive"), icon: UserX },
            ]}
          />
        </span>
      </label>

      <div className="mt-5 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{t("settings.users_role_permissions")}</h3>
      </div>
      {locked ? (
        <p className="mt-1 text-xs text-[#8b93a7]">{t("settings.users_perm_locked")}</p>
      ) : null}
      <div className="mt-2 max-h-[340px] space-y-1 overflow-y-auto">
        {keys.map((key) => {
          const Icon = PERM_ICONS[key];
          const on = locked || permissions[key] === true;
          return (
            <button
              key={key}
              type="button"
              disabled={locked}
              onClick={() => setPermissions((prev) => ({ ...prev, [key]: !prev[key] }))}
              className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left disabled:cursor-default"
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-md border",
                  on ? "border-brand bg-brand" : "border-[#1e2a45] bg-[#0D1326]",
                )}
                style={on ? onPurple : undefined}
              >
                {on ? <Check className="size-3" /> : null}
              </span>
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10"
              >
                <Icon className="size-4 text-brand" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white">
                  {t(`staff.perm_${permShort(key)}`)}
                </span>
                <span className="block text-xs text-[#8b93a7]">
                  {t(`staff.perm_${permShort(key).replace("_label", "_desc")}`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" className="h-10 rounded-full" onClick={onClose}>
          {t("btn.cancel")}
        </Button>
        <Button
          type="button"
          disabled={saving}
          className="h-10 rounded-full bg-brand px-4 hover:bg-brand-hover"
          style={onPurple}
          onClick={() => void save()}
        >
          <Check className="size-4" />
          {t("settings.users_save")}
        </Button>
      </div>
    </aside>
  );
}
