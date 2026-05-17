/**
 * Keep only the latest published installers for a POS product line.
 * Run after copy-windows-installers (update:*-pos).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POS_PRODUCTS, resolvePosProductId } from "./pos-products.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const LEGACY_NAMES = ["VyntexPOSSetup.exe", "VyntexPOSSetup-arm64.exe"];

function buildVersionedRe() {
  const prefixes = [...new Set(Object.values(POS_PRODUCTS).map((p) => p.artifactPrefix))];
  return new RegExp(
    `^(${[...prefixes, "VyntexPOSSetup"].join("|")})-(\\d+\\.\\d+\\.\\d+)-(x64|arm64)\\.exe(\\.blockmap)?$`,
  );
}

const VERSIONED_INSTALLER_RE = buildVersionedRe();

/** @param {string} dir */
function purgeDirectory(dir, product, version) {
  if (!fs.existsSync(dir)) return;
  const keepCanonical = new Set([product.publicExe, product.publicExeArm64]);
  const keepVersioned = new Set([
    `${product.artifactPrefix}-${version}-x64.exe`,
    `${product.artifactPrefix}-${version}-arm64.exe`,
  ]);

  for (const name of fs.readdirSync(dir)) {
    const lower = name.toLowerCase();
    const full = path.join(dir, name);

    if (!lower.endsWith(".exe") && !lower.endsWith(".exe.blockmap")) continue;

    const isLegacyVyntex = LEGACY_NAMES.includes(name);
    const versioned = name.match(VERSIONED_INSTALLER_RE);
    const isCanonical = keepCanonical.has(name);

    let remove = false;
    if (isLegacyVyntex) remove = true;
    else if (versioned) {
      const prefix = versioned[1];
      const ver = versioned[2];
      remove = prefix !== product.artifactPrefix || ver !== version;
    } else if (isCanonical) {
      remove = false;
    } else if (lower.includes("possetup") || lower.includes("vyntexsetup")) {
      remove = true;
    }

    if (!remove) continue;
    fs.unlinkSync(full);
    console.log(`[purge-installers] Removed ${path.relative(root, full)}`);
  }
}

/** Copy latest canonical (+ one versioned name for Vercel rewrite) into dist/. */
function syncDistFromPublic(product, version) {
  const distDir = path.join(root, "dist");
  if (!fs.existsSync(distDir)) return;

  const copies = [
    {
      src: path.join(root, "public", product.publicExe),
      dests: [
        path.join(distDir, product.publicExe),
        path.join(distDir, `${product.artifactPrefix}-${version}-x64.exe`),
      ],
    },
  ];

  const arm64Public = path.join(root, "public", product.publicExeArm64);
  if (fs.existsSync(arm64Public) && fs.statSync(arm64Public).size >= 50_000) {
    copies.push({
      src: arm64Public,
      dests: [
        path.join(distDir, product.publicExeArm64),
        path.join(distDir, `${product.artifactPrefix}-${version}-arm64.exe`),
      ],
    });
  }

  for (const { src, dests } of copies) {
    if (!fs.existsSync(src)) continue;
    for (const dest of dests) {
      fs.copyFileSync(src, dest);
      console.log(`[purge-installers] dist -> ${path.relative(root, dest)}`);
    }
  }
}

export function purgePublishedInstallers(options = {}) {
  const productId =
    resolvePosProductId(options.productId ?? process.env.POS_PRODUCT ?? process.env.VYNTEPOS_PRODUCT) ??
    "restaurant";
  const product = POS_PRODUCTS[productId] ?? POS_PRODUCTS.restaurant;
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const version = String(options.version ?? pkg.version ?? "0.0.0");

  console.log(`\n[purge-installers] ${product.label} — keep v${version} only\n`);

  for (const dir of ["public", "dist", "release"]) {
    purgeDirectory(path.join(root, dir), product, version);
  }

  syncDistFromPublic(product, version);
  syncBuildMetaToDist();
}

/** Vercel / static host serves `dist/build-meta.json` for live version label. */
function syncBuildMetaToDist() {
  const metaSrc = path.join(root, "public", "build-meta.json");
  const distDir = path.join(root, "dist");
  const metaDest = path.join(distDir, "build-meta.json");
  if (!fs.existsSync(metaSrc) || !fs.existsSync(distDir)) return;
  fs.copyFileSync(metaSrc, metaDest);
  console.log(`[purge-installers] dist -> ${path.relative(root, metaDest)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  purgePublishedInstallers();
}
