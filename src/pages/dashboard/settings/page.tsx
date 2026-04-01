import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useAuth } from "@/hooks/use-auth.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
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
import { Building2, Mail, User, MapPin, Phone, Banknote } from "lucide-react";

const currencies = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (\u20AC)" },
  { value: "GBP", label: "GBP (\u00A3)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "AUD", label: "AUD (A$)" },
];

const planLabels = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
} as const;

export default function DashboardSettings() {
  const { user } = useAuth();
  const restaurant = useQuery(api.dashboard.restaurants.getMyRestaurant);
  const updateRestaurant = useMutation(api.dashboard.restaurants.update);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form with restaurant data when loaded
  if (restaurant && !initialized) {
    setName(restaurant.name);
    setAddress(restaurant.address ?? "");
    setPhone(restaurant.phone ?? "");
    setCurrency(restaurant.currency);
    setInitialized(true);
  }

  if (restaurant === undefined) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (restaurant === null) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-muted-foreground">
          Please complete the setup first.
        </p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Business name is required");
      return;
    }
    setLoading(true);
    try {
      await updateRestaurant({
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        currency,
      });
      toast.success("Settings saved");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to save settings");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your business profile and account.
        </p>
      </div>

      {/* Business profile */}
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-border bg-card p-6 space-y-5"
      >
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
            <Building2 className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Business Profile
            </h2>
            <p className="text-xs text-muted-foreground">
              Update your restaurant information
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="biz-name">Business Name *</Label>
            <Input
              id="biz-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="biz-address">
                <MapPin className="size-3.5 inline mr-1" />
                Address
              </Label>
              <Input
                id="biz-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-phone">
                <Phone className="size-3.5 inline mr-1" />
                Phone
              </Label>
              <Input
                id="biz-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              <Banknote className="size-3.5 inline mr-1" />
              Currency
            </Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
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
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>

      {/* Account info */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
            <User className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Account</h2>
            <p className="text-xs text-muted-foreground">
              Your account details
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <User className="size-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Name:</span>
            <span className="text-foreground font-medium">
              {user?.profile.name || "Not set"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="size-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Email:</span>
            <span className="text-foreground font-medium">
              {user?.profile.email || "Not set"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Building2 className="size-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Business Type:</span>
            <span className="text-foreground font-medium capitalize">
              {restaurant.type}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Banknote className="size-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Plan:</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {planLabels[restaurant.plan]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
