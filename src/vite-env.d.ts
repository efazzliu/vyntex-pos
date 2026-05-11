/// <reference types="vite/client" />

/** Root `package.json` version — set in `vite.config.ts` via `define`. */
declare const __APP_VERSION__: string | undefined;

/** `public/RestaurantPOSSetup.exe` mtime (ISO) when present — set in `vite.config.ts` via `define`. */
declare const __INSTALLER_UPDATED_AT__: string | undefined;

type PrintHtmlSilentPayload =
  | string
  | { html: string; deviceName?: string };

interface VyntexDesktopApi {
  platform: string;
  isElectron: boolean;
  printHtmlSilent?: (
    payload: PrintHtmlSilentPayload,
  ) => Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    desktop?: VyntexDesktopApi;
  }
}

declare module "*.sql?raw" {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_PLATFORM_ADMIN_EMAILS?: string;
  /** Legacy: single Windows x64 installer URL (CDN / Supabase Storage). */
  readonly VITE_RESTAURANT_POS_EXE_URL?: string;
  readonly VITE_RESTAURANT_POS_EXE_URL_X64?: string;
  readonly VITE_RESTAURANT_POS_EXE_URL_ARM64?: string;
  /** Injected from root `package.json` version (Vite `define`). */
  readonly VITE_APP_VERSION?: string;
  /** Set at build time: public/RestaurantPOSSetup-arm64.exe exists and looks like a real installer. */
  readonly VITE_ARM64_INSTALLER_AVAILABLE?: string;
  /** Set at build time: last modified timestamp for public/RestaurantPOSSetup.exe (ISO). */
  readonly VITE_INSTALLER_UPDATED_AT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
