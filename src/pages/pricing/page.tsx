import { useState } from "react";
import { motion } from "motion/react";
import { Check, Smartphone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import PageHeader from "@/components/page-header.tsx";
import { useAuth } from "@/hooks/use-auth.ts";

const tiers = [
  {
    name: "Starter",
    monthly: 49,
    annual: 39,
    description: "Perfect for small restaurants getting started",
    popular: false,
    features: [
      "1 terminal",
      "Order management",
      "Basic analytics",
      "Card & cash payments",
      "Email support",
    ],
  },
  {
    name: "Professional",
    monthly: 99,
    annual: 79,
    description: "For growing restaurants that need more",
    popular: true,
    features: [
      "Up to 5 terminals",
      "Everything in Starter",
      "Table management",
      "Kitchen display system",
      "Inventory tracking",
      "Split bills",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    monthly: 199,
    annual: 159,
    description: "For multi-location operations",
    popular: false,
    features: [
      "Unlimited terminals",
      "Everything in Professional",
      "Multi-location dashboard",
      "Custom integrations",
      "Dedicated account manager",
      "24/7 phone support",
      "Custom reporting",
    ],
  },
];

const MOBILE_ADDON_MONTHLY = 29;
const MOBILE_ADDON_ANNUAL = 23;

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [mobileAddon, setMobileAddon] = useState(false);
  const { signinRedirect } = useAuth();

  const addonPrice = isAnnual ? MOBILE_ADDON_ANNUAL : MOBILE_ADDON_MONTHLY;

  return (
    <>
      <PageHeader
        badge="Pricing"
        title="Simple, transparent pricing"
        subtitle="No hidden fees. Choose the plan that fits your business and scale as you grow."
      />

      <section className="pb-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Toggles */}
          <div className="flex flex-col items-center gap-6 mb-14">
            {/* Billing cycle toggle */}
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-sm font-medium",
                  !isAnnual ? "text-foreground" : "text-muted-foreground"
                )}
              >
                Monthly
              </span>
              <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
              <span
                className={cn(
                  "text-sm font-medium",
                  isAnnual ? "text-foreground" : "text-muted-foreground"
                )}
              >
                Annual
              </span>
              {isAnnual && (
                <Badge className="bg-[#44CC00]/10 text-[#44CC00] border-[#44CC00]/20 hover:bg-[#44CC00]/15">
                  Save 20%
                </Badge>
              )}
            </div>

            {/* Mobile dashboard addon */}
            <div className="flex items-center gap-4 px-5 py-3.5 rounded-xl border border-border bg-card">
              <Smartphone className="size-5 text-primary shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  Mobile Dashboard Addon
                </span>
                <span className="text-xs text-muted-foreground">
                  Manage your restaurant from your phone
                </span>
              </div>
              <Switch
                checked={mobileAddon}
                onCheckedChange={setMobileAddon}
              />
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                +${addonPrice}/mo
              </span>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {tiers.map((tier, i) => {
              const basePrice = isAnnual ? tier.annual : tier.monthly;
              const totalPrice = mobileAddon
                ? basePrice + addonPrice
                : basePrice;

              return (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className={cn(
                    "relative rounded-2xl border bg-card p-8 flex flex-col",
                    tier.popular
                      ? "border-[#0066FF]/30 shadow-lg shadow-primary/5"
                      : "border-border"
                  )}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white border-0 hover:from-[#0055DD] hover:to-[#0099BB]">
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <h3 className="text-xl font-bold text-foreground">
                    {tier.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-6">
                    {tier.description}
                  </p>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">
                      ${totalPrice}
                    </span>
                    <span className="text-muted-foreground">/mo</span>
                    {isAnnual && (
                      <span className="text-xs text-muted-foreground ml-2">
                        billed annually
                      </span>
                    )}
                  </div>

                  <Button
                    size="lg"
                    onClick={() => signinRedirect()}
                    className={cn(
                      "w-full mb-6",
                      tier.popular
                        ? "bg-gradient-to-r from-[#0066FF] to-[#00AACC] hover:from-[#0055DD] hover:to-[#0099BB] text-white border-0"
                        : ""
                    )}
                  >
                    Get Started
                    <ArrowRight className="ml-1 size-4" />
                  </Button>

                  <ul className="space-y-3 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="size-4 text-[#44CC00] mt-0.5 shrink-0" />
                        <span className="text-sm text-muted-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                    {mobileAddon && (
                      <li className="flex items-start gap-2">
                        <Smartphone className="size-4 text-[#0066FF] mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground font-medium">
                          Mobile Dashboard
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
