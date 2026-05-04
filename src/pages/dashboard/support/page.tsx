import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { BookOpen, LifeBuoy, MessageCircleQuestion, Send, Wrench } from "lucide-react";

export default function DashboardSupportPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-2xl border border-[#315084] bg-gradient-to-br from-[#162746] via-[#10213f] to-[#0e1a31] p-6 lg:p-7">
        <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          Support
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">Tickets, Chat and Documentation</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#a7b5d1]">
          Get help quickly with activation, licensing, downloads, billing, and troubleshooting.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/85">
            <MessageCircleQuestion className="size-4 text-[#66b3ff]" />
            Help Categories
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#2c4673] bg-[#0b162b] p-3">
              <p className="text-sm font-medium text-white">License & Activation</p>
              <p className="mt-1 text-xs text-[#98aac8]">
                Key issues, expired license, and activation resets.
              </p>
            </div>
            <div className="rounded-xl border border-[#2c4673] bg-[#0b162b] p-3">
              <p className="text-sm font-medium text-white">Downloads & Install</p>
              <p className="mt-1 text-xs text-[#98aac8]">
                Installer compatibility, updates, and device setup.
              </p>
            </div>
            <div className="rounded-xl border border-[#2c4673] bg-[#0b162b] p-3">
              <p className="text-sm font-medium text-white">Billing</p>
              <p className="mt-1 text-xs text-[#98aac8]">
                Invoices, payment methods, and subscription changes.
              </p>
            </div>
            <div className="rounded-xl border border-[#2c4673] bg-[#0b162b] p-3">
              <p className="text-sm font-medium text-white">Technical Issues</p>
              <p className="mt-1 text-xs text-[#98aac8]">
                Printing, syncing, crashes, and performance troubleshooting.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <h3 className="text-base font-semibold text-white">Support Actions</h3>
          <div className="mt-4 space-y-3">
            <Button asChild className="w-full justify-start gap-2 rounded-xl">
              <Link to="/contact">
                <Send className="size-4" />
                Open Contact Page
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start gap-2 rounded-xl border-[#2c4673] bg-[#0b162b] text-white hover:bg-[#142646]"
            >
              <Link to="/dashboard/downloads">
                <Wrench className="size-4" />
                Open Downloads
              </Link>
            </Button>
          </div>

          <div className="mt-5 space-y-2 rounded-xl border border-[#2c4673] bg-[#0b162b] p-3 text-xs text-[#9cb0d0]">
            <p className="flex items-center gap-2 font-medium text-white/85">
              <LifeBuoy className="size-3.5 text-[#66b3ff]" />
              Faster Support Tips
            </p>
            <p>Include your license key and a screenshot when opening a ticket.</p>
            <p className="mt-2 flex items-center gap-2 font-medium text-white/85">
              <BookOpen className="size-3.5 text-[#66b3ff]" />
              Documentation
            </p>
            <p>Use the setup guides first for installation and activation steps.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
