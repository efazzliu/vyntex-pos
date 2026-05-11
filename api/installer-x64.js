/**
 * Legacy URL /VyntexPOSSetup.exe → external CDN (env) or same-site /RestaurantPOSSetup.exe
 * when the installer is shipped in public/ (Vite build). Do not rewrite canonical paths in
 * vercel.json or the static file would never be served.
 */
export default function handler(_req, res) {
  const url =
    trim(process.env.INSTALLER_X64_REDIRECT_URL) ||
    trim(process.env.VITE_RESTAURANT_POS_EXE_URL_X64) ||
    trim(process.env.VITE_RESTAURANT_POS_EXE_URL);
  if (url) {
    res.setHeader("Location", url);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(302).end();
    return;
  }
  res.setHeader("Location", "/RestaurantPOSSetup.exe");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(302).end();
}

function trim(v) {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length > 0 && !t.includes("...") ? t : "";
}
