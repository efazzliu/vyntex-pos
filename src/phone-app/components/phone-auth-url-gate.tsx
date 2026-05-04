import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase.ts";

/**
 * HashRouter + PKCE/magic-link: Supabase redirects to `phone.html?code=...` without a hash.
 * If we rendered routes immediately, `/` would send the user to `/login` before `getSession()`
 * finishes exchanging the code. This gate waits for URL recovery, then optionally navigates
 * to the path stored by the redeem page before `signInWithOtp`.
 */
function hasPendingAuthUrl(): boolean {
  if (typeof window === "undefined") return false;
  const search = window.location.search;
  const hash = window.location.hash;
  return (
    /[?&]code=/.test(search) ||
    /[?&]error(?:_description)?=/i.test(search) ||
    /access_token=/.test(hash)
  );
}

function routeFromIncomingUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    let path = (u.pathname || "/").startsWith("/") ? u.pathname : `/${u.pathname}`;
    if (u.host === "auth" && path === "/callback") {
      path = "/auth/callback";
    }
    if (/[?&]code=/.test(u.search) || /[?&]error(?:_description)?=/i.test(u.search)) {
      return `${path}${u.search}`;
    }
    if (/access_token=/.test(u.hash)) {
      return `${path}${u.hash}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function PhoneAuthUrlGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const [ready, setReady] = useState(() => !hasPendingAuthUrl());

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = App.addListener("appUrlOpen", ({ url }) => {
      const nextRoute = routeFromIncomingUrl(url);
      if (!nextRoute) return;
      window.location.hash = `#${nextRoute}`;
    });
    return () => {
      void sub.then((s) => s.remove());
    };
  }, []);

  useEffect(() => {
    const pendingAuth = hasPendingAuthUrl();
    if (!pendingAuth) {
      setReady(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      await supabase.auth.getSession();
      if (cancelled) return;
      const next = sessionStorage.getItem("vyntex_post_auth_hash");
      if (next) {
        sessionStorage.removeItem("vyntex_post_auth_hash");
        const path = next.startsWith("/") ? next : `/${next}`;
        navigate(path, { replace: true });
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-white px-4">
        <p className="text-sm text-slate-600">{t("phone.redeem.finishingSignIn")}</p>
      </div>
    );
  }

  return <>{children}</>;
}
