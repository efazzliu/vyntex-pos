/**
 * After `npm run dist:win`, copy NSIS outputs into public/ so the dashboard
 * download links work during dev and static deploys.
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

const pairs = [
  {
    from: path.join(releaseDir, `VyntexPOSSetup-${version}-x64.exe`),
    to: path.join(publicDir, "VyntexPOSSetup.exe"),
    label: "x64 (Intel/AMD)",
  },
  {
    from: path.join(releaseDir, `VyntexPOSSetup-${version}-arm64.exe`),
    to: path.join(publicDir, "VyntexPOSSetup-arm64.exe"),
    label: "ARM64",
  },
];

let ok = 0;
for (const { from, to, label } of pairs) {
  if (!fs.existsSync(from)) {
    console.warn(
      `[copy-installers] Skip ${label}: not found\n  ${from}\n  Run: npm run dist:win`,
    );
    continue;
  }
  fs.mkdirSync(publicDir, { recursive: true });
  fs.copyFileSync(from, to);
  const stat = fs.statSync(to);
  console.log(`[copy-installers] ${label} -> ${path.relative(root, to)} (${stat.size} bytes)`);
  ok++;
}

if (ok === 0) {
  console.error(
    "\n[copy-installers] No installers copied. Build Windows installers first:\n  npm run dist:win\n",
  );
  process.exit(1);
}
