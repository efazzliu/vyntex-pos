import { localeTag, type AdminLang } from "./admin-i18n.ts";

export function formatAdminDateTime(
  value: Date | string | number,
  timezone: string,
  lang: AdminLang,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(localeTag(lang), {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
      ...options,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}
