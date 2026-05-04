import { ConvexProvider } from "./convex.tsx";
import { QueryClientProvider } from "./query-client.tsx";
import { SiteLocaleProvider } from "./site-locale-provider.tsx";
import { SupabaseProvider } from "./supabase.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseProvider>
      <ConvexProvider>
        <QueryClientProvider>
          <SiteLocaleProvider>
            <TooltipProvider>
              <ThemeProvider>
                {children}
                <Toaster richColors position="top-right" />
              </ThemeProvider>
            </TooltipProvider>
          </SiteLocaleProvider>
        </QueryClientProvider>
      </ConvexProvider>
    </SupabaseProvider>
  );
}
