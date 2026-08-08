import { windowsInstallerX64Href } from "@/lib/installer-download-urls.ts";
import { APP_VERSION_LABEL } from "@/lib/site-constants.ts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

export type ServiceStatusKey =
  | "pos"
  | "cloud"
  | "api"
  | "payments"
  | "downloads"
  | "authentication";

export type ServiceHealth = {
  key: ServiceStatusKey;
  name: string;
  operational: boolean;
  latencyMs: number | null;
};

export type StatusIncident = {
  id: string;
  service: string;
  title: string;
  details: string | null;
  status: "investigating" | "identified" | "monitoring" | "resolved" | "completed";
  startedAt: string;
  resolvedAt: string | null;
};

async function timedCheck(check: () => Promise<boolean>): Promise<{
  ok: boolean;
  latencyMs: number;
}> {
  const started = performance.now();
  try {
    const ok = await Promise.race([
      check(),
      new Promise<boolean>((resolve) =>
        window.setTimeout(() => resolve(false), 8_000),
      ),
    ]);
    return { ok, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - started) };
  }
}

async function checkUrl(
  url: string,
  init?: RequestInit,
  allowOpaque = false,
): Promise<boolean> {
  const response = await fetch(url, { cache: "no-store", ...init });
  return response.ok || (allowOpaque && response.type === "opaque");
}

/**
 * Probe PostgREST with the same public/publishable key the app uses.
 * Do not hit `/rest/v1/` root — with sb_publishable_* keys that endpoint
 * requires a secret key and falsely reports "Service disruption".
 */
async function checkSupabaseRestApi(
  supabaseUrl: string,
  supabaseKey: string,
): Promise<boolean> {
  if (!supabaseUrl || !supabaseKey) return false;
  const response = await fetch(
    `${supabaseUrl}/rest/v1/restaurants?select=id&limit=1`,
    {
      method: "HEAD",
      cache: "no-store",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
      },
    },
  );
  return response.ok;
}

export async function checkVyntexServices(): Promise<ServiceHealth[]> {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  const supabaseKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "");
  const installerUrl = windowsInstallerX64Href(APP_VERSION_LABEL);

  const checks: Array<{
    key: ServiceStatusKey;
    name: string;
    run: () => Promise<boolean>;
  }> = [
    {
      key: "pos",
      name: "Vyntex POS",
      run: () => checkUrl("/build-meta.json"),
    },
    {
      key: "cloud",
      name: "Cloud Sync",
      run: async () => {
        if (!isSupabaseConfigured) return false;
        const { error } = await supabase.from("restaurants").select("id").limit(1);
        return !error;
      },
    },
    {
      key: "api",
      name: "API",
      run: () =>
        isSupabaseConfigured
          ? checkSupabaseRestApi(supabaseUrl, supabaseKey)
          : Promise.resolve(false),
    },
    {
      key: "payments",
      name: "Payments",
      run: () =>
        checkUrl(
          "https://cdn.paddle.com/paddle/v2/paddle.js",
          { mode: "no-cors" },
          true,
        ),
    },
    {
      key: "downloads",
      name: "Downloads",
      run: () => checkUrl(installerUrl, { method: "HEAD" }),
    },
    {
      key: "authentication",
      name: "Authentication",
      run: async () => {
        if (!isSupabaseConfigured) return false;
        const { error } = await supabase.auth.getUser();
        return !error;
      },
    },
  ];

  return Promise.all(
    checks.map(async ({ key, name, run }) => {
      const result = await timedCheck(run);
      return {
        key,
        name,
        operational: result.ok,
        latencyMs: result.latencyMs,
      };
    }),
  );
}

export async function fetchStatusIncidents(): Promise<StatusIncident[]> {
  const { data, error } = await supabase
    .from("platform_status_incidents")
    .select("id, service, title, details, status, started_at, resolved_at")
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) {
    console.warn("[system-status] incident history unavailable", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    service: String(row.service),
    title: String(row.title),
    details: row.details == null ? null : String(row.details),
    status: row.status as StatusIncident["status"],
    startedAt: String(row.started_at),
    resolvedAt: row.resolved_at == null ? null : String(row.resolved_at),
  }));
}
