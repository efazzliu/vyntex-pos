import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Send,
  Star,
  Users,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { cn } from "@/lib/utils.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";
import {
  DEFAULT_PHONE_ACCESS_BRANDING,
  phoneAccessButtonTextColor,
  phoneAccessTableGridClass,
  type PhoneAccessBranding,
  type PhoneAccessTheme,
} from "@/lib/local-db.ts";
import {
  brandingWithAccessTheme,
  PHONE_ACCESS_THEME_IDS,
  phoneAccessThemeTokens,
  waiterThemeGlow,
  waiterThemeStyle,
} from "@/lib/phone-access-theme.ts";
import {
  persistPhoneAccessBranding,
  resolvePhoneAccessBranding,
  resolvePinLoginBranding,
} from "@/lib/supabase-pos/license-sync.ts";
import posI18n from "../_lib/pos-i18n.ts";

const ACCENT_PRESETS = [
  "#0066FF",
  "#44CC00",
  "#7C3AED",
  "#EC4899",
  "#F59E0B",
  "#06B6D4",
  "#DC2626",
  "#FFFFFF",
  "#0F172A",
] as const;

type AccessScreen = "login" | "dashboard" | "tables" | "menu" | "orders";
type LoginTextId = "title" | "subtitle" | "hint" | "fields" | "button";

type PhoneAccessDesignSectionProps = {
  licenseKey: string;
  canEdit?: boolean;
  venueName?: string;
};

const SCREENS: { id: AccessScreen; titleKey: string }[] = [
  { id: "login", titleKey: "settings.phone_access_screen_login" },
  { id: "dashboard", titleKey: "settings.phone_access_screen_dashboard" },
  { id: "tables", titleKey: "settings.phone_access_screen_tables" },
  { id: "menu", titleKey: "settings.phone_access_screen_menu" },
  { id: "orders", titleKey: "settings.phone_access_screen_orders" },
];

const LOGIN_TEXTS: { id: LoginTextId; titleKey: string }[] = [
  { id: "title", titleKey: "settings.phone_access_text_title" },
  { id: "subtitle", titleKey: "settings.phone_access_text_subtitle" },
  { id: "hint", titleKey: "settings.phone_access_text_hint" },
  { id: "fields", titleKey: "settings.phone_access_text_fields" },
  { id: "button", titleKey: "settings.phone_access_text_button" },
];

function loginTextColor(b: PhoneAccessBranding, id: LoginTextId): string {
  if (id === "title") return b.loginTitleColor;
  if (id === "subtitle") return b.loginSubtitleColor;
  if (id === "hint") return b.loginHintColor;
  if (id === "fields") return b.loginFieldColor;
  return b.signInColor;
}

function withLoginTextColor(
  b: PhoneAccessBranding,
  id: LoginTextId,
  color: string,
): PhoneAccessBranding {
  if (id === "title") return { ...b, loginTitleColor: color };
  if (id === "subtitle") return { ...b, loginSubtitleColor: color };
  if (id === "hint") return { ...b, loginHintColor: color };
  if (id === "fields") return { ...b, loginFieldColor: color };
  return { ...b, signInColor: color };
}

async function resizeImageFileToJpegDataUrl(file: File): Promise<string> {
  const maxBytes = 2 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error("too_large");

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image"));
    el.src = dataUrl;
  });

  const maxDim = 512;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.88);
}

