/**
 * Vercel Serverless: redirect ARM64 installer path to a hosted .exe URL.
 */
export default function handler(_req, res) {
  const url =
    trim(process.env.INSTALLER_ARM64_REDIRECT_URL) ||
    trim(process.env.VITE_RESTAURANT_POS_EXE_URL_ARM64);
  if (!url) {
    res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(
      "Windows ARM64 installer is not configured. Set VITE_RESTAURANT_POS_EXE_URL_ARM64 " +
        "(or INSTALLER_ARM64_REDIRECT_URL) in Vercel environment variables to a public HTTPS URL.",
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
