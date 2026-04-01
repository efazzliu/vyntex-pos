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
  MessageSquare,
  Search,
  Mail,
  MessageCircle,
  Trash2,
  Eye,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusDot({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    new: { label: "New", color: "text-blue-500" },
    read: { label: "Read", color: "text-amber-500" },
    replied: { label: "Replied", color: "text-emerald-500" },
  };
  const c = config[status] ?? { label: status, color: "text-muted-foreground" };

  return (
    <span className={cn("flex items-center gap-1.5 text-xs font-medium", c.color)}>
      {status === "new" ? (
        <Circle className="size-2.5 fill-current" />
      ) : status === "replied" ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <Eye className="size-3.5" />
      )}
      {c.label}
    </span>
  );
}

export default function AdminContacts() {
  const contacts = useQuery(api.admin.listContacts);
  const updateStatus = useMutation(api.admin.updateContactStatus);
  const deleteContact = useMutation(api.admin.deleteContact);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailContact, setDetailContact] = useState<Id<"contactSubmissions"> | null>(null);
  const [deleteDialogId, setDeleteDialogId] = useState<Id<"contactSubmissions"> | null>(null);

  if (contacts === undefined) {
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

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      search === "" ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.message.toLowerCase().includes(search.toLowerCase()) ||
      (c.subject ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedContact = detailContact
    ? contacts.find((c) => c._id === detailContact)
    : null;

  const handleMarkStatus = async (
    id: Id<"contactSubmissions">,
    status: "new" | "read" | "replied"
  ) => {
    try {
      await updateStatus({ contactId: id, status });
      toast.success(`Marked as ${status}`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to update status");
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteDialogId) return;
    try {
      await deleteContact({ contactId: deleteDialogId });
      toast.success("Contact submission deleted");
      if (detailContact === deleteDialogId) setDetailContact(null);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to delete");
      }
    }
    setDeleteDialogId(null);
  };

  const handleOpenDetail = async (id: Id<"contactSubmissions">) => {
    setDetailContact(id);
    const contact = contacts.find((c) => c._id === id);
    // Auto-mark as read when opening
    if (contact && contact.status === "new") {
      await handleMarkStatus(id, "read");
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Contact Submissions
        </h1>
        <p className="text-sm text-muted-foreground">
          {contacts.length} total submission{contacts.length !== 1 ? "s" : ""}.
          {contacts.filter((c) => c.status === "new").length > 0 && (
            <span className="text-blue-500 font-medium ml-1">
              {contacts.filter((c) => c.status === "new").length} new
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
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
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contact list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <MessageSquare className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search || statusFilter !== "all"
              ? "No messages match your filters."
              : "No contact submissions yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => (
            <button
              key={contact._id}
              onClick={() => handleOpenDetail(contact._id)}
              className={cn(
                "w-full text-left rounded-xl border bg-card p-4 hover:shadow-sm transition-all cursor-pointer",
                contact.status === "new"
                  ? "border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-900/5"
                  : "border-border"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    contact.type === "chat"
                      ? "bg-purple-100 dark:bg-purple-900/30"
                      : "bg-blue-100 dark:bg-blue-900/30"
                  )}
                >
                  {contact.type === "chat" ? (
                    <MessageCircle className="size-4 text-purple-500" />
                  ) : (
                    <Mail className="size-4 text-blue-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <p
                        className={cn(
                          "text-sm truncate",
                          contact.status === "new"
                            ? "font-bold text-foreground"
                            : "font-medium text-foreground"
                        )}
                      >
                        {contact.name}
                      </p>
                      <StatusDot status={contact.status} />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDate(contact._creationTime)}
                    </span>
                  </div>
                  {contact.subject && (
                    <p className="text-xs font-medium text-foreground/80 mt-0.5 truncate">
                      {contact.subject}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {contact.message}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog
        open={detailContact !== null}
        onOpenChange={() => setDetailContact(null)}
      >
        <DialogContent className="max-w-lg">
          {selectedContact && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="truncate">{selectedContact.name}</span>
                  <StatusDot status={selectedContact.status} />
                </DialogTitle>
                <DialogDescription>
                  {selectedContact.email} · {formatDate(selectedContact._creationTime)}
                  {" · "}
                  {selectedContact.type === "chat" ? "Chat widget" : "Contact form"}
                </DialogDescription>
              </DialogHeader>

              {selectedContact.subject && (
                <p className="text-sm font-semibold text-foreground">
                  {selectedContact.subject}
                </p>
              )}

              <div className="rounded-lg bg-muted/50 p-4 text-sm text-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
                {selectedContact.message}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    handleMarkStatus(selectedContact._id, "replied")
                  }
                  disabled={selectedContact.status === "replied"}
                >
                  <CheckCircle2 className="size-3.5 mr-1" />
                  Mark Replied
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    handleMarkStatus(selectedContact._id, "new")
                  }
                  disabled={selectedContact.status === "new"}
                >
                  <Circle className="size-3.5 mr-1" />
                  Mark as New
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 ml-auto"
                  onClick={() => setDeleteDialogId(selectedContact._id)}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={deleteDialogId !== null}
        onOpenChange={() => setDeleteDialogId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Submission</DialogTitle>
            <DialogDescription>
              This will permanently delete this contact submission. This action
              cannot be undone.
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
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
