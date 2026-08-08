import {
  ThemeProvider as NextThemeProvider,
  type ThemeProviderProps,
} from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="vyntex-theme"
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemeProvider>
  );
}
