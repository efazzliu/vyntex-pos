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

function mapRequestToCanonical(basenameLower: string): string | null {
  if (
    basenameLower === "vyntexpossetup.exe" ||
    basenameLower === "restaurantpossetup.exe"
  ) {
    return CANONICAL_X64;
  }
  if (
    basenameLower === "vyntexpossetup-arm64.exe" ||
    basenameLower === "restaurantpossetup-arm64.exe"
  ) {
    return CANONICAL_ARM64;
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
  return (req, res, next) => {
    const raw = req.url?.split("?")[0] ?? "";
    if (!/\.exe$/i.test(raw)) {
      next();
      return;
    }

    let basename: string;
    try {
      basename = path.basename(decodeURIComponent(raw)).toLowerCase();
    } catch {
      next();
      return;
    }

    const canonical = mapRequestToCanonical(basename);
    if (!canonical) {
      next();
      return;
    }

    const diskPath = path.join(publicDir, path.basename(canonical));
    if (isRealInstaller(diskPath)) {
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${path.basename(canonical)}"`,
      );
      fs.createReadStream(diskPath).pipe(res);
      return;
    }

    res.statusCode = 503;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(installerBody(canonical));
  };
}
