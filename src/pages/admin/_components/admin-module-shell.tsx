import { AdminCard } from "@/pages/admin/_components/admin-card.tsx";
import { adminPageSectionClass } from "@/pages/admin/_lib/admin-ui.ts";

type AdminModuleShellProps = {
  title: string;
  description: string;
};

export function AdminModuleShell({ title, description }: AdminModuleShellProps) {
  return (
    <section className={adminPageSectionClass}>
      <AdminCard className="p-6">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </AdminCard>
    </section>
  );
}
