import { createContext, useContext } from "react";
import { supabase } from "@/lib/supabase.ts";

type SupabaseContextValue = {
  supabase: typeof supabase;
};

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error("useSupabase must be used within SupabaseProvider.");
  }
  return ctx.supabase;
}
