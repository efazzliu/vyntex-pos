import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { BadgeEuro, CreditCard, Download, ExternalLink, FileText, Sparkles } from "lucide-react";

const MOCK_INVOICES = [
  { id: "INV-2026-003", period: "Mar 2026", amount: "€39.00", status: "Paid" },
  { id: "INV-2026-002", period: "Feb 2026", amount: "€39.00", status: "Paid" },
  { id: "INV-2026-001", period: "Jan 2026", amount: "€39.00", status: "Paid" },
];

export default function DashboardBillingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-2xl border border-[#315084] bg-gradient-to-br from-[#162746] via-[#10213f] to-[#0e1a31] p-6 lg:p-7">
        <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          Billing
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">Invoices, Payment Methods and Subscription</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#a7b5d1]">
          Review recent invoices, update payment details, and manage your active plan from one
          place.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/85">
            <FileText className="size-4 text-[#66b3ff]" />
            Recent Invoices
          </div>
          <div className="space-y-3">
            {MOCK_INVOICES.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between rounded-xl border border-[#2c4673] bg-[#0b162b] p-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{invoice.id}</p>
                  <p className="text-xs text-[#98aac8]">{invoice.period}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{invoice.amount}</p>
                    <p className="text-xs text-emerald-300">{invoice.status}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#2c4673] bg-[#13213d] text-white hover:bg-[#1a2f55]"
                  >
                    <Download className="mr-1 size-3.5" />
                    PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <h3 className="text-base font-semibold text-white">Subscription Actions</h3>
          <div className="mt-4 space-y-3">
            <Button asChild className="w-full justify-start gap-2 rounded-xl">
              <Link to="/pricing">
                <Sparkles className="size-4" />
                Upgrade Plan
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start gap-2 rounded-xl border-[#2c4673] bg-[#0b162b] text-white hover:bg-[#142646]"
            >
              <Link to="/dashboard/settings">
                <CreditCard className="size-4" />
                Update Payment Method
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start gap-2 rounded-xl border-[#2c4673] bg-[#0b162b] text-white hover:bg-[#142646]"
            >
              <Link to="/contact">
                <ExternalLink className="size-4" />
                Contact Billing Support
              </Link>
            </Button>
          </div>

          <div className="mt-5 rounded-xl border border-[#2c4673] bg-[#0b162b] p-3 text-sm text-[#9cb0d0]">
            <p className="flex items-center gap-2 font-medium text-white/85">
              <BadgeEuro className="size-4 text-[#66b3ff]" />
              Active Plan: Professional
            </p>
            <p className="mt-1 text-xs">Billed monthly. Next invoice will be generated automatically.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
