/**
 * Paddle Billing webhooks → platform_billing_transactions + license extension.
 *
 * Deploy: supabase functions deploy paddle-webhook --no-verify-jwt
 * Secrets (Dashboard → Edge Functions):
 *   PADDLE_WEBHOOK_SECRET
 *   SUPABASE_SERVICE_ROLE_KEY (auto in project; required for inserts)
 * Optional price-id → plan mapping (same IDs as VITE_PADDLE_* in the app):
 *   PADDLE_STARTER_MONTHLY_PRICE_ID, PADDLE_STARTER_ANNUAL_PRICE_ID, …
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, paddle-signature",
};

type PlanName = "starter" | "professional" | "enterprise";
type BillingCycle = "monthly" | "yearly";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) throw new Error("Invalid hex");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader?.trim()) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    }),
  ) as Record<string, string>;
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const ageSec = Math.abs(Date.now() / 1000 - tsNum);
  if (ageSec > 300) return false;

  const payload = `${ts}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = new Uint8Array(sig);
  let received: Uint8Array;
  try {
    received = hexToBytes(h1);
  } catch {
    return false;
  }
  if (expected.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i]! ^ received[i]!;
  return diff === 0;
}

function pricePlanMap(): Map<string, { plan: PlanName; cycle: BillingCycle }> {
  const pairs: Array<[string | undefined, PlanName, BillingCycle]> = [
    [Deno.env.get("PADDLE_STARTER_MONTHLY_PRICE_ID"), "starter", "monthly"],
    [Deno.env.get("PADDLE_STARTER_ANNUAL_PRICE_ID"), "starter", "yearly"],
    [Deno.env.get("PADDLE_PROFESSIONAL_MONTHLY_PRICE_ID"), "professional", "monthly"],
    [Deno.env.get("PADDLE_PROFESSIONAL_ANNUAL_PRICE_ID"), "professional", "yearly"],
    [Deno.env.get("PADDLE_ENTERPRISE_MONTHLY_PRICE_ID"), "enterprise", "monthly"],
    [Deno.env.get("PADDLE_ENTERPRISE_ANNUAL_PRICE_ID"), "enterprise", "yearly"],
  ];
  const map = new Map<string, { plan: PlanName; cycle: BillingCycle }>();
  for (const [id, plan, cycle] of pairs) {
    const key = id?.trim();
    if (key) map.set(key, { plan, cycle });
  }
  return map;
}

function minorTotal(tx: Record<string, unknown>): number {
  const totals = tx.totals as Record<string, unknown> | undefined;
  const grand = totals?.grand_total as Record<string, unknown> | undefined;
  const amount = grand?.amount ?? totals?.total ?? tx.amount;
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function currencyCode(tx: Record<string, unknown>): string {
  const totals = tx.totals as Record<string, unknown> | undefined;
  const grand = totals?.grand_total as Record<string, unknown> | undefined;
  const code = grand?.currency_code ?? totals?.currency_code ?? tx.currency_code;
  return typeof code === "string" && code.trim() ? code.trim().toUpperCase() : "EUR";
}

function inferPlanFromItems(
  tx: Record<string, unknown>,
  priceMap: Map<string, { plan: PlanName; cycle: BillingCycle }>,
): { plan: PlanName | null; cycle: BillingCycle } {
  const items = tx.items;
  if (!Array.isArray(items)) return { plan: null, cycle: "monthly" };
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const price = row.price as Record<string, unknown> | undefined;
    const priceId = String(price?.id ?? row.price_id ?? "").trim();
    const hit = priceMap.get(priceId);
    if (hit) return hit;
  }
  return { plan: null, cycle: "monthly" };
}

function billingDays(cycle: BillingCycle): number {
  return cycle === "yearly" ? 366 : 32;
}

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

  const secret = Deno.env.get("PADDLE_WEBHOOK_SECRET")?.trim();
  if (!secret) {
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("Paddle-Signature");
  const valid = await verifyPaddleSignature(rawBody, signature, secret);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const envelope = JSON.parse(rawBody) as {
    event_id?: string;
    event_type?: string;
    occurred_at?: string;
    data?: Record<string, unknown>;
  };

  const eventId = String(envelope.event_id ?? "").trim();
  const eventType = String(envelope.event_type ?? "").trim();
  const data = envelope.data ?? {};

  const moneyEvents = new Set([
    "transaction.completed",
    "transaction.paid",
    "transaction.payment_failed",
    "transaction.refunded",
    "adjustment.updated",
  ]);

  if (!moneyEvents.has(eventType)) {
    return new Response(JSON.stringify({ ok: true, skipped: eventType }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tx = (data.transaction as Record<string, unknown> | undefined) ?? data;
  const paddleTransactionId = String(tx.id ?? "").trim() || null;
  const paddleSubscriptionId =
    String(
      (tx.subscription_id as string | undefined) ??
        ((tx.subscription as Record<string, unknown> | undefined)?.id as string | undefined) ??
        "",
    ).trim() || null;

  const customer = (tx.customer as Record<string, unknown> | undefined) ?? {};
  const customerEmail =
    String(customer.email ?? (data.customer as Record<string, unknown> | undefined)?.email ?? "")
      .trim()
      .toLowerCase() || null;
  const customerName = String(customer.name ?? "").trim() || null;

  const customData =
    (tx.custom_data as Record<string, unknown> | undefined) ??
    (data.custom_data as Record<string, unknown> | undefined) ??
    {};
  const restaurantIdFromCustom = String(customData.restaurant_id ?? "").trim() || null;

  const priceMap = pricePlanMap();
  let { plan, cycle } = inferPlanFromItems(tx, priceMap);
  const customPlan = String(customData.plan ?? "").trim().toLowerCase();
  if (customPlan === "starter" || customPlan === "professional" || customPlan === "enterprise") {
    plan = customPlan;
  }
  const customCycle = String(customData.billing_cycle ?? "").trim().toLowerCase();
  if (customCycle === "monthly" || customCycle === "annual" || customCycle === "yearly") {
    cycle = customCycle === "annual" || customCycle === "yearly" ? "yearly" : "monthly";
  }

  let status: "paid" | "pending" | "failed" | "refunded" = "pending";
  if (eventType === "transaction.refunded" || eventType === "adjustment.updated") {
    status = "refunded";
  } else if (eventType === "transaction.payment_failed") {
    status = "failed";
  } else if (eventType === "transaction.completed" || eventType === "transaction.paid") {
    status = "paid";
  }

  const paidAt =
    status === "paid"
      ? String(tx.billed_at ?? envelope.occurred_at ?? new Date().toISOString())
      : null;

  const row = {
    paddle_event_id: eventId || `evt_${paddleTransactionId ?? Date.now()}`,
    paddle_transaction_id: paddleTransactionId,
    paddle_subscription_id: paddleSubscriptionId,
    restaurant_id: restaurantIdFromCustom,
    customer_email: customerEmail,
    customer_name: customerName,
    plan,
    billing_cycle: cycle,
    amount_minor: minorTotal(tx),
    currency: currencyCode(tx),
    status,
    paid_at: paidAt,
  };

  const { error: upsertErr } = await supabase
    .from("platform_billing_transactions")
    .upsert(row, { onConflict: "paddle_event_id" });

  if (upsertErr) {
    return new Response(JSON.stringify({ error: upsertErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (status === "paid") {
    let restaurantId = restaurantIdFromCustom;

    if (!restaurantId && customerEmail) {
      const { data: match } = await supabase
        .from("restaurants")
        .select("id")
        .ilike("owner_email", customerEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      restaurantId = match?.id ? String(match.id) : null;
    }

    if (restaurantId) {
      const { data: license } = await supabase
        .from("restaurants")
        .select("license_expiry, plan")
        .eq("id", restaurantId)
        .maybeSingle();

      if (license) {
        const base = new Date(
          Math.max(new Date(String(license.license_expiry)).getTime(), Date.now()),
        );
        base.setUTCDate(base.getUTCDate() + billingDays(cycle));

        await supabase
          .from("restaurants")
          .update({
            license_expiry: base.toISOString(),
            license_status: "active",
            ...(plan ? { plan } : {}),
            ...(paddleSubscriptionId ? { paddle_subscription_id: paddleSubscriptionId } : {}),
          })
          .eq("id", restaurantId);

        await supabase
          .from("platform_billing_transactions")
          .update({ restaurant_id: restaurantId })
          .eq("paddle_event_id", row.paddle_event_id);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
