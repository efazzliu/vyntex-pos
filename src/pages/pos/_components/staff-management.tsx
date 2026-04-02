import { useState } from "react";
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
import { Plus, Pencil, Trash2, Users, Shield, ChefHat, UserCheck } from "lucide-react";
import StaffDialog from "./staff-dialog.tsx";

type StaffManagementProps = {
  licenseKey: string;
};

const ROLE_CONFIG = {
  admin: {
    label: "Admin",
    color: "#0066FF",
    icon: Shield,
  },
  waiter: {
    label: "Waiter",
    color: "#44CC00",
    icon: UserCheck,
  },
  kitchen: {
    label: "Kitchen",
    color: "#FF6B00",
    icon: ChefHat,
  },
} as const;

export default function StaffManagement({ licenseKey }: StaffManagementProps) {
  const staffList = useQuery(api.pos.staff.getStaff, { licenseKey });
  const deleteStaff = useMutation(api.pos.staff.deleteStaff);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Doc<"staff"> | null>(null);

  const isLoading = staffList === undefined;

  const handleDelete = async (staffId: Id<"staff">, staffName: string) => {
    if (!window.confirm(`Remove ${staffName} from staff?`)) return;
    try {
      await deleteStaff({ licenseKey, staffId });
      toast.success(`${staffName} removed`);
    } catch {
      toast.error("Failed to remove staff member");
    }
  };

  // ── Loading ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-64 bg-[#131A2E]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl bg-[#131A2E]" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-[#131A2E]" />
          ))}
        </div>
      </div>
    );
  }

  // ── Stats ──────────────────────────────────────────────
  const activeCount = staffList.filter((s) => s.isActive).length;
  const adminCount = staffList.filter((s) => s.role === "admin").length;
  const waiterCount = staffList.filter((s) => s.role === "waiter").length;
  const kitchenCount = staffList.filter((s) => s.role === "kitchen").length;

  // ── Empty ──────────────────────────────────────────────
  if (staffList.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <Header
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
              <EmptyTitle>No staff members yet</EmptyTitle>
              <EmptyDescription>
                Add your first staff member to enable PIN login
              </EmptyDescription>
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
                Add Staff
              </Button>
            </EmptyContent>
          </Empty>
        </div>

        <StaffDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          licenseKey={licenseKey}
          editing={editingStaff}
        />
      </div>
    );
  }

  // ── Main View ──────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Header
        onAdd={() => {
          setEditingStaff(null);
          setDialogOpen(true);
        }}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Total" value={staffList.length} color="#8b93a7" />
        <MiniStat label="Admins" value={adminCount} color="#0066FF" />
        <MiniStat label="Waiters" value={waiterCount} color="#44CC00" />
        <MiniStat label="Kitchen" value={kitchenCount} color="#FF6B00" />
      </div>

      {/* Staff grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {staffList.map((member) => {
          const config = ROLE_CONFIG[member.role];
          const RoleIcon = config.icon;

          return (
            <div
              key={member._id}
              className={cn(
                "rounded-xl border border-[#1e2a45] bg-[#131A2E] p-4 transition-all group hover:border-[#2a3a5a]",
                !member.isActive && "opacity-50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${config.color}15` }}
                  >
                    <RoleIcon
                      className="size-5"
                      style={{ color: config.color }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {member.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{
                          backgroundColor: `${config.color}20`,
                          color: config.color,
                        }}
                      >
                        {config.label}
                      </span>
                      {!member.isActive && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingStaff(member);
                    setDialogOpen(true);
                  }}
                  className="flex items-center gap-1 text-xs text-[#5a6580] hover:text-white transition-colors cursor-pointer"
                >
                  <Pencil className="size-3" />
                  Edit
                </button>
                <span className="text-white/10">|</span>
                <button
                  onClick={() => handleDelete(member._id, member.name)}
                  className="flex items-center gap-1 text-xs text-[#5a6580] hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="size-3" />
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <StaffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        licenseKey={licenseKey}
        editing={editingStaff}
      />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────

function Header({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="size-6" />
          Staff Management
        </h1>
        <p className="text-[#8b93a7] text-sm mt-1">
          Manage team members and PIN access
        </p>
      </div>
      <Button size="sm" onClick={onAdd}>
        <Plus className="size-4 mr-1" />
        Add Staff
      </Button>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] p-3 flex items-center gap-3">
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-[10px] text-[#5a6580] uppercase tracking-wider">
          {label}
        </p>
      </div>
    </div>
  );
}
