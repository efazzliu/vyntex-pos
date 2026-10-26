import {
  CalendarCheck,
  ChevronRight,
  Gift,
  Layers,
  Package,
  SlidersHorizontal,
  ToggleRight,
  UtensilsCrossed,
} from "lucide-react";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const CARDS: {
  id: string;
  icon: typeof Package;
  titleKey: string;
  descKey: string;
  art: "burger" | "folders" | "sizes" | "extras" | "combo" | "toggle";
}[] = [
  {
    id: "products",
    icon: Package,
    titleKey: "settings.menu_link_title",
    descKey: "settings.menu_link_desc",
    art: "burger",
  },
  {
    id: "categories",
    icon: Layers,
    titleKey: "settings.menu_categories_title",
    descKey: "settings.menu_categories_desc",
    art: "folders",
  },
  {
    id: "variants",
    icon: SlidersHorizontal,
    titleKey: "settings.menu_variants_title",
    descKey: "settings.menu_variants_desc",
    art: "sizes",
  },
  {
    id: "modifiers",
    icon: CalendarCheck,
    titleKey: "settings.menu_modifiers_title",
    descKey: "settings.menu_modifiers_desc",
    art: "extras",
  },
  {
    id: "combo",
    icon: Gift,
    titleKey: "settings.menu_combo_title",
    descKey: "settings.menu_combo_desc",
    art: "combo",
  },
  {
    id: "availability",
    icon: ToggleRight,
    titleKey: "settings.menu_availability_title",
    descKey: "settings.menu_availability_desc",
    art: "toggle",
  },
];

type SettingsMenuPanelProps = {
  t: Translate;
  onOpenMenu: () => void;
};

