/**
 * Site-only production deploy (Vercel). No Windows installer build required.
 *
 * Usage: npm run deploy:site
 *
 * Git-triggered Vercel build: VERCEL_DEPLOY=git npm run deploy:site
 * Build only (no upload): SKIP_VERCEL_DEPLOY=1 npm run deploy:site
 *
 * First time: npx vercel login && npx vercel link
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const SITE_GIT_PATHS = [
  "package.json",
  "package-lock.json",
  "vercel.json",
  "index.html",
  "phone.html",
  "vite.config.ts",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "components.json",
  "src",
  "api",
  "public/build-meta.json",
  "public/sw.js",
  "public/site.webmanifest",
  "public/offline.html",
  "public/vyntex-pos-logo.svg",
  "public/vyntex-logo.png",
  "public/INSTALLER_README.txt",
];

if (process.env.SKIP_VERCEL_DEPLOY === "1") {
  console.log("[deploy:site] Skipped Vercel upload (SKIP_VERCEL_DEPLOY=1)");
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

function runNpm(script) {
  const r = run(npmCmd, ["run", script]);
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function readVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    return String(pkg.version ?? "?");
  } catch {
    return "?";
  }
}

function syncBuildMetaToDist() {
  const metaSrc = path.join(root, "public", "build-meta.json");
  const distDir = path.join(root, "dist");
  const metaDest = path.join(distDir, "build-meta.json");
  if (fs.existsSync(metaSrc) && fs.existsSync(distDir)) {
    fs.copyFileSync(metaSrc, metaDest);
    console.log(`[deploy:site] Synced ${path.relative(root, metaDest)}`);
  }
}

function pruneBeforeUpload() {
  const winUnpacked = path.join(root, "release", "win-unpacked");
  if (fs.existsSync(winUnpacked)) {
    console.log("[deploy:site] Removing release/win-unpacked (not for Vercel)…");
    fs.rmSync(winUnpacked, { recursive: true, force: true });
  }
}

function deployViaGit(version) {
  console.log("\n[deploy:site] Git push → Vercel production build…\n");
  run("git", ["add", ...SITE_GIT_PATHS]);
  const commit = run("git", ["commit", "-m", `deploy: site v${version}`], { stdio: "pipe" });
  if (commit.status !== 0) {
    const out = String(commit.stdout || commit.stderr || "");
    if (!/nothing to commit|no changes/i.test(out)) {
      console.log("[deploy:site] Nothing new to commit — pushing branch…");
    }
  }
  const push = run("git", ["push"]);
  if (push.status !== 0) {
    console.error("[deploy:site] git push failed. Push manually, then check Vercel dashboard.");
    process.exit(push.status ?? 1);
  }
  console.log("\n[deploy:site] Pushed. Vercel will build the site from Git.\n");
}

const version = readVersion();
console.log(`\n[deploy:site] Website production (v${version})\n`);

run("node", ["scripts/sync-public-build-meta.mjs"]);
run("node", ["scripts/ensure-vite-supabase-env.mjs"]);
runNpm("build:web");
syncBuildMetaToDist();
pruneBeforeUpload();

if (process.env.SKIP_VERCEL_DEPLOY === "1") {
  console.log("\n[deploy:site] Build finished (deploy skipped).\n");
  process.exit(0);
}

if (process.env.VERCEL_DEPLOY === "git") {
  deployViaGit(version);
  process.exit(0);
}

console.log(`\n[deploy:site] Vercel CLI production deploy (v${version})…\n`);
const deploy = run("npx", ["vercel", "deploy", "--prod", "--yes"]);
if (deploy.status !== 0) {
  console.error(
    "\n[deploy:site] CLI deploy failed.\n" +
      "  Try: VERCEL_DEPLOY=git npm run deploy:site\n" +
      "  Or: npx vercel login && npx vercel link\n",
  );
  process.exit(deploy.status ?? 1);
}

console.log("\n[deploy:site] Live. Hard-refresh the site (Ctrl+F5).\n");
