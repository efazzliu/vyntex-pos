import type { CSSProperties } from "react";

export const PHONE_ACCESS_THEME_IDS = [
  "midnight",
  "pearl",
  "noir",
  "ocean",
  "ember",
] as const;

export type PhoneAccessTheme = (typeof PHONE_ACCESS_THEME_IDS)[number];

export type PhoneAccessThemeTokens = {
  id: PhoneAccessTheme;
  isLight: boolean;
  page: string;
  pageMid: string;
  pageDeep: string;
  fg: string;
  muted: string;
  soft: string;
  faint: string;
  card: string;
  border: string;
  glow: string;
  glow2: string;
  nav: string;
  sheet: string;
  loginTitle: string;
  loginSubtitle: string;
  loginHint: string;
  loginField: string;
};

const THEMES: Record<PhoneAccessTheme, PhoneAccessThemeTokens> = {
  midnight: {
    id: "midnight",
    isLight: false,
    page: "#070b14",
    pageMid: "#0a1224",
    pageDeep: "#05080f",
    fg: "#ffffff",
    muted: "rgba(255,255,255,0.42)",
    soft: "rgba(255,255,255,0.72)",
    faint: "rgba(255,255,255,0.3)",
    card: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.1)",
    glow: "rgba(0,102,255,0.28)",
    glow2: "rgba(68,204,0,0.12)",
    nav: "#0a1224",
    sheet: "#0d1326",
    loginTitle: "#FFFFFF",
    loginSubtitle: "#0066FF",
    loginHint: "#8B93A7",
    loginField: "#94A3B8",
  },
  pearl: {
    id: "pearl",
    isLight: true,
    page: "#f4f6fa",
    pageMid: "#ffffff",
    pageDeep: "#e8edf5",
    fg: "#0f172a",
    muted: "rgba(15,23,42,0.45)",
    soft: "rgba(15,23,42,0.7)",
    faint: "rgba(15,23,42,0.35)",
    card: "rgba(15,23,42,0.04)",
    border: "rgba(15,23,42,0.1)",
    glow: "rgba(0,102,255,0.14)",
    glow2: "rgba(0,102,255,0.05)",
    nav: "rgba(255,255,255,0.94)",
    sheet: "#ffffff",
    loginTitle: "#0F172A",
    loginSubtitle: "#0066FF",
    loginHint: "#64748B",
    loginField: "#475569",
  },
  noir: {
    id: "noir",
    isLight: false,
    page: "#070707",
    pageMid: "#111111",
    pageDeep: "#000000",
    fg: "#f7f1e8",
    muted: "rgba(247,241,232,0.42)",
    soft: "rgba(247,241,232,0.72)",
    faint: "rgba(247,241,232,0.32)",
    card: "rgba(212,175,55,0.08)",
    border: "rgba(212,175,55,0.18)",
    glow: "rgba(212,175,55,0.2)",
    glow2: "rgba(212,175,55,0.06)",
    nav: "#0e0e0e",
    sheet: "#141414",
    loginTitle: "#F7F1E8",
    loginSubtitle: "#D4AF37",
    loginHint: "#A89B84",
    loginField: "#C4B8A5",
  },
  ocean: {
    id: "ocean",
    isLight: false,
    page: "#04151c",
    pageMid: "#07232d",
    pageDeep: "#031016",
    fg: "#e7f7fb",
    muted: "rgba(231,247,251,0.42)",
    soft: "rgba(231,247,251,0.72)",
    faint: "rgba(231,247,251,0.32)",
    card: "rgba(34,211,238,0.08)",
    border: "rgba(103,232,249,0.16)",
    glow: "rgba(6,182,212,0.28)",
    glow2: "rgba(16,185,129,0.1)",
    nav: "#062028",
    sheet: "#0a2a35",
    loginTitle: "#E7F7FB",
    loginSubtitle: "#22D3EE",
    loginHint: "#7DD3E8",
    loginField: "#9EC9D4",
  },
  ember: {
    id: "ember",
    isLight: false,
    page: "#120e0c",
    pageMid: "#1c1510",
    pageDeep: "#0c0908",
    fg: "#faf3ea",
    muted: "rgba(250,243,234,0.42)",
    soft: "rgba(250,243,234,0.72)",
    faint: "rgba(250,243,234,0.32)",
    card: "rgba(245,158,11,0.09)",
    border: "rgba(245,158,11,0.16)",
    glow: "rgba(245,158,11,0.22)",
    glow2: "rgba(220,38,38,0.08)",
    nav: "#18120e",
    sheet: "#221a14",
    loginTitle: "#FAF3EA",
    loginSubtitle: "#F59E0B",
    loginHint: "#C4A574",
    loginField: "#D4B896",
  },
};

