/**
 * Run before electron-builder on Windows: stop processes that keep
 * release/win-unpacked/resources/app.asar open, then try to delete that file.
 * Does not remove the whole win-unpacked tree (avoids Explorer EPERM on folders).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const asarPath = path.join(root, "release", "win-unpacked", "resources", "app.asar");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function killPackagingLocks() {
  if (process.platform !== "win32") return;
  try {
    execSync('taskkill /F /IM "Vyntex POS.exe" /T', { stdio: "ignore" });
  } catch {
    /* not running */
  }
  try {
    execSync("taskkill /F /IM electron.exe /T", { stdio: "ignore" });
  } catch {
    /* not running */
  }
}

async function tryUnlinkOrRenameAsarOrExit() {
  for (let i = 0; i < 8; i++) {
    killPackagingLocks();
    try {
      if (!fs.existsSync(asarPath)) return;
      fs.unlinkSync(asarPath);
      return;
    } catch {
      await sleep(600 * (i + 1));
    }
  }
  /* Rename often works when delete is blocked (builder only needs the path free). */
  for (let i = 0; i < 6; i++) {
    killPackagingLocks();
    try {
      if (!fs.existsSync(asarPath)) return;
      const renamed = `${asarPath}.was-locked.${Date.now()}`;
      fs.renameSync(asarPath, renamed);
      console.warn(
        `[free-packaging-locks] Renamed locked app.asar to ${path.basename(renamed)} (you can delete it later).`,
      );
      return;
    } catch {
      await sleep(700 * (i + 1));
    }
  }
  if (!fs.existsSync(asarPath)) return;
  console.error(
    [
      "[free-packaging-locks] Still locked: release\\win-unpacked\\resources\\app.asar",
      "  Close “Vyntex POS”, stop npm run dev:desktop, close Explorer inside release\\.",
      "  Or build to a new output folder (avoids this tree entirely):",
      "      npm run dist:win:fresh",
      "  Or after closing everything: npm run dist:win:full",
    ].join("\n"),
  );
  process.exit(1);
}

if (process.platform === "win32") {
  killPackagingLocks();
  await sleep(1200);
  killPackagingLocks();
  await sleep(400);
  await tryUnlinkOrRenameAsarOrExit();
}
