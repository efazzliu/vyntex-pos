import type { User } from "@supabase/supabase-js";

/** True if auth user is treated as having a verified email (covers older JWT / API shapes). */
export function isAuthEmailVerified(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.email_confirmed_at) return true;
  const confirmedAt = (user as User & { confirmed_at?: string | null }).confirmed_at;
  return Boolean(confirmedAt);
}
