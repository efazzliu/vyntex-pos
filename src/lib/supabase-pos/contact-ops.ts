import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

export type ConversationSummary = {
  email: string;
  name: string;
  latestMessage: string;
  latestTimestamp: number;
  unreadCount: number;
  totalMessages: number;
  hasReplied: boolean;
  /** True if at least one row came from the site chat widget (`type: chat`). */
  hasChat: boolean;
};

export async function submitContactForm(args: {
  name: string;
  email: string;
  subject?: string;
  message: string;
  type: "form" | "chat";
}): Promise<void> {
  const { error } = await supabase.from("contact_submissions").insert({
    name: args.name.trim(),
    email: args.email.trim().toLowerCase(),
    subject: args.subject?.trim() || null,
    message: args.message.trim(),
    type: args.type,
    status: "new",
  });
  if (error) throw new Error(error.message);
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const { data: submissions, error: subErr } = await supabase
    .from("contact_submissions")
    .select("id, email, name, message, status, type, created_at")
    .order("created_at", { ascending: false });

  if (subErr) throw new Error(subErr.message);

  const { data: replies, error: repErr } = await supabase
    .from("contact_replies")
    .select("email, message, created_at")
    .order("created_at", { ascending: false });

  if (repErr) throw new Error(repErr.message);

  const map = new Map<string, ConversationSummary>();

  for (const sub of submissions ?? []) {
    const email = String(sub.email).toLowerCase();
    const ts = new Date(sub.created_at as string).getTime();
    const existing = map.get(email);
    if (!existing) {
      map.set(email, {
        email,
        name: sub.name as string,
        latestMessage: sub.message as string,
        latestTimestamp: ts,
        unreadCount: sub.status === "new" ? 1 : 0,
        totalMessages: 1,
        hasReplied: sub.status === "replied",
        hasChat: sub.type === "chat",
      });
    } else {
      existing.totalMessages += 1;
      if (sub.status === "new") existing.unreadCount += 1;
      if (sub.status === "replied") existing.hasReplied = true;
      if (sub.type === "chat") existing.hasChat = true;
    }
  }

  for (const rep of replies ?? []) {
    const email = String(rep.email).toLowerCase();
    const ts = new Date(rep.created_at as string).getTime();
    const existing = map.get(email);
    if (existing) {
      existing.hasReplied = true;
      if (ts > existing.latestTimestamp) {
        existing.latestTimestamp = ts;
        existing.latestMessage = rep.message as string;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.latestTimestamp - a.latestTimestamp);
}

export type TimelineItem =
  | {
      kind: "message";
      id: string;
      name: string;
      message: string;
      subject?: string;
      type: string;
      timestamp: number;
    }
  | {
      kind: "reply";
      id: string;
      adminName: string;
      message: string;
      timestamp: number;
    };

export async function getConversation(email: string): Promise<{
  contactName: string;
  email: string;
  timeline: TimelineItem[];
}> {
  const normalized = email.trim().toLowerCase();

  const { data: submissions, error: subErr } = await supabase
    .from("contact_submissions")
    .select("id, name, message, subject, type, created_at")
    .eq("email", normalized)
    .order("created_at", { ascending: true });

  if (subErr) throw new Error(subErr.message);

  const { data: replyRows, error: repErr } = await supabase
    .from("contact_replies")
    .select("id, admin_name, message, created_at")
    .eq("email", normalized)
    .order("created_at", { ascending: true });

  if (repErr) throw new Error(repErr.message);

  const timeline: TimelineItem[] = [];

  for (const sub of submissions ?? []) {
    timeline.push({
      kind: "message",
      id: sub.id as string,
      name: sub.name as string,
      message: sub.message as string,
      subject: (sub.subject as string) || undefined,
      type: sub.type as string,
      timestamp: new Date(sub.created_at as string).getTime(),
    });
  }

  for (const rep of replyRows ?? []) {
    timeline.push({
      kind: "reply",
      id: rep.id as string,
      adminName: rep.admin_name as string,
      message: rep.message as string,
      timestamp: new Date(rep.created_at as string).getTime(),
    });
  }

  timeline.sort((a, b) => a.timestamp - b.timestamp);

  return {
    contactName: (submissions?.[0]?.name as string) ?? "Unknown",
    email: normalized,
    timeline,
  };
}

/** Opens the default mail client with prefilled recipient, subject, and body (no server). */
export function buildMailtoClientUrl(to: string, subject: string, body: string): string {
  const email = to.trim();
  const q = new URLSearchParams();
  if (subject.trim()) q.set("subject", subject.trim());
  if (body.trim()) q.set("body", body.trim());
  const qs = q.toString();
  return qs ? `mailto:${email}?${qs}` : `mailto:${email}`;
}

/**
 * Sends email via Supabase Edge Function `send-client-email` (Resend).
 * Requires deployed function + secrets; see `supabase/functions/send-client-email/index.ts`.
 */
export async function sendClientEmailViaEdge(args: {
  to: string;
  subject: string;
  message: string;
}): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.functions.invoke("send-client-email", {
    body: {
      to: args.to.trim().toLowerCase(),
      subject: args.subject.trim() || "Message from Vyntex POS",
      message: args.message.trim(),
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to send email");
  }
  const payload = data as { error?: string; ok?: boolean } | null;
  if (payload && typeof payload.error === "string" && payload.error.length > 0) {
    throw new Error(payload.error);
  }
}

/** Sends email through the edge function, then logs the text under Messages for that address. */
export async function sendClientEmailAndLogReply(args: {
  to: string;
  subject: string;
  message: string;
  adminName: string;
}): Promise<void> {
  await sendClientEmailViaEdge(args);
  const logged =
    args.subject.trim().length > 0
      ? `Email: ${args.subject.trim()}\n\n${args.message.trim()}`
      : args.message.trim();
  await sendAdminReply({
    email: args.to,
    message: logged,
    adminName: args.adminName,
  });
}

export async function sendAdminReply(args: {
  email: string;
  message: string;
  adminName: string;
}): Promise<void> {
  const email = args.email.trim().toLowerCase();
  const { error: insErr } = await supabase.from("contact_replies").insert({
    email,
    message: args.message.trim(),
    admin_name: args.adminName.trim() || "Admin",
    created_at: new Date().toISOString(),
  });
  if (insErr) throw new Error(insErr.message);

  const { data: subs, error: fetchErr } = await supabase
    .from("contact_submissions")
    .select("id, status")
    .eq("email", email);

  if (fetchErr) throw new Error(fetchErr.message);

  for (const sub of subs ?? []) {
    if (sub.status !== "replied") {
      const { error: upErr } = await supabase
        .from("contact_submissions")
        .update({ status: "replied" })
        .eq("id", sub.id);
      if (upErr) throw new Error(upErr.message);
    }
  }
}

export async function markConversationRead(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const { data: subs, error: fetchErr } = await supabase
    .from("contact_submissions")
    .select("id, status")
    .eq("email", normalized);

  if (fetchErr) throw new Error(fetchErr.message);

  for (const sub of subs ?? []) {
    if (sub.status === "new") {
      const { error } = await supabase
        .from("contact_submissions")
        .update({ status: "read" })
        .eq("id", sub.id);
      if (error) throw new Error(error.message);
    }
  }
}

export async function deleteConversation(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();

  const { error: d1 } = await supabase.from("contact_submissions").delete().eq("email", normalized);
  if (d1) throw new Error(d1.message);

  const { error: d2 } = await supabase.from("contact_replies").delete().eq("email", normalized);
  if (d2) throw new Error(d2.message);
}

/** True when PostgREST reports missing inbox tables (migration not applied on Supabase). */
export function isContactInboxTableMissingError(message: string): boolean {
  const m = message.toLowerCase();
  const namesContact =
    m.includes("contact_submissions") || m.includes("contact_replies");
  if (!namesContact) return false;
  return (
    m.includes("schema cache") ||
    m.includes("could not find") ||
    m.includes("does not exist") ||
    m.includes("pgrst205") ||
    (m.includes("relation") && m.includes("does not exist"))
  );
}
