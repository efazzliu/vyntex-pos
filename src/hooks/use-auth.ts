import {
  useAuth as useHerculesAuth,
  useUser as useHerculesUser,
} from "@usehercules/auth/react";

const fallbackAuth = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null as Error | null,
  async signinRedirect() {
    return;
  },
  async removeUser() {
    return;
  },
};

export function useAuth() {
  try {
    const auth = useHerculesAuth();
    if (!auth) return fallbackAuth;
    return {
      ...fallbackAuth,
      ...auth,
      signinRedirect: auth.signinRedirect ?? fallbackAuth.signinRedirect,
      removeUser: auth.removeUser ?? fallbackAuth.removeUser,
    };
  } catch {
    return fallbackAuth;
  }
}

export function useUser() {
  try {
    const userState = useHerculesUser();
    if (!userState) return { user: null, isLoading: false };
    return {
      user: userState.user ?? null,
      isLoading: userState.isLoading ?? false,
    };
  } catch {
    return { user: null, isLoading: false };
  }
}