function ColorDots({
  value,
  disabled,
  onPick,
  onCustom,
}: {
  value: string;
  disabled: boolean;
  onPick: (color: string) => void;
  onCustom: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ACCENT_PRESETS.map((color) => (
        <button
          key={color}
          type="button"
          disabled={disabled}
          aria-label={color}
          onClick={() => onPick(color)}
          className={cn(
            "size-8 rounded-full border-2 cursor-pointer",
            value.toUpperCase() === color ? "border-white scale-110" : "border-transparent",
            color === "#FFFFFF" && "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]",
          )}
          style={{ backgroundColor: color }}
        />
      ))}
      <label className="relative size-8 overflow-hidden rounded-full border border-[#2a3a5a] cursor-pointer">
        <input
          type="color"
          disabled={disabled}
          value={value}
          onChange={(e) => onCustom(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
        <span className="block size-full" style={{ backgroundColor: value }} />
      </label>
    </div>
  );
}

function PhoneFrame({
  children,
  className,
  style,
  waiterTheme = "dark",
  waiterSkin = "midnight",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  waiterTheme?: "light" | "dark";
  waiterSkin?: PhoneAccessTheme;
}) {
  const light = waiterTheme === "light";
  return (
    <div
      data-phone-preview=""
      data-waiter-theme={waiterTheme}
      data-waiter-skin={waiterSkin}
      className={cn(
        "relative mx-auto flex h-[520px] w-[260px] flex-col overflow-hidden rounded-[2rem] border-[6px] border-[#1a2233] shadow-[0_18px_40px_-20px_rgba(0,0,0,0.55)]",
        className,
      )}
      style={{ color: light ? "#0f172a" : "#ffffff", ...style }}
    >
      <div className="mx-auto mt-2 h-4 w-20 shrink-0 rounded-full bg-black/40" />
      {children}
    </div>
  );
}

const PREVIEW_GLASS: CSSProperties = {
  border: "1px solid var(--waiter-border)",
  background: "var(--waiter-card)",
};
const PREVIEW_MUTED: CSSProperties = { color: "var(--waiter-muted)" };
const PREVIEW_SOFT: CSSProperties = { color: "var(--waiter-soft)" };
const PREVIEW_FG: CSSProperties = { color: "var(--waiter-fg)" };

function WaiterPreviewShell({
  children,
  glow,
  theme = "midnight",
}: {
  children: ReactNode;
  glow?: string;
  theme?: PhoneAccessTheme;
}) {
  const tokens = phoneAccessThemeTokens(theme);
  const overlay = glow ?? tokens.glow;
  return (
    <PhoneFrame
      waiterTheme={tokens.isLight ? "light" : "dark"}
      waiterSkin={tokens.id}
      style={waiterThemeStyle(tokens)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(90% 50% at 20% 0%, ${overlay} 0%, transparent 55%), radial-gradient(80% 50% at 90% 100%, ${tokens.glow2} 0%, transparent 50%), linear-gradient(180deg, ${tokens.pageMid} 0%, ${tokens.page} 58%, ${tokens.pageDeep} 100%)`,
        }}
      />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
    </PhoneFrame>
  );
}

function PreviewNav({
  active,
  accent,
  t,
  branding,
}: {
  active: "tables" | "menu" | "orders";
  accent: string;
  t: (key: string) => string;
  branding: PhoneAccessBranding;
}) {
  const items = [
    {
      id: "tables" as const,
      icon: LayoutGrid,
      labelKey: "settings.phone_access_preview_nav_tables",
      show: branding.showNavTables,
    },
    {
      id: "menu" as const,
      icon: UtensilsCrossed,
      labelKey: "settings.phone_access_preview_nav_menu",
      show: branding.showNavMenu,
    },
    {
      id: "orders" as const,
      icon: ClipboardList,
      labelKey: "settings.phone_access_preview_nav_orders",
      show: branding.showNavOrders,
    },
    {
      id: "alerts" as const,
      icon: Bell,
      labelKey: "settings.phone_access_preview_nav_alerts",
      show: branding.showNavAlerts,
    },
  ].filter((item) => item.show);
  if (items.length === 0) return null;
  return (
    <div
      className="mt-auto flex px-1 py-1.5"
      style={{
        borderTop: "1px solid var(--waiter-border)",
        background: "color-mix(in srgb, var(--waiter-page, #0a1224) 95%, transparent)",
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const on = item.id === active;
        return (
          <div
            key={item.id}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1"
            style={on ? { backgroundColor: `${accent}26` } : undefined}
          >
            <Icon
              className="size-3.5"
              style={{ color: on ? accent : "var(--waiter-muted)" }}
              strokeWidth={on ? 2.25 : 1.75}
            />
            <span
              className="text-[8px] font-semibold"
              style={{ color: on ? accent : "var(--waiter-muted)" }}
            >
              {t(item.labelKey)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TableScreenPreview({
  branding,
  t,
}: {
  branding: PhoneAccessBranding;
  t: (key: string) => string;
}) {
  const cats = [
    { label: t("settings.phone_access_preview_fav"), hot: true },
    { label: t("settings.phone_access_preview_dish_1"), hot: false },
    { label: t("settings.phone_access_preview_dish_2"), hot: false },
    { label: t("settings.phone_access_preview_dish_3"), hot: false },
  ];
  const dishes = [
    t("settings.phone_access_preview_dish_1"),
    t("settings.phone_access_preview_dish_2"),
    t("settings.phone_access_preview_dish_3"),
  ];
  const design = branding.tableDesign;

  if (design === "modern") {
    return (
      <WaiterPreviewShell theme={branding.theme} glow="rgba(99,102,241,0.28)">
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
          <div className="mb-2 flex items-center gap-2">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--waiter-card)" }}
            >
              <ArrowLeft className="size-3" style={PREVIEW_SOFT} />
            </span>
            <p className="min-w-0 flex-1 truncate text-[15px] font-semibold" style={PREVIEW_FG}>
              T1
            </p>
            <span
              className="rounded-full px-2 py-0.5 text-[8px] font-semibold"
              style={{ background: `${branding.accentColor}33`, color: branding.accentColor }}
            >
              {t("settings.phone_access_preview_zone")}
            </span>
          </div>
          <div className="mb-2 flex gap-1 overflow-hidden">
            {cats.map((cat) => (
              <span
                key={cat.label}
                className="shrink-0 rounded-full px-2 py-1 text-[8px] font-semibold"
                style={
                  cat.hot
                    ? { background: branding.accentColor, color: "#ffffff" }
                    : { background: "var(--waiter-card)", color: "var(--waiter-muted)" }
                }
              >
                {cat.label}
              </span>
            ))}
          </div>
          <div
            className="relative mb-2 h-7 rounded-full pl-6 pr-2 text-[9px] leading-7"
            style={{ background: "var(--waiter-card)", color: "var(--waiter-faint)" }}
          >
            <Search
              className="absolute left-2 top-1/2 size-2.5 -translate-y-1/2"
              style={{ color: "var(--waiter-faint)" }}
            />
            {t("settings.phone_access_preview_search")}
          </div>
          <div className="space-y-1.5">
            {dishes.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-2xl px-2.5 py-2"
                style={{ background: "var(--waiter-card)" }}
              >
                <span className="text-[11px] font-medium" style={PREVIEW_FG}>
                  {name}
                </span>
                <span
                  className="flex size-5 items-center justify-center rounded-full"
                  style={{ background: branding.accentColor, color: "#ffffff" }}
                >
                  <Plus className="size-3" />
                </span>
              </div>
            ))}
          </div>
          <div
            className="mt-auto mb-2 flex h-8 items-center justify-center gap-1.5 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: branding.signInColor, color: "#ffffff" }}
          >
            <Send className="size-3" />
            {t("settings.phone_access_preview_send")}
          </div>
        </div>
      </WaiterPreviewShell>
    );
  }

  if (design === "advanced") {
    return (
      <WaiterPreviewShell theme={branding.theme} glow="rgba(212,175,55,0.18)">
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
          <div className="mb-2 flex items-center gap-2">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
              style={{
                background: `linear-gradient(145deg, ${branding.accentColor}, #d4af37)`,
                color: "#0a0a0a",
              }}
            >
              T1
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[8px]" style={PREVIEW_MUTED}>
                {t("settings.phone_access_preview_zone")}
              </p>
              <p className="text-[12px] font-semibold" style={PREVIEW_FG}>
                #42
              </p>
            </div>
            <span className="flex size-7 items-center justify-center" style={PREVIEW_SOFT}>
              <ArrowLeft className="size-3.5" />
            </span>
          </div>
          <div className="mb-2 flex gap-3">
            {cats.map((cat) => (
              <span
                key={cat.label}
                className="pb-1 text-[9px] font-medium"
                style={{
                    color: cat.hot ? "var(--waiter-fg)" : "var(--waiter-muted)",
                  borderBottom: cat.hot
                    ? `2px solid ${branding.accentColor}`
                    : "2px solid transparent",
                }}
              >
                {cat.label}
              </span>
            ))}
          </div>
          <div
            className="relative mb-2 h-7 rounded-lg pl-6 pr-2 text-[9px] leading-7"
            style={{ ...PREVIEW_GLASS, color: "var(--waiter-faint)" }}
          >
            <Search
              className="absolute left-2 top-1/2 size-2.5 -translate-y-1/2"
              style={{ color: "var(--waiter-faint)" }}
            />
            {t("settings.phone_access_preview_search")}
          </div>
          <div className="space-y-1">
            {dishes.map((name, i) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                style={{
                  background: "var(--waiter-card)",
                  boxShadow: "inset 0 0 0 1px var(--waiter-border)",
                }}
              >
                <span
                  className="h-6 w-1 shrink-0 rounded-full"
                  style={{ background: i === 1 ? "#a78bfa" : "#fb923c" }}
                />
                <span className="min-w-0 flex-1 text-[10px] font-semibold" style={PREVIEW_FG}>
                  {name}
                </span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                  style={{ background: `${branding.accentColor}33`, color: branding.accentColor }}
                >
                  +
                </span>
              </div>
            ))}
          </div>
          <div
            className="mt-auto mb-2 flex h-8 items-center justify-between rounded-xl px-3 text-[11px] font-semibold"
            style={{ backgroundColor: branding.signInColor, color: "#ffffff" }}
          >
            <span className="flex items-center gap-1.5">
              <Send className="size-3" />
              {t("settings.phone_access_preview_send")}
            </span>
            <span>2</span>
          </div>
        </div>
      </WaiterPreviewShell>
    );
  }

  return (
        <WaiterPreviewShell theme={branding.theme} glow="rgba(0,102,255,0.22)">
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-xl"
            style={PREVIEW_GLASS}
          >
            <ArrowLeft className="size-3.5" style={PREVIEW_SOFT} />
          </span>
          <div className="min-w-0">
            <p
              className="text-[8px] font-semibold uppercase tracking-[0.12em]"
              style={PREVIEW_MUTED}
            >
              {t("settings.phone_access_preview_zone")}
            </p>
            <p className="truncate text-[14px] font-semibold" style={PREVIEW_FG}>
              T1
              <span className="ml-1.5 text-[11px] font-medium" style={{ color: "#7eb6ff" }}>
                #42
              </span>
            </p>
          </div>
        </div>
        <div className="mb-2 grid grid-cols-4 gap-1.5">
          {cats.map((cat) => (
            <div
              key={cat.label}
              className="flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center"
              style={
                cat.hot
                  ? { background: "#f59e0b", color: "#ffffff" }
                  : { ...PREVIEW_GLASS, color: "var(--waiter-muted)" }
              }
            >
              {cat.hot ? (
                <Star className="size-3" />
              ) : (
                <UtensilsCrossed className="size-3" />
              )}
              <span className="w-full truncate text-[8px] font-medium leading-tight">
                {cat.label}
              </span>
            </div>
          ))}
        </div>
        <div
          className="relative mb-2 h-8 rounded-xl pl-7 pr-2 text-[10px] leading-8"
          style={{ ...PREVIEW_GLASS, color: "var(--waiter-faint)" }}
        >
          <Search
            className="absolute left-2 top-1/2 size-3 -translate-y-1/2"
            style={{ color: "var(--waiter-faint)" }}
          />
          {t("settings.phone_access_preview_search")}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {dishes.map((name) => (
            <div
              key={name}
              className="flex flex-col items-start gap-1 rounded-xl px-2 py-2"
              style={PREVIEW_GLASS}
            >
              <span className="text-[10px] font-semibold" style={PREVIEW_FG}>
                {name}
              </span>
              <span
                className="flex size-5 items-center justify-center rounded-md self-end"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <Plus className="size-3" style={PREVIEW_SOFT} />
              </span>
            </div>
          ))}
        </div>
        <div
          className="mt-auto mb-2 flex h-9 items-center justify-center gap-1.5 rounded-2xl text-[11px] font-semibold"
          style={{ backgroundColor: branding.signInColor, color: "#ffffff" }}
        >
          <Send className="size-3" />
          {t("settings.phone_access_preview_send")}
        </div>
      </div>
    </WaiterPreviewShell>
  );
}

