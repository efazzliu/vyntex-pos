/**
 * Vercel Serverless: redirect canonical Windows x64 installer path to a hosted .exe URL.
 * Set VITE_RESTAURANT_POS_EXE_URL_X64 (or legacy VITE_RESTAURANT_POS_EXE_URL) in the
 * Vercel project environment so https://your-domain/RestaurantPOSSetup.exe works without
 * committing the binary to git.
 */
export default function handler(_req, res) {
  const url =
    trim(process.env.INSTALLER_X64_REDIRECT_URL) ||
    trim(process.env.VITE_RESTAURANT_POS_EXE_URL_X64) ||
    trim(process.env.VITE_RESTAURANT_POS_EXE_URL);
  if (!url) {
    res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(
      "Windows x64 installer is not configured. In Vercel → Settings → Environment Variables, " +
        "set VITE_RESTAURANT_POS_EXE_URL_X64 to the public HTTPS URL of RestaurantPOSSetup.exe " +
        "(e.g. Supabase Storage). Optional override: INSTALLER_X64_REDIRECT_URL.",
    );
    return;
  }
  res.setHeader("Location", url);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(302).end();
}

function trim(v) {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length > 0 && !t.includes("...") ? t : "";
}
