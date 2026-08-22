/** Public phone origin used in customer-facing QR codes (same host as waiter pairing). */
export const VYNTEX_PHONE_PUBLIC_ORIGIN = "https://www.vyntexpos.net";

/** MPA entry for the mobile shell. Keep `.html` so hosts without a `/phone` rewrite still work. */
export const PHONE_APP_PATH = "/phone.html";

export function buildGuestMenuUrl(restaurantId: string): string {
  const id = restaurantId.trim();
  return `${VYNTEX_PHONE_PUBLIC_ORIGIN}${PHONE_APP_PATH}#/m/${encodeURIComponent(id)}`;
}
