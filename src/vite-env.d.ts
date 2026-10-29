/// <reference types="vite/client" />

/** Root `package.json` version — set in `vite.config.ts` via `define`. */
declare const __APP_VERSION__: string | undefined;

/** `public/RestaurantPOSSetup.exe` mtime (ISO) when present — set in `vite.config.ts` via `define`. */
declare const __INSTALLER_UPDATED_AT__: string | undefined;

type PrintHtmlSilentPayload =
  | string
  | {
      html: string;
      deviceName?: string;
      pageSize?: { widthMm: number; heightMm: number };
      marginType?: "none" | "printableArea";
    };

type GetSystemPrintersIpcResult =
  | {
      ok: true;
      printers: {
        deviceName: string;
        displayName: string;
        isDefault: boolean;
        isOffline?: boolean;
      }[];
    }
  | { ok: false; error: string };

interface VyntexDesktopApi {
  platform: string;
  isElectron: boolean;
  printHtmlSilent?: (
    payload: PrintHtmlSilentPayload,
  ) => Promise<{ ok: boolean; error?: string }>;
  printHtmlToPdf?: (payload: {
    html: string;
    widthMm: number;
    heightMm: number;
    mode: "preview" | "save";
    fileName: string;
    marginType?: "none" | "printableArea";
  }) => Promise<{ ok: boolean; path?: string; cancelled?: boolean; error?: string }>;
  getSystemPrinters?: () => Promise<GetSystemPrintersIpcResult>;
  checkForAppUpdate?: () => Promise<{
    ok: boolean;
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    packaged: boolean;
    releaseNotes?: string | null;
    installerUpdatedAt?: string | null;
    downloaded?: boolean;
  }>;
  downloadAppUpdate?: () => Promise<{ ok: boolean; error?: string; version?: string }>;
  installAppUpdate?: () => Promise<{ ok: boolean; error?: string }>;
  appSystemInfo?: () => Promise<{
    ok: boolean;
    appVersion: string;
    packaged: boolean;
    platform: string;
    arch: string;
    electron: string | null;
    chrome: string | null;
    osRelease: string;
    osType: string;
  }>;
  onAppUpdateProgress?: (callback: (percent: number) => void) => () => void;
  customerDisplayStatus?: () => Promise<{
    open: boolean;
    extraDisplayCount: number;
    displayLabel?: string | null;
  }>;
  customerDisplayOpen?: () => Promise<{ ok: boolean; error?: string }>;
  customerDisplayClose?: () => Promise<{ ok: boolean }>;
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
