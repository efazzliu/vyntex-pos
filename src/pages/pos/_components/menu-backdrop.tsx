/**
 * Menu & Categories background (Settings sections and Products): pale lavender page with sweeping
 * translucent blue bands that curve from the lower left up to the top right, separated by a soft
 * light line. Decorative, behind all content; the parent needs `relative isolate`.
 */
export default function MenuBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#eef2fb]" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="menuBandA" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.35" />
            <stop offset="55%" stopColor="#60a5fa" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="menuBandB" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#eff6ff" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path
          d="M-80 820 C 220 640, 480 560, 760 420 S 1280 120, 1520 -40 L 1520 980 L -80 980 Z"
          fill="url(#menuBandA)"
        />
        <path
          d="M-80 880 C 260 700, 520 620, 820 490 S 1320 180, 1540 20 L 1540 980 L -80 980 Z"
          fill="url(#menuBandB)"
        />
        <path
          d="M-80 760 C 240 590, 500 510, 780 380 S 1300 90, 1520 -80"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.55"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
