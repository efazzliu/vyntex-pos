import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import type { OwnedRestaurantRow } from "@/lib/supabase-pos/phone-pos-session.ts";
import { useDashboardLocale } from "./dashboard-locale-context.tsx";
import { loadOwnedVenues, mapAdminVenue } from "../_lib/admin-center-data.ts";
import type { AdminVenue, DatePreset } from "../_lib/admin-center-types.ts";

type RenewTarget = {
  venueId: string;
  venueName: string;
  plan: string;
  expiry: string | null;
} | null;

type AdminCenterContextValue = {
  venues: AdminVenue[];
  venuesLoading: boolean;
  venueFilterId: string | "all";
  setVenueFilterId: (id: string | "all") => void;
  datePreset: DatePreset;
  setDatePreset: (preset: DatePreset) => void;
  customRange: { from: Date; to: Date } | undefined;
  setCustomRange: (range: { from: Date; to: Date } | undefined) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  renewTarget: RenewTarget;
  openRenew: (target: NonNullable<RenewTarget>) => void;
  closeRenew: () => void;
  refreshVenues: () => Promise<unknown>;
  rawVenues: OwnedRestaurantRow[];
};

const AdminCenterContext = createContext<AdminCenterContextValue | null>(null);

export function AdminCenterProvider({ children }: { children: ReactNode }) {
  const { lang } = useDashboardLocale();
  const [venueFilterId, setVenueFilterId] = useState<string | "all">("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | undefined>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [renewTarget, setRenewTarget] = useState<RenewTarget>(null);

  const venuesQuery = useQuery({
    queryKey: ["admin-center", "venues"],
    queryFn: loadOwnedVenues,
    staleTime: 30_000,
  });

  const rawVenues = venuesQuery.data ?? [];
  const venues = useMemo(
    () => rawVenues.map((row) => mapAdminVenue(row, lang)),
    [rawVenues, lang],
  );

  const openRenew = useCallback((target: NonNullable<RenewTarget>) => {
    setRenewTarget(target);
  }, []);
  const closeRenew = useCallback(() => setRenewTarget(null), []);

  const value = useMemo<AdminCenterContextValue>(
    () => ({
      venues,
      venuesLoading: venuesQuery.isLoading,
      venueFilterId,
      setVenueFilterId,
      datePreset,
      setDatePreset,
      customRange,
      setCustomRange,
      searchOpen,
      setSearchOpen,
      renewTarget,
      openRenew,
      closeRenew,
      refreshVenues: venuesQuery.refetch,
      rawVenues,
    }),
    [
      venues,
      venuesQuery.isLoading,
      venuesQuery.refetch,
      venueFilterId,
      datePreset,
      customRange,
      searchOpen,
      renewTarget,
      openRenew,
      closeRenew,
      rawVenues,
    ],
  );

  return <AdminCenterContext.Provider value={value}>{children}</AdminCenterContext.Provider>;
}

export function useAdminCenter(): AdminCenterContextValue {
  const ctx = useContext(AdminCenterContext);
  if (!ctx) throw new Error("useAdminCenter must be used within AdminCenterProvider");
  return ctx;
}
