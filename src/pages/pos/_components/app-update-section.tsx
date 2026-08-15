import { useCallback, useEffect, useState } from "react";
import { ArrowUpCircle, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { APP_VERSION_LABEL } from "@/lib/site-constants.ts";
import {
  checkForPosAppUpdate,
  startBrowserInstallerDownload,
} from "@/lib/pos-app-update.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";

type UpdateUiState =
  | "idle"
  | "checking"
  | "uptodate"
  | "available"
  | "downloading"
  | "installing"
  | "browser_download"
  | "error";

export default function AppUpdateSection() {
  const { t } = usePosLocale();
  const [state, setState] = useState<UpdateUiState>("idle");
  const [currentVersion, setCurrentVersion] = useState(APP_VERSION_LABEL);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorKey, setErrorKey] = useState<"check" | "install" | "dev">("check");
  const [canSilentInstall, setCanSilentInstall] = useState(false);
  const [viaElectron, setViaElectron] = useState(false);

  useEffect(() => {
    const unsub = window.desktop?.onAppUpdateProgress?.((percent) => {
      setProgress(percent);
      setState("downloading");
    });
    return () => {
      unsub?.();
    };
  }, []);

  const runCheck = useCallback(async () => {
    setState("checking");
    setProgress(0);
    try {
      const result = await checkForPosAppUpdate();
      setCurrentVersion(result.currentVersion);
      setLatestVersion(result.latestVersion);
      setViaElectron(result.viaElectron);
      setCanSilentInstall(result.viaElectron && result.packaged);
      setState(result.updateAvailable ? "available" : "uptodate");
    } catch {
      setErrorKey("check");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const runInstall = useCallback(async () => {
    if (viaElectron && !canSilentInstall) {
      setErrorKey("dev");
      setState("error");
      return;
    }
    if (!canSilentInstall) {
      startBrowserInstallerDownload();
      setState("browser_download");
      return;
    }
    setState("downloading");
    setProgress(0);
    try {
      const result = await window.desktop?.installAppUpdate?.();
      if (!result?.ok) {
        if (result?.error === "dev") {
          setErrorKey("dev");
        } else if (result?.error === "none") {
          setState("uptodate");
          return;
        } else {
          setErrorKey("install");
        }
        setState("error");
        return;
      }
      setState("installing");
    } catch {
      setErrorKey("install");
      setState("error");
    }
  }, [canSilentInstall, viaElectron]);

  const statusText =
    state === "checking"
      ? t("settings.update_checking")
      : state === "uptodate"
        ? t("settings.update_uptodate")
        : state === "available"
          ? t("settings.update_available", { version: latestVersion ?? "" })
          : state === "downloading"
            ? t("settings.update_downloading", { percent: progress })
            : state === "installing"
              ? t("settings.update_installing")
              : state === "browser_download"
                ? t("settings.update_browser")
                : state === "error"
                  ? errorKey === "dev"
                    ? t("settings.update_dev")
                    : errorKey === "install"
                      ? t("settings.update_error_install")
                      : t("settings.update_error")
                  : t("settings.update_desc");

  return (
    <section className="rounded-xl border border-[#1e2a45] bg-[#0D1326] p-5 space-y-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <ArrowUpCircle className="size-5 text-[#0066FF]" />
        {t("settings.update")}
      </h2>

      <div className="flex items-start justify-between p-3 rounded-lg bg-[#131A2E]/60 border border-[#1e2a45]/50 flex-wrap gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-white">{t("settings.update")}</p>
          <p className="text-xs text-[#5a6580]">{statusText}</p>
          <p className="text-xs text-[#8b93a7] tabular-nums pt-1">
            {t("settings.update_current")}: {currentVersion}
            {latestVersion ? ` · ${t("settings.update_latest")}: ${latestVersion}` : ""}
          </p>
          {state === "downloading" ? (
            <div className="mt-2 h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-[#1e2a45]">
              <div
                className="h-full rounded-full bg-[#0066FF] transition-[width]"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void runCheck()}
            disabled={state === "checking" || state === "downloading" || state === "installing"}
            className="bg-[#1e2a45] border-[#2a3a5c] text-white hover:bg-[#2a3a5c]"
          >
            <RefreshCw className="size-4 mr-1.5" />
            {t("settings.update_check")}
          </Button>
          {state === "available" || state === "browser_download" ? (
            <Button
              type="button"
              size="sm"
              className="bg-[#0066FF] hover:bg-[#0052CC]"
              onClick={() => void runInstall()}
              disabled={state === "downloading" || state === "installing"}
            >
              <Download className="size-4 mr-1.5" />
              {t("settings.update_now")}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
