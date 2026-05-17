import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase.ts";
import { fetchPhoneManagerRestaurantId } from "@/lib/supabase-pos/phone-manager-session.ts";

const RESTAURANT_ID_KEY = "vyntex.dashboard.restaurantId";

export type DashboardRestaurant = {
  id: string;
  name: string;
  type: string;
  address?: string | null;
  phone?: string | null;
  currency: string;
  plan: string;
  licenseKey: string;
  licenseExpiry: string;
  licenseStatus: string;
  deviceId?: string | null;
};

type UseDashboardRestaurantResult = {
  restaurant: DashboardRestaurant | null | undefined;
  refresh: () => Promise<void>;
};

function mapRow(row: {
  id: string;
  name: string;
  type: string;
  address: string | null;
  phone: string | null;
  currency: string;
  plan: string;
  license_key: string;
  license_expiry: string;
  license_status: string;
  device_id: string | null;
}): DashboardRestaurant {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    address: row.address,
    phone: row.phone,
    currency: row.currency,
    plan: row.plan,
    licenseKey: row.license_key,
    licenseExpiry: row.license_expiry,
    licenseStatus: row.license_status,
    deviceId: row.device_id,
  };
}

export function setDashboardRestaurantId(restaurantId: string) {
  localStorage.setItem(RESTAURANT_ID_KEY, restaurantId);
}

export function clearDashboardRestaurantId() {
  localStorage.removeItem(RESTAURANT_ID_KEY);
}

export function useDashboardRestaurant(): UseDashboardRestaurantResult {
  const [restaurant, setRestaurant] = useState<DashboardRestaurant | null | undefined>(
    undefined
  );

  const refresh = useCallback(async () => {
    let restaurantId = localStorage.getItem(RESTAURANT_ID_KEY);
    if (!restaurantId) {
      const fromManager = await fetchPhoneManagerRestaurantId();
      if (fromManager) {
        restaurantId = fromManager;
        localStorage.setItem(RESTAURANT_ID_KEY, restaurantId);
      }
    }
    if (!restaurantId) {
      setRestaurant(null);
      return;
    }

    const { data, error } = await supabase
      .from("restaurants")
      .select(
        "id, name, type, address, phone, currency, plan, license_key, license_expiry, license_status, device_id"
      )
      .eq("id", restaurantId)
      .maybeSingle();

    if (error || !data) {
      setRestaurant(null);
      return;
    }

    setRestaurant(mapRow(data));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { restaurant, refresh };
}
