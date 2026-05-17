import { AdminUserSettingsPanel } from "./admin-user-settings-panel.tsx";
import { adminPageSectionClass } from "@/pages/admin/_lib/admin-ui.ts";

/** Dedicated admin settings — account, security, appearance, notifications. */
export function AdminSettingsHub() {
  return (
    <section className={adminPageSectionClass}>
      <AdminUserSettingsPanel />
    </section>
  );
}
