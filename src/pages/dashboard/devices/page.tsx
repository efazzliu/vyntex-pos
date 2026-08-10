import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CircleOff,
  Clock3,
  Eye,
  Laptop,
  MapPin,
  Monitor,
  Pencil,
  RefreshCw,
  Router,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  disconnectDashboardPosDevice,
  fetchDashboardPosDevices,
  renameDashboardPosDevice,
  type DashboardPosDevice,
} from "@/lib/supabase-pos/device-presence.ts";
import {
  fetchAllRestaurantsOwnedBySession,
  type OwnedRestaurantRow,
} from "@/lib/supabase-pos/phone-pos-session.ts";
import {
  effectiveMaxTerminals,
  parseRegisteredDeviceIds,
} from "@/lib/dashboard-overview-data.ts";
import { dashboardDateLocale } from "@/lib/dashboard-i18n.ts";
import { cn } from "@/lib/utils.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";

type DeviceWithVenue = DashboardPosDevice & {
  venue: OwnedRestaurantRow;
};

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function isOnline(device: DashboardPosDevice): boolean {
  return (
    !device.disconnected_at &&
    Date.now() - new Date(device.last_seen_at).getTime() <= ONLINE_WINDOW_MS
  );
}

function relativeTime(
  iso: string | null,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (!iso) return t("devices.time_never");
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  if (diff < 60_000) return t("devices.time_now");
  if (diff < 3_600_000)
    return t("devices.time_min", { count: Math.floor(diff / 60_000) });
  if (diff < 86_400_000)
    return t("devices.time_hours", { count: Math.floor(diff / 3_600_000) });
  return t("devices.time_days", { count: Math.floor(diff / 86_400_000) });
}

function exactTime(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale);
}

