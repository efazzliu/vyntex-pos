import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { KeyRound, MailPlus, ShieldCheck, UserCog, Users } from "lucide-react";

const MOCK_MEMBERS = [
  { name: "Owner Account", email: "owner@company.com", role: "Owner", status: "Active" },
  { name: "Manager Account", email: "manager@company.com", role: "Admin", status: "Active" },
  { name: "Support Viewer", email: "viewer@company.com", role: "Viewer", status: "Pending" },
];

export default function DashboardTeamAccessPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-2xl border border-[#315084] bg-gradient-to-br from-[#162746] via-[#10213f] to-[#0e1a31] p-6 lg:p-7">
        <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          Team Access
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">Control Who Can Access This Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#a7b5d1]">
          Invite trusted members, assign roles, and keep account-level permissions under control.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/85">
            <Users className="size-4 text-[#66b3ff]" />
            Team Members
          </div>
          <div className="space-y-3">
            {MOCK_MEMBERS.map((member) => (
              <div
                key={member.email}
                className="flex items-center justify-between rounded-xl border border-[#2c4673] bg-[#0b162b] p-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{member.name}</p>
                  <p className="text-xs text-[#98aac8]">{member.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-white/85">{member.role}</p>
                  <p
                    className={
                      member.status === "Active" ? "text-xs text-emerald-300" : "text-xs text-amber-300"
                    }
                  >
                    {member.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#2c4673] bg-[#121f38] p-6">
          <h3 className="text-base font-semibold text-white">Access Actions</h3>
          <div className="mt-4 space-y-3">
            <Button className="w-full justify-start gap-2 rounded-xl">
              <MailPlus className="size-4" />
              Invite New Member
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start gap-2 rounded-xl border-[#2c4673] bg-[#0b162b] text-white hover:bg-[#142646]"
            >
              <Link to="/dashboard/security">
                <ShieldCheck className="size-4" />
                Open Security Settings
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start gap-2 rounded-xl border-[#2c4673] bg-[#0b162b] text-white hover:bg-[#142646]"
            >
              <Link to="/dashboard/support">
                <UserCog className="size-4" />
                Contact Admin Support
              </Link>
            </Button>
          </div>

          <div className="mt-5 rounded-xl border border-[#2c4673] bg-[#0b162b] p-3 text-xs text-[#9cb0d0]">
            <p className="flex items-center gap-2 font-medium text-white/85">
              <KeyRound className="size-3.5 text-[#66b3ff]" />
              Access Policy
            </p>
            <p className="mt-1">
              Use unique user accounts for dashboard access. Never share owner credentials.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
