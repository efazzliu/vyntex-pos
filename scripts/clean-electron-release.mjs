/**
 * Frees file locks from a previous desktop build so electron-builder can recreate
 * release/win-unpacked. Run manually or via `npm run dist:win:full` / `build:desktop:full`.
 * Normal `npm run dist:win` does not run this (avoids EPERM when Windows locks the tree).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(root, "release");
const winUnpacked = path.join(releaseDir, "win-unpacked");

function killLockingProcesses() {
  if (process.platform !== "win32") return;
  try {
    execSync('taskkill /F /IM "Vyntex POS.exe" /T', { stdio: "ignore" });
  } catch {
    /* not running */
  }
  /*
   * Dev desktop (`npm run dev:desktop`) runs `electron.exe` from node_modules.
   * It can keep handles under release/ on some setups; always try to stop it before rm.
   * (Packaged installs use "Vyntex POS.exe", killed above.)
   */
  try {
    execSync("taskkill /F /IM electron.exe /T", { stdio: "ignore" });
  } catch {
    /* not running */
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Windows: cmd rd sometimes succeeds when Node fs.rm gets EPERM on locked trees. */
function tryWindowsRd(target) {
  if (process.platform !== "win32" || !fs.existsSync(target)) return;
  try {
    execSync(`cmd /c rd /s /q "${target}"`, {
      stdio: "ignore",
      windowsHide: true,
    });
  } catch {
    /* still locked */
  }
}

async function rmWithRetry(target, label) {
  const attempts = 6;
  for (let i = 0; i < attempts; i++) {
    killLockingProcesses();
    try {
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
      return;
    } catch (err) {
      tryWindowsRd(target);
      if (!fs.existsSync(target)) return;
      if (i === attempts - 1) {
        const grave = `${target}.__trash_${Date.now()}`;
        try {
          fs.renameSync(target, grave);
          console.warn(
            `[clean-electron-release] Could not delete ${label}; renamed to ${path.basename(grave)}. You can delete that folder later in File Explorer.`,
          );
          tryWindowsRd(grave);
          return;
        } catch {
          /* fall through */
        }
        console.error(
          [
            `[clean-electron-release] Could not remove or rename ${label}.`,
            `  • Stop dev: Ctrl+C on “npm run dev” / “npm run dev:desktop”.`,
            `  • Close File Explorer windows showing release\\ (or any folder inside it).`,
            `  • Close “Vyntex POS” if opened from release\\win-unpacked.`,
            `  • For a normal build without cleaning first, use: npm run dist:win`,
            "",
            err instanceof Error ? err.message : err,
          ].join("\n"),
        );
        process.exit(1);
      }
      await sleep(1200 * (i + 1));
    }
  }
}

killLockingProcesses();
await sleep(1200);

// Only remove the unpacked app dir (avoids EPERM on entire release/ from other tools).
await rmWithRetry(winUnpacked, "release/win-unpacked");
