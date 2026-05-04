import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { KeyRound, LockKeyhole, Monitor, ShieldCheck, Users } from "lucide-react";

export default function DashboardSecurityPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-2xl border border-[#315084] bg-gradient-to-br from-[#162746] via-[#10213f] to-[#0e1a31] p-6 lg:p-7">
        <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          Security
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">Password, 2FA and Session Controls</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#a7b5d1]">
          Centralize account security, strengthen authentication, and monitor active access.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/85">
            <ShieldCheck className="size-4 text-[#66b3ff]" />
            Security Checklist
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-[#2c4673] bg-[#0b162b] p-3 text-sm text-white">
              <p className="font-medium">Password</p>
              <p className="mt-1 text-xs text-[#98aac8]">
                Use a strong password and rotate it periodically.
              </p>
            </div>
            <div className="rounded-xl border border-[#2c4673] bg-[#0b162b] p-3 text-sm text-white">
              <p className="font-medium">Two-Factor Authentication</p>
              <p className="mt-1 text-xs text-[#98aac8]">
                Enable 2FA for owner and admin-level accounts.
              </p>
            </div>
            <div className="rounded-xl border border-[#2c4673] bg-[#0b162b] p-3 text-sm text-white">
              <p className="font-medium">Session Monitoring</p>
              <p className="mt-1 text-xs text-[#98aac8]">
                Revoke sessions on devices you no longer recognize.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <h3 className="text-base font-semibold text-white">Security Actions</h3>
          <div className="mt-4 space-y-3">
            <Button asChild className="w-full justify-start gap-2 rounded-xl">
              <Link to="/dashboard/settings">
                <LockKeyhole className="size-4" />
                Manage Password
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start gap-2 rounded-xl border-[#2c4673] bg-[#0b162b] text-white hover:bg-[#142646]"
            >
              <Link to="/dashboard/team-access">
                <Users className="size-4" />
                Review Team Access
              </Link>
            </Button>
          </div>

          <div className="mt-5 rounded-xl border border-[#2c4673] bg-[#0b162b] p-3 text-xs text-[#9cb0d0]">
            <p className="flex items-center gap-2 text-white/85">
              <Monitor className="size-3.5 text-[#66b3ff]" />
              Trusted Devices
            </p>
            <p className="mt-1">Only keep active sessions on known workstations used by your team.</p>
            <p className="mt-3 flex items-center gap-2 text-white/85">
              <KeyRound className="size-3.5 text-[#66b3ff]" />
              Access Hygiene
            </p>
            <p className="mt-1">Remove old team members immediately after offboarding.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
