/**
 * After `npm run dist:win`, copy NSIS outputs into `public/` (for dev / static deploys)
 * and mirror canonical names into `release/` so Explorer shows `VyntexPOSSetup.exe`
 * next to the versioned `VyntexPOSSetup-<ver>-x64.exe` artifacts.
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

/** `VyntexPOSSetup-1.2.3-x64.exe` or `...arm64.exe` / `.exe.blockmap` */
const VERSIONED_INSTALLER_RE =
  /^VyntexPOSSetup-(\d+\.\d+\.\d+)-(x64|arm64)\.exe(\.blockmap)?$/;

/**
 * In `release/`, remove versioned installers + blockmaps for any version other than `keepVersion`
 * (electron-builder leaves older builds on disk).
 */
function purgeStaleFromRelease(dir, keepVersion) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const m = name.match(VERSIONED_INSTALLER_RE);
    if (!m || m[1] === keepVersion) continue;
    const full = path.join(dir, name);
    fs.unlinkSync(full);
    console.log(`[copy-installers] Removed stale release artifact: ${path.relative(root, full)}`);
  }
}

/** In `public/`, remove all versioned copies; canonical `VyntexPOSSetup*.exe` stay. */
function purgeVersionedFromPublic(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!VERSIONED_INSTALLER_RE.test(name)) continue;
    const full = path.join(dir, name);
    fs.unlinkSync(full);
    console.log(`[copy-installers] Removed versioned public file: ${path.relative(root, full)}`);
  }
}

purgeStaleFromRelease(releaseDir, version);
purgeVersionedFromPublic(publicDir);

const pairs = [
  {
    from: path.join(releaseDir, `VyntexPOSSetup-${version}-x64.exe`),
    toPublic: path.join(publicDir, "VyntexPOSSetup.exe"),
    toRelease: path.join(releaseDir, "VyntexPOSSetup.exe"),
    label: "x64 (Intel/AMD)",
  },
  {
    from: path.join(releaseDir, `VyntexPOSSetup-${version}-arm64.exe`),
    toPublic: path.join(publicDir, "VyntexPOSSetup-arm64.exe"),
    toRelease: path.join(releaseDir, "VyntexPOSSetup-arm64.exe"),
    label: "ARM64",
  },
];

let ok = 0;
for (const { from, toPublic, toRelease, label } of pairs) {
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
