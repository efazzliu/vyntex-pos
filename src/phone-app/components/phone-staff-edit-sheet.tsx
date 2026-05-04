import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { hashString } from "@/lib/local-db.ts";
import { clearRestaurantCache } from "@/lib/supabase-pos/restaurant.ts";
import { createStaff, updateStaff } from "@/lib/supabase-pos/staff-ops.ts";
import type { StaffRole } from "@/pages/pos/_lib/types.ts";
import {
  STAFF_PIN_MAX_LEN,
  STAFF_PIN_MIN_LEN,
  isValidStaffPinLength,
  sanitizeStaffPinInput,
} from "@/pages/pos/_lib/staff-pin.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { toast } from "sonner";

type StaffDoc = {
  _id: string;
  name: string;
  role: string;
  isActive: boolean;
};

const ROLES: StaffRole[] = [
  "admin",
  "manager",
  "waiter",
  "inventory",
  "accountant",
  "auditor",
  "kitchen",
];

type PhoneStaffEditSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  editing: StaffDoc | null;
  isPhoneManager?: boolean;
  onSaved: () => void;
};

export function PhoneStaffEditSheet({
  open,
  onOpenChange,
  licenseKey,
  editing,
  isPhoneManager = false,
  onSaved,
}: PhoneStaffEditSheetProps) {
  const { t } = useTranslation("site");
  const isEdit = Boolean(editing);
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("waiter");
  const [pin, setPin] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setRole((editing.role as StaffRole) || "waiter");
      setPin("");
      setIsActive(editing.isActive);
    } else {
      setName("");
      setRole("waiter");
      setPin("");
      setIsActive(true);
    }
  }, [open, editing]);

  const roleLabel = (r: StaffRole) => {
    const key = `phone.staff.role_${r}`;
    const v = t(key);
    return v === key ? r : v;
  };
  const editingAdminRole = isEdit && editing?.role === "admin";
  const roleLockedForManager = isPhoneManager && editingAdminRole;
  const roleOptions = isPhoneManager ? ROLES.filter((r) => r !== "admin") : ROLES;

  const handleSave = async () => {
    const n = name.trim();
    if (!n) {
      toast.error(t("phone.staff.errName"));
      return;
    }
    const pinClean = sanitizeStaffPinInput(pin);
    if (!isEdit) {
      if (!isValidStaffPinLength(pinClean.length)) {
        toast.error(
          t("phone.staff.errPin", {
            min: STAFF_PIN_MIN_LEN,
            max: STAFF_PIN_MAX_LEN,
          }),
        );
        return;
      }
    } else if (pinClean.length > 0 && !isValidStaffPinLength(pinClean.length)) {
      toast.error(
        t("phone.staff.errPin", {
          min: STAFF_PIN_MIN_LEN,
          max: STAFF_PIN_MAX_LEN,
        }),
      );
      return;
    }
    if (isPhoneManager && role === "admin") {
      toast.error(t("phone.staff.managerNoAdminRole"));
      return;
    }

    setSaving(true);
    try {
      if (isEdit && editing) {
        const pinHash =
          pinClean.length > 0 ? await hashString(pinClean) : undefined;
        const roleToSave = roleLockedForManager ? (editing.role as StaffRole) : role;
        await updateStaff({
          licenseKey,
          staffId: editing._id,
          name: n,
          role: roleToSave,
          isActive,
          pinHash,
        });
        clearRestaurantCache(licenseKey);
        toast.success(t("phone.staff.saved"));
      } else {
        const pinHash = await hashString(pinClean);
        const roleToCreate = isPhoneManager && role === "admin" ? "waiter" : role;
        await createStaff({
          licenseKey,
          name: n,
          role: roleToCreate,
          pinHash,
        });
        clearRestaurantCache(licenseKey);
        toast.success(t("phone.staff.created"));
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("phone.staff.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl px-4">
        <SheetHeader>
          <SheetTitle>{isEdit ? t("phone.staff.editTitle") : t("phone.staff.addTitle")}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 pb-2">
          <div className="space-y-2">
            <Label htmlFor="staff-name">{t("phone.staff.fieldName")}</Label>
            <Input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl"
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("phone.staff.fieldRole")}</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as StaffRole)}
              disabled={roleLockedForManager}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roleLockedForManager ? (
              <p className="text-xs text-slate-500">{t("phone.staff.managerNoAdminRole")}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-pin">
              {isEdit ? t("phone.staff.fieldPinEdit") : t("phone.staff.fieldPinNew")}
            </Label>
            <Input
              id="staff-pin"
              type="password"
              inputMode="text"
              autoComplete="new-password"
              maxLength={STAFF_PIN_MAX_LEN}
              value={pin}
              onChange={(e) => setPin(sanitizeStaffPinInput(e.target.value))}
              placeholder={isEdit ? t("phone.staff.pinPlaceholderEdit") : undefined}
              className="rounded-xl"
            />
            <p className="text-xs text-slate-500">{t("phone.staff.pinHint")}</p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
            <Label htmlFor="staff-active" className="cursor-pointer">
              {t("phone.staff.fieldActive")}
            </Label>
            <Switch id="staff-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <SheetFooter className="mt-4 flex-col gap-2 sm:flex-col">
          <Button
            className="w-full rounded-xl bg-[#6d28d9] hover:bg-[#5b21b6]"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? t("phone.staff.saving") : t("phone.staff.save")}
          </Button>
          <Button variant="outline" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>
            {t("phone.staff.cancel")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
