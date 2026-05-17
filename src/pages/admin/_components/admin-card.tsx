import type { ComponentProps } from "react";
import { cn } from "@/lib/utils.ts";
import { adminCardClass, adminHeroClass, adminKpiCardClass } from "@/pages/admin/_lib/admin-ui.ts";

type AdminCardProps = ComponentProps<"div">;

export function AdminCard({ className, ...props }: AdminCardProps) {
  return <div className={cn(adminCardClass, className)} {...props} />;
}

export function AdminHero({ className, ...props }: AdminCardProps) {
  return <div className={cn(adminHeroClass, className)} {...props} />;
}

export function AdminKpiCard({ className, ...props }: AdminCardProps) {
  return <div className={cn(adminKpiCardClass, className)} {...props} />;
}
