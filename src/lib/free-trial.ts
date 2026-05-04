import { addMonths } from "date-fns";

/** Marketing / hero CTA — register with free-trial intent (shown in UI). */
export const FREE_TRIAL_QUERY_VALUE = "1m";

/** Stored on Supabase `user_metadata` when user signs up from a trial CTA. */
export const USER_META_APP_TRIAL = "app_trial";

export function registerUrlWithFreeTrial(): string {
  return `/register?trial=${FREE_TRIAL_QUERY_VALUE}`;
}

/** Logged-in marketing CTA: finish setup or view license with trial context in the URL. */
export function dashboardUrlWithTrial(page: "get-started" | "licenses"): string {
  return `/dashboard/${page}?trial=${FREE_TRIAL_QUERY_VALUE}`;
}

export function isFreeTrialSignupQuery(search: string): boolean {
  const q = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(q).get("trial") === FREE_TRIAL_QUERY_VALUE;
}

/** Self-serve POS license: first month free (calendar month from activation moment). */
export function defaultSelfServeTrialExpiry(): Date {
  return addMonths(new Date(), 1);
}
