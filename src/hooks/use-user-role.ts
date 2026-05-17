import { usePlatformAdmin } from "@/hooks/use-platform-admin.ts";

/** Site dashboard: platform admin flag from env + Supabase session (not Convex). */
export function useUserRole() {
  const { session, profile, isPlatformAdmin, platformAdminRole, loading } = usePlatformAdmin();
  const u = session?.user;

  return {
    user: u
      ? {
          _id: u.id,
          name: profile.name,
          email: profile.email,
          role: isPlatformAdmin ? ("admin" as const) : ("user" as const),
        }
      : undefined,
    isAdmin: isPlatformAdmin,
    adminAccess: platformAdminRole,
    isFullAdmin: platformAdminRole === "full",
    isLimitedAdmin: platformAdminRole !== null && platformAdminRole !== "full",
    isUser: Boolean(u) && !isPlatformAdmin,
    loading,
  };
}