export default function SettingsMenuPanel({ t, onOpenMenu }: SettingsMenuPanelProps) {
  return (
    <div className="space-y-4">
      <header className="flex min-w-0 items-center gap-3 px-1">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e7f0ff] text-[#005bd6]">
          <UtensilsCrossed className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-[#0f172a]">
            {t("settings.cat.menu")}
          </h1>
          <p className="mt-0.5 text-sm text-[#64748b]">{t("settings.cat.menu_desc")}</p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            type="button"
            onClick={onOpenMenu}
            className="group relative flex min-h-[168px] items-stretch gap-3 rounded-[22px] border border-[#e6edf5] bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-px hover:border-[#c5d8fb]"
          >
            <span className="min-w-0 flex-1">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#e7f0ff] text-[#005bd6]">
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <span className="mt-4 block text-[16px] font-semibold tracking-tight text-[#0f172a]">
                {t(card.titleKey)}
              </span>
              <span className="mt-1 block max-w-[16rem] text-[13px] leading-snug text-[#64748b]">
                {t(card.descKey)}
              </span>
            </span>
            <span className="relative flex w-[7.5rem] shrink-0 items-center justify-center">
              <CardArt kind={card.art} />
            </span>
            <span className="absolute bottom-4 right-4 flex size-8 items-center justify-center rounded-full border border-[#e6edf5] bg-white text-[#94a3b8] shadow-sm transition group-hover:text-[#005bd6]">
              <ChevronRight className="size-4" />
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

function CardArt({ kind }: { kind: (typeof CARDS)[number]["art"] }) {
  if (kind === "burger") return <BurgerArt />;
  if (kind === "folders") return <FolderArt />;
  if (kind === "sizes") return <SizesArt />;
  if (kind === "extras") return <ExtrasArt />;
  if (kind === "combo") return <ComboArt />;
  return <ToggleArt />;
}

function BurgerArt() {
  return (
    <svg viewBox="0 0 120 96" className="h-24 w-28" aria-hidden>
      <ellipse cx="60" cy="84" rx="34" ry="6" fill="#e8eef8" />
      <path d="M28 46c0-16 14-28 32-28s32 12 32 28v4H28v-4z" fill="#f2b13a" />
      <path d="M34 42c6-8 14-12 26-12s20 4 26 12" fill="none" stroke="#e0942a" strokeWidth="3" strokeLinecap="round" />
      <rect x="30" y="50" width="60" height="8" rx="3" fill="#7dce4a" />
      <rect x="32" y="58" width="56" height="7" rx="2" fill="#efb23a" />
      <path d="M30 66h60c2 8-4 16-30 16S28 74 30 66z" fill="#d9893a" />
      <circle cx="78" cy="30" r="6" fill="#ef6b4a" />
    </svg>
  );
}

function FolderArt() {
  return (
    <svg viewBox="0 0 120 96" className="h-24 w-28" aria-hidden>
      <ellipse cx="62" cy="82" rx="32" ry="6" fill="#e8eef8" />
      <path d="M22 36h28l6 6h40c4 0 8 4 8 8v24c0 4-4 8-8 8H30c-4 0-8-4-8-8V36z" fill="#7eb6ff" />
      <path d="M34 30h24l6 6h28c4 0 8 3 8 8v22c0 4-3 7-8 7H34c-4 0-8-3-8-7V37c0-4 4-7 8-7z" fill="#4d94f5" />
      <path d="M48 28h22l5 6h18c3 0 6 3 6 6v16c0 3-3 6-6 6H48c-3 0-6-3-6-6V34c0-3 3-6 6-6z" fill="#d7e8ff" />
      <path d="M56 40h8M54 46h14" stroke="#4d94f5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SizesArt() {
  return (
    <svg viewBox="0 0 120 96" className="h-24 w-28" aria-hidden>
      <ellipse cx="62" cy="84" rx="36" ry="6" fill="#e8eef8" />
      <path d="M22 40h22c2 0 4 2 4 4v28c0 4-4 8-8 8H26c-4 0-8-4-8-8V44c0-2 2-4 4-4z" fill="#f7f9fc" stroke="#d5e2f5" />
      <path d="M18 40c2-8 6-12 11-12s9 4 11 12" fill="none" stroke="#4d94f5" strokeWidth="3" strokeLinecap="round" />
      <text x="27" y="62" textAnchor="middle" fontSize="11" fontWeight="700" fill="#4d94f5">S</text>
      <path d="M50 34h26c2 0 4 2 4 4v34c0 4-4 8-8 8H54c-4 0-8-4-8-8V38c0-2 2-4 4-4z" fill="#fff" stroke="#d5e2f5" />
      <path d="M48 34c2-10 7-16 13-16s11 6 13 16" fill="none" stroke="#4d94f5" strokeWidth="3" strokeLinecap="round" />
      <text x="63" y="60" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4d94f5">M</text>
      <path d="M82 28h28c2 0 4 2 4 4v40c0 4-4 8-8 8H86c-4 0-8-4-8-8V32c0-2 2-4 4-4z" fill="#f7f9fc" stroke="#d5e2f5" />
      <path d="M80 28c3-12 8-18 14-18s11 6 14 18" fill="none" stroke="#2f80ed" strokeWidth="3" strokeLinecap="round" />
      <text x="96" y="58" textAnchor="middle" fontSize="13" fontWeight="700" fill="#2f80ed">L</text>
    </svg>
  );
}

function ExtrasArt() {
  return (
    <svg viewBox="0 0 120 96" className="h-24 w-28" aria-hidden>
      <ellipse cx="60" cy="84" rx="34" ry="6" fill="#e8eef8" />
      <path d="M24 48c8-16 22-18 28-6 4 8 2 16-6 20-10 4-20 0-22-14z" fill="#f2c14d" />
      <circle cx="34" cy="46" r="3" fill="#e0942a" />
      <circle cx="42" cy="52" r="2.5" fill="#e0942a" />
      <ellipse cx="62" cy="58" rx="14" ry="8" fill="#efe4ef" transform="rotate(-20 62 58)" />
      <ellipse cx="74" cy="52" rx="12" ry="7" fill="#f6e8f2" transform="rotate(18 74 52)" />
      <ellipse cx="86" cy="62" rx="10" ry="6" fill="#efe0ea" />
      <circle cx="96" cy="40" r="10" fill="#2f80ed" />
      <path d="M96 35v10M91 40h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ComboArt() {
  return (
    <svg viewBox="0 0 120 96" className="h-24 w-28" aria-hidden>
      <ellipse cx="60" cy="84" rx="36" ry="6" fill="#e8eef8" />
      <rect x="18" y="48" width="36" height="22" rx="4" fill="#f2c14d" />
      <circle cx="28" cy="58" r="4" fill="#efb23a" />
      <circle cx="40" cy="60" r="4" fill="#efb23a" />
      <path d="M58 34c8 0 16 8 16 18v16H50V50c0-9 4-16 8-16z" fill="#4aa3f0" />
      <rect x="62" y="22" width="4" height="14" rx="2" fill="#d0d7e2" />
      <path d="M78 46c0-10 8-18 16-18 2 8-2 16-8 20l-8 4v-6z" fill="#f2b13a" />
      <rect x="76" y="58" width="22" height="8" rx="3" fill="#7dce4a" />
    </svg>
  );
}

function ToggleArt() {
  return (
    <svg viewBox="0 0 120 96" className="h-24 w-28" aria-hidden>
      <ellipse cx="60" cy="78" rx="30" ry="6" fill="#e8eef8" />
      <rect x="28" y="36" width="64" height="32" rx="16" fill="#2f80ed" />
      <circle cx="74" cy="52" r="12" fill="#fff" />
      <rect x="36" y="58" width="40" height="16" rx="8" fill="#d7e4f8" opacity="0.9" />
    </svg>
  );
}
