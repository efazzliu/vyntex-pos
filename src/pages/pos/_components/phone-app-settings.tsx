import { useState } from "react";
import { ChevronRight, Paintbrush, QrCode } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import WaiterPhonePairSection from "./waiter-phone-pair-section.tsx";
import PhoneAccessDesignSection from "./phone-access-design-section.tsx";

type PhoneAppSection = "activation" | "accessDesign";

type PhoneAppSettingsProps = {
  licenseKey: string;
  canActivate: boolean;
  canEditDesign: boolean;
  venueName?: string;
};

const SECTIONS: {
  id: PhoneAppSection;
  icon: typeof QrCode;
  color: string;
  titleKey: string;
  descKey: string;
}[] = [
  {
    id: "activation",
    icon: QrCode,
    color: "#0284C7",
    titleKey: "settings.phone_app_activation",
    descKey: "settings.phone_app_activation_desc",
  },
  {
    id: "accessDesign",
    icon: Paintbrush,
    color: "#7C3AED",
    titleKey: "settings.phone_app_access",
    descKey: "settings.phone_app_access_desc",
  },
];

export default function PhoneAppSettings({
  licenseKey,
  canActivate,
  canEditDesign,
  venueName,
}: PhoneAppSettingsProps) {
  const { t } = usePosLocale();
  const [section, setSection] = useState<PhoneAppSection | null>(null);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const on = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(on ? null : item.id)}
              className={cn(
                "group flex items-center gap-3.5 rounded-[18px] border bg-[#131A2E]",
                "px-4 py-[17px] text-left cursor-pointer",
                "transition-all duration-200 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]/50",
                on
                  ? "border-[#0066FF] shadow-[0_14px_32px_-18px_rgba(0,102,255,0.45)]"
                  : "border-[#1e2a45] hover:-translate-y-px hover:border-[#7C3AED]/30 hover:shadow-[0_14px_32px_-18px_rgba(124,58,237,0.45)]",
              )}
            >
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${item.color}1F` }}
              >
                <Icon
                  className="size-[22px]"
                  style={{ color: item.color }}
                  strokeWidth={1.75}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-tight text-white">
                  {t(item.titleKey)}
                </p>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-[#8b93a7]">
                  {t(item.descKey)}
                </p>
              </div>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                  on
                    ? "bg-[#0066FF]/10 text-[#0066FF] rotate-90"
                    : "text-[#7C3AED]/70 group-hover:translate-x-0.5 group-hover:bg-[#7C3AED]/10 group-hover:text-[#7C3AED]",
                )}
              >
                <ChevronRight className="size-5" strokeWidth={2} />
              </span>
            </button>
          );
        })}
      </div>

      {section === "activation" ? (
        <WaiterPhonePairSection
          licenseKey={licenseKey}
          canActivate={canActivate}
        />
      ) : null}

      {section === "accessDesign" ? (
        <PhoneAccessDesignSection
          licenseKey={licenseKey}
          canEdit={canEditDesign}
          venueName={venueName}
        />
      ) : null}
    </div>
  );
}
