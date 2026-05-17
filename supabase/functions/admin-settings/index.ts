/**
 * Platform admin settings: list/revoke auth sessions, send self notification emails.
 *
 * Deploy: supabase functions deploy admin-settings
 * Secrets: SUPABASE_SERVICE_ROLE_KEY, PLATFORM_ADMIN_EMAILS, RESEND_API_KEY, RESEND_FROM_EMAIL
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminEmailSet(): Set<string> {
  const raw = Deno.env.get("PLATFORM_ADMIN_EMAILS") ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

type SessionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  factor_id?: string | null;
  aal?: string | null;
  user_agent?: string | null;
  ip?: string | null;
  tag?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "Server misconfiguration" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await userClient.auth.getUser();
    if (callerErr || !caller?.email || !caller.id) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admins = adminEmailSet();
    if (!admins.has(caller.email.toLowerCase())) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "").trim();

    if (action === "list_sessions") {
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${caller.id}/sessions`, {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        return json({ error: text || "Could not list sessions", sessions: [] }, res.status === 404 ? 200 : 400);
      }
      const sessions = (await res.json()) as SessionRow[];
      return json({ sessions: Array.isArray(sessions) ? sessions : [] });
    }

    if (action === "revoke_session") {
      const sessionId = String(body.sessionId ?? "").trim();
      if (!sessionId) return json({ error: "sessionId required" }, 400);
      const res = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${caller.id}/sessions/${sessionId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
        },
      );
      if (!res.ok) {
        const text = await res.text();
        return json({ error: text || "Could not revoke session" }, 400);
      }
      return json({ ok: true });
    }

    if (action === "send_notify_email") {
      const meta = (caller.user_metadata ?? {}) as Record<string, unknown>;
      const prefs = (meta.admin_notifications ?? {}) as Record<string, unknown>;
      const notifyType = String(body.notifyType ?? "");
      if (notifyType === "license_expiry" && prefs.licenseExpiryAlerts === false) {
        return json({ error: "License alerts disabled" }, 400);
      }
      if (notifyType === "billing_digest" && prefs.billingAlerts === false) {
        return json({ error: "Billing alerts disabled" }, 400);
      }
      if (prefs.email === false) {
        return json({ error: "Email notifications disabled" }, 400);
      }

      const resendKey = Deno.env.get("RESEND_API_KEY");
      const from = Deno.env.get("RESEND_FROM_EMAIL");
      if (!resendKey || !from) {
        return json({ error: "Email provider not configured" }, 503);
      }

      const subject = String(body.subject ?? "Vyntex Admin notification").trim();
      const message = String(body.message ?? "").trim();
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [caller.email],
          subject,
          text: message,
        }),
      });
      if (!emailRes.ok) {
        const errText = await emailRes.text();
        return json({ error: errText || "Resend failed" }, 502);
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
