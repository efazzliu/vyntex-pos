import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  KeyRound,
  Search,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Monitor,
  RotateCcw,
  CalendarPlus,
  Trash2,
  MoreHorizontal,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const VYN_TYPE_LABELS: Record<string, string> = {
  restaurant: "Restaurant POS",
  cafe: "Coffee POS",
  bar: "Bar POS",
  hotel: "Hotel POS",
  fitness: "Fitness POS",
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    active: {
      icon: ShieldCheck,
      label: "Active",
      classes:
        "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    },
    expired: {
      icon: ShieldAlert,
      label: "Expired",
      classes:
        "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    },
    suspended: {
      icon: ShieldOff,
      label: "Suspended",
      classes:
        "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    },
  }[status] ?? {
    icon: ShieldAlert,
    label: status,
    classes: "bg-muted text-muted-foreground",
  };

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
        config.classes
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

export default function AdminLicenses() {
  const licenses = useQuery(api.admin.listLicenses);
  const updateStatus = useMutation(api.admin.updateLicenseStatus);
  const extendLicense = useMutation(api.admin.extendLicense);
  const resetDevice = useMutation(api.admin.resetDeviceId);
  const deleteLicense = useMutation(api.admin.deleteLicense);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Dialog states
  const [extendDialogId, setExtendDialogId] = useState<Id<"restaurants"> | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [resetDialogId, setResetDialogId] = useState<Id<"restaurants"> | null>(null);
  const [deleteDialogId, setDeleteDialogId] = useState<Id<"restaurants"> | null>(null);
  const [actionsOpenId, setActionsOpenId] = useState<Id<"restaurants"> | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (licenses === undefined) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const filtered = licenses.filter((l) => {
    const matchesSearch =
      search === "" ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      l.ownerEmail.toLowerCase().includes(search.toLowerCase()) ||
      l.licenseKey.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || l.licenseStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (
    id: Id<"restaurants">,
    status: "active" | "expired" | "suspended"
  ) => {
    try {
      await updateStatus({ licenseId: id, status });
      toast.success(`License status updated to ${status}`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to update status");
      }
    }
    setActionsOpenId(null);
  };

  const handleExtend = async () => {
    if (!extendDialogId) return;
    const days = parseInt(extendDays, 10);
    if (isNaN(days) || days <= 0) {
      toast.error("Enter a valid number of days");
      return;
    }
    try {
      await extendLicense({ licenseId: extendDialogId, days });
      toast.success(`License extended by ${days} days`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to extend license");
      }
    }
    setExtendDialogId(null);
    setExtendDays("30");
  };

  const handleResetDevice = async () => {
    if (!resetDialogId) return;
    try {
      await resetDevice({ licenseId: resetDialogId });
      toast.success("Device ID has been reset. The user can now activate on a new device.");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to reset device ID");
      }
    }
    setResetDialogId(null);
  };

  const handleDelete = async () => {
    if (!deleteDialogId) return;
    try {
      await deleteLicense({ licenseId: deleteDialogId });
      toast.success("License deleted");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to delete license");
      }
    }
    setDeleteDialogId(null);
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">License Management</h1>
        <p className="text-sm text-muted-foreground">
          View and manage all client licenses. {licenses.length} total.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* License list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <KeyRound className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search || statusFilter !== "all"
              ? "No licenses match your filters."
              : "No licenses yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((license) => (
            <div
              key={license._id}
              className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">
                      {license.name}
                    </h3>
                    <StatusBadge status={license.licenseStatus} />
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {PLAN_LABELS[license.plan]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {VYN_TYPE_LABELS[license.type]}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Owner: <span className="text-foreground font-medium">{license.ownerName}</span>{" "}
                      ({license.ownerEmail})
                    </span>
                    <span>
                      Expires: <span className="text-foreground font-medium">{formatDate(license.licenseExpiry)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Monitor className="size-3" />
                      Device: <span className="text-foreground font-medium">{license.deviceId ?? "Not bound"}</span>
                    </span>
                  </div>

                  {/* License key */}
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono tracking-wider bg-muted px-2 py-0.5 rounded text-foreground">
                      {license.licenseKey}
                    </code>
                    <button
                      onClick={() => handleCopyKey(license.licenseKey)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Copy license key"
                    >
                      {copiedKey === license.licenseKey ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 relative">
                  {/* Reset Device ID — prominent action */}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs"
                    onClick={() => setResetDialogId(license._id)}
                  >
                    <RotateCcw className="size-3.5 mr-1" />
                    Reset Device
                  </Button>

                  {/* More actions dropdown */}
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setActionsOpenId(
                          actionsOpenId === license._id ? null : license._id
                        )
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                    {actionsOpenId === license._id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setActionsOpenId(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-card shadow-lg z-50 py-1 overflow-hidden">
                          {license.licenseStatus !== "active" && (
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer"
                              onClick={() =>
                                handleStatusChange(license._id, "active")
                              }
                            >
                              <ShieldCheck className="size-4 text-emerald-500" />
                              Activate
                            </button>
                          )}
                          {license.licenseStatus !== "suspended" && (
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer"
                              onClick={() =>
                                handleStatusChange(license._id, "suspended")
                              }
                            >
                              <ShieldOff className="size-4 text-red-500" />
                              Suspend
                            </button>
                          )}
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer"
                            onClick={() => {
                              setExtendDialogId(license._id);
                              setActionsOpenId(null);
                            }}
                          >
                            <CalendarPlus className="size-4 text-blue-500" />
                            Extend
                          </button>
                          <div className="border-t border-border my-1" />
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 flex items-center gap-2 cursor-pointer"
                            onClick={() => {
                              setDeleteDialogId(license._id);
                              setActionsOpenId(null);
                            }}
                          >
                            <Trash2 className="size-4" />
                            Delete License
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reset Device ID Dialog */}
      <Dialog
        open={resetDialogId !== null}
        onOpenChange={() => setResetDialogId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Device ID</DialogTitle>
            <DialogDescription>
              This will unlink the license from its current device. The user will
              be able to activate the software on a new computer. This is useful
              when a customer{"'"}s computer breaks or they need to move to a new
              machine.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 text-sm text-amber-700 dark:text-amber-300">
            The previous device will be deactivated and will no longer be able
            to use the software.
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetDialogId(null)}>
              Cancel
            </Button>
            <Button onClick={handleResetDevice}>
              <RotateCcw className="size-4 mr-2" />
              Reset Device ID
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend License Dialog */}
      <Dialog
        open={extendDialogId !== null}
        onOpenChange={() => setExtendDialogId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend License</DialogTitle>
            <DialogDescription>
              Add days to this license. If expired, the new expiry will be
              calculated from today.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Number of days
            </label>
            <Input
              type="number"
              value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
              min={1}
              placeholder="30"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExtendDialogId(null)}>
              Cancel
            </Button>
            <Button onClick={handleExtend}>
              <CalendarPlus className="size-4 mr-2" />
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete License Dialog */}
      <Dialog
        open={deleteDialogId !== null}
        onOpenChange={() => setDeleteDialogId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete License</DialogTitle>
            <DialogDescription>
              This will permanently remove this license. The user will lose
              access to their POS software. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogId(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
            >
              <Trash2 className="size-4 mr-2" />
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