export function normalizePhoneAccessTheme(raw: unknown): PhoneAccessTheme {
  const s = String(raw ?? "");
  if (s === "light" || s === "pearl") return "pearl";
  if (s === "noir") return "noir";
  if (s === "ocean") return "ocean";
  if (s === "ember") return "ember";
  return "midnight";
}

export function phoneAccessThemeTokens(
  theme: PhoneAccessTheme | null | undefined,
): PhoneAccessThemeTokens {
  return THEMES[normalizePhoneAccessTheme(theme)];
}

export function waiterThemeStyle(tokens: PhoneAccessThemeTokens): CSSProperties {
  return {
    color: tokens.fg,
    backgroundColor: tokens.page,
    ["--waiter-fg" as string]: tokens.fg,
    ["--waiter-muted" as string]: tokens.muted,
    ["--waiter-soft" as string]: tokens.soft,
    ["--waiter-faint" as string]: tokens.faint,
    ["--waiter-card" as string]: tokens.card,
    ["--waiter-border" as string]: tokens.border,
    ["--waiter-page" as string]: tokens.page,
  };
}

export function waiterThemeGlow(tokens: PhoneAccessThemeTokens): string {
  return `radial-gradient(90% 50% at 20% 0%, ${tokens.glow} 0%, transparent 55%), radial-gradient(80% 50% at 90% 100%, ${tokens.glow2} 0%, transparent 50%), linear-gradient(180deg, ${tokens.pageMid} 0%, ${tokens.page} 55%, ${tokens.pageDeep} 100%)`;
}

/** Inactive pills/chips: dark text on light gray, not white-on-white. */
export function waiterIdleChipClass(isLight: boolean): string {
  return isLight
    ? "bg-slate-200 text-slate-800"
    : "bg-white/12 text-white/85";
}

export function waiterPageTextClass(isLight: boolean): string {
  return isLight ? "text-slate-900" : "text-white";
}

function loginMatchesPreset(
  b: {
    loginTitleColor: string;
    loginSubtitleColor: string;
    loginHintColor: string;
    loginFieldColor: string;
  },
  preset: PhoneAccessThemeTokens,
): boolean {
  return (
    b.loginTitleColor === preset.loginTitle &&
    b.loginSubtitleColor === preset.loginSubtitle &&
    b.loginHintColor === preset.loginHint &&
    b.loginFieldColor === preset.loginField
  );
}

export function brandingWithAccessTheme<
  T extends {
    theme: PhoneAccessTheme;
    loginTitleColor: string;
    loginSubtitleColor: string;
    loginHintColor: string;
    loginFieldColor: string;
  },
>(branding: T, theme: PhoneAccessTheme): T {
  const nextTokens = phoneAccessThemeTokens(theme);
  const currentPreset = Object.values(THEMES).some((preset) =>
    loginMatchesPreset(branding, preset),
  );
  const stillFactory =
    branding.loginTitleColor === "#FFFFFF" &&
    branding.loginSubtitleColor === "#0066FF" &&
    branding.loginHintColor === "#8B93A7" &&
    branding.loginFieldColor === "#94A3B8";
  if (!currentPreset && !stillFactory) {
    return { ...branding, theme };
  }
  return {
    ...branding,
    theme,
    loginTitleColor: nextTokens.loginTitle,
    loginSubtitleColor: nextTokens.loginSubtitle,
    loginHintColor: nextTokens.loginHint,
    loginFieldColor: nextTokens.loginField,
  };
}
