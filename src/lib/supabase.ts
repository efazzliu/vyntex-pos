import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * False when the desktop .exe was built without Supabase env vars — the app must
 * still load so users see the activation screen and a clear message (not a white screen).
 */
export const isSupabaseConfigured =
  typeof rawUrl === "string" &&
  rawUrl.trim().length > 0 &&
  typeof rawKey === "string" &&
  rawKey.trim().length > 0;

/** Placeholder client only used when env is missing; never call remote APIs meaningfully. */
const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.eyJpc1BsYWNlaG9sZGVyIjp0cnVlfQ.signature";

const supabaseUrl = isSupabaseConfigured ? rawUrl.trim() : PLACEHOLDER_URL;
const supabaseAnonKey = isSupabaseConfigured ? rawKey.trim() : PLACEHOLDER_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
