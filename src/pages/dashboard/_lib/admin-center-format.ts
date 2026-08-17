import type { DatePreset, LicenseHealth } from "./admin-center-types.ts";

export const EUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const EUR_COMPACT = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatEur(value: number, compact = false): string {
  return (compact ? EUR_COMPACT : EUR).format(value);
}

export function formatInt(value: number, locale = "en-US"): string {
  return Math.round(value).toLocaleString(locale);
}

export function formatPct(value: number, digits = 1): string {
  const abs = Math.abs(value).toFixed(digits);
  return `${value >= 0 ? "+" : "−"}${abs}%`;
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
}

export function licenseHealth(
  status: string | null | undefined,
  expiry: string | null | undefined,
): LicenseHealth {
  const days = daysUntil(expiry);
  if (status === "expired" || status === "suspended" || (days != null && days < 0)) {
    return "expired";
  }
  if (days != null && days <= 30) return "expiring";
  return "active";
}

export function greetingHour(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export function firstName(name: string | null | undefined, email?: string | null): string {
  const trimmed = (name ?? "").trim();
  if (trimmed && !trimmed.includes("@")) return trimmed.split(/\s+/)[0] ?? trimmed;
  const local = (email ?? "").split("@")[0] ?? "";
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function cityFromAddress(address: string | null | undefined): string {
  const raw = (address ?? "").trim();
  if (!raw) return "";
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? raw;
}

export function relativeTime(iso: string, locale = "en"): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return locale === "sq" ? "Tani" : "Just now";
  if (mins < 60) {
    return locale === "sq" ? `${mins} minuta më parë` : `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  const hours = Math.round(mins / 60);
  if (hours < 24) {
    return locale === "sq" ? `${hours} orë më parë` : `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.round(hours / 24);
  if (days === 1) return locale === "sq" ? "Dje" : "Yesterday";
  if (days < 7) {
    return locale === "sq" ? `${days} ditë më parë` : `${days} days ago`;
  }
  return new Date(iso).toLocaleDateString(locale === "sq" ? "sq-AL" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function rangeForPreset(
  preset: DatePreset,
  custom?: { from: Date; to: Date },
): { from: Date; to: Date; previousFrom: Date; previousTo: Date } {
  const now = new Date();
  const today = startOfDay(now);
  let from = today;
  let to = addDays(today, 1);

  if (preset === "today") {
    from = today;
    to = addDays(today, 1);
  } else if (preset === "week") {
    const dow = today.getDay();
    from = addDays(today, dow === 0 ? -6 : 1 - dow);
    to = addDays(today, 1);
  } else if (preset === "month") {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to = addDays(today, 1);
  } else if (preset === "last_month") {
    from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    to = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (preset === "quarter") {
    from = addMonths(today, -3);
    to = addDays(today, 1);
  } else if (preset === "year") {
    from = new Date(today.getFullYear(), 0, 1);
    to = addDays(today, 1);
  } else if (custom?.from && custom?.to) {
    from = startOfDay(custom.from);
    to = addDays(startOfDay(custom.to), 1);
  }

  const span = to.getTime() - from.getTime();
  const previousTo = from;
  const previousFrom = new Date(from.getTime() - span);
  return { from, to, previousFrom, previousTo };
}

export function rangeForChart(range: "7d" | "30d" | "3m" | "1y"): { from: Date; to: Date } {
  const to = addDays(startOfDay(new Date()), 1);
  if (range === "7d") return { from: addDays(to, -7), to };
  if (range === "30d") return { from: addDays(to, -30), to };
  if (range === "3m") return { from: addMonths(to, -3), to };
  return { from: addMonths(to, -12), to };
}

export const DATE_PRESET_LABELS: Record<DatePreset, { en: string; sq: string }> = {
  today: { en: "Today", sq: "Sot" },
  week: { en: "This Week", sq: "Këtë javë" },
  month: { en: "This Month", sq: "Këtë muaj" },
  last_month: { en: "Last Month", sq: "Muajin e kaluar" },
  quarter: { en: "Last 3 Months", sq: "3 muajt e fundit" },
  year: { en: "This Year", sq: "Këtë vit" },
  custom: { en: "Custom Range", sq: "Interval i personalizuar" },
};
