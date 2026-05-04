/**
 * Ambient types for Supabase Edge Functions (Deno at deploy/runtime).
 * The IDE uses normal TypeScript; Deno provides these globals when the function runs.
 */

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get(key: string): string | undefined;
  };
};

declare module "https://esm.sh/@supabase/supabase-js@2.49.1" {
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: {
      global?: { headers?: Record<string, string> };
    },
  ): {
    auth: {
      getUser: () => Promise<{
        data: { user: { email?: string | null } | null };
        error: { message?: string } | null;
      }>;
    };
  };
}
