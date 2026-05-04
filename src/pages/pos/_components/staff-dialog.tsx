import { useState, useEffect, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { hashString } from "@/lib/local-db.ts";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { canAccessView, hasSplitBills, normalizePlan } from "../_lib/plan-features.ts";
import {
  STAFF_PIN_MAX_LEN,
  STAFF_PIN_MIN_LEN,
  isValidStaffPinLength,
  sanitizeStaffPinInput,
} from "../_lib/staff-pin.ts";

type StaffDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  plan: string;
  editing: Doc<"staff"> | null;
  onSaved?: (staff: Doc<"staff">, mode: "create" | "update") => void;
};

type Permissions = {
  canVoidItems: boolean;
  canGiveDiscount: boolean;
  canTransferTables: boolean;
  canMergeTables: boolean;
  canSplitBills?: boolean;
  canViewReports: boolean;
  canManageMenu: boolean;
  canManageStock: boolean;
  canLogStaffConsumption?: boolean;
  canChargeDebt?: boolean;
  canMarkComplimentary?: boolean;
  canViewAuditLog?: boolean;
};

const DEFAULT_PERMISSIONS: Permissions = {
  canVoidItems: false,
  canGiveDiscount: false,
  canTransferTables: false,
  canMergeTables: false,
  canSplitBills: false,
  canViewReports: false,
  canManageMenu: false,
  canManageStock: false,
  canLogStaffConsumption: false,
  canChargeDebt: false,
  canMarkComplimentary: false,
  canViewAuditLog: false,
};

const ADMIN_PERMISSIONS: Permissions = {
  canVoidItems: true,
  canGiveDiscount: true,
  canTransferTables: true,
  canMergeTables: true,
  canSplitBills: true,
  canViewReports: true,
  canManageMenu: true,
  canManageStock: true,
  canLogStaffConsumption: true,
  canChargeDebt: true,
  canMarkComplimentary: true,
  canViewAuditLog: true,
};

