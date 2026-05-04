import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

type ActionLink = {
  label: string;
  to: string;
};

export default function SectionPageShell({
  eyebrow,
  title,
  description,
  actionLinks,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionLinks?: ActionLink[];
}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
      <header className="relative overflow-hidden rounded-2xl border border-[#315084] bg-gradient-to-br from-[#162746] via-[#10213f] to-[#0e1a31] p-6 lg:p-7">
        <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#a7b5d1]">{description}</p>
      </header>

      <section className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
        <h2 className="text-base font-semibold text-white">Coming next</h2>
        <p className="mt-2 text-sm text-[#98aac8]">
          This section is ready in navigation and can now be implemented with real data and actions.
        </p>
        {actionLinks && actionLinks.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {actionLinks.map((action) => (
              <Button
                key={action.to + action.label}
                asChild
                variant="outline"
                className="h-10 rounded-xl border-[#2c4673] bg-[#0b162b] text-white hover:bg-[#142646]"
              >
                <Link to={action.to}>
                  {action.label}
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
