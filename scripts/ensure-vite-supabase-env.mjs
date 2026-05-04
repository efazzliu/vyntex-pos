/**
 * Runs before `vite build` (see package.json `prebuild:web`).
 * Stops the build if Supabase env is missing — otherwise the .exe ships without API
 * (no license, no phone notifications, RPC never called).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
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

function mergeViteSupabaseForProductionBuild() {
  /** Same layering as Vite for `vite build` (mode production). */
  const layers = [
    path.join(root, ".env"),
    path.join(root, ".env.local"),
    path.join(root, ".env.production"),
    path.join(root, ".env.production.local"),
  ];
  const merged = {};
  for (const p of layers) Object.assign(merged, parseDotEnv(p));
  return merged;
}

if (process.env.SKIP_VITE_SUPABASE_CHECK === "1") {
  process.exit(0);
}

const fromFiles = mergeViteSupabaseForProductionBuild();
const url =
  String(process.env.VITE_SUPABASE_URL ?? fromFiles.VITE_SUPABASE_URL ?? "").trim();
const key =
  String(process.env.VITE_SUPABASE_ANON_KEY ?? fromFiles.VITE_SUPABASE_ANON_KEY ?? "").trim();

const placeholder =
  url.includes("YOUR_PROJECT") ||
  url.includes("placeholder") ||
  key.includes("your-anon") ||
  key.length < 20;

if (!url || !key || placeholder) {
  console.error("");
  console.error("[ensure-vite-supabase-env] Missing or placeholder Supabase env for production build.");
  console.error("  Need real VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Supabase → Project Settings → API).");
  console.error("");
  console.error("  1) Copy .env.production.example → .env.production.local (recommended, git-ignored)");
  console.error("     or edit .env.production");
  console.error("  2) Paste URL + anon public key, save, then run npm run dist:win again.");
  console.error("");
  console.error("  To skip this check (not recommended): set SKIP_VITE_SUPABASE_CHECK=1");
  console.error("");
  process.exit(1);
}

process.exit(0);
