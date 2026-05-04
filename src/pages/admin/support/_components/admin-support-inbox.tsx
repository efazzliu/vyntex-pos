import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Inbox,
  MessageCircle,
  MessagesSquare,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { cn } from "@/lib/utils.ts";
import {
  deleteConversation,
  getConversation,
  isContactInboxTableMissingError,
  listConversations,
  markConversationRead,
  sendAdminReply,
  type ConversationSummary,
  type TimelineItem,
} from "@/lib/supabase-pos/contact-ops.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import { toast } from "sonner";

const INBOX_QK = ["admin", "contact-inbox"] as const;
const threadKey = (email: string) => ["admin", "contact-thread", email] as const;

function InboxQueryError({ error }: { error: unknown }) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (isContactInboxTableMissingError(raw)) {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-5 text-sm text-amber-950 shadow-[0_0_40px_-12px_rgba(245,158,11,0.35)] dark:border-amber-500/25 dark:from-amber-500/15 dark:to-transparent dark:text-amber-50">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">
          Database setup required
        </p>
        <p className="font-semibold text-amber-900 dark:text-amber-100">Inbox tables are missing on Supabase</p>
        <p className="leading-relaxed text-amber-900/85 dark:text-amber-100/85">
          Create <code className="rounded-md bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px]">contact_submissions</code> and{" "}
          <code className="rounded-md bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px]">contact_replies</code>. In Supabase:{" "}
          <strong>SQL Editor</strong> → paste the contents of{" "}
          <code className="break-all font-mono text-[11px]">supabase/migrations/007_contact_inbox_tables.sql</code>, run it, then refresh
          this page (or <strong>Settings → API → Reload schema</strong> if needed).
        </p>
      </div>
    );
  }
  return (
    <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
      {raw || "Something went wrong."}
    </p>
  );
}

function formatTime(ts: number) {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

function TimelineBubble({ item }: { item: TimelineItem }) {
  if (item.kind === "reply") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex justify-start"
      >
        <div className="max-w-[min(100%,520px)] rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-900/95 to-slate-800/90 px-4 py-3 text-sm text-slate-100 shadow-[0_12px_40px_-20px_rgba(6,182,212,0.45)] dark:from-slate-950 dark:to-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">{item.adminName}</p>
          <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-slate-100">{item.message}</p>
          <p className="mt-2 font-mono text-[10px] text-slate-500">{formatTime(item.timestamp)}</p>
        </div>
      </motion.div>
    );
  }

  const isChat = item.type === "chat";
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex justify-end"
    >
      <div
        className={cn(
          "max-w-[min(100%,520px)] rounded-2xl px-4 py-3 text-sm text-white shadow-[0_16px_48px_-24px_rgba(0,102,255,0.65)]",
          isChat
            ? "border border-white/20 bg-gradient-to-br from-[#0066FF] via-[#0088ee] to-[#22c55e]"
            : "border border-white/10 bg-gradient-to-br from-slate-600 to-slate-700",
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">{item.name}</p>
        {item.subject ? (
          <p className="mt-0.5 text-xs text-white/75">
            {item.subject} · {isChat ? "Chat" : "Form"}
          </p>
        ) : (
          <p className="mt-0.5 text-[10px] text-white/65">{isChat ? "Live chat" : "Contact form"}</p>
        )}
        <p className="mt-2 whitespace-pre-wrap leading-relaxed">{item.message}</p>
        <p className="mt-2 font-mono text-[10px] text-white/55">{formatTime(item.timestamp)}</p>
      </div>
    </motion.div>
  );
}

