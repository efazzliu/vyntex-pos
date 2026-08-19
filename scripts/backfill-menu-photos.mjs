/**
 * Backfill image_url for menu items that have no photo.
 *
 * Usage: node scripts/backfill-menu-photos.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { photoUrlForMenuItem } from "./menu-item-photo-urls.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const eq = s.indexOf("=");
    if (eq <= 0) continue;
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = {
  ...parseDotEnv(path.join(root, ".env")),
  ...parseDotEnv(path.join(root, ".env.local")),
};

const url = String(env.VITE_SUPABASE_URL ?? "").trim();
const anon = String(env.VITE_SUPABASE_ANON_KEY ?? "").trim();
if (!url || !anon) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: items, error } = await supabase
    .from("menu_items")
    .select("id, name, category_id, restaurant_id, image_url")
    .is("image_url", null);
  if (error) throw error;
  if (!items?.length) {
    console.log("All menu items already have photos.");
    return;
  }

  const restaurantIds = [...new Set(items.map((i) => i.restaurant_id))];
  const { data: categories, error: catErr } = await supabase
    .from("menu_categories")
    .select("id, name, restaurant_id")
    .in("restaurant_id", restaurantIds);
  if (catErr) throw catErr;

  const catById = new Map((categories ?? []).map((c) => [c.id, c.name]));
  let updated = 0;
  for (const row of items) {
    const categoryName = catById.get(row.category_id) ?? "";
    const imageUrl = photoUrlForMenuItem(row.name, categoryName);
    const { error: upErr } = await supabase
      .from("menu_items")
      .update({ image_url: imageUrl })
      .eq("id", row.id);
    if (upErr) throw upErr;
    updated += 1;
  }
  console.log(`Updated ${updated} menu item photos.`);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
