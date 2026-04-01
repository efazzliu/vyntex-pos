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
 */
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
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
