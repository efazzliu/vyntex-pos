import type { ReactNode } from "react";
import {
  ArrowRight,
  Box,
  ChefHat,
  Gift,
  Layers,
  Puzzle,
  SlidersHorizontal,
  ToggleRight,
  UtensilsCrossed,
} from "lucide-react";
import { hasEnterpriseSupplyRecipe, isMenuVariantsEnabled } from "../_lib/plan-features.ts";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type CardArtKind = "burger" | "folders" | "sizes" | "extras" | "combo" | "recipe" | "toggle";

const CARDS: {
  id: string;
  icon: typeof Box;
  titleKey: string;
  descKey: string;
  art: CardArtKind;
  /** Top row: three wide cards; bottom row: four. */
  wide: boolean;
  enterpriseOnly?: boolean;
}[] = [
  { id: "products", icon: Box, titleKey: "settings.menu_link_title", descKey: "settings.menu_link_desc", art: "burger", wide: true },
  { id: "categories", icon: Layers, titleKey: "settings.menu_categories_title", descKey: "settings.menu_categories_desc", art: "folders", wide: true },
  { id: "variants", icon: SlidersHorizontal, titleKey: "settings.menu_variants_title", descKey: "settings.menu_variants_desc", art: "sizes", wide: true },
  { id: "modifiers", icon: Puzzle, titleKey: "settings.menu_modifiers_title", descKey: "settings.menu_modifiers_desc", art: "extras", wide: false },
  { id: "combo", icon: Gift, titleKey: "settings.menu_combo_title", descKey: "settings.menu_combo_desc", art: "combo", wide: false },
  {
    id: "recipes",
    icon: ChefHat,
    titleKey: "settings.menu_recipes_title",
    descKey: "settings.menu_recipes_desc",
    art: "recipe",
    wide: false,
    enterpriseOnly: true,
  },
  { id: "availability", icon: ToggleRight, titleKey: "settings.menu_availability_title", descKey: "settings.menu_availability_desc", art: "toggle", wide: false },
];

type SettingsMenuPanelProps = {
  t: Translate;
  /** License tier: recipes (stock ingredients per product) are an Enterprise feature. */
  plan: string;
  onOpenMenu: () => void;
  /** Categories card opens the Settings categories page instead of the Products page. */
  onOpenCategories?: () => void;
  /** Variants card opens the Settings variants page. */
  onOpenVariants?: () => void;
  /** Modifiers card opens the Settings modifiers page. */
  onOpenModifiers?: () => void;
};

