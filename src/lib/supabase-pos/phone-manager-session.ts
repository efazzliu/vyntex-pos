import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase.ts";

const DASHBOARD_RESTAURANT_ID_KEY = "vyntex.dashboard.restaurantId";

/** True when this account has a row in phone_app_managers (not user_metadata). */
export async function isPhoneManagerSession(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("phone_app_managers")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .limit(1);

  if (error) {
    console.warn("[isPhoneManagerSession]", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/** Venue id for a linked phone manager (localStorage first, then DB). */
export async function fetchPhoneManagerRestaurantId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const stored = localStorage.getItem(DASHBOARD_RESTAURANT_ID_KEY)?.trim();
  if (stored) {
    const { data: row } = await supabase
      .from("phone_app_managers")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .eq("restaurant_id", stored)
      .maybeSingle();
    if (row?.restaurant_id) return String(row.restaurant_id);
  }

  const { data: rows, error } = await supabase
    .from("phone_app_managers")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.warn("[fetchPhoneManagerRestaurantId]", error.message);
    return null;
  }
  const id = rows?.[0]?.restaurant_id;
  return id ? String(id) : null;
}

/** `null` while loading, then whether the session is a linked phone manager. */
export function usePhoneManagerSession(): boolean | null {
  const [isManager, setIsManager] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isPhoneManagerSession().then((value) => {
      if (!cancelled) setIsManager(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return isManager;
}
