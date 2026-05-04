import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";
import { ShieldAlert, Mail, CreditCard } from "lucide-react";
import type { DashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { SUPPORT_EMAIL, SUPPORT_MAILTO_HREF } from "@/lib/site-constants.ts";

const VYN_TYPE_LABELS: Record<string, string> = {
  restaurant: "Restaurant POS",
  cafe: "Coffee POS",
  bar: "Bar POS",
  hotel: "Hotel POS",
  fitness: "Fitness POS",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ExpiredLicense({
  restaurant,
}: {
  restaurant: DashboardRestaurant;
}) {
  const handleRenew = () => {
    toast.info(
      `Payment integration is being set up. Email ${SUPPORT_EMAIL} to renew your license.`,
    );
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-3.5rem)] lg:min-h-dvh p-4">
      <div className="max-w-lg w-full text-center">
        {/* Warning icon */}
        <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="size-10 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Your License Has Expired
        </h1>
        <p className="text-muted-foreground mb-1">
          Your{" "}
          <span className="font-semibold text-foreground">
            {VYN_TYPE_LABELS[restaurant.type] ?? restaurant.type}
          </span>{" "}
          license expired on{" "}
          <span className="font-semibold text-foreground">
            {formatDate(restaurant.licenseExpiry)}
          </span>
          .
        </p>
        <p className="text-muted-foreground mb-8">
          Renew now to regain access to your Vyntex POS software and dashboard
          settings.
        </p>

        {/* License key reminder */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6 text-left">
          <p className="text-xs text-muted-foreground mb-1">License Key</p>
          <p className="font-mono text-base tracking-widest text-foreground">
            {restaurant.licenseKey}
          </p>
        </div>

        {/* Renew button */}
        <Button
          size="lg"
          className="w-full mb-4 bg-gradient-to-r from-[#0066FF] to-[#0055DD] hover:from-[#0055DD] hover:to-[#0044CC] text-white h-12 text-base"
          onClick={handleRenew}
        >
          <CreditCard className="size-5 mr-2" />
          Renew Now
        </Button>

        {/* Contact support */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
          <a
            href={SUPPORT_MAILTO_HREF}
            className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
          >
            <Mail className="size-4" />
            {SUPPORT_EMAIL}
          </a>
          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            Contact form
          </Link>
        </div>
      </div>
    </div>
  );
}
