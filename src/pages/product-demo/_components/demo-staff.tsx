import { DEMO_STAFF } from "../_data.ts";

const ROLE_LABEL: Record<(typeof DEMO_STAFF)[number]["role"], string> = {
  admin: "Admin",
  manager: "Manager",
  waiter: "Waiter",
  kitchen: "Kitchen",
};

export default function DemoStaff() {
  return (
    <div className="grid gap-2.5 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
      {DEMO_STAFF.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-3 rounded-xl border border-[#1e2a45] bg-[#131A2E] px-3.5 py-3"
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: `${member.color}33`, color: member.color }}
          >
            {member.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{member.name}</p>
            <p className="text-xs text-[#8b93a7]">{ROLE_LABEL[member.role]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
