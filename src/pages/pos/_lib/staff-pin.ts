/** Staff / device quick-login PIN length (alphanumeric A–Z, a–z, 0–9). */
export const STAFF_PIN_MIN_LEN = 4;
export const STAFF_PIN_MAX_LEN = 64;

export function isValidStaffPinLength(len: number): boolean {
  return len >= STAFF_PIN_MIN_LEN && len <= STAFF_PIN_MAX_LEN;
}

export function sanitizeStaffPinInput(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, STAFF_PIN_MAX_LEN);
}
