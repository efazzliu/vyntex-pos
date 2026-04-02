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
 * Typed helper to read the globally captured install prompt.
 * The `beforeinstallprompt` event is captured by a <script> in index.html
 * so it is never lost even if it fires before React mounts.
 */
function getGlobalPrompt(): BeforeInstallPromptEvent | null {
  const win = window as unknown as Record<string, unknown>;
  return (win.__pwaInstallPrompt as BeforeInstallPromptEvent) ?? null;
}

function clearGlobalPrompt() {
  const win = window as unknown as Record<string, unknown>;
  win.__pwaInstallPrompt = null;
}

/**
 * Global provider that captures the `beforeinstallprompt` event once at app root
 * so every component in the tree can access it regardless of mount timing.
 *
 * If the URL contains `?install=true`, the install prompt is auto-triggered
 * as soon as the prompt is available. This enables a seamless
 * install flow when opened from a dashboard "Install" button.
 */
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 1. Check if the event was already captured globally before React mounted
    const existing = getGlobalPrompt();

    const params = new URLSearchParams(window.location.search);
    const autoInstall = params.get("install") === "true";

    if (existing) {
      clearGlobalPrompt();

      if (autoInstall) {
        // Clean the URL param so it doesn't re-trigger
        params.delete("install");
        const cleanUrl =
          window.location.pathname +
          (params.toString() ? `?${params.toString()}` : "");
        window.history.replaceState({}, "", cleanUrl);

        existing.prompt();
        existing.userChoice.then(({ outcome }) => {
          if (outcome !== "accepted") {
            setDeferredPrompt(existing);
          }
        });
        return;
      }

      setDeferredPrompt(existing);
    }

    // 2. Also listen for future events (e.g. if the browser fires it late)
    const handler = (e: Event) => {
      e.preventDefault();
      clearGlobalPrompt();
      const prompt = e as BeforeInstallPromptEvent;

      const currentParams = new URLSearchParams(window.location.search);
      if (currentParams.get("install") === "true") {
        currentParams.delete("install");
        const cleanUrl =
          window.location.pathname +
          (currentParams.toString() ? `?${currentParams.toString()}` : "");
        window.history.replaceState({}, "", cleanUrl);

        prompt.prompt();
        prompt.userChoice.then(({ outcome }) => {
          if (outcome !== "accepted") {
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
