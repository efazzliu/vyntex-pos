/** Same variants as activation: formatted / unformatted 16-char keys. */
export function licenseKeyLookupVariants(raw: string): string[] {
  const u = raw.trim().toUpperCase();
  const alnum = u.replace(/[^A-Z0-9]/g, "");
  const out = new Set<string>();
  if (u.length > 0) out.add(u);
  if (alnum.length > 0) {
    out.add(alnum);
    if (alnum.length === 16) {
      out.add(
        `${alnum.slice(0, 4)}-${alnum.slice(4, 8)}-${alnum.slice(8, 12)}-${alnum.slice(12, 16)}`,
      );
    }
  }
  return [...out];
}
