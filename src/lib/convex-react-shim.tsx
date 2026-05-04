import type { ReactNode } from "react";

export function ConvexProvider({ children }: { client?: unknown; children: ReactNode }) {
  return <>{children}</>;
}

export function ConvexProviderWithAuth({
  children,
}: {
  client?: unknown;
  useAuth?: unknown;
  children: ReactNode;
}) {
  return <>{children}</>;
}

export function ConvexProviderWithHerculesAuth({
  children,
}: {
  client?: unknown;
  children: ReactNode;
}) {
  return <>{children}</>;
}

export function Authenticated({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function Unauthenticated(_: { children: ReactNode }) {
  return null;
}

export function AuthLoading(_: { children: ReactNode }) {
  return null;
}

export function useConvexAuth() {
  return { isLoading: false, isAuthenticated: true };
}

export function useQuery(..._args: unknown[]) {
  return undefined;
}

export function useMutation(..._args: unknown[]) {
  return async (..._mutationArgs: unknown[]) => null;
}
