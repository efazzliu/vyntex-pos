import { useEffect, useState } from "react";
import { Navigate, Outlet, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";

type RedirectIfAuthedProps = {
  /** Default destination when a session already exists (e.g. phone app uses `/app`). */
  redirectTo?: string;
};

function safeNextPath(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

/**
 * For /login and /register: if already signed in, send user to the dashboard.
 */
export function RedirectIfAuthed({ redirectTo = "/dashboard" }: RedirectIfAuthedProps) {
  const [params] = useSearchParams();
  const destination = safeNextPath(params.get("next"), redirectTo);
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

  if (state === "authed") {
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}