export function AdminSupportInbox() {
  const queryClient = useQueryClient();
  const { user } = useUserRole();
  const adminName = user?.name?.trim() || user?.email || "Admin";
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [filter, setFilter] = useState<"all" | "chat" | "unread">("all");

  const listQuery = useQuery({
    queryKey: INBOX_QK,
    queryFn: listConversations,
  });

  const allRows = listQuery.data ?? [];

  const stats = useMemo(() => {
    const unread = allRows.reduce((a, c) => a + c.unreadCount, 0);
    const chatChannels = allRows.filter((c) => c.hasChat).length;
    const withReply = allRows.filter((c) => c.hasReplied).length;
    return {
      total: allRows.length,
      unread,
      chatChannels,
      withReply,
    };
  }, [allRows]);

  const rows = useMemo(() => {
    if (filter === "chat") return allRows.filter((c) => c.hasChat);
    if (filter === "unread") return allRows.filter((c) => c.unreadCount > 0);
    return allRows;
  }, [allRows, filter]);

  const threadQuery = useQuery({
    queryKey: selectedEmail ? threadKey(selectedEmail) : ["admin", "contact-thread", "none"],
    queryFn: () => getConversation(selectedEmail!),
    enabled: Boolean(selectedEmail),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmail?.trim() || !replyDraft.trim()) return;
      await sendAdminReply({
        email: selectedEmail,
        message: replyDraft.trim(),
        adminName,
      });
    },
    onSuccess: () => {
      setReplyDraft("");
      toast.success("Reply saved.");
      void queryClient.invalidateQueries({ queryKey: INBOX_QK });
      if (selectedEmail) void queryClient.invalidateQueries({ queryKey: threadKey(selectedEmail) });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Could not send reply.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (email: string) => deleteConversation(email),
    onSuccess: () => {
      toast.success("Conversation removed.");
      setSelectedEmail(null);
      void queryClient.invalidateQueries({ queryKey: INBOX_QK });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    },
  });

  const selectConversation = (c: ConversationSummary) => {
    setSelectedEmail(c.email);
    setReplyDraft("");
    if (c.unreadCount > 0) {
      void markConversationRead(c.email)
        .then(() => void queryClient.invalidateQueries({ queryKey: INBOX_QK }))
        .catch((e) => {
          toast.error(e instanceof Error ? e.message : "Could not mark conversation as read.");
        });
    }
  };

  const metricCards = useMemo(
    () => [
      {
        title: "Threads",
        value: String(stats.total),
        note: "Unique visitor emails",
        icon: <Inbox className="size-4" />,
        glow: "from-cyan-400/35 to-blue-600/10",
      },
      {
        title: "Unread signals",
        value: String(stats.unread),
        note: "Needs operator attention",
        icon: <Sparkles className="size-4" />,
        glow: "from-violet-400/35 to-fuchsia-600/10",
      },
      {
        title: "Live chat",
        value: String(stats.chatChannels),
        note: "Threads with widget traffic",
        icon: <MessagesSquare className="size-4" />,
        glow: "from-emerald-400/35 to-teal-600/10",
      },
      {
        title: "Answered",
        value: String(stats.withReply),
        note: "Threads you replied to",
        icon: <MessageCircle className="size-4" />,
        glow: "from-sky-400/35 to-cyan-600/10",
      },
    ],
    [stats],
  );

  return (
    <section className="space-y-5 px-6 pb-10 pt-0 lg:px-8">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#050a18] p-6 text-white shadow-[0_40px_100px_-50px_rgba(34,211,238,0.55)]"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-[#0066FF]/20 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/90">
              <Sparkles className="size-3.5 text-cyan-300" />
              Signal inbox
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight lg:text-3xl">Client messages</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-cyan-100/75">
              Unified stream from the public site chat widget and the contact form — triage, respond, and keep continuity
              without leaving admin.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/30 to-blue-600/40">
              <UserRound className="size-4 text-cyan-100" />
            </div>
            <div className="text-left text-xs">
              <p className="font-medium text-white/90">Operator</p>
              <p className="truncate text-cyan-100/70">{adminName}</p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((m, i) => (
          <motion.article
            key={m.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06 * i }}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_24px_56px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80"
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-x-6 top-0 h-16 rounded-b-[100%] bg-gradient-to-b opacity-90 blur-xl transition group-hover:opacity-100",
                m.glow,
              )}
            />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-600/80 dark:bg-slate-800/90 dark:text-slate-300">
                {m.icon}
                {m.title}
              </span>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
                {listQuery.isLoading ? "—" : m.value}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{m.note}</p>
            </div>
          </motion.article>
        ))}
      </div>

      <div className="grid min-h-[min(480px,70vh)] gap-4 xl:grid-cols-[minmax(280px,360px)_1fr]">
        <motion.aside
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/85 shadow-[0_28px_64px_-48px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/75"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 px-4 py-4 dark:border-slate-700/50">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0066FF]/20 to-cyan-500/20 ring-1 ring-[#0066FF]/25">
                <Inbox className="size-5 text-[#0066FF] dark:text-cyan-300" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold tracking-tight text-slate-900 dark:text-white">Queue</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Filter by channel or read state</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl border-slate-200/80 bg-white/80 dark:border-slate-600 dark:bg-slate-800/80"
              onClick={() => void queryClient.invalidateQueries({ queryKey: INBOX_QK })}
              aria-label="Refresh inbox"
            >
              <RefreshCw className={cn("size-4", listQuery.isFetching && "animate-spin")} />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-200/60 px-3 py-3 dark:border-slate-700/50">
            {(
              [
                { key: "all" as const, label: "All" },
                { key: "chat" as const, label: "Chat only" },
                { key: "unread" as const, label: "Unread" },
              ] as const
            ).map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => setFilter(x.key)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                  filter === x.key
                    ? "border-cyan-500/40 bg-gradient-to-r from-[#0066FF]/15 to-cyan-500/10 text-[#0a3d6b] shadow-sm dark:border-cyan-400/30 dark:from-cyan-500/20 dark:to-blue-600/10 dark:text-cyan-100"
                    : "border-transparent bg-slate-100/80 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-800",
                )}
              >
                {x.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="p-2">
              {listQuery.isLoading ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-[4.5rem] w-full rounded-2xl" />
                  ))}
                </div>
              ) : listQuery.isError ? (
                <div className="p-3">
                  <InboxQueryError error={listQuery.error} />
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-800/50">
                    <MessagesSquare className="size-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No conversations yet</p>
                  <p className="max-w-[220px] text-xs text-slate-500 dark:text-slate-400">
                    When visitors use the site chat or contact form, threads appear here in real time.
                  </p>
                </div>
              ) : (
                rows.map((c) => {
                  const active = selectedEmail === c.email;
                  return (
                    <button
                      key={c.email}
                      type="button"
                      onClick={() => selectConversation(c)}
                      className={cn(
                        "mb-2 flex w-full flex-col rounded-2xl border px-3.5 py-3 text-left text-sm transition-all duration-200",
                        active
                          ? "border-cyan-500/40 bg-gradient-to-br from-[#0066FF]/12 to-cyan-500/8 shadow-[0_12px_32px_-20px_rgba(0,102,255,0.4)] dark:from-cyan-500/15 dark:to-blue-900/20"
                          : "border-transparent bg-slate-50/50 hover:border-slate-200/80 hover:bg-white dark:bg-slate-800/40 dark:hover:border-slate-600 dark:hover:bg-slate-800/70",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-slate-900 dark:text-white">{c.name}</span>
                        {c.unreadCount > 0 ? (
                          <span className="ml-auto shrink-0 rounded-full bg-gradient-to-r from-[#0066FF] to-cyan-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                            {c.unreadCount}
                          </span>
                        ) : null}
                      </span>
                      <span className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">{c.email}</span>
                      <span className="mt-1.5 line-clamp-2 text-xs leading-snug text-slate-600 dark:text-slate-300">
                        {c.latestMessage}
                      </span>
                      {c.hasChat ? (
                        <span className="mt-2 inline-flex w-fit rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                          Chat
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </motion.aside>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="flex min-h-[min(400px,62vh)] flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 shadow-[0_32px_70px_-50px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/75 xl:min-h-[min(calc(100dvh-22rem),720px)]"
        >
          {!selectedEmail ? (
            <div className="relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden p-10 text-center">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,102,255,0.08),transparent_55%)]" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-900 to-slate-800 shadow-[0_20px_50px_-24px_rgba(34,211,238,0.5)]">
                <MessageCircle className="size-7 text-cyan-300" />
              </div>
              <div className="relative max-w-sm">
                <p className="text-base font-semibold text-slate-900 dark:text-white">Select a thread</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Pick a conversation from the queue to view the full timeline and send a reply. Replies sync to the visitor
                  chat history when they return.
                </p>
              </div>
            </div>
          ) : threadQuery.isLoading ? (
            <div className="space-y-4 p-8">
              <Skeleton className="h-7 w-52 rounded-lg" />
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="ml-auto h-24 w-full max-w-md rounded-2xl" />
            </div>
          ) : threadQuery.isError ? (
            <div className="p-8">
              <InboxQueryError error={threadQuery.error} />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-transparent px-5 py-4 dark:border-slate-700/50 dark:from-slate-800/40">
                <div className="min-w-0">
                  <p className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                    {threadQuery.data?.contactName}
                  </p>
                  <p className="mt-0.5 font-mono text-sm text-slate-500 dark:text-slate-400">{threadQuery.data?.email}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-red-500/25 text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete thread
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-slate-700">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        All messages and replies for this email will be permanently removed. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 text-white hover:bg-red-600/90"
                        onClick={() => selectedEmail && deleteMutation.mutate(selectedEmail)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.6)_0%,transparent_120px)] px-5 py-5 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.5)_0%,transparent_120px)]">
                <div className="mx-auto flex max-w-3xl flex-col gap-4">
                  {threadQuery.data?.timeline.map((item) => (
                    <TimelineBubble key={`${item.kind}-${item.id}`} item={item} />
                  ))}
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200/60 bg-slate-50/90 p-5 dark:border-slate-700/50 dark:bg-slate-950/40">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Compose reply
                </p>
                <Textarea
                  placeholder="Write a response — it appears in the visitor's chat timeline…"
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  rows={3}
                  className="resize-none rounded-xl border-slate-200/80 bg-white/95 shadow-inner dark:border-slate-600 dark:bg-slate-900/80"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="max-w-md text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    Saved replies show in the public chat widget when the same visitor opens it again.
                  </p>
                  <Button
                    type="button"
                    disabled={!replyDraft.trim() || sendMutation.isPending}
                    onClick={() => sendMutation.mutate()}
                    className="rounded-xl bg-gradient-to-r from-[#0066FF] to-[#22c55e] px-5 font-semibold text-white shadow-[0_12px_32px_-16px_rgba(0,102,255,0.55)] hover:opacity-95"
                  >
                    {sendMutation.isPending ? (
                      "Sending…"
                    ) : (
                      <>
                        <Send className="mr-2 size-4" />
                        Send reply
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
