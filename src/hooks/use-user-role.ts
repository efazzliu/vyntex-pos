import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

export function useUserRole() {
  const user = useQuery(api.users.getCurrentUser);

  return {
    user,
    isAdmin: user?.role === "admin",
    isUser: user?.role === "user",
  };
}
