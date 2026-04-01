import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Link } from "react-router-dom";
import {
  Users,
  KeyRound,
  MessageSquare,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

export default function AdminOverview() {
  const stats = useQuery(api.admin.getStats);

  if (stats === undefined) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      href: "/admin/users",
    },
    {
      label: "Active Licenses",
      value: stats.activeLicenses,
      icon: ShieldCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      href: "/admin/licenses",
    },
    {
      label: "Expired / Suspended",
      value: stats.expiredLicenses + stats.suspendedLicenses,
      icon: ShieldAlert,
      color: "text-amber-500",
      bg: "bg-amber-100 dark:bg-amber-900/30",
      href: "/admin/licenses",
    },
    {
      label: "New Messages",
      value: stats.newContacts,
      icon: MessageSquare,
      color: "text-purple-500",
      bg: "bg-purple-100 dark:bg-purple-900/30",
      href: "/admin/contacts",
    },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage licenses, users, and support inquiries.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.href}
            className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  card.bg
                )}
              >
                <card.icon className={cn("size-5", card.color)} />
              </div>
              <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/admin/licenses"
            className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
          >
            <KeyRound className="size-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Manage Licenses
              </p>
              <p className="text-xs text-muted-foreground">
                Activate, suspend, extend, reset devices
              </p>
            </div>
          </Link>
          <Link
            to="/admin/users"
            className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
          >
            <Users className="size-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Manage Users
              </p>
              <p className="text-xs text-muted-foreground">
                View users, assign admin roles
              </p>
            </div>
          </Link>
          <Link
            to="/admin/contacts"
            className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
          >
            <MessageSquare className="size-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Support Inbox
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.newContacts > 0
                  ? `${stats.newContacts} unread message${stats.newContacts !== 1 ? "s" : ""}`
                  : "All caught up"}
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* License breakdown */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">
          License Summary
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-emerald-500" />
            <div>
              <p className="text-lg font-bold text-foreground">
                {stats.activeLicenses}
              </p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ShieldAlert className="size-5 text-amber-500" />
            <div>
              <p className="text-lg font-bold text-foreground">
                {stats.expiredLicenses}
              </p>
              <p className="text-xs text-muted-foreground">Expired</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ShieldOff className="size-5 text-red-500" />
            <div>
              <p className="text-lg font-bold text-foreground">
                {stats.suspendedLicenses}
              </p>
              <p className="text-xs text-muted-foreground">Suspended</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      {stats.newContacts > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
          <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            You have{" "}
            <span className="font-semibold">{stats.newContacts}</span> unread
            contact message{stats.newContacts !== 1 ? "s" : ""}.{" "}
            <Link
              to="/admin/contacts"
              className="underline font-medium hover:no-underline"
            >
              View inbox
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
