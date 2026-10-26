/**
 * Sends a venue report email from the POS (scheduled or Send now).
 *
 * Secrets: RESEND_API_KEY, RESEND_FROM_EMAIL
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonError("Server misconfiguration", 500);
    }

    const body = (await req.json()) as {
      licenseKey?: string;
      to?: string;
      subject?: string;
      html?: string;
      attachment?: {
        filename?: string;
        contentBase64?: string;
        contentType?: string;
      };
    };

    const licenseKey = String(body.licenseKey ?? "").trim();
    const to = String(body.to ?? "").trim().toLowerCase();
    const subject = String(body.subject ?? "").trim() || "Vyntex POS report";
    const html = String(body.html ?? "").trim();
    if (!licenseKey || !to.includes("@") || !html) {
      return jsonError("Invalid report email payload", 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, name, license_key")
      .eq("license_key", licenseKey)
      .maybeSingle();
    if (restaurantError || !restaurant) {
      return jsonError("Unknown venue license", 404);
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM_EMAIL");
    if (!resendKey || !from) {
      return jsonError(
        "Email service not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
        503,
      );
    }

    const attachments = [];
    const filename = String(body.attachment?.filename ?? "").trim();
    const content = String(body.attachment?.contentBase64 ?? "").trim();
    if (filename && content) {
      attachments.push({
        filename,
        content,
        type:
          String(body.attachment?.contentType ?? "").trim() ||
          "application/vnd.ms-excel",
      });
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
        subject: `${restaurant.name}: ${subject}`,
        html,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return jsonError(`Email provider error: ${errText}`, 502);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Send failed", 500);
  }
});

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
