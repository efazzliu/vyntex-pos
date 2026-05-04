import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Check, Smartphone, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import PageHeader from "@/components/page-header.tsx";
import { useAuth } from "@/hooks/use-auth.ts";

const MOBILE_ADDON_MONTHLY = 29;
const MOBILE_ADDON_ANNUAL = 23;

const TIER_ORDER = ["starter", "professional", "enterprise"] as const;
type TierId = (typeof TIER_ORDER)[number];
type BillingMode = "monthly" | "annual";

/** Display prices (USD/mo) — align with admin catalog / Stripe when billing goes live */
const TIER_PRICES: Record<TierId, { monthly: number; annual: number }> = {
  starter: { monthly: 49, annual: 39 },
  professional: { monthly: 99, annual: 79 },
  enterprise: { monthly: 189, annual: 151 },
};

type PaddleCheckoutItem = {
  priceId: string;
  quantity: number;
};

type PaddleGlobal = {
  Initialize: (opts: { token: string }) => void;
  Checkout: {
    open: (opts: { items: PaddleCheckoutItem[] }) => void;
  };
  Environment?: {
    set: (value: "sandbox" | "production") => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

const PADDLE_CLIENT_TOKEN = (import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined)?.trim();
const PADDLE_ENV = ((import.meta.env.VITE_PADDLE_ENV as string | undefined)?.trim().toLowerCase() ??
  "sandbox") as "sandbox" | "production";

const PLAN_PRICE_IDS: Record<TierId, Record<BillingMode, string>> = {
  starter: {
    monthly:
      (import.meta.env.VITE_PADDLE_STARTER_MONTHLY_PRICE_ID as string | undefined)?.trim() ??
      "pri_01kq2fkwssn5ebp7s8kva1cgjd",
    annual:
      (import.meta.env.VITE_PADDLE_STARTER_ANNUAL_PRICE_ID as string | undefined)?.trim() ??
      "pri_01kq2frfxg6txws0hnhg8sk3jw",
  },
  professional: {
    monthly:
      (import.meta.env.VITE_PADDLE_PROFESSIONAL_MONTHLY_PRICE_ID as string | undefined)?.trim() ??
      "pri_01kq2fxerj5j4f6f6bkqmcnngn",
    annual:
      (import.meta.env.VITE_PADDLE_PROFESSIONAL_ANNUAL_PRICE_ID as string | undefined)?.trim() ??
      "pri_01kq2g11wwqe2pv3js23bdvjyb",
  },
  enterprise: {
    monthly:
      (import.meta.env.VITE_PADDLE_ENTERPRISE_MONTHLY_PRICE_ID as string | undefined)?.trim() ??
      "pri_01kq2g6m4ty2sg9yfngb5y3psq",
    annual:
      (import.meta.env.VITE_PADDLE_ENTERPRISE_ANNUAL_PRICE_ID as string | undefined)?.trim() ??
      "pri_01kq2g9x0pr0z63z0xbfghj7y1",
  },
};

const PHONE_ADDON_PRICE_IDS: Record<BillingMode, string> = {
  monthly:
    (import.meta.env.VITE_PADDLE_PHONE_ADDON_MONTHLY_PRICE_ID as string | undefined)?.trim() ??
    "pri_01kq2gejn5q4z3f2hdexpkk4qa",
  annual:
    (import.meta.env.VITE_PADDLE_PHONE_ADDON_ANNUAL_PRICE_ID as string | undefined)?.trim() ??
    "pri_01kq2gg94jx3ayscfqk1gsfqar",
};

let paddleScriptPromise: Promise<void> | null = null;
let paddleInitialized = false;

async function ensurePaddleLoaded() {
  if (typeof window === "undefined") return;
  if (window.Paddle) return;
  if (!paddleScriptPromise) {
    paddleScriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-paddle-script="true"]',
      ) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load Paddle SDK")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      script.async = true;
      script.dataset.paddleScript = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Paddle SDK"));
      document.head.appendChild(script);
    });
  }
  return paddleScriptPromise;
}

async function openPaddleCheckout(items: PaddleCheckoutItem[]) {
  if (!PADDLE_CLIENT_TOKEN) {
    throw new Error("Missing VITE_PADDLE_CLIENT_TOKEN.");
  }
  await ensurePaddleLoaded();
  const paddle = window.Paddle;
  if (!paddle) {
    throw new Error("Paddle SDK is unavailable.");
  }
  if (!paddleInitialized) {
    if (PADDLE_ENV === "sandbox" && paddle.Environment?.set) {
      paddle.Environment.set("sandbox");
    }
    paddle.Initialize({ token: PADDLE_CLIENT_TOKEN });
    paddleInitialized = true;
  }
  paddle.Checkout.open({ items });
}

