/** Public phone origin used in customer-facing QR codes (same host as waiter pairing). */
export const VYNTEX_PHONE_PUBLIC_ORIGIN = "https://www.vyntexpos.net";

export function buildGuestMenuUrl(restaurantId: string): string {
  const id = restaurantId.trim();
  return `${VYNTEX_PHONE_PUBLIC_ORIGIN}/phone.html#/m/${encodeURIComponent(id)}`;
}
