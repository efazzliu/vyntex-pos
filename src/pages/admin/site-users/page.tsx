import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Ban, Loader2, LogIn, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  listSiteUsers,
  moderateSiteUser,
  type SiteUserModerationAction,
  type SiteUserRow,
} from "@/lib/supabase-pos/admin-ops.ts";
import { AdminCard } from "@/pages/admin/_components/admin-card.tsx";
import { adminInputClass, adminPageSectionClass, adminTableShellClass } from "@/pages/admin/_lib/admin-ui.ts";
import { cn } from "@/lib/utils.ts";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy · HH:mm");
}

function formatWhenShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy");
}

type PendingAction = {
  row: SiteUserRow;
  action: SiteUserModerationAction;
};

export default function AdminSiteUsersPage() {
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["admin", "site-users"],
    queryFn: listSiteUsers,
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    const source = usersQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter((row) => {
      const hay = `${row.email} ${row.fullName ?? ""} ${row.userId}`.toLowerCase();
      return hay.includes(q);
    });
  }, [usersQuery.data, search]);

  const runModeration = async () => {
    if (!pending) return;
    setActingId(pending.row.userId);
    try {
      const result = await moderateSiteUser(pending.row.userId, pending.action);
      await queryClient.invalidateQueries({ queryKey: ["admin", "site-users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      if (pending.action === "ban") {
        toast.success(
          `${result.email} u bllokua. U fshinë ${result.venuesDeleted} venue/llicenca.`,
        );
      } else {
        toast.success(
          `${result.email} u fshi. U hoqën ${result.venuesDeleted} venue/llicenca. Mund të regjistrohet përsëri.`,
        );
      }
      setPending(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Veprimi dështoi.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <section className={cn(adminPageSectionClass, "space-y-4 px-4 pt-2 sm:px-6 lg:space-y-5 lg:px-8 lg:pt-4")}>
      <AdminCard className="p-3 sm:p-4">
        <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Users</h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {usersQuery.isLoading ? "Loading…" : `${rows.length} user${rows.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className={cn(adminInputClass, "pl-8")}
            />
          </div>
        </div>

        {usersQuery.error ? (
          <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {usersQuery.error.message}
          </p>
        ) : null}

        {/* Mobile card list */}
        <div className="space-y-2.5 md:hidden">
          {usersQuery.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))
          ) : rows.length ? (
            rows.map((row) => (
              <UserMobileCard
                key={row.userId}
                row={row}
                busy={actingId === row.userId}
                onAction={(action) => setPending({ row, action })}
              />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300/70">
              {search ? "No users match this search." : "No registered users yet."}
            </p>
          )}
        </div>

        {/* Desktop table */}
        <div className={cn(adminTableShellClass, "hidden md:block")}>
          <div className="grid grid-cols-[1.4fr_1fr_1.1fr_0.9fr_0.6fr_4.5rem] gap-3 bg-slate-100/80 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-300/80">
            <span>User</span>
            <span>Registered</span>
            <span>Last sign-in</span>
            <span>Venues</span>
            <span className="text-right">Client</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="max-h-[calc(100dvh-14rem)] overflow-auto">
            {usersQuery.isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="m-2 h-12 rounded-lg" />
              ))
            ) : rows.length ? (
              rows.map((row) => (
                <UserDesktopRow
                  key={row.userId}
                  row={row}
                  busy={actingId === row.userId}
                  onAction={(action) => setPending({ row, action })}
                />
              ))
            ) : (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300/70">
                {search ? "No users match this search." : "No registered users yet."}
              </p>
            )}
          </div>
        </div>
      </AdminCard>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent className="mx-4 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.action === "ban" ? "Ban përdoruesin?" : "Fshi përdoruesin?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">{pending?.row.email}</span>
                </p>
                {pending?.action === "delete" ? (
                  <p>
                    Fshihen të gjitha licencat dhe të dhënat e klientit (POS, venue, etj.), plus llogaria
                    Auth. Përdoruesi <strong>mund të regjistrohet përsëri</strong> me të njëjtin email.
                  </p>
                ) : (
                  <p>
                    Fshihen të gjitha të dhënat e klientit dhe llogaria Auth. Email-i{" "}
                    <strong>bllokohet përgjithmonë</strong> — nuk mund të regjistrohet ose të hyjë më në site.
                  </p>
                )}
                <p className="text-destructive">Ky veprim nuk mund të zhbëhet.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actingId !== null}>Anulo</AlertDialogCancel>
            <AlertDialogAction
              className={
                pending?.action === "ban"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-destructive hover:bg-destructive/90"
              }
              disabled={actingId !== null}
              onClick={(e) => {
                e.preventDefault();
                void runModeration();
              }}
            >
              {actingId ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Duke procesuar…
                </>
              ) : pending?.action === "ban" ? (
                "Ban"
              ) : (
                "Fshi"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function userDisplayName(row: SiteUserRow) {
  return row.fullName || row.email.split("@")[0] || row.email;
}

function clientHrefFor(row: SiteUserRow) {
  return row.email && row.venueCount > 0
    ? `/admin/businesses/${encodeURIComponent(row.email)}`
    : null;
}

function UserActionsMenu({
  busy,
  onAction,
}: {
  busy: boolean;
  onAction: (action: SiteUserModerationAction) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          disabled={busy}
          aria-label="User actions"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onAction("delete")}
        >
          <Trash2 className="size-4" />
          Fshi përdoruesin
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600"
          onClick={() => onAction("ban")}
        >
          <Ban className="size-4" />
          Ban (blloko email)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VenueBadges({ row }: { row: SiteUserRow }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline" className="text-[11px]">
        {row.venueCount} venue{row.venueCount === 1 ? "" : "s"}
      </Badge>
      {row.activeLicenseCount > 0 ? (
        <Badge className="border border-emerald-500/40 bg-emerald-500/12 text-[11px] text-emerald-700 dark:text-emerald-300">
          {row.activeLicenseCount} active
        </Badge>
      ) : null}
    </div>
  );
}

function UserMobileCard({
  row,
  busy,
  onAction,
}: {
  row: SiteUserRow;
  busy: boolean;
  onAction: (action: SiteUserModerationAction) => void;
}) {
  const displayName = userDisplayName(row);
  const clientHref = clientHrefFor(row);
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0066FF]/12 text-sm font-semibold text-[#0066FF] dark:bg-blue-500/15 dark:text-blue-300">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {displayName}
                </p>
                {row.isBanned ? (
                  <Badge variant="destructive" className="h-4 px-1.5 text-[9px]">
                    Banned
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 break-all text-[12px] text-slate-500 dark:text-slate-400">
                {row.email}
              </p>
            </div>
            <UserActionsMenu busy={busy} onAction={onAction} />
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-white/80 px-3 py-2.5 text-[11px] dark:bg-slate-950/50">
        <div>
          <dt className="font-medium uppercase tracking-wide text-slate-400">Registered</dt>
          <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
            {formatWhenShort(row.registeredAt)}
          </dd>
        </div>
        <div>
          <dt className="font-medium uppercase tracking-wide text-slate-400">Last sign-in</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
            <LogIn className="size-3 shrink-0 opacity-50" />
            {formatWhenShort(row.lastSignInAt)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <VenueBadges row={row} />
        {clientHref ? (
          <Button asChild size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
            <Link to={clientHref}>View client</Link>
          </Button>
        ) : (
          <span className="text-[11px] text-slate-400">No client profile</span>
        )}
      </div>
    </article>
  );
}

function UserDesktopRow({
  row,
  busy,
  onAction,
}: {
  row: SiteUserRow;
  busy: boolean;
  onAction: (action: SiteUserModerationAction) => void;
}) {
  const displayName = userDisplayName(row);
  const clientHref = clientHrefFor(row);

  return (
    <div className="grid grid-cols-[1.4fr_1fr_1.1fr_0.9fr_0.6fr_4.5rem] items-center gap-3 border-t border-slate-200/70 px-3 py-2.5 text-xs dark:border-slate-700/60">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{displayName}</p>
          {row.isBanned ? (
            <Badge variant="destructive" className="h-4 px-1 text-[9px]">
              Banned
            </Badge>
          ) : null}
        </div>
        <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">{row.email}</p>
      </div>
      <span className="text-slate-600 dark:text-slate-300">{formatWhen(row.registeredAt)}</span>
      <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
        <LogIn className="size-3 shrink-0 opacity-60" />
        {formatWhen(row.lastSignInAt)}
      </span>
      <VenueBadges row={row} />
      <div className="flex justify-end">
        {clientHref ? (
          <Link
            to={clientHref}
            className="text-[11px] font-medium text-[#0f4cb8] hover:underline dark:text-blue-300"
          >
            View
          </Link>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        )}
      </div>
      <div className="flex justify-end">
        <UserActionsMenu busy={busy} onAction={onAction} />
      </div>
    </div>
  );
}