export default function DashboardDevicesPage() {
  const { t, lang } = useDashboardLocale();
  const dateLocale = dashboardDateLocale(lang);
  const [licenses, setLicenses] = useState<OwnedRestaurantRow[] | null>(null);
  const [devices, setDevices] = useState<DashboardPosDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<DeviceWithVenue | null>(null);
  const [renaming, setRenaming] = useState<DeviceWithVenue | null>(null);
  const [disconnecting, setDisconnecting] = useState<DeviceWithVenue | null>(null);
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const owned = await fetchAllRestaurantsOwnedBySession();
      setLicenses(owned);
      try {
        setDevices(await fetchDashboardPosDevices(owned.map((row) => row.id)));
      } catch (error) {
        // Until migration 030 is deployed, show registered IDs rather than an empty page.
        const fallback = owned.flatMap((venue) =>
          parseRegisteredDeviceIds(venue.registered_devices, venue.device_id).map(
            (deviceId, index): DashboardPosDevice => ({
              id: `${venue.id}:${deviceId}`,
              restaurant_id: venue.id,
              device_id: deviceId,
              display_name: `POS-${String(index + 1).padStart(2, "0")}`,
              location_name: venue.name,
              os: null,
              app_version: null,
              ip_address: null,
              first_seen_at: venue.created_at ?? new Date(0).toISOString(),
              last_seen_at: new Date(0).toISOString(),
              last_sync_at: null,
              disconnected_at: null,
            }),
          ),
        );
        setDevices(fallback);
        console.warn("[devices] metadata unavailable", error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const interval = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const rows = useMemo<DeviceWithVenue[]>(() => {
    const venueById = new Map((licenses ?? []).map((row) => [row.id, row]));
    return devices
      .filter((device) => !device.disconnected_at)
      .flatMap((device) => {
        const venue = venueById.get(device.restaurant_id);
        return venue ? [{ ...device, venue }] : [];
      });
  }, [devices, licenses]);

  const connected = rows.filter(isOnline).length;
  const maximum = (licenses ?? []).reduce(
    (sum, row) =>
      sum + effectiveMaxTerminals(row.plan ?? "professional", row.max_terminals),
    0,
  );

  const saveRename = async () => {
    if (!renaming || !name.trim()) return;
    setSaving(true);
    try {
      await renameDashboardPosDevice(renaming.id, name, locationName);
      toast.success(t("devices.toast_renamed"));
      setRenaming(null);
      await load(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("devices.toast_rename_failed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!disconnecting) return;
    setSaving(true);
    try {
      await disconnectDashboardPosDevice(
        disconnecting.restaurant_id,
        disconnecting.device_id,
      );
      toast.success(t("devices.toast_disconnected"));
      setDisconnecting(null);
      setSelected(null);
      await load(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("devices.toast_disconnect_failed"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5 px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-sky-50/50 px-4 pb-12 pt-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-600">
              {t("nav.section_management")}
            </p>
            <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
                <Laptop className="size-5" />
              </span>
              {t("nav.devices")}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {t("devices.page_subtitle")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={refreshing}
            className="rounded-xl bg-white"
          >
            <RefreshCw className={cn("mr-2 size-4", refreshing && "animate-spin")} />
            {t("devices.refresh")}
          </Button>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Metric
            label={t("devices.title")}
            value={`${rows.length} / ${maximum}`}
            hint={t("devices.metric_capacity_hint")}
            icon={Monitor}
            tone="sky"
          />
          <Metric
            label={t("devices.metric_online")}
            value={`${connected}`}
            hint={t("devices.metric_online_hint")}
            icon={Activity}
            tone="emerald"
          />
          <Metric
            label={t("devices.metric_offline")}
            value={`${Math.max(0, rows.length - connected)}`}
            hint={t("devices.metric_offline_hint")}
            icon={CircleOff}
            tone="slate"
          />
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.4)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold">{t("devices.table_title")}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {t("devices.table_subtitle")}
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
              <Monitor className="size-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                {t("devices.empty_title")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t("devices.empty_hint")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3">{t("devices.col_device")}</th>
                    <th className="px-5 py-3">{t("devices.col_location")}</th>
                    <th className="px-5 py-3">{t("devices.col_os")}</th>
                    <th className="px-5 py-3">{t("devices.col_status")}</th>
                    <th className="px-5 py-3">{t("devices.col_last_seen")}</th>
                    <th className="px-5 py-3 text-right">{t("devices.col_actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {rows.map((device) => {
                    const online = isOnline(device);
                    return (
                      <tr key={device.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                              <Monitor className="size-4" />
                            </span>
                            <div>
                              <p className="font-semibold text-slate-800">
                                {device.display_name}
                              </p>
                              <code className="block max-w-40 truncate text-[10px] text-slate-400">
                                {device.device_id}
                              </code>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {device.location_name ?? device.venue.name}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {device.os ?? t("devices.unknown")}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                              online
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600",
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                online ? "bg-emerald-500" : "bg-slate-400",
                              )}
                            />
                            {online
                              ? t("devices.status_online")
                              : t("devices.status_offline")}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {relativeTime(device.last_seen_at, t)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("devices.action_view")}
                              onClick={() => setSelected(device)}
                              className="size-8 rounded-lg"
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("devices.action_rename")}
                              onClick={() => {
                                setName(device.display_name);
                                setLocationName(device.location_name ?? device.venue.name);
                                setRenaming(device);
                              }}
                              className="size-8 rounded-lg"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("devices.action_disconnect")}
                              onClick={() => setDisconnecting(device)}
                              className="size-8 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600"
                            >
                              <Unplug className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="size-5 text-sky-600" />
              {selected?.display_name}
            </DialogTitle>
            <DialogDescription>{t("devices.details_description")}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid gap-3 py-2 sm:grid-cols-2">
              <DeviceDetail
                iconKey="device_id"
                label={t("devices.detail_device_id")}
                value={selected.device_id}
                mono
              />
              <DeviceDetail
                iconKey="os"
                label={t("devices.detail_os")}
                value={selected.os ?? t("devices.unknown")}
              />
              <DeviceDetail
                iconKey="version"
                label={t("devices.detail_version")}
                value={selected.app_version ?? t("devices.unknown")}
              />
              <DeviceDetail
                iconKey="ip"
                label={t("devices.detail_ip")}
                value={selected.ip_address ?? t("devices.unavailable")}
                mono
              />
              <DeviceDetail
                iconKey="last_sync"
                label={t("devices.detail_last_sync")}
                value={exactTime(selected.last_sync_at, dateLocale)}
              />
              <DeviceDetail
                iconKey="last_active"
                label={t("devices.detail_last_active")}
                value={exactTime(selected.last_seen_at, dateLocale)}
              />
              <DeviceDetail
                iconKey="location"
                label={t("devices.detail_location")}
                value={selected.location_name ?? selected.venue.name}
              />
              <DeviceDetail
                iconKey="license"
                label={t("devices.detail_license")}
                value={selected.venue.license_key}
                mono
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              {t("devices.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renaming)} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("devices.rename_title")}</DialogTitle>
            <DialogDescription>{t("devices.rename_hint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">
                {t("devices.device_name")}
              </span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                autoFocus
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">
                {t("devices.location_label")}
              </span>
              <Input
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                maxLength={80}
                placeholder={t("devices.location_placeholder")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveRename();
                }}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              {t("devices.cancel")}
            </Button>
            <Button onClick={() => void saveRename()} disabled={saving || !name.trim()}>
              {t("devices.save_name")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(disconnecting)}
        onOpenChange={(open) => !open && setDisconnecting(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("devices.disconnect_title", { name: disconnecting?.display_name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("devices.disconnect_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t("devices.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void disconnect();
              }}
              disabled={saving}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {t("devices.disconnect_action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Monitor;
  tone: "sky" | "emerald" | "slate";
}) {
  const tones = {
    sky: "bg-sky-50 text-sky-600",
    emerald: "bg-emerald-50 text-emerald-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
        </div>
        <span className={cn("flex size-10 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

function DeviceDetail({
  iconKey,
  label,
  value,
  mono = false,
}: {
  iconKey: string;
  label: string;
  value: string;
  mono?: boolean;
}) {
  const icons: Record<string, typeof Monitor> = {
    device_id: Router,
    location: MapPin,
    last_sync: RefreshCw,
    last_active: Clock3,
  };
  const Icon = icons[iconKey] ?? Monitor;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="size-3.5 text-sky-500" />
        {label}
      </p>
      <p className={cn("mt-1.5 break-all text-sm font-medium", mono && "font-mono text-xs")}>
        {value}
      </p>
    </div>
  );
}