function MenuScreenPreview({
  branding,
  t,
}: {
  branding: PhoneAccessBranding;
  t: (key: string) => string;
}) {
  const cats = [
    { label: t("settings.phone_access_preview_all"), on: true },
    { label: t("settings.phone_access_preview_dish_1"), on: false },
    { label: t("settings.phone_access_preview_dish_2"), on: false },
  ];
  const dishes = [
    t("settings.phone_access_preview_dish_1"),
    t("settings.phone_access_preview_dish_2"),
    t("settings.phone_access_preview_dish_3"),
  ];
  const qr = branding.showMenuQr;
  const design = branding.menuDesign;

  const qrBtn = qr ? (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        design === "modern" ? "size-7 rounded-full" : "size-8 rounded-xl",
      )}
      style={PREVIEW_GLASS}
    >
      <QrCode className="size-3.5" style={PREVIEW_SOFT} />
    </span>
  ) : null;

  if (design === "modern") {
    return (
      <WaiterPreviewShell theme={branding.theme} glow="rgba(99,102,241,0.28)">
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
          <div className="mb-2 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[15px] font-semibold" style={PREVIEW_FG}>
              {t("settings.phone_access_preview_menu_title")}
            </p>
            {qrBtn}
          </div>
          <div className="mb-2 flex gap-1 overflow-hidden">
            {cats.map((cat) => (
              <span
                key={cat.label}
                className="shrink-0 rounded-full px-2 py-1 text-[8px] font-semibold"
                style={
                  cat.on
                    ? { background: branding.accentColor, color: "#ffffff" }
                    : { background: "var(--waiter-card)", color: "var(--waiter-muted)" }
                }
              >
                {cat.label}
              </span>
            ))}
          </div>
          <div
            className="relative mb-2 h-7 rounded-full pl-6 pr-2 text-[9px] leading-7"
            style={{ background: "var(--waiter-card)", color: "var(--waiter-faint)" }}
          >
            <Search
              className="absolute left-2 top-1/2 size-2.5 -translate-y-1/2"
              style={{ color: "var(--waiter-faint)" }}
            />
            {t("settings.phone_access_preview_search")}
          </div>
          <div className="space-y-1.5">
            {dishes.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-2xl px-2.5 py-2"
                style={{ background: "var(--waiter-card)" }}
              >
                <span className="text-[11px] font-medium" style={PREVIEW_FG}>
                  {name}
                </span>
                <span className="text-[10px] font-semibold" style={{ color: "#7eb6ff" }}>
                  8.50
                </span>
              </div>
            ))}
          </div>
          <PreviewNav
            active="menu"
            accent={branding.accentColor}
            t={t}
            branding={branding}
          />
        </div>
      </WaiterPreviewShell>
    );
  }

  if (design === "advanced") {
    return (
      <WaiterPreviewShell theme={branding.theme} glow="rgba(212,175,55,0.18)">
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
          <div className="mb-2 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p
                className="text-[8px] font-semibold uppercase tracking-[0.14em]"
                style={PREVIEW_MUTED}
              >
                {t("settings.phone_access_preview_on_shift")}
              </p>
              <p className="text-[12px] font-semibold" style={PREVIEW_FG}>
                {t("settings.phone_access_preview_menu_title")}
              </p>
            </div>
            {qrBtn}
          </div>
          <div className="mb-2 flex gap-3">
            {cats.map((cat) => (
              <span
                key={cat.label}
                className="pb-1 text-[9px] font-medium"
                style={{
                  color: cat.on ? "var(--waiter-fg)" : "var(--waiter-muted)",
                  borderBottom: cat.on
                    ? `2px solid ${branding.accentColor}`
                    : "2px solid transparent",
                }}
              >
                {cat.label}
              </span>
            ))}
          </div>
          <div
            className="relative mb-2 h-7 rounded-lg pl-6 pr-2 text-[9px] leading-7"
            style={{ ...PREVIEW_GLASS, color: "var(--waiter-faint)" }}
          >
            <Search
              className="absolute left-2 top-1/2 size-2.5 -translate-y-1/2"
              style={{ color: "var(--waiter-faint)" }}
            />
            {t("settings.phone_access_preview_search")}
          </div>
          <div className="space-y-1">
            {dishes.map((name, i) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                style={{
                  background: "var(--waiter-card)",
                  boxShadow: "inset 0 0 0 1px var(--waiter-border)",
                }}
              >
                <span
                  className="h-6 w-1 shrink-0 rounded-full"
                  style={{ background: i === 1 ? "#a78bfa" : "#fb923c" }}
                />
                <span className="min-w-0 flex-1 text-[10px] font-semibold" style={PREVIEW_FG}>
                  {name}
                </span>
                <span className="text-[10px] font-bold" style={{ color: branding.accentColor }}>
                  8.50
                </span>
              </div>
            ))}
          </div>
          <PreviewNav
            active="menu"
            accent={branding.accentColor}
            t={t}
            branding={branding}
          />
        </div>
      </WaiterPreviewShell>
    );
  }

  return (
    <WaiterPreviewShell theme={branding.theme}>
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
        {branding.showMenuHeader ? (
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p
                className="text-[8px] font-semibold uppercase tracking-[0.14em]"
                style={PREVIEW_MUTED}
              >
                {t("settings.phone_access_preview_on_shift")}
              </p>
              <p className="text-[14px] font-semibold tracking-tight" style={PREVIEW_FG}>
                {t("settings.phone_access_preview_menu_title")}
              </p>
            </div>
            {qrBtn}
          </div>
        ) : qr ? (
          <div className="mb-2 flex justify-end">{qrBtn}</div>
        ) : null}
        <div className="mb-2 flex gap-1.5">
          <div
            className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl"
            style={{ backgroundColor: branding.accentColor, color: "#ffffff" }}
          >
            <LayoutGrid className="size-3" />
            <span className="text-[8px] font-medium">
              {t("settings.phone_access_preview_all")}
            </span>
          </div>
          {dishes.slice(0, 2).map((name) => (
            <div
              key={name}
              className="flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1"
              style={{ ...PREVIEW_GLASS, color: "var(--waiter-muted)" }}
            >
              <UtensilsCrossed className="size-3" />
              <span className="w-full truncate text-center text-[8px] font-medium">
                {name}
              </span>
            </div>
          ))}
        </div>
        <div
          className="relative mb-2 h-8 rounded-xl pl-7 pr-2 text-[10px] leading-8"
          style={{ ...PREVIEW_GLASS, color: "var(--waiter-faint)" }}
        >
          <Search
            className="absolute left-2 top-1/2 size-3 -translate-y-1/2"
            style={{ color: "var(--waiter-faint)" }}
          />
          {t("settings.phone_access_preview_search")}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {dishes.map((name) => (
            <div
              key={name}
              className="flex min-h-[3.6rem] flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-center"
              style={PREVIEW_GLASS}
            >
              <span className="line-clamp-2 text-[10px] font-medium leading-tight" style={PREVIEW_FG}>
                {name}
              </span>
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: "#7eb6ff" }}>
                8.50
              </span>
            </div>
          ))}
        </div>
        <PreviewNav
          active="menu"
          accent={branding.accentColor}
          t={t}
          branding={branding}
        />
      </div>
    </WaiterPreviewShell>
  );
}