function tierFeaturesList(t: (key: string, opts?: object) => unknown, id: TierId): string[] {
  const raw = t(`pricing.tiers.${id}.features`, { returnObjects: true });
  return Array.isArray(raw) ? (raw as string[]) : [];
}

export default function PricingPage() {
  const { t } = useTranslation("site");
  const [isAnnual, setIsAnnual] = useState(false);
  const [mobileAddon, setMobileAddon] = useState(false);
  const { signinRedirect } = useAuth();

  const addonPrice = isAnnual ? MOBILE_ADDON_ANNUAL : MOBILE_ADDON_MONTHLY;

  const tierData = useMemo(
    () =>
      TIER_ORDER.map((id) => ({
        id,
        name: t(`pricing.tiers.${id}.name`),
        description: t(`pricing.tiers.${id}.description`),
        features: tierFeaturesList(t, id),
      })),
    [t],
  );

  const handleCheckout = async (tierId: TierId) => {
    const mode: BillingMode = isAnnual ? "annual" : "monthly";
    const primaryPriceId = PLAN_PRICE_IDS[tierId][mode];
    const addonPriceId = PHONE_ADDON_PRICE_IDS[mode];

    if (!primaryPriceId) {
      toast.error("This plan is not configured yet.");
      return;
    }

    const items: PaddleCheckoutItem[] = [{ priceId: primaryPriceId, quantity: 1 }];
    if (mobileAddon && addonPriceId) {
      items.push({ priceId: addonPriceId, quantity: 1 });
    }

    try {
      await openPaddleCheckout(items);
    } catch {
      toast.error("Checkout is not ready yet. Please sign in and continue from billing.");
      await signinRedirect();
    }
  };

  return (
    <>
      <PageHeader
        badge={t("pricing.badge")}
        title={t("pricing.title")}
        subtitle={t("pricing.subtitle")}
      />

      <section className="pb-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 mb-14">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-sm font-medium",
                  !isAnnual ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t("pricing.monthly")}
              </span>
              <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
              <span
                className={cn(
                  "text-sm font-medium",
                  isAnnual ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t("pricing.annual")}
              </span>
              {isAnnual && (
                <Badge className="bg-[#44CC00]/10 text-[#44CC00] border-[#44CC00]/20 hover:bg-[#44CC00]/15">
                  {t("pricing.save")}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 px-5 py-3.5 rounded-xl border border-border bg-card">
              <Smartphone className="size-5 text-primary shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {t("pricing.mobileAddon")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("pricing.mobileAddonHint")}
                </span>
              </div>
              <Switch checked={mobileAddon} onCheckedChange={setMobileAddon} />
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                +${addonPrice}/mo
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto items-stretch">
            {tierData.map((tier, idx) => {
              const isPro = tier.id === "professional";
              const prices = TIER_PRICES[tier.id];
              const basePrice = isAnnual ? prices.annual : prices.monthly;
              const totalPrice = mobileAddon ? basePrice + addonPrice : basePrice;

              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.08 + idx * 0.06, duration: 0.45 }}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-card p-6 lg:p-8 h-full",
                    isPro
                      ? "border-[#0066FF]/40 shadow-lg shadow-primary/10 md:scale-[1.02] md:z-[1]"
                      : "border-border",
                  )}
                >
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <Badge className="bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white border-0 hover:from-[#0055DD] hover:to-[#0099BB]">
                        {t("pricing.mostPopular")}
                      </Badge>
                    </div>
                  )}

                  <div className="mb-4 pt-1">
                    <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      {tier.description}
                    </p>
                  </div>

                  <div className="mb-5">
                    <span className="text-4xl font-bold text-foreground">${totalPrice}</span>
                    <span className="text-muted-foreground">/mo</span>
                    {isAnnual && (
                      <span className="text-xs text-muted-foreground ml-2 block sm:inline sm:ml-2">
                        {t("pricing.billedAnnually")}
                      </span>
                    )}
                  </div>

                  <Button
                    size="lg"
                    onClick={() => void handleCheckout(tier.id)}
                    className={cn(
                      "w-full mb-6 shrink-0",
                      isPro &&
                        "bg-gradient-to-r from-[#0066FF] to-[#00AACC] hover:from-[#0055DD] hover:to-[#0099BB] text-white border-0 shadow-none",
                    )}
                    variant={isPro ? "default" : "outline"}
                  >
                    {t("pricing.getStarted")}
                    <ArrowRight className="ml-1 size-4" />
                  </Button>

                  <ul className="space-y-2.5 flex-1 border-t border-border/70 pt-5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="size-4 text-[#44CC00] mt-0.5 shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                    {mobileAddon && (
                      <li className="flex items-start gap-2">
                        <Smartphone className="size-4 text-[#0066FF] mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground font-medium">
                          {t("pricing.mobileFeature")}
                        </span>
                      </li>
                    )}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
