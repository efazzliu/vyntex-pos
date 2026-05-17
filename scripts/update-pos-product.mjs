/**
 * Full update (web build + Windows NSIS + copy to public/) for a POS product line.
 *
 * Usage:
 *   npm run update:restaurant-pos
 *   npm run update:fitness-pos      (when enabled in pos-products.mjs)
 *   npm run pos-update -- restaurant
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  POS_PRODUCTS,
  listPosProductIds,
  resolvePosProductId,
} from "./pos-products.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

function run(label, command, args, extraEnv = {}) {
  console.log(`\n[update-pos] ${label}…`);
  const r = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: isWin,
  });
  if (r.status !== 0) {
    console.error(`[update-pos] Failed: ${label}`);
    process.exit(r.status ?? 1);
  }
}

function parseArgv() {
  const rest = process.argv.slice(2).filter(Boolean);
  const noVercel = rest.includes("--no-vercel");
  const filtered = rest.filter((a) => a !== "--no-vercel");
  return { noVercel, filtered };
}

function parseProductArg(filtered) {
  if (filtered.length === 0) return null;
  const joined = filtered.join(" ").trim();
  const single = resolvePosProductId(filtered[0]);
  if (single) return single;
  return resolvePosProductId(joined);
}

const { noVercel, filtered: cliArgs } = parseArgv();

const productId = parseProductArg(cliArgs);
if (!productId) {
  console.error(
    [
      "Usage: npm run update:restaurant-pos",
      "   or: npm run pos-update -- restaurant",
      "",
      `Products: ${listPosProductIds().join(", ")}`,
    ].join("\n"),
  );
  process.exit(1);
}

const product = POS_PRODUCTS[productId];
if (!product) {
  console.error(`Unknown product: ${productId}`);
  process.exit(1);
}

if (!product.enabled) {
  console.error(
    [
      `${product.label} is not enabled yet.`,
      `Edit scripts/pos-products.mjs → set ${productId}.enabled = true`,
      "when branding, routes, and electron config are ready.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`\n=== Vyntex update: ${product.label} ===\n`);

const env = {
  VYNTEPOS_PRODUCT: productId,
  POS_PRODUCT: productId,
};

run("Clean electron release", npmCmd, ["run", "clean:electron-release"], env);
run("Build Electron bundle (dist/)", npmCmd, ["run", "build:electron"], env);

console.log("\n[update-pos] electron-builder (NSIS)…");
const eb = spawnSync(
  "npx",
  ["electron-builder", "--win", "nsis"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
      npm_config_pos_product: productId,
    },
    shell: isWin,
  },
);
if (eb.status !== 0) process.exit(eb.status ?? 1);

run("Copy installers + keep latest only", npmCmd, ["run", "copy-installers"], env);

const skipVercel =
  noVercel ||
  process.env.SKIP_VERCEL_DEPLOY === "1" ||
  process.env.VERCEL_DEPLOY === "0";

if (!skipVercel && productId === "restaurant") {
  console.log("\n[update-pos] Vercel production deploy (git push — reliable for large .exe)…");
  const vercel = spawnSync("node", ["scripts/deploy-vercel.mjs"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, VERCEL_DEPLOY: process.env.VERCEL_DEPLOY ?? "git" },
    shell: isWin,
  });
  if (vercel.status !== 0) {
    console.warn(
      "[update-pos] Vercel deploy failed — local build is OK. Retry: npm run deploy:vercel:git",
    );
  }
} else if (skipVercel) {
  console.log("\n[update-pos] Vercel deploy skipped (--no-vercel or SKIP_VERCEL_DEPLOY=1)");
}

console.log(`\n[update-pos] Done — ${product.label}`);
console.log(`  Publish only: public/${product.publicExe}`);
console.log(`  dist/${product.publicExe} + dist/${product.artifactPrefix}-<version>-x64.exe`);
if (!skipVercel && productId === "restaurant") {
  console.log("  Vercel: production deploy attempted (dashboard shows build-meta.json version)");
}
console.log(`  (older ${product.artifactPrefix}-* and VyntexPOSSetup.exe removed)\n`);
