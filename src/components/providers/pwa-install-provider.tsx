import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaInstallContextValue = {
  canInstall: boolean;
  triggerInstall: () => Promise<boolean>;
  dismiss: () => void;
};

const PwaInstallContext = createContext<PwaInstallContextValue>({
  canInstall: false,
  triggerInstall: async () => false,
  dismiss: () => {},
});

/**
 * Global provider that captures the `beforeinstallprompt` event once at app root
 * so every component in the tree can access it regardless of mount timing.
 *
 * If the URL contains `?install=true`, the install prompt is auto-triggered
 * as soon as the browser fires `beforeinstallprompt`. This enables a seamless
 * install flow when opened from a dashboard "Install" button.
 */
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;

      // Auto-trigger install if opened with ?install=true
      const params = new URLSearchParams(window.location.search);
      if (params.get("install") === "true") {
        // Clean the URL param so it doesn't re-trigger
        params.delete("install");
        const cleanUrl =
          window.location.pathname +
          (params.toString() ? `?${params.toString()}` : "");
        window.history.replaceState({}, "", cleanUrl);

        // Auto-trigger the prompt
        prompt.prompt();
        prompt.userChoice.then(({ outcome }) => {
          if (outcome === "accepted") {
            setDeferredPrompt(null);
          } else {
            // User dismissed — keep the prompt available for manual trigger
            setDeferredPrompt(prompt);
          }
        });
        return;
      }

      setDeferredPrompt(prompt);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setDeferredPrompt(null);
  }, []);

  return (
    <PwaInstallContext.Provider
      value={{ canInstall: deferredPrompt !== null, triggerInstall, dismiss }}
    >
      {children}
    </PwaInstallContext.Provider>
  );
}

/** Access the PWA install prompt from anywhere in the component tree */
export function usePwaInstallContext() {
  return useContext(PwaInstallContext);
}
