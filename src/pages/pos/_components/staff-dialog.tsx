import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { hashString } from "@/lib/local-db.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { motion } from "motion/react";

type StaffDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  editing: Doc<"staff"> | null;
};

const ROLE_OPTIONS = [
  {
    value: "admin" as const,
    label: "Admin",
    desc: "Full access",
    color: "#0066FF",
  },
  {
    value: "waiter" as const,
    label: "Waiter",
    desc: "Floor & orders",
    color: "#44CC00",
  },
  {
    value: "kitchen" as const,
    label: "Kitchen",
    desc: "Kitchen display",
    color: "#FF6B00",
  },
];

export default function StaffDialog({
  open,
  onOpenChange,
  licenseKey,
  editing,
}: StaffDialogProps) {
  const createStaff = useMutation(api.pos.staff.createStaff);
  const updateStaff = useMutation(api.pos.staff.updateStaff);

  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "waiter" | "kitchen">("waiter");
  const [pin, setPin] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setRole(editing.role);
        setPin("");
        setIsActive(editing.isActive);
      } else {
        setName("");
        setRole("waiter");
        setPin("");
        setIsActive(true);
      }
      setError(null);
    }
  }, [open, editing]);

  const handlePinChange = (value: string) => {
    setPin(value.replace(/\D/g, "").slice(0, 4));
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!editing && pin.length !== 4) {
      setError("PIN must be exactly 4 digits");
      return;
    }

    if (editing && pin.length > 0 && pin.length !== 4) {
      setError("PIN must be exactly 4 digits");
      return;
    }

    setLoading(true);

    try {
      if (editing) {
        const pinHash =
          pin.length === 4 ? await hashString(pin) : undefined;
        await updateStaff({
          licenseKey,
          staffId: editing._id,
          name: name.trim(),
          role,
          pinHash,
          isActive,
        });
        toast.success("Staff member updated");
      } else {
        const pinHash = await hashString(pin);
        await createStaff({
          licenseKey,
          name: name.trim(),
          role,
          pinHash,
        });
        toast.success("Staff member created");
      }

      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message: string };
        setError(data.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131A2E] border-[#1e2a45] text-white max-w-md [&>button]:text-[#8b93a7]">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editing ? "Edit Staff Member" : "Add Staff Member"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
              Name
            </Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="John Smith"
              className="bg-[#0A0F1E] border-[#1e2a45] text-white placeholder:text-[#3a4560] h-11"
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
              Role
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all cursor-pointer",
                    role === opt.value
                      ? "text-white"
                      : "border-[#1e2a45] bg-[#0A0F1E] text-[#8b93a7] hover:border-[#2a3a5a]"
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

          {/* PIN */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
              {editing
                ? "New PIN (leave empty to keep current)"
                : "4-Digit PIN"}
            </Label>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="size-10 rounded-lg bg-[#0A0F1E] border border-[#1e2a45] flex items-center justify-center"
                  >
                    <span className="text-lg font-mono text-white">
                      {pin[i] ? "\u2022" : ""}
                    </span>
                  </div>
                ))}
              </div>
              <Input
                type="tel"
                inputMode="numeric"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                maxLength={4}
                placeholder="0000"
                className="bg-[#0A0F1E] border-[#1e2a45] text-white placeholder:text-[#3a4560] h-10 font-mono tracking-[0.5em] text-center flex-1"
              />
            </div>
          </div>

          {/* Active Toggle (edit only) */}
          {editing && (
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
                  Status
                </Label>
                <p className="text-xs text-[#5a6580] mt-0.5">
                  Inactive staff cannot log in
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}

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

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[#8b93a7] hover:text-white hover:bg-[#1e2a45]"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner /> : editing ? "Save Changes" : "Add Staff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
