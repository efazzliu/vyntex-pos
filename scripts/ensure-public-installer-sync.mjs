/**
 * After sync-public-build-meta: fail the build if public/build-meta.json does not
 * match public/RestaurantPOSSetup.exe (common when metadata was committed without the new .exe).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const metaPath = path.join(root, "public", "build-meta.json");
const x64Exe = path.join(root, "public", "RestaurantPOSSetup.exe");

if (!fs.existsSync(x64Exe)) {
  console.warn(
    "[ensure-public-installer-sync] No public/RestaurantPOSSetup.exe — Vercel will not serve a Windows installer.",
  );
  process.exit(0);
}

if (!fs.existsSync(metaPath)) {
  console.error(
    "[ensure-public-installer-sync] Missing public/build-meta.json — run: node scripts/sync-public-build-meta.mjs",
  );
  process.exit(1);
}

const stat = fs.statSync(x64Exe);
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
const recordedSize = meta.installerSizeBytes;
const recordedMtime = meta.installerUpdatedAt;

if (typeof recordedSize === "number" && recordedSize !== stat.size) {
  console.error(
    `[ensure-public-installer-sync] Installer size mismatch.\n` +
      `  public/RestaurantPOSSetup.exe: ${stat.size} bytes\n` +
      `  public/build-meta.json:       ${recordedSize} bytes\n` +
      `  Run: npm run copy-installers  (then commit BOTH files before pushing to Vercel)`,
  );
  process.exit(1);
}

if (typeof recordedMtime === "string" && recordedMtime.trim()) {
  const a = new Date(recordedMtime).getTime();
  const b = stat.mtime.getTime();
  if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 2000) {
    console.error(
      `[ensure-public-installer-sync] Installer mtime mismatch (>2s).\n` +
        `  exe:  ${stat.mtime.toISOString()}\n` +
        `  meta: ${recordedMtime}\n` +
        `  Run: node scripts/sync-public-build-meta.mjs && commit public/build-meta.json with the .exe`,
    );
    process.exit(1);
  }
}

console.log("[ensure-public-installer-sync] public/RestaurantPOSSetup.exe matches build-meta.json");
