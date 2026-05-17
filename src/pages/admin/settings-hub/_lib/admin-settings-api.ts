import { supabase } from "@/lib/supabase.ts";

export type AdminAuthSession = {
  id: string;
  created_at: string;
  updated_at: string;
  factor_id?: string | null;
  aal?: string | null;
  user_agent?: string | null;
  ip?: string | null;
  tag?: string | null;
};

export async function listAdminAuthSessions(): Promise<AdminAuthSession[]> {
  const { data, error } = await supabase.functions.invoke("admin-settings", {
    body: { action: "list_sessions" },
  });
  if (error) throw new Error(error.message);
  const payload = data as { error?: string; sessions?: AdminAuthSession[] };
  if (payload?.error) throw new Error(payload.error);
  return payload.sessions ?? [];
}

export async function revokeAdminAuthSession(sessionId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("admin-settings", {
    body: { action: "revoke_session", sessionId },
  });
  if (error) throw new Error(error.message);
  const payload = data as { error?: string };
  if (payload?.error) throw new Error(payload.error);
}

export type AdminNotifyEmailType = "license_expiry" | "billing_digest";

export async function sendAdminNotifyEmail(args: {
  type: AdminNotifyEmailType;
  subject: string;
  message: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("admin-settings", {
    body: {
      action: "send_notify_email",
      notifyType: args.type,
      subject: args.subject,
      message: args.message,
    },
  });
  if (error) throw new Error(error.message);
  const payload = data as { error?: string };
  if (payload?.error) throw new Error(payload.error);
}
