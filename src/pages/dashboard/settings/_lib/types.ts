export type DashboardNotificationPrefs = {
  emailNotifications: boolean;
  posAlerts: boolean;
  salesReports: boolean;
  marketingEmails: boolean;
  soundNotifications: boolean;
};

export type DashboardLoginHistoryEntry = {
  at: string;
  userAgent: string;
  ip?: string;
};

export const DEFAULT_DASHBOARD_NOTIFICATION_PREFS: DashboardNotificationPrefs = {
  emailNotifications: true,
  posAlerts: true,
  salesReports: true,
  marketingEmails: false,
  soundNotifications: true,
};

export type DashboardUserMetadata = {
  full_name?: string;
  phone?: string;
  country?: string;
  dashboard_notifications?: Partial<DashboardNotificationPrefs>;
  dashboard_login_history?: DashboardLoginHistoryEntry[];
  password_changed_at?: string;
};

export type DashboardActivityItem = {
  id: string;
  label: string;
  value: string;
  tone?: "default" | "info" | "warning";
};
