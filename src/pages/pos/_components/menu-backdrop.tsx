/**
 * Menu & Categories background (Settings sections and Products): pale lavender page with sweeping
 * translucent blue bands that curve from the lower left up to the top right, separated by a soft
 * light line. Decorative, behind all content; the parent needs `relative isolate`.
 */
export default function MenuBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f3f5fd_0%,#f6f7fe_45%,#f8f9ff_100%)]" />
      <svg
        className="absolute right-0 top-0 h-[520px] w-full [mask-image:linear-gradient(180deg,#000_0%,#000_62%,transparent_100%)]"
        viewBox="0 0 1200 460"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="pbBandDeep" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#9db8f6" stopOpacity="0" />
            <stop offset="0.45" stopColor="#9db8f6" stopOpacity="0.35" />
            <stop offset="0.8" stopColor="#7fa2f2" stopOpacity="0.55" />
            <stop offset="1" stopColor="#8aaaf4" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="pbBandSoft" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#c3d3fa" stopOpacity="0" />
            <stop offset="0.5" stopColor="#c3d3fa" stopOpacity="0.45" />
            <stop offset="1" stopColor="#d3defb" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="pbBandHaze" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#dfe7fd" stopOpacity="0" />
            <stop offset="0.6" stopColor="#dfe7fd" stopOpacity="0.55" />
            <stop offset="1" stopColor="#e8eefe" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="pbEdge" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.5" />
          </linearGradient>
          <filter id="pbBlurWide" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="pbBlurSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Outer haze to the right of the bands */}
        <path d="M380 460 C 880 430, 1110 230, 1200 -10 L 1200 460 Z" fill="url(#pbBandHaze)" filter="url(#pbBlurWide)" />
        {/* Wide soft band */}
        <path
          d="M0 330 C 420 322, 760 222, 960 -10 L 1110 -10 C 900 242, 520 362, 0 382 Z"
          fill="url(#pbBandSoft)"
          filter="url(#pbBlurSoft)"
        />
        {/* Deep band */}
        <path
          d="M180 362 C 620 342, 920 232, 1060 -10 L 1170 -10 C 1010 252, 700 382, 250 402 Z"
          fill="url(#pbBandDeep)"
          filter="url(#pbBlurSoft)"
        />
        {/* Light line between the bands */}
        <path d="M0 382 C 520 362, 900 242, 1110 -10" stroke="url(#pbEdge)" strokeWidth="3" filter="url(#pbBlurSoft)" />
        <path d="M250 402 C 700 382, 1010 252, 1170 -10" stroke="url(#pbEdge)" strokeWidth="2" opacity="0.7" />
      </svg>
    </div>
  );
}

