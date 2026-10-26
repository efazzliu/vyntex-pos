/**
 * Hex mirrors of the `--brand-*` tokens in `src/index.css` (sampled from `public/vyntex-logo.png`).
 * Use only where a CSS variable cannot work: inline styles that append hex alpha (`${hex}1F`),
 * chart libraries, canvas, and printed HTML. Prefer `bg-brand`, `text-brand`, … in class names.
 */
export const BRAND = {
  primary: "#005BD6",
  primaryHover: "#0046C8",
  primaryActive: "#00259F",
  sky: "#0079EB",
  cyan: "#00C6FF",
  navy: "#000853",
  accent: "#12C959",
  accentStrong: "#007471",
  lime: "#97FD2C",
  deepTeal: "#003054",
} as const;

/** Previous primary blue; still present in saved branding / category colors. */
export const LEGACY_BRAND_BLUE = "#0066FF";
