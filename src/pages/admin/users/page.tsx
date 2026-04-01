import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
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
  Users,
  Search,
  ShieldCheck,
  User,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminUsers() {
  const users = useQuery(api.admin.listUsers);
  const updateRole = useMutation(api.admin.updateUserRole);

  const [search, setSearch] = useState("");
  const [roleDialogUser, setRoleDialogUser] = useState<{
    id: Id<"users">;
    name: string;
    currentRole: string;
  } | null>(null);

  if (users === undefined) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const filtered = users.filter((u) => {
    if (search === "") return true;
    const q = search.toLowerCase();
    return (
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q)
    );
  });

  const handleToggleRole = async () => {
    if (!roleDialogUser) return;
    const newRole =
      roleDialogUser.currentRole === "admin" ? "user" : "admin";
    try {
      await updateRole({ userId: roleDialogUser.id, role: newRole });
      toast.success(
        `${roleDialogUser.name || "User"} is now ${newRole === "admin" ? "an admin" : "a regular user"}`
      );
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to update role");
      }
    }
    setRoleDialogUser(null);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-sm text-muted-foreground">
          {users.length} registered user{users.length !== 1 ? "s" : ""}.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* User list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Users className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? "No users match your search." : "No users yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => (
            <div
              key={user._id}
              className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0",
                    user.role === "admin"
                      ? "bg-gradient-to-br from-red-500 to-orange-500"
                      : "bg-gradient-to-br from-[#0066FF] to-[#44CC00]"
                  )}
                >
                  {(user.name ?? "?").charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user.name ?? "Unnamed"}
                    </p>
                    {user.role === "admin" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold">
                        <ShieldCheck className="size-3" />
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{user.email ?? "No email"}</span>
                    <span>Joined {formatDate(user._creationTime)}</span>
                    {user.license && (
                      <span className="flex items-center gap-1">
                        <KeyRound className="size-3" />
                        {user.license.name} ({user.license.plan})
                      </span>
                    )}
                  </div>
                </div>

                {/* Action */}
                <Button
                  size="sm"
                  variant={user.role === "admin" ? "secondary" : "default"}
                  className="text-xs shrink-0"
                  onClick={() =>
                    setRoleDialogUser({
                      id: user._id,
                      name: user.name ?? "User",
                      currentRole: user.role,
                    })
                  }
                >
                  {user.role === "admin" ? (
                    <>
                      <User className="size-3.5 mr-1" />
                      Remove Admin
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3.5 mr-1" />
                      Make Admin
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role toggle dialog */}
      <Dialog
        open={roleDialogUser !== null}
        onOpenChange={() => setRoleDialogUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {roleDialogUser?.currentRole === "admin"
                ? "Remove Admin Role"
                : "Grant Admin Role"}
            </DialogTitle>
            <DialogDescription>
              {roleDialogUser?.currentRole === "admin"
                ? `This will remove admin access from ${roleDialogUser?.name}. They will no longer be able to access the admin panel.`
                : `This will grant admin access to ${roleDialogUser?.name}. They will be able to manage licenses, users, and contact submissions.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRoleDialogUser(null)}>
              Cancel
            </Button>
            <Button
              className={
                roleDialogUser?.currentRole === "admin"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : ""
              }
              onClick={handleToggleRole}
            >
              {roleDialogUser?.currentRole === "admin"
                ? "Remove Admin"
                : "Grant Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
