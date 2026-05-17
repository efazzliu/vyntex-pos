/**
 * Deploy to Vercel production (website + build-meta + installer in public/).
 *
 * Requires once: npx vercel login && npx vercel link
 *
 * Skip: SKIP_VERCEL_DEPLOY=1
 * Prefer git (no CLI upload limit): VERCEL_DEPLOY=git npm run deploy:vercel
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const MAX_FILE_BYTES = 100 * 1024 * 1024;

if (process.env.SKIP_VERCEL_DEPLOY === "1") {
  console.log("[vercel] Skipped (SKIP_VERCEL_DEPLOY=1)");
  process.exit(0);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
    ...opts,
  });
}

/** Remove folders that break the 100 MB CLI limit if accidentally included. */
function pruneBeforeUpload() {
  const winUnpacked = path.join(root, "release", "win-unpacked");
  if (fs.existsSync(winUnpacked)) {
    console.log("[vercel] Removing release/win-unpacked (~200 MB, not for upload)…");
    fs.rmSync(winUnpacked, { recursive: true, force: true });
  }
}

/** Warn if any tracked upload candidate exceeds Vercel limit. */
function scanLargeFiles() {
  const offenders = [];
  const skipDir = new Set([
    "node_modules",
    ".git",
    "release",
    "dist",
    "dist-phone",
    "android",
    "ios",
  ]);

  function walk(dir, depth = 0) {
    if (depth > 6) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (skipDir.has(e.name)) continue;
        if (e.name === "win-unpacked" || e.name.includes("unpacked")) continue;
        walk(full, depth + 1);
        continue;
      }
      if (!e.isFile()) continue;
      let size = 0;
      try {
        size = fs.statSync(full).size;
      } catch {
        continue;
      }
      if (size > MAX_FILE_BYTES) {
        offenders.push({ rel: path.relative(root, full), size });
      }
    }
  }

  walk(path.join(root, "public"));
  walk(root);

  if (offenders.length > 0) {
    console.error("\n[vercel] Files over 100 MB (will fail CLI deploy):\n");
    for (const o of offenders) {
      console.error(`  ${(o.size / 1024 / 1024).toFixed(1)} MB  ${o.rel}`);
    }
    console.error(
      "\nUse git push instead: VERCEL_DEPLOY=git npm run deploy:vercel\n" +
        "Or add paths to .vercelignore and delete release/win-unpacked.\n",
    );
    return false;
  }
  return true;
}

function syncBuildMetaToDist() {
  const metaSrc = path.join(root, "public", "build-meta.json");
  const distDir = path.join(root, "dist");
  const metaDest = path.join(distDir, "build-meta.json");
  if (fs.existsSync(metaSrc) && fs.existsSync(distDir)) {
    fs.copyFileSync(metaSrc, metaDest);
    console.log(`[vercel] Synced ${path.relative(root, metaDest)}`);
  }
}

function deployViaGit() {
  console.log("\n[vercel] Git push → Vercel (recommended for large .exe)…\n");
  const files = [
    "public/RestaurantPOSSetup.exe",
    "public/build-meta.json",
    "package.json",
    "package-lock.json",
  ];
  run("git", ["add", ...files]);
  const msg = `release: restaurant POS v${readVersion()}`;
  const commit = run("git", ["commit", "-m", msg], { stdio: "pipe" });
  if (commit.status !== 0) {
    const out = String(commit.stdout || commit.stderr || "");
    if (!/nothing to commit|no changes/i.test(out)) {
      console.log("[vercel] Nothing to commit or commit skipped — pushing existing branch…");
    }
  }
  const push = run("git", ["push"]);
  if (push.status !== 0) {
    console.error("[vercel] git push failed. Push manually, then wait for Vercel build.");
    process.exit(push.status ?? 1);
  }
  console.log("\n[vercel] Pushed. Vercel will build from Git (check dashboard).\n");
}

function readVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    return String(pkg.version ?? "?");
  } catch {
    return "?";
  }
}

const installer = path.join(root, "public", "RestaurantPOSSetup.exe");
if (!fs.existsSync(installer) || fs.statSync(installer).size < 50_000) {
  console.error("[vercel] Missing public/RestaurantPOSSetup.exe — run npm run update:restaurant-pos first");
  process.exit(1);
}

const installerMb = fs.statSync(installer).size / 1024 / 1024;
if (installerMb > 99) {
  console.warn(
    `[vercel] Warning: installer is ${installerMb.toFixed(1)} MB (Vercel limit 100 MB per file). Prefer VERCEL_DEPLOY=git`,
  );
}

syncBuildMetaToDist();
pruneBeforeUpload();

if (process.env.VERCEL_DEPLOY === "git") {
  deployViaGit();
  process.exit(0);
}

if (!scanLargeFiles()) {
  console.log("[vercel] Retrying hint: VERCEL_DEPLOY=git npm run deploy:vercel\n");
  process.exit(1);
}

const version = readVersion();
console.log(`\n[vercel] CLI production deploy (app v${version})…\n`);

const r = run("npx", ["vercel", "deploy", "--prod", "--yes"]);

if (r.status !== 0) {
  console.error(
    "\n[vercel] CLI deploy failed.\n" +
      "  Use git instead (best for ~98 MB installer):\n" +
      "    VERCEL_DEPLOY=git npm run deploy:vercel\n\n" +
      "  Or: delete release\\win-unpacked, then retry npm run deploy:vercel\n",
  );
  process.exit(r.status ?? 1);
}

console.log("\n[vercel] Production deploy finished. Hard-refresh the site (Ctrl+F5).\n");
