import { Link } from "react-router-dom";
import {
  triggerInstallerDownload,
  windowsInstallerArm64Href,
  windowsInstallerX64Href,
} from "@/lib/installer-download-urls.ts";
import {
  APP_VERSION_LABEL,
  formattedInstallerMtime,
  formatInstallerDisplayFromIso,
} from "@/lib/site-constants.ts";
import { useLiveBuildMeta } from "@/hooks/use-live-build-meta.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import {
  ArrowUpRight,
  CalendarClock,
  Download,
  HardDriveDownload,
  Monitor,
  ShieldAlert,
} from "lucide-react";

export default function DashboardDownloadsPage() {
  const live = useLiveBuildMeta();
  const versionLabel = live?.appVersion ?? APP_VERSION_LABEL;
  const installerFileMtime =
    formatInstallerDisplayFromIso(live?.installerUpdatedAt) ??
    formattedInstallerMtime();

  const installerUrlX64 = windowsInstallerX64Href(versionLabel);
  const installerUrlArm64 = windowsInstallerArm64Href(versionLabel);

  const openInstallerDownload = (
    url: string,
    arch: "x64" | "arm64",
  ) => {
    triggerInstallerDownload(url, arch, versionLabel);
    toast.success("Download started");
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-2xl border border-[#315084] bg-gradient-to-br from-[#162746] via-[#10213f] to-[#0e1a31] p-6 lg:p-7">
        <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          Downloads
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">Windows Builds and Release History</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#a7b5d1]">
          Download the latest installer for your device architecture and track release freshness in
          one place.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/80">
            <HardDriveDownload className="size-4 text-[#66b3ff]" />
            Download Installer
          </div>

          <Button
            size="lg"
            onClick={() => openInstallerDownload(installerUrlX64, "x64")}
            className="h-auto w-full flex-col gap-1 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] py-3 text-white shadow-lg shadow-blue-600/25 hover:from-[#0055DD] hover:to-[#0099BB]"
          >
            <span className="flex items-center gap-2">
              <Download className="size-4" />
              Windows - 64-bit (Intel/AMD)
            </span>
            <span className="text-xs opacity-90">Recommended for most PCs</span>
          </Button>

          {installerUrlArm64 ? (
            <Button
              size="lg"
              variant="outline"
              onClick={() => openInstallerDownload(installerUrlArm64!, "arm64")}
              className="mt-3 h-auto w-full flex-col gap-1 rounded-xl border-[#2c4673] bg-[#0b162b] py-3 text-white hover:bg-[#142646]"
            >
              <span className="flex items-center gap-2">
                <Monitor className="size-4" />
                Windows - ARM64
              </span>
              <span className="text-xs opacity-80">Surface / Snapdragon devices</span>
            </Button>
          ) : null}

          <p className="mt-3 text-xs leading-relaxed text-[#95a8c6]">
            <span className="font-medium tabular-nums text-[#b8c5dc]">App v{versionLabel}</span>
            {installerFileMtime ? (
              <>
                <span className="text-white/25"> · </span>
                Installer file: <span className="text-[#b8c5dc]">{installerFileMtime}</span>
              </>
            ) : (
              <>
                <span className="text-white/25"> · </span>
                <span className="text-white/40">Place </span>
                <code className="rounded bg-black/25 px-1 py-0.5 text-[10px] text-white/55">
                  public/RestaurantPOSSetup.exe
                </code>
                <span className="text-white/40"> to show installer build time.</span>
              </>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <h3 className="text-base font-semibold text-white">Quick Actions</h3>
          <div className="mt-4 space-y-3">
            <Link
              to="/dashboard/restaurant-pos"
              className="group flex items-center justify-between rounded-xl border border-[#2c4673] bg-[#0b162b] p-3 text-sm text-white transition-colors hover:bg-[#142646]"
            >
              <span className="flex items-center gap-2">
                <ArrowUpRight className="size-4 text-[#66b3ff]" />
                Open Installation Card
              </span>
              <ArrowUpRight className="size-4 text-white/50 group-hover:text-white" />
            </Link>
            <Link
              to="/dashboard/support"
              className="group flex items-center justify-between rounded-xl border border-[#2c4673] bg-[#0b162b] p-3 text-sm text-white transition-colors hover:bg-[#142646]"
            >
              <span className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-amber-300" />
                Contact Support
              </span>
              <ArrowUpRight className="size-4 text-white/50 group-hover:text-white" />
            </Link>
          </div>

          <div className="mt-5 rounded-xl border border-[#2c4673] bg-[#0b162b] p-3 text-xs text-[#9cb0d0]">
            <p className="flex items-center gap-2 font-medium text-white/85">
              <CalendarClock className="size-3.5 text-[#66b3ff]" />
              Release Tip
            </p>
            <p className="mt-1">
              Keep your POS client on the latest build for stability, printer compatibility, and
              security fixes.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
