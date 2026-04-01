import { Button } from "@/components/ui/button.tsx";
import { Download, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { usePwaInstall } from "@/hooks/use-pwa-install.ts";

export default function InstallPrompt() {
  const { canInstall, triggerInstall, dismiss } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  const handleInstall = async () => {
    await triggerInstall();
  };

  const handleDismiss = () => {
    setDismissed(true);
    dismiss();
  };

  if (!canInstall || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-5 py-3 shadow-2xl">
          <Download className="size-5 text-primary shrink-0" />
          <p className="text-sm font-medium text-foreground">
            Install VYNTEX for a better experience
          </p>
          <Button size="sm" onClick={handleInstall}>
            Install
          </Button>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
