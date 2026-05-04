/** IndexedDB keys for POS offline cache. Bump `v2` if table id shape changes (e.g. Convex → Supabase UUID). */
export function posTablesIndexedDbKey(licenseKey: string): string {
  return `pos_tables_v2:${licenseKey}`;
}
