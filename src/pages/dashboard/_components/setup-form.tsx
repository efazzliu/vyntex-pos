import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Building2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

const businessTypes = [
  { value: "restaurant", label: "Restaurant POS" },
  { value: "cafe", label: "Coffee POS" },
  { value: "bar", label: "Bar POS" },
  { value: "hotel", label: "Hotel POS" },
  { value: "fitness", label: "Fitness POS" },
] as const;

const currencies = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (\u20AC)" },
  { value: "GBP", label: "GBP (\u00A3)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "AUD", label: "AUD (A$)" },
];

const plans = [
  {
    value: "starter" as const,
    label: "Starter",
    price: "$49/mo",
    description: "30-day license \u00B7 1 terminal",
  },
  {
    value: "professional" as const,
    label: "Professional",
    price: "$99/mo",
    description: "Annual license \u00B7 5 terminals",
    popular: true,
  },
  {
    value: "enterprise" as const,
    label: "Enterprise",
    price: "$199/mo",
    description: "Annual license \u00B7 Unlimited",
  },
];

export default function SetupForm() {
  const createRestaurant = useMutation(api.dashboard.restaurants.create);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<
    "restaurant" | "cafe" | "bar" | "hotel" | "fitness"
  >("restaurant");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [plan, setPlan] = useState<"starter" | "professional" | "enterprise">(
    "professional"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your business name");
      return;
    }
    setLoading(true);
    try {
      await createRestaurant({
        name: name.trim(),
        type,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        currency,
        plan,
      });
      toast.success(
        "Welcome to VYNTEX! Your license key has been generated."
      );
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to activate license");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-3.5rem)] lg:min-h-dvh p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center mx-auto mb-4">
            <img src={LOGO_URL} alt="VYNTEX" className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Activate your license
          </h1>
          <p className="text-muted-foreground">
            Set up your business to receive your VYNTEX POS license key.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-6 space-y-5"
        >
          {/* Plan selection */}
          <div className="space-y-2">
            <Label>Select Plan</Label>
            <div className="grid grid-cols-3 gap-2">
              {plans.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlan(p.value)}
                  className={cn(
                    "relative rounded-lg border p-3 text-left transition-all cursor-pointer",
                    plan === p.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40 hover:bg-accent/50"
                  )}
                >
                  {p.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full whitespace-nowrap flex items-center gap-0.5">
                      <Sparkles className="size-2.5" />
                      Popular
                    </span>
                  )}
                  <p className="text-sm font-semibold text-foreground">
                    {p.label}
                  </p>
                  <p className="text-xs font-bold text-primary mt-0.5">
                    {p.price}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                    {p.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Business Name *</Label>
            <Input
              id="name"
              placeholder={"Mario's Italian Kitchen"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">VYN Type</Label>
            <Select
              value={type}
              onValueChange={(v) =>
                setType(
                  v as "restaurant" | "cafe" | "bar" | "hotel" | "fitness"
                )
              }
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {businessTypes.map((bt) => (
                  <SelectItem key={bt.value} value={bt.value}>
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-muted-foreground" />
                      {bt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="123 Main St"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Activating..." : "Activate License"}
          </Button>
        </form>
      </div>
    </div>
  );
}
