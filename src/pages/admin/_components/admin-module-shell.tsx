type AdminModuleShellProps = {
  title: string;
  description: string;
};

export function AdminModuleShell({ title, description }: AdminModuleShellProps) {
  return (
    <section className="p-6 lg:p-8">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </section>
  );
}
