/**
 * Writes `public/build-meta.json` before `vite build` so static hosts (Vercel, etc.)
 * serve `/build-meta.json` without relying on dev-only middleware.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = path.join(root, "package.json");
const publicDir = path.join(root, "public");
const outPath = path.join(publicDir, "build-meta.json");
const x64Exe = path.join(publicDir, "RestaurantPOSSetup.exe");

let appVersion = "0.0.0";
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (typeof pkg.version === "string" && pkg.version.trim()) {
    appVersion = pkg.version.trim();
  }
} catch {
  process.exitCode = 1;
  console.error("[sync-public-build-meta] Could not read package.json");
  process.exit(1);
}

let installerUpdatedAt = null;
try {
  if (fs.existsSync(x64Exe)) {
    installerUpdatedAt = fs.statSync(x64Exe).mtime.toISOString();
  }
} catch {
  /* ignore */
}

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(
  outPath,
  JSON.stringify({ appVersion, installerUpdatedAt }, null, 0) + "\n",
  "utf8",
);
console.log(
  `[sync-public-build-meta] Wrote ${path.relative(root, outPath)} (app ${appVersion}${installerUpdatedAt ? ", installer mtime ok" : ", no x64 exe"})`,
);