function PhoneAccessPreview({
  branding,
  venueName,
  pinLogo,
  t,
  screen,
  selectedText,
  onSelectText,
}: {
  branding: PhoneAccessBranding;
  venueName: string;
  pinLogo: string | null;
  t: (key: string) => string;
  screen: AccessScreen;
  selectedText: LoginTextId | null;
  onSelectText: (id: LoginTextId) => void;
}) {
  const tokens = phoneAccessThemeTokens(branding.theme);
  const light = tokens.isLight;
  const logo = branding.logoDataUrl || pinLogo;
  const venue = venueName.trim() || t("settings.phone_access_preview_venue");
  const btnText = phoneAccessButtonTextColor(branding.signInColor);
  const fieldBorder = light ? "#e2e8f0" : tokens.border;
  const fieldBg = light ? "#ffffff" : tokens.card;

  const hit = (id: LoginTextId) =>
    cn(
      "cursor-pointer rounded-lg transition-shadow",
      selectedText === id
        ? "ring-2 ring-[#0066FF] ring-offset-1 ring-offset-transparent"
        : "hover:ring-1 hover:ring-[#0066FF]/50",
    );

  if (screen === "dashboard") {
    const tables = [
      { name: "T1", free: true, seats: 4 },
      { name: "T2", free: false, seats: 2 },
      { name: "T3", free: true, seats: 6 },
      { name: "T4", free: false, seats: 4 },
      { name: "T5", free: true, seats: 4 },
      { name: "T6", free: false, seats: 2 },
      { name: "T7", free: true, seats: 8 },
      { name: "T8", free: true, seats: 4 },
    ];
    const design = branding.floorDesign;
    if (design === "advanced") {
      return (
        <WaiterPreviewShell theme={branding.theme} glow="rgba(212,175,55,0.16)">
          <div
            className="flex min-h-0 flex-1 flex-col px-3 pt-1"
            style={{ background: "transparent" }}
          >
            {branding.showHomeHeader ? (
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{
                    background: `linear-gradient(145deg, ${branding.accentColor}, #d4af37)`,
                    color: "#0a0a0a",
                  }}
                >
                  K
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[8px] font-semibold uppercase tracking-[0.14em]"
                    style={PREVIEW_MUTED}
                  >
                    {t("settings.phone_access_preview_on_shift")}
                  </p>
                  <p className="text-[12px] font-semibold" style={PREVIEW_FG}>
                    {t("settings.phone_access_preview_waiter")}
                  </p>
                </div>
                <span
                  className="flex size-7 items-center justify-center rounded-full"
                  style={{ background: "var(--waiter-card)" }}
                >
                  <LogOut className="size-3" style={PREVIEW_SOFT} />
                </span>
              </div>
            ) : null}
            <div className="mb-2 flex gap-3">
              {[
                { name: t("settings.phone_access_preview_zone"), on: true },
                { name: t("settings.phone_access_preview_zone_2"), on: false },
              ].map((zone) => (
                <span
                  key={zone.name}
                  className="pb-1 text-[10px] font-medium"
                  style={{
                    color: zone.on ? "var(--waiter-fg)" : "var(--waiter-muted)",
                    borderBottom: zone.on
                      ? `2px solid ${branding.accentColor}`
                      : "2px solid transparent",
                  }}
                >
                  {zone.name}
                </span>
              ))}
            </div>
            <div
              className={cn("grid gap-1.5", phoneAccessTableGridClass(branding.homeTableCols))}
            >
              {tables.slice(0, branding.homeTableCols * 3).map((tb) => (
                <div
                  key={tb.name}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                  style={{
                    background: "var(--waiter-card)",
                    boxShadow: "inset 0 0 0 1px var(--waiter-border)",
                  }}
                >
                  <span
                    className="h-6 w-1 shrink-0 rounded-full"
                    style={{ background: tb.free ? "#34d399" : "#60a5fa" }}
                  />
                  <span className="min-w-0 flex-1 text-[10px] font-semibold" style={PREVIEW_FG}>
                    {tb.name}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[7px] font-semibold uppercase"
                    style={{
                      color: tb.free ? "#6ee7b7" : "#93c5fd",
                      background: tb.free ? "rgba(16,185,129,0.15)" : "rgba(59,130,246,0.15)",
                    }}
                  >
                    {tb.free
                      ? t("settings.phone_access_preview_free")
                      : t("settings.phone_access_preview_busy")}
                  </span>
                </div>
              ))}
            </div>
            <PreviewNav
              active="tables"
              accent={branding.accentColor}
              t={t}
              branding={branding}
            />
          </div>
        </WaiterPreviewShell>
      );
    }
    if (design === "modern") {
      return (
        <WaiterPreviewShell theme={branding.theme} glow="rgba(99,102,241,0.28)">
          <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
            {branding.showHomeHeader ? (
              <div className="mb-2 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[15px] font-semibold" style={PREVIEW_FG}>
                  {t("settings.phone_access_preview_waiter")}
                </p>
                <span
                  className="flex size-7 items-center justify-center rounded-full"
                  style={{ background: "var(--waiter-card)" }}
                >
                  <LogOut className="size-3" style={PREVIEW_SOFT} />
                </span>
              </div>
            ) : null}
            <div className="mb-2 flex gap-1 overflow-hidden">
              {[
                { name: t("settings.phone_access_preview_zone"), on: true },
                { name: t("settings.phone_access_preview_zone_2"), on: false },
              ].map((zone) => (
                <span
                  key={zone.name}
                  className="shrink-0 rounded-full px-2 py-1 text-[8px] font-semibold"
                  style={
                    zone.on
                      ? { background: branding.accentColor, color: "#ffffff" }
                      : { background: "var(--waiter-card)", color: "var(--waiter-muted)" }
                  }
                >
                  {zone.name}
                </span>
              ))}
            </div>
            <div
              className={cn("grid gap-1.5", phoneAccessTableGridClass(branding.homeTableCols))}
            >
              {tables.map((tb) => (
                <div
                  key={tb.name}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2"
                  style={{ background: "var(--waiter-card)" }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: tb.free ? "#34d399" : "#60a5fa" }}
                  />
                  <span className="text-[11px] font-semibold" style={PREVIEW_FG}>
                    {tb.name}
                  </span>
                  <span className="text-[7px] font-medium" style={PREVIEW_MUTED}>
                    {tb.free
                      ? t("settings.phone_access_preview_free")
                      : t("settings.phone_access_preview_busy")}
                  </span>
                </div>
              ))}
            </div>
            <PreviewNav
              active="tables"
              accent={branding.accentColor}
              t={t}
              branding={branding}
            />
          </div>
        </WaiterPreviewShell>
      );
    }
    return (
      <WaiterPreviewShell theme={branding.theme}>
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
          {branding.showHomeHeader ? (
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p
                  className="text-[8px] font-semibold uppercase tracking-[0.14em]"
                  style={PREVIEW_MUTED}
                >
                  {t("settings.phone_access_preview_on_shift")}
                </p>
                <p
                  className="text-[14px] font-semibold tracking-tight"
                  style={{
                    ...PREVIEW_FG,
                    fontFamily: '"Space Grotesk", Geist, system-ui, sans-serif',
                  }}
                >
                  {t("settings.phone_access_preview_waiter")}
                </p>
              </div>
              <span
                className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] font-medium"
                style={{ ...PREVIEW_GLASS, ...PREVIEW_SOFT }}
              >
                <LogOut className="size-2.5" />
                {t("settings.phone_access_preview_out")}
              </span>
            </div>
          ) : null}
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            {[
              { name: t("settings.phone_access_preview_zone"), count: 4, on: true },
              { name: t("settings.phone_access_preview_zone_2"), count: 2, on: false },
            ].map((zone) => (
              <div
                key={zone.name}
                className="flex h-8 items-center justify-between gap-1 rounded-xl px-2 text-[10px] font-medium"
                style={
                  zone.on
                    ? {
                        backgroundColor: branding.accentColor,
                        color: "#ffffff",
                        boxShadow: `0 8px 16px -8px ${branding.accentColor}80`,
                      }
                    : { ...PREVIEW_GLASS, color: "var(--waiter-muted)" }
                }
              >
                <span className="truncate">{zone.name}</span>
                <span
                  className="flex size-4 shrink-0 items-center justify-center rounded-full text-[9px]"
                  style={{
                    background: zone.on ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
                  }}
                >
                  {zone.count}
                </span>
              </div>
            ))}
          </div>
          <div
            className={cn("grid gap-2", phoneAccessTableGridClass(branding.homeTableCols))}
          >
            {tables.map((tb) => (
              <div
                key={tb.name}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2",
                  branding.homeTableCols === 4
                    ? "py-1.5"
                    : branding.homeTableCols === 3
                      ? "py-2.5"
                      : "py-3.5",
                )}
                style={
                  tb.free
                    ? {
                        borderColor: "rgba(52,211,153,0.7)",
                        background: "rgba(16,185,129,0.12)",
                      }
                    : {
                        borderColor: "#60a5fa",
                        background: "rgba(59,130,246,0.15)",
                      }
                }
              >
                <span className="text-[12px] font-bold" style={PREVIEW_FG}>
                  {tb.name}
                </span>
                <span
                  className="text-[8px] font-medium"
                  style={{ color: tb.free ? "#6ee7b7" : "#93c5fd" }}
                >
                  {tb.free
                    ? t("settings.phone_access_preview_free")
                    : t("settings.phone_access_preview_busy")}
                </span>
                <span
                  className="flex items-center gap-0.5 text-[8px]"
                  style={{ color: "var(--waiter-faint)" }}
                >
                  <Users className="size-2" />
                  {tb.seats}
                </span>
              </div>
            ))}
          </div>
          <PreviewNav
            active="tables"
            accent={branding.accentColor}
            t={t}
            branding={branding}
          />
        </div>
      </WaiterPreviewShell>
    );
  }

  if (screen === "tables") {
    return <TableScreenPreview branding={branding} t={t} />;
  }

  if (screen === "menu") {
    return <MenuScreenPreview branding={branding} t={t} />;
  }

  if (screen === "orders") {
    return (
      <WaiterPreviewShell theme={branding.theme}>
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
          {branding.showOrdersHeader ? (
            <div className="mb-2">
              <p
                className="text-[8px] font-semibold uppercase tracking-[0.14em]"
                style={PREVIEW_MUTED}
              >
                {t("settings.phone_access_preview_on_shift")}
              </p>
              <p className="text-[14px] font-semibold tracking-tight" style={PREVIEW_FG}>
                {t("settings.phone_access_preview_orders_title")}
              </p>
            </div>
          ) : null}
          <div
            className="flex items-center justify-between rounded-2xl px-3 py-3"
            style={{
              border: "1px solid rgba(96,165,250,0.4)",
              background: "rgba(59,130,246,0.1)",
            }}
          >
            <div>
              <p className="text-[13px] font-semibold" style={PREVIEW_FG}>
                T2
              </p>
              <p className="text-[10px]" style={{ color: "var(--waiter-muted)" }}>
                {t("settings.phone_access_preview_zone")}
              </p>
            </div>
            <p className="text-[13px] font-semibold tabular-nums" style={{ color: "#7eb6ff" }}>
              24
            </p>
          </div>
          <PreviewNav
            active="orders"
            accent={branding.accentColor}
            t={t}
            branding={branding}
          />
        </div>
      </WaiterPreviewShell>
    );
  }

  return (
    <PhoneFrame
      waiterTheme={light ? "light" : "dark"}
      waiterSkin={tokens.id}
      style={waiterThemeStyle(tokens)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: waiterThemeGlow(tokens),
        }}
      />
      <div className="relative z-10 flex flex-1 flex-col px-3.5 pb-3 pt-1">
        <div className="mb-2 flex items-center gap-1 text-[8px] font-medium uppercase tracking-wider text-emerald-400">
          <span className="size-1 animate-pulse rounded-full bg-emerald-400" />
          <Wifi className="size-2.5" />
          {t("settings.phone_access_preview_online")}
        </div>

        {branding.showVyntexMark ? (
          <div className="mb-2 flex flex-col items-center text-center">
            <img
              src={VYNTEX_APP_LOGO_SRC}
              alt=""
              className="mb-1 w-auto object-contain drop-shadow-[0_8px_24px_rgba(0,102,255,0.35)]"
              style={{ height: Math.min(branding.logoHeightPx, 44) }}
            />
            <p
              className="text-[1.35rem] font-semibold leading-none tracking-tight"
              style={{
                fontFamily: '"Space Grotesk", Geist, system-ui, sans-serif',
                color: branding.loginTitleColor,
              }}
            >
              Vyntex
            </p>
            <button
              type="button"
              onClick={() => onSelectText("subtitle")}
              className={cn("mt-1.5 text-[11px] font-medium", hit("subtitle"))}
              style={{ color: branding.loginSubtitleColor }}
            >
              {t("settings.phone_access_preview_subtitle")}
            </button>
            <button
              type="button"
              onClick={() => onSelectText("hint")}
              className={cn("mt-0.5 max-w-[14rem] text-[9px] leading-snug", hit("hint"))}
              style={{ color: branding.loginHintColor }}
            >
              {t("settings.phone_access_preview_hint")}
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => onSelectText("title")}
          className={cn("mb-2 flex flex-col items-center gap-1 text-center", hit("title"))}
        >
          {logo ? (
            <img
              src={logo}
              alt=""
              className="max-w-[6.5rem] object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
              style={{ height: Math.min(branding.logoHeightPx, 40) }}
            />
          ) : null}
          <p
            className="text-[15px] font-semibold leading-tight tracking-tight"
            style={{
              fontFamily: '"Montserrat", "Space Grotesk", Geist, system-ui, sans-serif',
              color: branding.loginTitleColor,
            }}
          >
            {venue}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelectText("hint")}
          className={cn("mb-2 text-center text-[11px] font-medium", hit("hint"))}
          style={{ color: branding.loginHintColor }}
        >
          {t("settings.phone_access_preview_login_label")}
        </button>

        <button
          type="button"
          onClick={() => onSelectText("fields")}
          className={cn("mb-2 w-full text-left", hit("fields"))}
        >
          {branding.showNameLabel ? (
            <span
              className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: branding.loginFieldColor }}
            >
              {t("settings.phone_access_name")}
            </span>
          ) : null}
          <span
            className="block h-9 w-full rounded-xl border px-2.5 text-[11px] leading-9"
            style={{
              borderColor: fieldBorder,
              background: fieldBg,
              color: branding.loginFieldColor,
            }}
          >
            {t("settings.phone_access_name_placeholder")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSelectText("fields")}
          className={cn("mb-2 w-full text-left", hit("fields"))}
        >
          {branding.showCodeLabel ? (
            <span
              className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: branding.loginFieldColor }}
            >
              {t("settings.phone_access_code")}
            </span>
          ) : null}
          <span
            className="block h-9 w-full rounded-xl border px-2.5 font-mono text-[11px] leading-9"
            style={{
              borderColor: fieldBorder,
              background: fieldBg,
              color: branding.loginFieldColor,
            }}
          >
            {t("settings.phone_access_code_placeholder")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSelectText("button")}
          className={cn(
            "mt-auto h-10 w-full rounded-2xl text-center text-[12px] font-semibold shadow-[0_10px_28px_rgba(0,0,0,0.18)]",
            hit("button"),
          )}
          style={{
            backgroundColor: branding.signInColor,
            color: btnText,
          }}
        >
          {t("settings.phone_access_sign_in")}
        </button>
      </div>
    </PhoneFrame>
  );
}

