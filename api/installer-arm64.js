/**
 * Legacy /VyntexPOSSetup-arm64.exe → env URL or /RestaurantPOSSetup-arm64.exe (static).
 */
export default function handler(_req, res) {
  const url =
    trim(process.env.INSTALLER_ARM64_REDIRECT_URL) ||
    trim(process.env.VITE_RESTAURANT_POS_EXE_URL_ARM64);
  if (url) {
    res.setHeader("Location", url);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(302).end();
    return;
  }
  res.setHeader("Location", "/RestaurantPOSSetup-arm64.exe");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(302).end();
}

function trim(v) {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length > 0 && !t.includes("...") ? t : "";
}
