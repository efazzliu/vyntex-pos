import { Button } from "@/components/ui/button.tsx";
import { motion } from "motion/react";
import {
  LayoutGrid,
  ShieldCheck,
  Clock,
  LogOut,
} from "lucide-react";
import { clearActivation, type ActivationData } from "@/lib/local-db.ts";
import { normalizePlan, planLabel } from "../_lib/plan-features.ts";
import { toast } from "sonner";
import { format } from "date-fns";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

type PosHomeProps = {
  activation: ActivationData | null;
};

export default function PosHome({ activation }: PosHomeProps) {
  const { theme: posTheme } = usePosTheme();
  const handleDeactivate = async () => {
    await clearActivation();
    toast.success("Device deactivated. Reloading...");
    setTimeout(() => window.location.reload(), 1000);
  };

  const displayPlan = activation?.plan
    ? planLabel(normalizePlan(activation.plan))
    : "Starter";

  return (
    <div
      data-pos-theme={posTheme}
      className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-14 w-14 mb-3" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
            {activation?.businessName ?? "Vyntex POS"}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#44CC00] bg-[#44CC00]/10 px-2.5 py-1 rounded-full">
              <ShieldCheck className="size-3" />
              Activated
            </span>
            <span className="text-xs text-[#8b93a7] bg-[#1e2a45] px-2.5 py-1 rounded-full">
              {displayPlan}
            </span>
          </div>
        </div>

        {/* POS Coming Soon Card */}
        <div className="bg-[#131A2E] border border-[#1e2a45] rounded-2xl p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-[#0066FF]/10">
            <LayoutGrid className="size-8 text-[#0066FF]" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">POS System</h2>
            <p className="text-[#8b93a7] text-sm leading-relaxed">
              The full Point-of-Sale system is coming soon. Menu management, table layout,
              order taking, and checkout will be available in the next update.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-[#5a6580]">
            <Clock className="size-3.5" />
            <span>Coming in a future milestone!</span>
          </div>
        </div>

        {/* Device Info */}
        <div className="bg-[#131A2E] border border-[#1e2a45] rounded-2xl p-4 mt-4 space-y-3">
          <h3 className="text-xs font-medium text-[#8b93a7] uppercase tracking-wider">
            Device Information
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[#5a6580] text-xs">License Key</p>
              <p className="font-mono text-xs text-white truncate">
                {activation?.licenseKey ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[#5a6580] text-xs">Device ID</p>
              <p className="font-mono text-xs text-white truncate">
                {activation?.deviceId?.slice(0, 8) ?? "—"}...
              </p>
            </div>
            <div>
              <p className="text-[#5a6580] text-xs">Activated</p>
              <p className="text-xs text-white">
                {activation?.activatedAt
                  ? format(new Date(activation.activatedAt), "MMM d, yyyy")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[#5a6580] text-xs">Expires</p>
              <p className="text-xs text-white">
                {activation?.expiresAt
                  ? format(new Date(activation.expiresAt), "MMM d, yyyy")
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Deactivate */}
        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeactivate}
            className="text-[#5a6580] hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="size-4 mr-1.5" />
            Deactivate This Device
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