export default function PhoneAccessDesignSection({
  licenseKey,
  canEdit = true,
  venueName = "",
}: PhoneAccessDesignSectionProps) {
  const t = useCallback(
    (key: string, opts?: Record<string, unknown>) => posI18n.t(key, opts),
    [],
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const [branding, setBranding] = useState<PhoneAccessBranding>(
    DEFAULT_PHONE_ACCESS_BRANDING,
  );
  const [pinLogo, setPinLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<AccessScreen>("login");
  const [selectedText, setSelectedText] = useState<LoginTextId | null>(null);

  useEffect(() => {
    void resolvePhoneAccessBranding(licenseKey).then(setBranding);
    void resolvePinLoginBranding(licenseKey).then((pin) => {
      setPinLogo(pin.logoDataUrl);
    });
  }, [licenseKey]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const persist = useCallback(
    async (next: PhoneAccessBranding, withToast: boolean) => {
      setBusy(true);
      try {
        await persistPhoneAccessBranding(licenseKey, next);
        setBranding(next);
        if (withToast) toast.success(t("settings.phone_access_saved"));
      } catch {
        toast.error(t("settings.save_failed"));
      } finally {
        setBusy(false);
      }
    },
    [licenseKey, t],
  );

  const debouncePersist = useCallback(
    (next: PhoneAccessBranding) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void persist(next, false);
      }, 400);
    },
    [persist],
  );

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      toast.error(t("settings.pin_logo_invalid"));
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeImageFileToJpegDataUrl(file);
      const current = await resolvePhoneAccessBranding(licenseKey);
      await persist({ ...current, logoDataUrl: dataUrl }, true);
    } catch (err) {
      if (err instanceof Error && err.message === "too_large") {
        toast.error(t("settings.pin_logo_invalid"));
      } else {
        toast.error(t("settings.pin_logo_read_error"));
      }
    } finally {
      setBusy(false);
    }
  };

  const resetToDefault = async () => {
    setBusy(true);
    try {
      const next = { ...DEFAULT_PHONE_ACCESS_BRANDING };
      await persistPhoneAccessBranding(licenseKey, next);
      setBranding(next);
      setSelectedText(null);
      toast.success(t("settings.phone_access_reset_done"));
    } catch {
      toast.error(t("settings.save_failed"));
    } finally {
      setBusy(false);
    }
  };

  const activeColor = selectedText ? loginTextColor(branding, selectedText) : null;

  return (
    <section className="rounded-2xl border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-5">
      {!canEdit ? (
        <p className="text-xs text-amber-400/90">
          {t("settings.admin_only_phone_access")}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[auto_1fr] xl:items-start">
        <div className="flex flex-col items-center gap-2 xl:sticky xl:top-4">
          <PhoneAccessPreview
            branding={branding}
            venueName={venueName}
            pinLogo={pinLogo}
            t={t}
            screen={screen}
            selectedText={selectedText}
            onSelectText={setSelectedText}
          />
          <p className="text-xs text-[#5a6580]">{t("settings.phone_access_preview")}</p>
        </div>

        <div className="min-w-0 space-y-5">
          <nav className="flex flex-wrap gap-x-5 gap-y-2 border-b border-[#1e2a45] pb-2">
            {SCREENS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setScreen(item.id);
                  if (item.id !== "login") setSelectedText(null);
                }}
                className={cn(
                  "pb-1.5 text-[13px] font-medium whitespace-nowrap cursor-pointer",
                  screen === item.id
                    ? "text-white border-b-2 border-[#0066FF]"
                    : "text-[#8b93a7] hover:text-white",
                )}
              >
                {t(item.titleKey)}
              </button>
            ))}
          </nav>

          {screen === "login" ? (
            <div className="space-y-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => void onPickFile(e)}
              />
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || !canEdit}
                    className="border-[#1e2a45] bg-[#131A2E] text-white hover:bg-[#1e2a45]"
                    onClick={() => fileRef.current?.click()}
                  >
                    {t("settings.pin_upload_logo")}
                  </Button>
                  {branding.logoDataUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy || !canEdit}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() =>
                        void persist({ ...branding, logoDataUrl: null }, true)
                      }
                    >
                      {t("settings.pin_remove_logo")}
                    </Button>
                  ) : null}
                </div>
                <div className="flex max-w-sm items-center gap-3">
                  <p className="shrink-0 text-sm text-[#8b93a7]">
                    {t("settings.pin_logo_size")}
                  </p>
                  <Slider
                    value={[branding.logoHeightPx]}
                    min={32}
                    max={120}
                    step={2}
                    disabled={busy || !canEdit}
                    onValueChange={([v]) => {
                      setBranding((prev) => {
                        const next = { ...prev, logoHeightPx: v };
                        debouncePersist(next);
                        return next;
                      });
                    }}
                    className="w-40 shrink-0"
                  />
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[#8b93a7]">
                    {branding.logoHeightPx}px
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-white">
                    {t("settings.phone_access_theme")}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5a6580]">
                    {t("settings.phone_access_theme_desc")}
                  </p>
                </div>
              <div className="flex flex-wrap gap-1.5">
                {PHONE_ACCESS_THEME_IDS.map((id) => {
                  const skin = phoneAccessThemeTokens(id);
                  const on = branding.theme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={busy || !canEdit}
                      onClick={() =>
                        void persist(brandingWithAccessTheme(branding, id), false)
                      }
                      className={cn(
                        "inline-flex max-w-[15rem] items-center gap-2 rounded-lg border px-2 py-1.5 text-left cursor-pointer transition-colors",
                        on
                          ? "border-[#0066FF] bg-[#0066FF]/10"
                          : "border-[#1e2a45] bg-[#131A2E] hover:border-[#0066FF]/40",
                      )}
                    >
                      <span
                        className="flex h-8 w-12 shrink-0 overflow-hidden rounded-[6px] ring-1 ring-white/10"
                        style={{
                          background: `linear-gradient(135deg, ${skin.pageMid} 0%, ${skin.page} 55%, ${skin.pageDeep} 100%)`,
                        }}
                      >
                        <span
                          className="mt-auto h-1.5 w-full"
                          style={{ background: skin.loginSubtitle }}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold leading-tight text-white">
                          {t(`settings.phone_access_theme_${id}`)}
                        </span>
                        <span className="block text-[10px] leading-snug text-[#8b93a7]">
                          {t(`settings.phone_access_theme_${id}_desc`)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-[#8b93a7]">
                  {t("settings.phone_access_pick_text")}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {LOGIN_TEXTS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedText(item.id)}
                      className={cn(
                        "text-[13px] font-medium cursor-pointer",
                        selectedText === item.id
                          ? "text-white underline decoration-[#0066FF] underline-offset-4"
                          : "text-[#8b93a7] hover:text-white",
                      )}
                    >
                      {t(item.titleKey)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedText && activeColor ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-white">
                    {t("settings.phone_access_text_color", {
                      name: t(
                        LOGIN_TEXTS.find((x) => x.id === selectedText)?.titleKey ??
                          "settings.phone_access_text_title",
                      ),
                    })}
                  </p>
                  <ColorDots
                    value={activeColor}
                    disabled={busy || !canEdit}
                    onPick={(color) =>
                      void persist(withLoginTextColor(branding, selectedText, color), false)
                    }
                    onCustom={(color) => {
                      const next = withLoginTextColor(branding, selectedText, color);
                      setBranding(next);
                      debouncePersist(next);
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : screen === "dashboard" ? (
            <div className="space-y-5">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {t("settings.phone_access_floor_design")}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5a6580]">
                    {t("settings.phone_access_floor_design_desc")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      {
                        id: "professional" as const,
                        titleKey: "settings.phone_access_floor_professional",
                        descKey: "settings.phone_access_floor_professional_desc",
                      },
                      {
                        id: "modern" as const,
                        titleKey: "settings.phone_access_floor_modern",
                        descKey: "settings.phone_access_floor_modern_desc",
                      },
                      {
                        id: "advanced" as const,
                        titleKey: "settings.phone_access_floor_advanced",
                        descKey: "settings.phone_access_floor_advanced_desc",
                      },
                    ] as const
                  ).map((opt) => {
                    const on = branding.floorDesign === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={busy || !canEdit}
                        onClick={() =>
                          void persist({ ...branding, floorDesign: opt.id }, false)
                        }
                        className={cn(
                          "inline-flex max-w-[15rem] items-center gap-2 rounded-lg border px-2 py-1.5 text-left cursor-pointer transition-colors",
                          on
                            ? "border-[#0066FF] bg-[#0066FF]/10"
                            : "border-[#1e2a45] bg-[#131A2E] hover:border-[#0066FF]/40",
                        )}
                      >
                        <div className="grid h-8 w-12 shrink-0 grid-cols-3 gap-px">
                          {opt.id === "professional" ? (
                            [1, 2, 3, 4, 5, 6].map((n) => (
                              <span
                                key={n}
                                className="rounded-[2px]"
                                style={{
                                  background:
                                    n % 2 === 0
                                      ? "rgba(59,130,246,0.55)"
                                      : "rgba(16,185,129,0.55)",
                                }}
                              />
                            ))
                          ) : opt.id === "modern" ? (
                            [1, 2, 3].map((n) => (
                              <span
                                key={n}
                                className="col-span-3 flex items-center rounded-full px-0.5"
                                style={{
                                  background:
                                    n === 1
                                      ? "rgba(0,102,255,0.7)"
                                      : "rgba(255,255,255,0.12)",
                                }}
                              />
                            ))
                          ) : (
                            [1, 2, 3].map((n) => (
                              <span
                                key={n}
                                className="col-span-3 flex items-center gap-0.5 rounded-[2px] px-0.5"
                                style={{ background: "rgba(255,255,255,0.08)" }}
                              >
                                <span
                                  className="h-1.5 w-px rounded-full"
                                  style={{
                                    background: n === 2 ? "#60a5fa" : "#34d399",
                                  }}
                                />
                                <span className="h-px flex-1 rounded-full bg-white/25" />
                              </span>
                            ))
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold leading-tight text-white">
                            {t(opt.titleKey)}
                          </p>
                          <p className="text-[10px] leading-snug text-[#8b93a7]">
                            {t(opt.descKey)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {t("settings.phone_access_grid")}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5a6580]">
                    {t("settings.phone_access_grid_desc")}
                  </p>
                </div>
                <div className="inline-flex overflow-hidden rounded-lg border border-[#1e2a45]">
                  {([2, 3, 4] as const).map((cols) => (
                    <button
                      key={cols}
                      type="button"
                      disabled={busy || !canEdit}
                      onClick={() =>
                        void persist({ ...branding, homeTableCols: cols }, false)
                      }
                      className={cn(
                        "h-8 w-9 text-[13px] font-semibold cursor-pointer",
                        branding.homeTableCols === cols
                          ? "bg-[#0066FF] text-white"
                          : "bg-[#131A2E] text-[#8b93a7] hover:text-white",
                      )}
                    >
                      {cols}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {t("settings.phone_access_nav")}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5a6580]">
                    {t("settings.phone_access_nav_desc")}
                  </p>
                </div>
                {(
                  [
                    ["showNavTables", "settings.phone_access_preview_nav_tables"],
                    ["showNavMenu", "settings.phone_access_preview_nav_menu"],
                    ["showNavOrders", "settings.phone_access_preview_nav_orders"],
                    ["showNavAlerts", "settings.phone_access_preview_nav_alerts"],
                  ] as const
                ).map(([key, labelKey]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#1e2a45]/50 bg-[#131A2E]/60 px-3 py-2.5"
                  >
                    <p className="text-sm text-white">{t(labelKey)}</p>
                    <Switch
                      checked={branding[key]}
                      disabled={busy || !canEdit}
                      onCheckedChange={(v) =>
                        void persist({ ...branding, [key]: v }, false)
                      }
                      className="data-[state=checked]:bg-[#0066FF] data-[state=checked]:border-[#0066FF]"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : screen === "tables" ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-white">
                  {t("settings.phone_access_table_design")}
                </p>
                <p className="mt-0.5 text-xs text-[#5a6580]">
                  {t("settings.phone_access_table_design_desc")}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    {
                      id: "professional" as const,
                      titleKey: "settings.phone_access_table_professional",
                      descKey: "settings.phone_access_table_professional_desc",
                    },
                    {
                      id: "modern" as const,
                      titleKey: "settings.phone_access_table_modern",
                      descKey: "settings.phone_access_table_modern_desc",
                    },
                    {
                      id: "advanced" as const,
                      titleKey: "settings.phone_access_table_advanced",
                      descKey: "settings.phone_access_table_advanced_desc",
                    },
                  ] as const
                ).map((opt) => {
                  const on = branding.tableDesign === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={busy || !canEdit}
                      onClick={() =>
                        void persist({ ...branding, tableDesign: opt.id }, false)
                      }
                      className={cn(
                        "inline-flex max-w-[15rem] items-center gap-2 rounded-lg border px-2 py-1.5 text-left cursor-pointer transition-colors",
                        on
                          ? "border-[#0066FF] bg-[#0066FF]/10"
                          : "border-[#1e2a45] bg-[#131A2E] hover:border-[#0066FF]/40",
                      )}
                    >
                      <div className="grid h-8 w-12 shrink-0 grid-cols-3 gap-px">
                        {opt.id === "professional" ? (
                          [1, 2, 3, 4, 5, 6].map((n) => (
                            <span
                              key={n}
                              className="rounded-[2px]"
                              style={{
                                background:
                                  n === 1
                                    ? "rgba(245,158,11,0.75)"
                                    : "rgba(255,255,255,0.18)",
                              }}
                            />
                          ))
                        ) : opt.id === "modern" ? (
                          [1, 2, 3].map((n) => (
                            <span
                              key={n}
                              className="col-span-3 flex items-center rounded-full px-0.5"
                              style={{
                                background:
                                  n === 1
                                    ? "rgba(0,102,255,0.7)"
                                    : "rgba(255,255,255,0.12)",
                              }}
                            />
                          ))
                        ) : (
                          [1, 2, 3].map((n) => (
                            <span
                              key={n}
                              className="col-span-3 flex items-center gap-0.5 rounded-[2px] px-0.5"
                              style={{ background: "rgba(255,255,255,0.08)" }}
                            >
                              <span
                                className="h-1.5 w-px rounded-full"
                                style={{
                                  background: n === 1 ? "#d4af37" : "#fb923c",
                                }}
                              />
                              <span className="h-px flex-1 rounded-full bg-white/25" />
                            </span>
                          ))
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold leading-tight text-white">
                          {t(opt.titleKey)}
                        </p>
                        <p className="text-[10px] leading-snug text-[#8b93a7]">
                          {t(opt.descKey)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : screen === "menu" ? (
            <div className="space-y-5">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {t("settings.phone_access_menu_design")}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5a6580]">
                    {t("settings.phone_access_menu_design_desc")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      {
                        id: "professional" as const,
                        titleKey: "settings.phone_access_menu_professional",
                        descKey: "settings.phone_access_menu_professional_desc",
                      },
                      {
                        id: "modern" as const,
                        titleKey: "settings.phone_access_menu_modern",
                        descKey: "settings.phone_access_menu_modern_desc",
                      },
                      {
                        id: "advanced" as const,
                        titleKey: "settings.phone_access_menu_advanced",
                        descKey: "settings.phone_access_menu_advanced_desc",
                      },
                    ] as const
                  ).map((opt) => {
                    const on = branding.menuDesign === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={busy || !canEdit}
                        onClick={() =>
                          void persist({ ...branding, menuDesign: opt.id }, false)
                        }
                        className={cn(
                          "inline-flex max-w-[15rem] items-center gap-2 rounded-lg border px-2 py-1.5 text-left cursor-pointer transition-colors",
                          on
                            ? "border-[#0066FF] bg-[#0066FF]/10"
                            : "border-[#1e2a45] bg-[#131A2E] hover:border-[#0066FF]/40",
                        )}
                      >
                        <div className="grid h-8 w-12 shrink-0 grid-cols-3 gap-px">
                          {opt.id === "professional" ? (
                            [1, 2, 3, 4, 5, 6].map((n) => (
                              <span
                                key={n}
                                className="rounded-[2px]"
                                style={{
                                  background:
                                    n === 1
                                      ? "rgba(0,102,255,0.75)"
                                      : "rgba(255,255,255,0.18)",
                                }}
                              />
                            ))
                          ) : opt.id === "modern" ? (
                            [1, 2, 3].map((n) => (
                              <span
                                key={n}
                                className="col-span-3 flex items-center rounded-full px-0.5"
                                style={{
                                  background:
                                    n === 1
                                      ? "rgba(0,102,255,0.7)"
                                      : "rgba(255,255,255,0.12)",
                                }}
                              />
                            ))
                          ) : (
                            [1, 2, 3].map((n) => (
                              <span
                                key={n}
                                className="col-span-3 flex items-center gap-0.5 rounded-[2px] px-0.5"
                                style={{ background: "rgba(255,255,255,0.08)" }}
                              >
                                <span
                                  className="h-1.5 w-px rounded-full"
                                  style={{
                                    background: n === 1 ? "#d4af37" : "#22d3ee",
                                  }}
                                />
                                <span className="h-px flex-1 rounded-full bg-white/25" />
                              </span>
                            ))
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold leading-tight text-white">
                            {t(opt.titleKey)}
                          </p>
                          <p className="text-[10px] leading-snug text-[#8b93a7]">
                            {t(opt.descKey)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#1e2a45]/50 bg-[#131A2E]/60 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-white">{t("settings.phone_access_menu_qr")}</p>
                  <p className="mt-0.5 text-xs text-[#5a6580]">
                    {t("settings.phone_access_menu_qr_desc")}
                  </p>
                </div>
                <Switch
                  checked={branding.showMenuQr}
                  disabled={busy || !canEdit}
                  onCheckedChange={(v) =>
                    void persist({ ...branding, showMenuQr: v }, false)
                  }
                  className="data-[state=checked]:bg-[#0066FF] data-[state=checked]:border-[#0066FF]"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#8b93a7]">
              {t("settings.phone_access_screen_preview_only")}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1e2a45] pt-4">
        <p className="text-sm text-[#8b93a7]">
          {t("settings.phone_access_reset_desc")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !canEdit}
          className="border-[#1e2a45] bg-[#131A2E] text-white hover:bg-[#1e2a45]"
          onClick={() => void resetToDefault()}
        >
          <RotateCcw className="size-3.5" />
          {t("settings.phone_access_reset")}
        </Button>
      </div>
    </section>
  );
}