export default function SettingsMenuPanel({
  t,
  plan,
  onOpenMenu,
  onOpenCategories,
  onOpenVariants,
  onOpenModifiers,
}: SettingsMenuPanelProps) {
  const recipesEnabled = hasEnterpriseSupplyRecipe(plan);
  const variantsEnabled = isMenuVariantsEnabled();
  const visibleCards = CARDS.filter((card) => card.id !== "variants" || variantsEnabled);
  return (
    <div className="space-y-5">
      <header className="flex min-w-0 items-center gap-4 px-1">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#dbe7ff] bg-[linear-gradient(145deg,#f4f8ff,#e3edff)] text-[#2563eb] shadow-[0_8px_20px_-12px_rgba(37,99,235,0.55)]">
          <UtensilsCrossed className="size-6" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-[#0b1220]">
            {t("settings.cat.menu")}
          </h1>
          <p className="mt-1 text-[14px] text-[#475569]">{t("settings.cat.menu_desc")}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
        {visibleCards.map((card) => {
          const locked = Boolean(card.enterpriseOnly && !recipesEnabled);
          return (
            <MenuCard
              key={card.id}
              icon={card.icon}
              title={t(card.titleKey)}
              description={t(card.descKey)}
              art={<CardArt kind={card.art} />}
              wide={card.wide}
              badge={locked ? t("settings.menu_enterprise_badge") : undefined}
              disabled={locked}
              onClick={
                card.id === "categories" && onOpenCategories
                  ? onOpenCategories
                  : card.id === "variants" && onOpenVariants
                    ? onOpenVariants
                    : card.id === "modifiers" && onOpenModifiers
                      ? onOpenModifiers
                      : onOpenMenu
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function MenuCard({
  icon: Icon,
  title,
  description,
  art,
  wide,
  badge,
  disabled,
  onClick,
}: {
  icon: typeof Box;
  title: string;
  description: string;
  art: ReactNode;
  wide: boolean;
  badge?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "group relative isolate flex flex-col overflow-hidden rounded-[24px] border border-[#e3ebf7] p-5 text-left",
        "bg-[linear-gradient(150deg,#ffffff_0%,#f7faff_55%,#eef4ff_100%)]",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_36px_-26px_rgba(37,99,235,0.45)]",
        "transition duration-200 enabled:hover:-translate-y-0.5 enabled:hover:border-[#9cc0ff]",
        "enabled:hover:shadow-[0_0_0_3px_rgba(37,99,235,0.10),0_24px_44px_-26px_rgba(37,99,235,0.55)]",
        "disabled:cursor-not-allowed disabled:opacity-70",
        wide ? "min-h-[210px] lg:col-span-4" : "min-h-[220px] lg:col-span-3",
      ].join(" ")}
    >
      {/* Soft light sweep behind the illustration */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 -z-10 size-64 rounded-full bg-[radial-gradient(circle,rgba(147,197,253,0.35),rgba(255,255,255,0)_70%)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 -z-10 h-40 w-[140%] rotate-[-6deg] rounded-[100%] bg-[linear-gradient(90deg,rgba(219,234,254,0.0),rgba(219,234,254,0.55),rgba(219,234,254,0.0))]"
      />

      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#dbe7ff] bg-[linear-gradient(145deg,#f5f9ff,#e4eeff)] text-[#2563eb] shadow-[inset_0_1px_0_#ffffff,0_6px_14px_-10px_rgba(37,99,235,0.6)]">
        <Icon className="size-[22px]" strokeWidth={1.8} />
      </span>

      <span
        aria-hidden
        className={[
          "pointer-events-none absolute transition duration-300 group-enabled:group-hover:-translate-y-1 group-enabled:group-hover:scale-[1.03]",
          wide ? "right-3 top-3 h-[118px] w-[46%] max-w-[190px]" : "right-2 top-3 h-[104px] w-[52%] max-w-[160px]",
        ].join(" ")}
      >
        {art}
      </span>

      <span className={wide ? "mt-7" : "mt-8"}>
        <span className="flex flex-wrap items-center gap-2">
          <span className={["font-bold tracking-tight text-[#0b1220]", wide ? "text-[24px]" : "text-[21px]"].join(" ")}>
            {title}
          </span>
          {badge ? (
            <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11px] font-semibold text-[#4338ca]">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-2 block pr-14 text-[13px] leading-relaxed text-[#334155]">{description}</span>
      </span>

      <span className="absolute bottom-4 right-4 flex size-11 items-center justify-center rounded-xl border border-[#e3ebf7] bg-white text-[#0b1220] shadow-[0_6px_16px_-10px_rgba(15,23,42,0.45)] transition group-enabled:group-hover:border-[#9cc0ff] group-enabled:group-hover:text-[#2563eb]">
        <ArrowRight className="size-[18px]" strokeWidth={2.2} />
      </span>
    </button>
  );
}

function CardArt({ kind }: { kind: CardArtKind }) {
  if (kind === "burger") return <BurgerArt />;
  if (kind === "folders") return <FolderArt />;
  if (kind === "sizes") return <SizesArt />;
  if (kind === "extras") return <ExtrasArt />;
  if (kind === "combo") return <ComboArt />;
  if (kind === "recipe") return <RecipeArt />;
  return <ToggleArt />;
}

const svgProps = { viewBox: "0 0 200 140", className: "h-full w-full", preserveAspectRatio: "xMidYMid meet" } as const;

function Shadow({ cx = 100, cy = 128, rx = 62 }: { cx?: number; cy?: number; rx?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={7} fill="#1e3a8a" opacity="0.10" />;
}

function BurgerArt() {
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="bunTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc56b" />
          <stop offset="0.55" stopColor="#f29b2c" />
          <stop offset="1" stopColor="#d9771a" />
        </linearGradient>
        <linearGradient id="bunBottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0a03a" />
          <stop offset="1" stopColor="#c96a17" />
        </linearGradient>
        <linearGradient id="patty" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a3b1d" />
          <stop offset="1" stopColor="#4a210f" />
        </linearGradient>
      </defs>
      <Shadow rx={66} />
      <path d="M40 98h120c3 0 5 3 4 6-4 14-26 20-64 20s-60-6-64-20c-1-3 1-6 4-6z" fill="url(#bunBottom)" />
      <rect x="38" y="82" width="124" height="18" rx="9" fill="url(#patty)" />
      <path d="M42 80c10 8 18-2 28 4s16-6 26 2 18-4 28 2 16-6 28 0l-2 6H40z" fill="#ffd23f" />
      <path d="M36 76c8 6 14-4 22 2s14-6 22 0 14-6 22 0 14-6 22 0 14-6 22 0 12-4 18 0l-2 6H36z" fill="#58c04a" />
      <circle cx="74" cy="76" r="6" fill="#e5483a" />
      <circle cx="122" cy="76" r="6" fill="#e5483a" />
      <path d="M36 72c0-30 28-50 64-50s64 20 64 50z" fill="url(#bunTop)" />
      <path d="M58 46c10-12 26-17 42-17" stroke="#fff3d6" strokeWidth="6" strokeLinecap="round" opacity="0.55" fill="none" />
      {[
        [70, 44], [90, 36], [112, 38], [132, 48], [80, 56], [104, 52], [126, 60], [60, 60],
      ].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="3.2" ry="1.8" fill="#fff4d8" transform={`rotate(-20 ${x} ${y})`} />
      ))}
    </svg>
  );
}

function FolderArt() {
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="fBack" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#93c5fd" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="fMid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="fFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbe8fb" />
        </linearGradient>
      </defs>
      <Shadow cx={108} rx={64} />
      <path d="M78 18h30l8 9h52c5 0 9 4 9 9v60H78z" fill="url(#fBack)" />
      <path d="M64 30h30l8 9h52c5 0 9 4 9 9v58H64z" fill="url(#fMid)" />
      <path d="M50 42h30l8 9h52c5 0 9 4 9 9v58H50z" fill="#2563eb" />
      <path d="M44 62c0-5 4-9 9-9h98c5 0 9 4 8 9l-8 54c-1 5-5 8-10 8H55c-5 0-9-3-10-8z" fill="url(#fFront)" />
      <path d="M44 62c0-5 4-9 9-9h98c5 0 9 4 8 9" stroke="#ffffff" strokeWidth="2" fill="none" />
      <g stroke="#2563eb" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M92 74v12c0 4 3 6 6 6M98 74v12M104 74v12c0 4-3 6-6 6M98 92v20" />
        <path d="M118 74c-6 4-6 14 0 18v20" />
      </g>
    </svg>
  );
}

function SizesArt() {
  const cup = (x: number, w: number, h: number, label: string, id: string) => {
    const top = 120 - h;
    return (
      <g>
        <defs>
          <linearGradient id={`${id}Body`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.7" stopColor="#f1f5fb" />
            <stop offset="1" stopColor="#d9e2ef" />
          </linearGradient>
          <linearGradient id={`${id}Lid`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#60a5fa" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <path d={`M${x} ${top + 10}h${w}l-${w * 0.08} ${h - 10}h-${w * 0.84}z`} fill={`url(#${id}Body)`} />
        <rect x={x - 3} y={top} width={w + 6} height="11" rx="5" fill={`url(#${id}Lid)`} />
        <rect x={x + w * 0.12} y={top - 5} width={w * 0.76} height="7" rx="3.5" fill="#3b82f6" />
        <text x={x + w / 2} y={top + h * 0.6} textAnchor="middle" fontSize={w * 0.36} fontWeight="800" fill="#1d4ed8" fontFamily="system-ui, sans-serif">
          {label}
        </text>
      </g>
    );
  };
  return (
    <svg {...svgProps}>
      <Shadow cx={112} rx={74} />
      {cup(40, 34, 46, "S", "cs")}
      {cup(84, 42, 68, "M", "cm")}
      {cup(136, 50, 92, "L", "cl")}
    </svg>
  );
}

function ExtrasArt() {
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="cheese" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="1" stopColor="#f4b400" />
        </linearGradient>
        <radialGradient id="plus" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1d4ed8" />
        </radialGradient>
      </defs>
      <Shadow cx={110} rx={64} />
      <path d="M66 30l66 16v34L66 66z" fill="#f4b400" />
      <path d="M66 30l66 16-14 14-64-12z" fill="#ffe680" />
      <path d="M54 48l64 12v34L54 80z" fill="url(#cheese)" />
      <circle cx="74" cy="66" r="5" fill="#e09a00" />
      <circle cx="96" cy="76" r="4" fill="#e09a00" />
      <circle cx="104" cy="62" r="3" fill="#e09a00" />
      <g fill="none" strokeLinecap="round">
        <ellipse cx="150" cy="58" rx="22" ry="18" stroke="#8e3b6b" strokeWidth="5" />
        <ellipse cx="150" cy="58" rx="14" ry="11" stroke="#b5528b" strokeWidth="4" />
        <ellipse cx="150" cy="58" rx="6" ry="5" stroke="#d17aac" strokeWidth="3" />
      </g>
      <path d="M48 104c0-10 9-17 20-17s20 7 20 17z" fill="#efe6dc" />
      <rect x="61" y="102" width="14" height="16" rx="5" fill="#f7f1ea" />
      <circle cx="150" cy="104" r="17" fill="url(#plus)" />
      <path d="M150 96v16M142 104h16" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function ComboArt() {
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="cup" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="fries" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd54d" />
          <stop offset="1" stopColor="#f2a516" />
        </linearGradient>
        <linearGradient id="cBun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc56b" />
          <stop offset="1" stopColor="#d9771a" />
        </linearGradient>
      </defs>
      <Shadow cx={104} rx={70} />
      <path d="M132 42h36l-5 80h-26z" fill="url(#cup)" />
      <rect x="129" y="36" width="42" height="9" rx="4" fill="#bfdbfe" />
      <path d="M154 38l10-26" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
      {[38, 46, 54, 62, 70].map((x, i) => (
        <rect key={x} x={x} y={30 + (i % 2) * 6} width="7" height="40" rx="2" fill="url(#fries)" transform={`rotate(${(i - 2) * 6} ${x} 60)`} />
      ))}
      <path d="M32 58h50l-6 34H38z" fill="#2563eb" />
      <path d="M32 58h50" stroke="#93c5fd" strokeWidth="3" />
      <path d="M72 104h70c2 0 3 2 2 4-3 9-16 14-37 14s-34-5-37-14c-1-2 0-4 2-4z" fill="#d9771a" />
      <rect x="70" y="94" width="76" height="11" rx="5" fill="#5a2a14" />
      <path d="M72 92c6 5 11-2 17 2s10-4 16 0 10-4 16 0 10-4 18 0l-1 4H72z" fill="#58c04a" />
      <path d="M70 90c0-20 17-32 38-32s38 12 38 32z" fill="url(#cBun)" />
    </svg>
  );
}

function RecipeArt() {
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="board" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9a066" />
          <stop offset="1" stopColor="#a8693a" />
        </linearGradient>
        <linearGradient id="chicken" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd9cf" />
          <stop offset="1" stopColor="#f3a99a" />
        </linearGradient>
        <linearGradient id="oil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#d4a017" />
        </linearGradient>
      </defs>
      <Shadow cx={98} rx={72} />
      <path d="M26 96l104-20 34 16-104 22z" fill="url(#board)" />
      <path d="M26 96l34 18v6L26 102z" fill="#8a5428" />
      <path d="M60 114l104-22v6L60 120z" fill="#96602f" />
      <ellipse cx="80" cy="90" rx="26" ry="10" fill="url(#chicken)" transform="rotate(-10 80 90)" />
      <ellipse cx="112" cy="84" rx="24" ry="9" fill="url(#chicken)" transform="rotate(-10 112 84)" />
      <path d="M62 92c10-4 24-6 34-6M96 86c10-4 22-6 30-5" stroke="#fff3ef" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <path d="M40 80c4-10 14-12 18-4-6 2-10 4-18 4z" fill="#3fa34d" />
      <path d="M46 74c6-8 14-6 14 0-6 0-10 1-14 0z" fill="#58c04a" />
      <path d="M156 34h12v14c8 6 10 14 10 22v34c0 6-4 10-10 10h-12c-6 0-10-4-10-10V70c0-8 2-16 10-22z" fill="url(#oil)" opacity="0.95" />
      <path d="M152 74h22" stroke="#fff" strokeWidth="2" opacity="0.6" />
      <rect x="155" y="24" width="14" height="12" rx="3" fill="#1f2937" />
      <path d="M150 76c0-10 4-18 10-24" stroke="#fffbeb" strokeWidth="3" strokeLinecap="round" opacity="0.6" fill="none" />
    </svg>
  );
}

function ToggleArt() {
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="track" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <radialGradient id="knob" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e2e8f0" />
        </radialGradient>
      </defs>
      <Shadow cx={108} rx={66} />
      <rect x="40" y="38" width="136" height="70" rx="35" fill="url(#track)" />
      <rect x="44" y="42" width="128" height="30" rx="15" fill="#ffffff" opacity="0.18" />
      <path d="M68 74l12 12 22-24" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="140" cy="73" r="29" fill="url(#knob)" />
      <circle cx="140" cy="73" r="29" fill="none" stroke="#ffffff" strokeWidth="2" />
    </svg>
  );
}
