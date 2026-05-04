/**
 * Sends an email from the platform admin UI (Clients page) to a client address.
 *
 * Deploy: `supabase functions deploy send-client-email --no-verify-jwt` is NOT recommended;
 * keep JWT verification (default). Set secrets in Supabase Dashboard → Edge Functions → Secrets:
 *   RESEND_API_KEY       — from https://resend.com
 *   RESEND_FROM_EMAIL    — verified sender, e.g. "Vyntex POS <onboarding@yourdomain.com>"
 *   PLATFORM_ADMIN_EMAILS — same comma-separated list as VITE_PLATFORM_ADMIN_EMAILS
 *
 * SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminListRaw = Deno.env.get("PLATFORM_ADMIN_EMAILS") ?? "";
    const adminSet = new Set(
      adminListRaw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
    if (!adminSet.has(user.email.toLowerCase())) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as { to?: string; subject?: string; message?: string };
    const to = String(body.to ?? "").trim().toLowerCase();
    const subject = String(body.subject ?? "").trim() || "Message from Vyntex POS";
    const message = String(body.message ?? "").trim();

    if (!to.includes("@") || !message) {
      return new Response(JSON.stringify({ error: "Invalid recipient or empty message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM_EMAIL");
    if (!resendKey || !from) {
      return new Response(
        JSON.stringify({
          error:
            "Email service not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL on this function, or use Open in mail app from the admin UI.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: message,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `Email provider error: ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
