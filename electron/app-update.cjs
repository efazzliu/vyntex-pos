const { app, ipcMain, BrowserWindow, net, shell } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

let downloadedInstaller = { version: null, path: null };

const UPDATE_ORIGIN = (
  process.env.VYNTEX_UPDATE_ORIGIN || "https://www.vyntexpos.net"
).replace(/\/$/, "");

function parseVersion(v) {
  return String(v || "0")
    .split(/[^\d]+/)
    .filter(Boolean)
    .map((n) => Number(n) || 0);
}

function cmpVersion(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function sendProgress(percent) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("app-update-progress", percent);
    }
  }
}

async function fetchLatestMeta() {
  const paths = ["/build-meta.json", "/__vyntex/build-meta.json"];
  let lastErr;
  for (const p of paths) {
    try {
      const res = await net.fetch(`${UPDATE_ORIGIN}${p}`);
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const j = await res.json();
      const appVersion = String(j?.appVersion ?? "").trim();
      if (appVersion) {
        const notes = String(j?.releaseNotes ?? "").trim();
        return {
          appVersion,
          installerUpdatedAt:
            typeof j.installerUpdatedAt === "string" ? j.installerUpdatedAt : null,
          releaseNotes: notes || null,
        };
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Could not read the latest version.");
}

function installerUrlForArch() {
  if (process.arch === "arm64") {
    return `${UPDATE_ORIGIN}/RestaurantPOSSetup-arm64.exe`;
  }
  return `${UPDATE_ORIGIN}/RestaurantPOSSetup.exe`;
}

async function downloadInstaller(url, dest) {
  const res = await net.fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }
  const total = Number(res.headers.get("content-length") || 0);
  if (!res.body || typeof res.body.getReader !== "function") {
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    sendProgress(100);
    return;
  }
  const file = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      received += chunk.length;
      if (!file.write(chunk)) {
        await new Promise((resolve) => file.once("drain", resolve));
      }
      if (total > 0) {
        sendProgress(Math.min(99, Math.round((received / total) * 100)));
      }
    }
  } finally {
    await new Promise((resolve, reject) => {
      file.end(() => resolve());
      file.on("error", reject);
    });
  }
  sendProgress(100);
}

function launchInstallerAndQuit(exePath) {
  const child = spawn(exePath, ["/S"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", () => {
    void shell.openPath(exePath);
  });
  child.unref();
  setTimeout(() => {
    app.quit();
  }, 500);
}

async function ensureDownloadedInstaller() {
  if (!app.isPackaged) {
    return { ok: false, error: "dev" };
  }
  const currentVersion = app.getVersion();
  const latest = await fetchLatestMeta();
  if (cmpVersion(latest.appVersion, currentVersion) <= 0) {
    return { ok: false, error: "none", version: latest.appVersion };
  }
  const dest = path.join(
    app.getPath("temp"),
    `VyntexPOS-Setup-${latest.appVersion}.exe`,
  );
  if (
    downloadedInstaller.version === latest.appVersion &&
    downloadedInstaller.path &&
    fs.existsSync(downloadedInstaller.path)
  ) {
    return { ok: true, path: downloadedInstaller.path, version: latest.appVersion };
  }
  await downloadInstaller(installerUrlForArch(), dest);
  downloadedInstaller = { version: latest.appVersion, path: dest };
  return { ok: true, path: dest, version: latest.appVersion };
}

function registerAppUpdateIpc() {
  ipcMain.removeHandler("app-update-check");
  ipcMain.handle("app-update-check", async () => {
    const currentVersion = app.getVersion();
    const latest = await fetchLatestMeta();
    return {
      ok: true,
      currentVersion,
      latestVersion: latest.appVersion,
      updateAvailable: cmpVersion(latest.appVersion, currentVersion) > 0,
      packaged: app.isPackaged,
      releaseNotes: latest.releaseNotes,
      installerUpdatedAt: latest.installerUpdatedAt,
      downloaded: Boolean(
        downloadedInstaller.version === latest.appVersion &&
          downloadedInstaller.path &&
          fs.existsSync(downloadedInstaller.path),
      ),
    };
  });

  ipcMain.removeHandler("app-update-download");
  ipcMain.handle("app-update-download", async () => {
    const result = await ensureDownloadedInstaller();
    if (!result.ok) return result;
    return { ok: true, version: result.version };
  });

  ipcMain.removeHandler("app-update-install");
  ipcMain.handle("app-update-install", async () => {
    const result = await ensureDownloadedInstaller();
    if (!result.ok) return result;
    launchInstallerAndQuit(result.path);
    return { ok: true };
  });

  ipcMain.removeHandler("app-system-info");
  ipcMain.handle("app-system-info", async () => {
    return {
      ok: true,
      appVersion: app.getVersion(),
      packaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron || null,
      chrome: process.versions.chrome || null,
      osRelease: os.release(),
      osType: os.type(),
    };
  });
}

module.exports = { registerAppUpdateIpc };
