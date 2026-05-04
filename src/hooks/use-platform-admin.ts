import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.ts";
import { getPlatformAdminRole } from "@/lib/platform-admin.ts";

export function usePlatformAdmin() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const email = session?.user?.email ?? null;
  const meta = session?.user?.user_metadata as { full_name?: string } | undefined;
  const name =
    (meta?.full_name && String(meta.full_name).trim()) || email || "";

  const adminRole = getPlatformAdminRole(email);

  return {
    session,
    loading,
    isPlatformAdmin: adminRole !== null,
    platformAdminRole: adminRole,
    profile: { email: email ?? "", name },
  };
}
