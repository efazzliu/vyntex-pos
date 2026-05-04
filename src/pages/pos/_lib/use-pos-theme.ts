import { useState, useEffect, useCallback } from "react";

type PosTheme = "dark" | "light";

const STORAGE_KEY = "vyntex-pos-theme";

export function usePosTheme() {
  const [theme, setThemeState] = useState<PosTheme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      // localStorage unavailable
    }
    return "dark";
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const setTheme = useCallback((t: PosTheme) => {
    setThemeState(t);
  }, []);

  return { theme, toggle, setTheme };
}
