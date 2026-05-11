/**
 * After `npm run dist:win`, copy NSIS outputs into `public/` (for dev / static deploys)
 * and mirror canonical names into `release/` (Restaurant POS line; Fitness POS etc. can use
 * their own artifact names in separate products later).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = String(pkg.version ?? "0.0.0");
/** Override when using e.g. `dist:win:fresh` (alternate electron-builder output dir). */
const releaseDir = path.join(
  root,
  (process.env.RELEASE_DIR && String(process.env.RELEASE_DIR).trim()) || "release",
);
const publicDir = path.join(root, "public");

/** Versioned NSIS outputs: RestaurantPOSSetup-1.2.3-x64.exe (legacy: VyntexPOSSetup-*). */
const VERSIONED_INSTALLER_RE =
  /^(RestaurantPOSSetup|VyntexPOSSetup)-(\d+\.\d+\.\d+)-(x64|arm64)\.exe(\.blockmap)?$/;

/**
 * In `release/`, remove stale versioned installers + blockmaps (wrong semver or legacy Vyntex names).
 */
function purgeStaleFromRelease(dir, keepVersion) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const m = name.match(VERSIONED_INSTALLER_RE);
    if (!m) continue;
    const prefix = m[1];
    const ver = m[2];
    const stale = ver !== keepVersion || prefix === "VyntexPOSSetup";
    if (!stale) continue;
    const full = path.join(dir, name);
    fs.unlinkSync(full);
    console.log(`[copy-installers] Removed stale release artifact: ${path.relative(root, full)}`);
  }
}

/** In `public/`, remove all versioned copies; canonical `RestaurantPOSSetup*.exe` stay. */
function purgeVersionedFromPublic(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!VERSIONED_INSTALLER_RE.test(name)) continue;
    const full = path.join(dir, name);
    fs.unlinkSync(full);
    console.log(`[copy-installers] Removed versioned public file: ${path.relative(root, full)}`);
  }
}

function resolveBuiltExe(arch) {
  const restaurant = path.join(releaseDir, `RestaurantPOSSetup-${version}-${arch}.exe`);
  const vyntex = path.join(releaseDir, `VyntexPOSSetup-${version}-${arch}.exe`);
  if (fs.existsSync(restaurant)) return restaurant;
  if (fs.existsSync(vyntex)) return vyntex;
  return restaurant;
}

purgeStaleFromRelease(releaseDir, version);
purgeVersionedFromPublic(publicDir);

const pairs = [
  {
    from: () => resolveBuiltExe("x64"),
    toPublic: path.join(publicDir, "RestaurantPOSSetup.exe"),
    toRelease: path.join(releaseDir, "RestaurantPOSSetup.exe"),
    label: "x64 (Intel/AMD)",
  },
  {
    from: () => resolveBuiltExe("arm64"),
    toPublic: path.join(publicDir, "RestaurantPOSSetup-arm64.exe"),
    toRelease: path.join(releaseDir, "RestaurantPOSSetup-arm64.exe"),
    label: "ARM64",
  },
];

let ok = 0;
for (const { from: fromFn, toPublic, toRelease, label } of pairs) {
  const from = fromFn();
  if (!fs.existsSync(from)) {
    console.warn(
      `[copy-installers] Skip ${label}: not found\n  ${from}\n  Run: npm run dist:win`,
    );
    continue;
  }
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(releaseDir, { recursive: true });
  for (const to of [toPublic, toRelease]) {
    fs.copyFileSync(from, to);
    const stat = fs.statSync(to);
    console.log(`[copy-installers] ${label} -> ${path.relative(root, to)} (${stat.size} bytes)`);
  }
  ok++;
}

if (ok === 0) {
  console.error(
    "\n[copy-installers] No installers copied. Build Windows installers first:\n  npm run dist:win\n",
  );
  process.exit(1);
}
