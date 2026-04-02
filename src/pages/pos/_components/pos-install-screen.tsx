import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Download, CheckCircle2, Monitor, Wifi } from "lucide-react";
import { motion } from "motion/react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Full-screen install screen shown when the POS page is opened with ?install=true.
 * Waits for the browser's `beforeinstallprompt` event, then lets the user
 * click a button to trigger the native install dialog (user gesture required).
 */
export default function PosInstallScreen() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState<"waiting" | "ready" | "installing" | "installed">("waiting");

  useEffect(() => {
    // Check if the global script already captured the event
    const win = window as unknown as Record<string, unknown>;
    const existing = win.__pwaInstallPrompt as BeforeInstallPromptEvent | undefined;
    if (existing) {
      win.__pwaInstallPrompt = null;
      setPrompt(existing);
      setStatus("ready");
    }

    // Also listen for the event if it hasn't fired yet
    const handler = (e: Event) => {
      e.preventDefault();
      const p = e as BeforeInstallPromptEvent;
      // Clear global so provider doesn't double-handle
      const w = window as unknown as Record<string, unknown>;
      w.__pwaInstallPrompt = null;
      setPrompt(p);
      setStatus("ready");
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setStatus("installed");
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!prompt) return;
    setStatus("installing");
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        setStatus("installed");
      } else {
        setStatus("ready");
      }
    } catch {
      setStatus("ready");
    }
  }, [prompt]);

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
      >
        {/* Logo */}
        <motion.img
          src="https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz"
          alt="VYNTEX"
          className="h-16 w-16 mx-auto mb-6"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
        />

        <h1 className="text-2xl font-bold text-white mb-2">
          Install VYNTEX POS
        </h1>
        <p className="text-sm text-gray-400 mb-8 max-w-xs mx-auto">
          Install the POS application on your desktop for full offline support
          and a native app experience.
        </p>

        {/* Features list */}
        <div className="flex flex-col gap-3 mb-8 text-left max-w-xs mx-auto">
          {[
            { icon: Monitor, text: "Runs as a standalone desktop app" },
            { icon: Wifi, text: "Works offline — no internet needed" },
            { icon: Download, text: "Fast launch from your taskbar" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-gray-300 text-sm">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Icon className="size-4 text-[#0066FF]" />
              </div>
              {text}
            </div>
          ))}
        </div>

        {/* Install button states */}
        {status === "waiting" && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
              <div className="w-4 h-4 border-2 border-gray-600 border-t-[#0066FF] rounded-full animate-spin" />
              Preparing installation...
            </div>
            <p className="text-xs text-gray-600">
              If this takes more than a few seconds, your browser may not support
              PWA installation or the app may already be installed.
            </p>
          </div>
        )}

        {status === "ready" && (
          <Button
            size="lg"
            onClick={handleInstall}
            className="w-full h-14 text-base bg-gradient-to-r from-[#0066FF] to-[#0055DD] hover:from-[#0055DD] hover:to-[#0044CC] text-white rounded-xl"
          >
            <Download className="size-5 mr-2" />
            Install Now
          </Button>
        )}

        {status === "installing" && (
          <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-[#0066FF] rounded-full animate-spin" />
            Installing...
          </div>
        )}

        {status === "installed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-medium">
              <CheckCircle2 className="size-5" />
              VYNTEX POS is installed!
            </div>
            <p className="text-xs text-gray-500">
              You can now close this tab and open VYNTEX POS from your desktop or
              taskbar.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
