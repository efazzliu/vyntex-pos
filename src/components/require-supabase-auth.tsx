import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";

/**
 * Renders child routes only when a Supabase session exists (email/password or other providers).
 */
export function RequireSupabaseAuth() {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "authed" | "anon">("loading");

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setState(session?.user ? "authed" : "anon");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState(session?.user ? "authed" : "anon");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (state === "anon") {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  return <Outlet />;
}
