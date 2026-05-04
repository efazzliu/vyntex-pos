import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.ts";
import {
  dashboardUrlWithTrial,
  registerUrlWithFreeTrial,
} from "@/lib/free-trial.ts";

async function marketingHrefForSession(session: Session | null): Promise<string> {
  if (!session?.user?.id) return registerUrlWithFreeTrial();

  const { data } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_user_id", session.user.id)
    .limit(1)
    .maybeSingle();

  if (data?.id) return dashboardUrlWithTrial("licenses");
  return dashboardUrlWithTrial("get-started");
}

/**
 * Public marketing CTAs: signed-out → register with `trial=1m`;
 * signed-in → finish setup (no venue yet) or Licenses (trial reminder) with the same query.
 */
export function useMarketingPrimaryCtaHref(): string {
  const [href, setHref] = useState(registerUrlWithFreeTrial());

  useEffect(() => {
    let cancelled = false;

    const apply = async (session: Session | null) => {
      const next = await marketingHrefForSession(session);
      if (!cancelled) setHref(next);
    };

    void supabase.auth.getSession().then(({ data: { session } }) => void apply(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void apply(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return href;
}