export default function StaffDialog({
  open,
  onOpenChange,
  licenseKey,
  plan,
  editing,
  onSaved,
}: StaffDialogProps) {
  const { t } = usePosLocale();
  const { theme: posTheme } = usePosTheme();
  const createStaff = useMutation('pos.staff.createStaff');
  const updateStaff = useMutation('pos.staff.updateStaff');

  const ROLE_OPTIONS = useMemo(
    () =>
      [
        {
          value: "admin" as const,
          label: t("staff.role_admin"),
          desc: t("staff.role_desc_admin"),
          color: "#0066FF",
        },
        {
          value: "manager" as const,
          label: t("staff.role_manager"),
          desc: t("staff.role_desc_manager"),
          color: "#8B5CF6",
        },
        {
          value: "waiter" as const,
          label: t("staff.role_waiter"),
          desc: t("staff.role_desc_waiter"),
          color: "#44CC00",
        },
        {
          value: "inventory" as const,
          label: t("staff.role_inventory"),
          desc: t("staff.role_desc_inventory"),
          color: "#F59E0B",
        },
        {
          value: "accountant" as const,
          label: t("staff.role_accountant"),
          desc: t("staff.role_desc_accountant"),
          color: "#06B6D4",
        },
        {
          value: "auditor" as const,
          label: t("staff.role_auditor"),
          desc: t("staff.role_desc_auditor"),
          color: "#EC4899",
        },
        {
          value: "kitchen" as const,
          label: t("staff.role_kitchen_long"),
          desc: t("staff.role_desc_kitchen"),
          color: "#FF6B00",
        },
      ] as const,
    [t],
  );

  const PERMISSION_LABELS = useMemo(
    (): { key: keyof Permissions; label: string; description: string }[] => {
      if (normalizePlan(plan) === "starter") {
        return [
          {
            key: "canVoidItems",
            label: t("staff.perm_void_label"),
            description: t("staff.perm_void_desc"),
          },
          {
            key: "canGiveDiscount",
            label: t("staff.perm_discount_label"),
            description: t("staff.perm_discount_desc"),
          },
          {
            key: "canTransferTables",
            label: t("staff.perm_transfer_label"),
            description: t("staff.perm_transfer_desc"),
          },
          {
            key: "canMergeTables",
            label: t("staff.perm_merge_label"),
            description: t("staff.perm_merge_desc"),
          },
          {
            key: "canManageMenu",
            label: t("staff.perm_menu_label"),
            description: t("staff.perm_menu_desc"),
          },
          {
            key: "canManageStock",
            label: t("staff.perm_stock_label"),
            description: t("staff.perm_stock_desc"),
          },
          {
            key: "canLogStaffConsumption",
            label: t("staff.perm_consumption_label"),
            description: t("staff.perm_consumption_desc"),
          },
        ];
      }

      const rows: { key: keyof Permissions; label: string; description: string }[] = [
        {
          key: "canVoidItems",
          label: t("staff.perm_void_label"),
          description: t("staff.perm_void_desc"),
        },
        {
          key: "canGiveDiscount",
          label: t("staff.perm_discount_label"),
          description: t("staff.perm_discount_desc"),
        },
        {
          key: "canTransferTables",
          label: t("staff.perm_transfer_label"),
          description: t("staff.perm_transfer_desc"),
        },
        {
          key: "canMergeTables",
          label: t("staff.perm_merge_label"),
          description: t("staff.perm_merge_desc"),
        },
      ];

      if (hasSplitBills(plan)) {
        rows.push({
          key: "canSplitBills",
          label: t("staff.perm_split_label"),
          description: t("staff.perm_split_desc"),
        });
      }

      rows.push(
        {
          key: "canViewReports",
          label: t("staff.perm_reports_label"),
          description: t("staff.perm_reports_desc"),
        },
        {
          key: "canManageMenu",
          label: t("staff.perm_menu_label"),
          description: t("staff.perm_menu_desc"),
        },
        {
          key: "canManageStock",
          label: t("staff.perm_stock_label"),
          description: t("staff.perm_stock_desc"),
        },
        {
          key: "canLogStaffConsumption",
          label: t("staff.perm_consumption_label"),
          description: t("staff.perm_consumption_desc"),
        },
      );

      if (canAccessView(plan, "debt-ledger")) {
        rows.push({
          key: "canChargeDebt",
          label: t("staff.perm_debt_label"),
          description: t("staff.perm_debt_desc"),
        });
      }

      rows.push({
        key: "canMarkComplimentary",
        label: t("staff.perm_complimentary_label"),
        description: t("staff.perm_complimentary_desc"),
      });

      if (canAccessView(plan, "audit-log")) {
        rows.push({
          key: "canViewAuditLog",
          label: t("staff.perm_audit_label"),
          description: t("staff.perm_audit_desc"),
        });
      }
      return rows;
    },
    [t, plan],
  );

  const [name, setName] = useState("");
  const [role, setRole] = useState<
    "admin" | "manager" | "waiter" | "inventory" | "accountant" | "auditor" | "kitchen"
  >("waiter");
  const [pin, setPin] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (open) {
      setShowPin(false);
      if (editing) {
        setName(editing.name);
        setRole(editing.role);
        setPin("");
        setIsActive(editing.isActive);
        setPermissions({
          ...DEFAULT_PERMISSIONS,
          ...(editing.permissions ?? {}),
          canMergeTables:
            editing.permissions?.canMergeTables ??
            editing.permissions?.canTransferTables ??
            false,
          canViewAuditLog:
            editing.permissions?.canViewAuditLog ??
            editing.role === "auditor",
        });
      } else {
        setName("");
        setRole("waiter");
        setPin("");
        setIsActive(true);
        setPermissions(DEFAULT_PERMISSIONS);
      }
      setError(null);
    }
  }, [open, editing]);

  // When role changes to admin or manager, auto-enable all permissions
  useEffect(() => {
    if (role === "admin" || role === "manager") {
      setPermissions(ADMIN_PERMISSIONS);
    }
  }, [role]);

  const handlePinChange = (value: string) => {
    setPin(sanitizeStaffPinInput(value));
    setError(null);
  };

  const togglePermission = (key: keyof Permissions) => {
    // Admins & managers always have all permissions
    if (role === "admin" || role === "manager") return;
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim()) {
      setError(t("staff.err_name_required"));
      return;
    }

    if (!editing && !isValidStaffPinLength(pin.length)) {
      setError(
        t("staff.err_pin_digits", {
          min: STAFF_PIN_MIN_LEN,
          max: STAFF_PIN_MAX_LEN,
        }),
      );
      return;
    }

    if (editing && pin.length > 0 && !isValidStaffPinLength(pin.length)) {
      setError(
        t("staff.err_pin_digits", {
          min: STAFF_PIN_MIN_LEN,
          max: STAFF_PIN_MAX_LEN,
        }),
      );
      return;
    }

    setLoading(true);

    try {
      if (editing) {
        const pinHash =
          pin.length > 0 && isValidStaffPinLength(pin.length)
            ? await hashString(pin)
            : undefined;
        await updateStaff({
          licenseKey,
          staffId: editing._id,
          name: name.trim(),
          role,
          pinHash,
          isActive,
          permissions,
        });
        const updatedStaff = {
          ...editing,
          name: name.trim(),
          role,
          isActive,
          permissions,
          pinHash: pinHash ?? editing.pinHash,
        } as Doc<"staff">;
        const cached = (await getDataCache<Doc<"staff">[]>(`staff:${licenseKey}`)) ?? [];
        await saveDataCache(
          `staff:${licenseKey}`,
          cached.map((s) => (s._id === editing._id ? updatedStaff : s)),
        );
        onSaved?.(updatedStaff, "update");
        toast.success(t("staff.toast_updated"));
      } else {
        const pinHash = await hashString(pin);
        const createdId = await createStaff({
          licenseKey,
          name: name.trim(),
          role,
          pinHash,
          permissions,
        });
        const createdStaff = {
          _id: createdId,
          _creationTime: Date.now(),
          licenseKey,
          name: name.trim(),
          role,
          pinHash,
          isActive: true,
          permissions,
        } as Doc<"staff">;
        const cached = (await getDataCache<Doc<"staff">[]>(`staff:${licenseKey}`)) ?? [];
        await saveDataCache(`staff:${licenseKey}`, [...cached, createdStaff]);
        onSaved?.(createdStaff, "create");
        toast.success(t("staff.toast_created"));
      }

      onOpenChange(false);
    } catch (err) {
      const convexMessage =
        err instanceof ConvexError &&
        err.data &&
        typeof err.data === "object" &&
        "message" in err.data &&
        typeof (err.data as { message?: unknown }).message === "string"
          ? String((err.data as { message: string }).message)
          : null;
      const message = convexMessage ?? errorMessageFromUnknown(err, t("staff.err_unexpected"));
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-pos-theme={posTheme}
        side="right"
        className="bg-[#131A2E] border-[#1e2a45] text-white w-full sm:max-w-md p-0 gap-0 flex flex-col [&>button]:text-[#8b93a7]"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-[#1e2a45] shrink-0">
          <SheetTitle className="text-white text-lg">
            {editing ? t("staff.dialog_edit_title") : t("staff.dialog_add_title")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
              {t("common.name")}
            </Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder={t("staff.placeholder_name")}
              className="bg-[#0A0F1E] border-[#1e2a45] text-white placeholder:text-[#3a4560] h-11"
            />
          </div>

          {/* Role / Position */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
              {t("staff.position_label")}
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all cursor-pointer",
                    role === opt.value
                      ? "text-white"
                      : "border-[#1e2a45] bg-[#0A0F1E] text-[#8b93a7] hover:border-[#2a3a5a]",
                  )}
                  style={
                    role === opt.value
                      ? {
                          borderColor: opt.color,
                          backgroundColor: `${opt.color}15`,
                        }
                      : undefined
                  }
                >
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* PIN — single field, alphanumeric, min 4 / max STAFF_PIN_MAX_LEN */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
              {editing ? t("staff.pin_new_optional") : t("staff.pin_4digit")}
            </Label>
            {editing && (
              <p className="text-[11px] text-[#5a6580] leading-snug">
                {t("staff.pin_not_recoverable_hint")}
              </p>
            )}
            <div className="relative">
              <Input
                type={showPin ? "text" : "password"}
                autoComplete="new-password"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                maxLength={STAFF_PIN_MAX_LEN}
                placeholder={t("staff.pin_placeholder")}
                className="bg-[#0A0F1E] border-[#1e2a45] text-white placeholder:text-[#3a4560] h-11 font-mono text-base pr-11"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPin((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-md text-[#8b93a7] hover:text-white hover:bg-[#1e2a45]/80 transition-colors"
                aria-label={showPin ? t("staff.pin_toggle_hide") : t("staff.pin_toggle_show")}
              >
                {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Active Toggle (edit only) */}
          {editing && (
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
                  {t("staff.status_label")}
                </Label>
                <p className="text-xs text-[#5a6580] mt-0.5">
                  {t("staff.inactive_login_hint")}
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}

          {/* Access Permissions */}
          <div className="space-y-3">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
              {t("staff.access_permissions")}
            </Label>
            {(role === "admin" || role === "manager") && (
              <p className="text-[10px] text-[#0066FF]">
                {t("staff.admin_all_permissions_hint")}
              </p>
            )}
            <div className="space-y-1 rounded-xl border border-[#1e2a45] bg-[#0A0F1E] overflow-hidden">
              {PERMISSION_LABELS.map((perm) => (
                <div
                  key={perm.key}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 border-b border-[#1e2a45]/50 last:border-b-0"
                >
                  <div className="min-w-0 flex flex-col gap-1">
                    <p className="text-sm text-white font-medium leading-snug">{perm.label}</p>
                    <p className="text-[11px] text-[#5a6580] leading-snug">{perm.description}</p>
                  </div>
                  <Switch
                    checked={Boolean(permissions[perm.key])}
                    onCheckedChange={() => togglePermission(perm.key)}
                    disabled={role === "admin" || role === "manager"}
                    className="shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg p-3"
            >
              <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </motion.div>
          )}
        </div>

        <SheetFooter className="px-6 py-4 border-t border-[#1e2a45] shrink-0 flex gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[#8b93a7] hover:text-white hover:bg-[#1e2a45]"
          >
            {t("btn.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? <Spinner /> : editing ? t("staff.btn_save_changes") : t("staff.add_staff")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
