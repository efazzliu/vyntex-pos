/**
 * Dev / preview: serve Windows installers from public/ with a stable URL and
 * avoid the SPA swallowing missing .exe requests (React 404).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";

type Next = (err?: unknown) => void;

const MIN_REAL_INSTALLER_BYTES = 50_000;

const CANONICAL_X64 = "/RestaurantPOSSetup.exe";
const CANONICAL_ARM64 = "/RestaurantPOSSetup-arm64.exe";
/** Legacy bookmarks / old links */
function installerBody(canonicalName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Installer not available</title>
<style>
body{font-family:system-ui,sans-serif;padding:2rem;max-width:42rem;line-height:1.5;background:#0f1419;color:#e6e9ef}
code{background:#1e2636;padding:.15rem .4rem;border-radius:4px}
a{color:#4d9fff}
</style>
</head>
<body>
<h1>Windows installer is not in this dev server</h1>
<p>You asked for <code>${canonicalName}</code> but <code>public${canonicalName}</code> is missing or too small (placeholder).</p>
<p><strong>Fix:</strong> from the project folder run:</p>
<pre style="background:#1e2636;padding:1rem;border-radius:8px;overflow:auto">npm run dist:win</pre>
<p>That builds the real .exe and copies it into <code>public/</code>. Then restart <code>npm run dev</code>.</p>
<p>Exact filename (note <strong>two S</strong> letters: POS<strong>S</strong>etup): <code>RestaurantPOSSetup.exe</code> (legacy <code>VyntexPOSSetup.exe</code> still works in dev if that file exists).</p>
<p><a href="/">Back to site</a></p>
</body>
</html>`;
}

const VERSIONED_INSTALLER_RE =
  /^restaurantpossetup-(\d+\.\d+\.\d+)-(x64|arm64)\.exe$/;

function parseInstallerRequest(
  rawPath: string,
): { canonical: string; dispositionFilename: string } | null {
  let basename: string;
  try {
    basename = path.basename(decodeURIComponent(rawPath));
  } catch {
    return null;
  }
  const lower = basename.toLowerCase();

  const versioned = lower.match(VERSIONED_INSTALLER_RE);
  if (versioned) {
    const arch = versioned[2];
    return {
      canonical: arch === "arm64" ? CANONICAL_ARM64 : CANONICAL_X64,
      dispositionFilename: basename,
    };
  }

  if (lower === "vyntexpossetup.exe" || lower === "restaurantpossetup.exe") {
    return { canonical: CANONICAL_X64, dispositionFilename: basename };
  }
  if (lower === "vyntexpossetup-arm64.exe" || lower === "restaurantpossetup-arm64.exe") {
    return { canonical: CANONICAL_ARM64, dispositionFilename: basename };
  }
  return null;
}

function isRealInstaller(filePath: string): boolean {
  try {
    const st = fs.statSync(filePath);
    return st.isFile() && st.size >= MIN_REAL_INSTALLER_BYTES;
  } catch {
    return false;
  }
}

export function createInstallerMiddleware(
  publicDir: string,
): (req: IncomingMessage, res: ServerResponse, next: Next) => void {
  const projectRoot = path.join(publicDir, "..");
  const pkgPath = path.join(projectRoot, "package.json");
  const x64Exe = path.join(publicDir, "RestaurantPOSSetup.exe");

  return (req, res, next) => {
    const raw = req.url?.split("?")[0] ?? "";
    if (raw === "/__vyntex/build-meta.json" || raw.endsWith("/__vyntex/build-meta.json")) {
      let appVersion = "0.0.0";
      let installerUpdatedAt: string | null = null;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
        if (typeof pkg.version === "string" && pkg.version.trim()) {
          appVersion = pkg.version.trim();
        }
      } catch {
        /* ignore */
      }
      try {
        if (fs.existsSync(x64Exe)) {
          installerUpdatedAt = fs.statSync(x64Exe).mtime.toISOString();
        }
      } catch {
        /* ignore */
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(
        JSON.stringify({
          appVersion,
          installerUpdatedAt,
        }),
      );
      return;
    }

    if (!/\.exe$/i.test(raw)) {
      next();
      return;
    }

    const parsed = parseInstallerRequest(raw);
    if (!parsed) {
      next();
      return;
    }

    const { canonical, dispositionFilename } = parsed;
    const diskPath = path.join(publicDir, path.basename(canonical));
    if (isRealInstaller(diskPath)) {
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${dispositionFilename}"`,
      );
      fs.createReadStream(diskPath).pipe(res);
      return;
    }

    res.statusCode = 503;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(installerBody(canonical));
  };
}
