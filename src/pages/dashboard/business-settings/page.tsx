import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Building2, Clock3, Globe2, MapPin, Phone, Settings } from "lucide-react";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";

export default function DashboardBusinessSettingsPage() {
  const { restaurant } = useDashboardRestaurant();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-2xl border border-[#315084] bg-gradient-to-br from-[#162746] via-[#10213f] to-[#0e1a31] p-6 lg:p-7">
        <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          Business Settings
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">Company Information and Regional Preferences</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#a7b5d1]">
          Manage your business profile details used across account, billing, and license metadata.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/85">
            <Building2 className="size-4 text-[#66b3ff]" />
            Profile Snapshot
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#2c4673] bg-[#0b162b] p-3">
              <p className="text-xs text-[#97abcc]">Business Name</p>
              <p className="mt-1 text-sm font-medium text-white">{restaurant?.name ?? "Not set"}</p>
            </div>
            <div className="rounded-xl border border-[#2c4673] bg-[#0b162b] p-3">
              <p className="text-xs text-[#97abcc]">Currency</p>
              <p className="mt-1 text-sm font-medium text-white">{restaurant?.currency ?? "EUR"}</p>
            </div>
            <div className="rounded-xl border border-[#2c4673] bg-[#0b162b] p-3">
              <p className="text-xs text-[#97abcc]">Address</p>
              <p className="mt-1 text-sm font-medium text-white">{restaurant?.address ?? "Not set"}</p>
            </div>
            <div className="rounded-xl border border-[#2c4673] bg-[#0b162b] p-3">
              <p className="text-xs text-[#97abcc]">Phone</p>
              <p className="mt-1 text-sm font-medium text-white">{restaurant?.phone ?? "Not set"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <h3 className="text-base font-semibold text-white">Settings Actions</h3>
          <div className="mt-4 space-y-3">
            <Button asChild className="w-full justify-start gap-2 rounded-xl">
              <Link to="/dashboard/settings">
                <Settings className="size-4" />
                Open Account Settings
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start gap-2 rounded-xl border-[#2c4673] bg-[#0b162b] text-white hover:bg-[#142646]"
            >
              <Link to="/dashboard/restaurant-pos">
                <Building2 className="size-4" />
                Open License Overview
              </Link>
            </Button>
          </div>

          <div className="mt-5 space-y-2 rounded-xl border border-[#2c4673] bg-[#0b162b] p-3 text-xs text-[#9cb0d0]">
            <p className="flex items-center gap-2">
              <MapPin className="size-3.5 text-[#66b3ff]" />
              Keep address synced for invoices and tax documents.
            </p>
            <p className="flex items-center gap-2">
              <Phone className="size-3.5 text-[#66b3ff]" />
              Use a support-ready phone number for faster issue resolution.
            </p>
            <p className="flex items-center gap-2">
              <Globe2 className="size-3.5 text-[#66b3ff]" />
              Regional settings affect receipts and reporting.
            </p>
            <p className="flex items-center gap-2">
              <Clock3 className="size-3.5 text-[#66b3ff]" />
              Verify timezone before generating period reports.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
